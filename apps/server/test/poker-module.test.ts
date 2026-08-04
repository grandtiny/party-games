import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameRegistry } from "@party-games/game-core";
import {
  CreateRoomRequestSchema,
  type GameType,
  type RoomSessionResponse
} from "@party-games/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  POKER_ACTION_TIMEOUT_MS,
  POKER_BOT_ACTION_DELAY_MS,
  PokerGameModule
} from "../src/games/poker.js";
import { createGameRegistry } from "../src/games/index.js";
import type { ServerGameModule } from "../src/platform/game-module.js";
import { PresenceTracker } from "../src/presence.js";
import { SqliteRoomRepository } from "../src/repository.js";
import { RoomService } from "../src/room-service.js";
import { testAccount } from "./test-account.js";

const tempDirectories: string[] = [];
const openRepositories = new Set<SqliteRoomRepository>();

afterEach(() => {
  vi.useRealTimers();
  for (const repository of openRepositories) repository.close();
  openRepositories.clear();
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function pokerRegistry(): GameRegistry<GameType, ServerGameModule> {
  return new GameRegistry<GameType, ServerGameModule>([new PokerGameModule()]);
}

function createRepository(databasePath?: string): {
  databasePath: string;
  repository: SqliteRoomRepository;
} {
  const resolvedPath = databasePath ?? (() => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-poker-test-"));
    tempDirectories.push(directory);
    return join(directory, "test.sqlite");
  })();
  const repository = new SqliteRoomRepository(resolvedPath);
  openRepositories.add(repository);
  return { databasePath: resolvedPath, repository };
}

function closeRepository(repository: SqliteRoomRepository): void {
  if (!openRepositories.delete(repository)) return;
  repository.close();
}

async function createStartedPokerRoom(
  service: RoomService,
  poker: {
    mode: "points" | "tournament";
    smallBlind: number;
    bigBlind: number;
    blindStructure?: Array<{ smallBlind: number; bigBlind: number; ante: number }>;
    blindAdvanceMode?: "manual" | "automatic";
    blindLevelDurationMinutes?: number;
  }
): Promise<{ owner: RoomSessionResponse; second: RoomSessionResponse }> {
  const owner = await service.createRoom({
    gameType: "poker",
    nickname: "Owner",
    password: "secret",
    poker
  }, testAccount("Owner"));
  const second = await service.joinRoom({
    roomCode: owner.roomCode,
    nickname: "Player 2",
    password: "secret"
  }, testAccount("Player 2"));
  await service.setSeat(owner.roomCode, owner.playerId, 1);
  await service.setSeat(owner.roomCode, second.playerId, 2);
  await service.setReady(owner.roomCode, owner.playerId, true);
  await service.setReady(owner.roomCode, second.playerId, true);
  await service.startRoom(owner.roomCode, owner.playerId);
  return { owner, second };
}

describe("poker server module", () => {
  it("validates poker room parameters while keeping the default registry closed", async () => {
    expect(createGameRegistry().has("poker")).toBe(false);
    expect(createGameRegistry({ pokerEnabled: true }).has("poker")).toBe(true);
    expect(
      CreateRoomRequestSchema.safeParse({
        gameType: "poker",
        nickname: "Owner",
        password: "secret",
        poker: { mode: "tournament", smallBlind: 5, bigBlind: 10 }
      }).success
    ).toBe(false);
    expect(
      CreateRoomRequestSchema.safeParse({
        gameType: "poker",
        nickname: "Owner",
        password: "secret",
        poker: { mode: "points", smallBlind: 5, bigBlind: 10 }
      }).success
    ).toBe(true);
    expect(
      CreateRoomRequestSchema.safeParse({
        gameType: "poker",
        nickname: "Owner",
        password: "secret",
        poker: {
          mode: "tournament",
          smallBlind: 5,
          bigBlind: 10,
          blindStructure: [{ smallBlind: 5, bigBlind: 10, ante: 0 }],
          blindAdvanceMode: "automatic"
        }
      }).success
    ).toBe(false);

    const { repository } = createRepository();
    const defaultService = new RoomService(repository, new PresenceTracker());
    await expect(
      defaultService.createRoom(
        {
          gameType: "poker",
          nickname: "Owner",
          password: "secret",
          poker: { mode: "points", smallBlind: 5, bigBlind: 10 }
        },
        testAccount("Owner")
      )
    ).rejects.toThrow("德州扑克模块尚未开放");
  });

  it("runs a points hand with private projections and restores it from SQLite", async () => {
    const context = createRepository();
    let repository = context.repository;
    let service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const { owner, second } = await createStartedPokerRoom(service, {
      mode: "points",
      smallBlind: 5,
      bigBlind: 10
    });

    const waitingView = service.getView(owner.roomCode, owner.playerId);
    expect(waitingView.room.phase).toBe("playing");
    expect(waitingView.room.pokerTable?.players.map((player) => player.stack)).toEqual([500, 500]);
    await expect(service.dealPokerHand(owner.roomCode, second.playerId)).rejects.toThrow(
      "只有房主可以执行该操作"
    );
    await service.dealPokerHand(owner.roomCode, owner.playerId);

    const ownerView = service.getView(owner.roomCode, owner.playerId);
    const secondView = service.getView(owner.roomCode, second.playerId);
    expect(ownerView.room.pokerTable?.players[0]?.hand).toHaveLength(2);
    expect(ownerView.room.pokerTable?.players[1]?.hand).toBeNull();
    expect(secondView.room.pokerTable?.players[0]?.hand).toBeNull();
    expect(secondView.room.pokerTable?.players[1]?.hand).toHaveLength(2);
    expect(ownerView.room.pokerTable).toMatchObject({
      buttonPlayerId: owner.playerId,
      smallBlindPlayerId: owner.playerId,
      bigBlindPlayerId: second.playerId
    });
    expect(JSON.stringify(ownerView)).not.toContain("tableSeed");
    expect(JSON.stringify(ownerView)).not.toContain('"deck"');

    closeRepository(repository);
    ({ repository } = createRepository(context.databasePath));
    service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const restoredOwnerView = service.getView(owner.roomCode, owner.playerId);
    const restoredSecondView = service.getView(owner.roomCode, second.playerId);
    expect(restoredOwnerView.room.pokerTable).toEqual(ownerView.room.pokerTable);
    expect(restoredOwnerView.self.poker).toEqual(ownerView.self.poker);
    expect(restoredSecondView.room.pokerTable).toEqual(secondView.room.pokerTable);
    expect(restoredOwnerView.room.version).toBe(ownerView.room.version);

    const actionPlayerId = restoredOwnerView.room.pokerTable?.actionPlayerId;
    if (!actionPlayerId) throw new Error("德扑测试牌局缺少行动玩家");
    await service.actPoker(owner.roomCode, actionPlayerId, "fold");
    const settledView = service.getView(owner.roomCode, owner.playerId);
    expect(settledView.room.pokerTable?.status).toBe("waiting-hand");
    expect(settledView.room.pokerTable?.totalPot).toBe(10);
    expect(settledView.room.pokerTable?.actionHistory).toEqual([
      expect.objectContaining({ action: "fold", playerId: actionPlayerId, potAfter: 15 }),
      expect.objectContaining({ action: "uncalled-return", amount: 5, potAfter: 10 })
    ]);
  });

  it("runs a solo room with deterministic AI opponents", async () => {
    vi.useFakeTimers();
    const { repository } = createRepository();
    const service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const owner = await service.createRoom(
      {
        gameType: "poker",
        nickname: "Solo Player",
        password: "secret",
        poker: {
          mode: "points",
          smallBlind: 5,
          bigBlind: 10,
          aiPlayerCount: 3,
          aiDifficulty: "hard"
        }
      },
      testAccount("Solo Player")
    );

    const lobby = service.getView(owner.roomCode, owner.playerId);
    expect(lobby.room.pokerConfig?.aiDifficulty).toBe("hard");
    expect(lobby.room.players).toHaveLength(4);
    expect(lobby.room.players[0]).toMatchObject({
      id: owner.playerId,
      seat: 1,
      ready: true
    });
    expect(lobby.room.players.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isBot: true, seat: 2, ready: true }),
        expect.objectContaining({ isBot: true, seat: 3, ready: true }),
        expect.objectContaining({ isBot: true, seat: 4, ready: true })
      ])
    );
    await expect(
      service.joinRoom(
        {
          roomCode: owner.roomCode,
          nickname: "Unexpected Player",
          password: "secret"
        },
        testAccount("Unexpected Player")
      )
    ).rejects.toThrow("单人 AI 房间不接受其他玩家加入");

    await service.startRoom(owner.roomCode, owner.playerId);
    await service.dealPokerHand(owner.roomCode, owner.playerId);
    let view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable?.status).toBe("in-hand");
    const firstBotPlayerId = view.room.pokerTable?.actionPlayerId;
    expect(
      view.room.players.find((player) => player.id === firstBotPlayerId)?.isBot
    ).toBe(true);
    expect(view.self.poker?.legalActions).toBeUndefined();
    expect(view.room.pokerTable?.actionHistory).toHaveLength(0);

    const dealtState = repository.getRoom(owner.roomCode);
    if (!dealtState?.poker?.actionTimer) throw new Error("单人 AI 测试房间缺少行动计时器");
    const firstBotDueAt =
      dealtState.poker.actionTimer.deadlineAt -
      POKER_ACTION_TIMEOUT_MS +
      POKER_BOT_ACTION_DELAY_MS;
    vi.setSystemTime(firstBotDueAt - 1);
    expect(await service.tickActiveGames(firstBotDueAt - 1)).toEqual([]);
    vi.setSystemTime(firstBotDueAt);
    expect(await service.tickActiveGames(firstBotDueAt)).toEqual([owner.roomCode]);

    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable?.actionPlayerId).toBe(owner.playerId);
    expect(view.self.poker?.legalActions).toBeDefined();
    expect(
      view.room.pokerTable?.actionHistory.some((record) =>
        view.room.players.some(
          (player) => player.isBot && player.id === record.playerId
        )
      )
    ).toBe(true);

    const legalActions = view.self.poker?.legalActions;
    expect(legalActions?.actions).toContain("call");
    const historyBeforeHumanAction = view.room.pokerTable?.actionHistory.length ?? 0;
    await service.actPoker(owner.roomCode, owner.playerId, "call");
    view = service.getView(owner.roomCode, owner.playerId);
    const queuedBotPlayerId = view.room.pokerTable?.actionPlayerId;
    expect(
      view.room.players.find((player) => player.id === queuedBotPlayerId)?.isBot
    ).toBe(true);
    expect(view.room.pokerTable?.actionHistory).toHaveLength(historyBeforeHumanAction + 1);

    const queuedBotState = repository.getRoom(owner.roomCode);
    if (!queuedBotState?.poker?.actionTimer) {
      throw new Error("单人 AI 测试房间缺少排队行动计时器");
    }
    const historyBeforeBotAction = view.room.pokerTable?.actionHistory.length ?? 0;
    const queuedBotDueAt =
      queuedBotState.poker.actionTimer.deadlineAt -
      POKER_ACTION_TIMEOUT_MS +
      POKER_BOT_ACTION_DELAY_MS;
    vi.setSystemTime(queuedBotDueAt);
    await service.tickActiveGames(queuedBotDueAt);
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable?.actionHistory).toHaveLength(historyBeforeBotAction + 1);
    expect(view.room.pokerTable?.actionHistory.at(-1)?.playerId).toBe(queuedBotPlayerId);

    for (let step = 0; step < 12; step += 1) {
      if (
        view.room.pokerTable?.status !== "in-hand" ||
        view.room.pokerTable.actionPlayerId === owner.playerId
      ) {
        break;
      }
      const actorPlayerId = view.room.pokerTable.actionPlayerId;
      expect(view.room.players.find((player) => player.id === actorPlayerId)?.isBot).toBe(true);
      const state = repository.getRoom(owner.roomCode);
      if (!state?.poker?.actionTimer) throw new Error("单人 AI 测试房间缺少连续行动计时器");
      const botDueAt =
        state.poker.actionTimer.deadlineAt -
        POKER_ACTION_TIMEOUT_MS +
        POKER_BOT_ACTION_DELAY_MS;
      vi.setSystemTime(botDueAt);
      await service.tickActiveGames(botDueAt);
      view = service.getView(owner.roomCode, owner.playerId);
    }

    expect(["in-hand", "waiting-hand"]).toContain(view.room.pokerTable?.status);
    if (view.room.pokerTable?.status === "in-hand") {
      expect(view.room.pokerTable.actionPlayerId).toBe(owner.playerId);
      expect(view.self.poker?.legalActions).toBeDefined();
    }
  });

  it("checks or folds for a human player after the 15 second action deadline", async () => {
    vi.useFakeTimers();
    const { repository } = createRepository();
    const service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const { owner } = await createStartedPokerRoom(service, {
      mode: "points",
      smallBlind: 5,
      bigBlind: 10
    });

    await service.dealPokerHand(owner.roomCode, owner.playerId);
    let view = service.getView(owner.roomCode, owner.playerId);
    const firstActorPlayerId = view.room.pokerTable?.actionPlayerId;
    const firstDeadlineAt = view.room.pokerTable?.actionDeadlineAt;
    if (!firstActorPlayerId || !firstDeadlineAt) {
      throw new Error("超时测试缺少首个行动玩家或截止时间");
    }
    const dealtState = repository.getRoom(owner.roomCode);
    if (!dealtState?.poker?.actionTimer) throw new Error("超时测试缺少持久化计时器");
    expect(dealtState.poker.actionTimer).toEqual({
      playerId: firstActorPlayerId,
      deadlineAt: firstDeadlineAt
    });
    expect(
      firstDeadlineAt - Date.parse(dealtState.updatedAt)
    ).toBeGreaterThanOrEqual(POKER_ACTION_TIMEOUT_MS - 100);
    vi.setSystemTime(firstDeadlineAt - 1);
    expect(await service.tickActiveGames(firstDeadlineAt - 1)).toEqual([]);
    vi.setSystemTime(firstDeadlineAt);
    await expect(
      service.actPoker(owner.roomCode, firstActorPlayerId, "fold")
    ).rejects.toThrow("行动时间已结束");
    expect(await service.tickActiveGames(firstDeadlineAt)).toEqual([owner.roomCode]);

    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable?.status).toBe("waiting-hand");
    expect(view.room.pokerTable?.actionDeadlineAt).toBeUndefined();
    expect(view.room.pokerTable?.actionHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: firstActorPlayerId, action: "fold" })
      ])
    );

    await service.dealPokerHand(owner.roomCode, owner.playerId);
    view = service.getView(owner.roomCode, owner.playerId);
    const callerPlayerId = view.room.pokerTable?.actionPlayerId;
    if (!callerPlayerId) throw new Error("超时过牌测试缺少跟注玩家");
    expect(
      service.getView(owner.roomCode, callerPlayerId).self.poker?.legalActions?.actions
    ).toContain("call");
    await service.actPoker(owner.roomCode, callerPlayerId, "call");

    view = service.getView(owner.roomCode, owner.playerId);
    const checkingPlayerId = view.room.pokerTable?.actionPlayerId;
    const checkDeadlineAt = view.room.pokerTable?.actionDeadlineAt;
    if (!checkingPlayerId || !checkDeadlineAt) {
      throw new Error("超时过牌测试缺少行动玩家或截止时间");
    }
    expect(
      service.getView(owner.roomCode, checkingPlayerId).self.poker?.legalActions?.actions
    ).toContain("check");
    vi.setSystemTime(checkDeadlineAt);
    await service.tickActiveGames(checkDeadlineAt);

    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable?.actionHistory.at(-1)).toMatchObject({
      playerId: checkingPlayerId,
      action: "check"
    });
    expect(view.room.pokerTable?.status).toBe("in-hand");
    expect(view.room.pokerTable?.actionDeadlineAt).toBeGreaterThan(checkDeadlineAt);
  });

  it("advances tournament blinds through the owner-only service boundary", async () => {
    const { repository } = createRepository();
    const service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const { owner, second } = await createStartedPokerRoom(service, {
      mode: "tournament",
      smallBlind: 5,
      bigBlind: 10,
      blindStructure: [
        { smallBlind: 5, bigBlind: 10, ante: 0 },
        { smallBlind: 10, bigBlind: 20, ante: 2 }
      ]
    });

    await expect(service.advancePokerBlinds(owner.roomCode, second.playerId)).rejects.toThrow(
      "只有房主可以执行该操作"
    );
    await service.advancePokerBlinds(owner.roomCode, owner.playerId);
    expect(service.getView(owner.roomCode, owner.playerId).room.pokerTable).toMatchObject({
      blindLevel: 1,
      smallBlind: 10,
      bigBlind: 20,
      ante: 2
    });
  });

  it("persists optional automatic blinds and applies due levels only before the next hand", async () => {
    const context = createRepository();
    let repository = context.repository;
    let service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const { owner, second } = await createStartedPokerRoom(service, {
      mode: "tournament",
      smallBlind: 5,
      bigBlind: 10,
      blindStructure: [
        { smallBlind: 5, bigBlind: 10, ante: 0 },
        { smallBlind: 10, bigBlind: 20, ante: 2 },
        { smallBlind: 20, bigBlind: 40, ante: 4 }
      ],
      blindAdvanceMode: "automatic",
      blindLevelDurationMinutes: 1
    });

    await expect(service.pausePokerBlinds(owner.roomCode, second.playerId)).rejects.toThrow(
      "只有房主可以执行该操作"
    );
    await service.pausePokerBlinds(owner.roomCode, owner.playerId);
    let view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable?.blindTimer).toMatchObject({ status: "paused" });
    const pausedRemainingMs = view.room.pokerTable?.blindTimer?.remainingMs;
    expect(pausedRemainingMs).toBeGreaterThan(0);

    closeRepository(repository);
    ({ repository } = createRepository(context.databasePath));
    service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable?.blindTimer).toEqual({
      status: "paused",
      remainingMs: pausedRemainingMs
    });
    expect(await service.tickActiveGames(Date.now() + 10 * 60_000)).toEqual([]);

    await service.resumePokerBlinds(owner.roomCode, owner.playerId);
    let state = repository.getRoom(owner.roomCode);
    if (!state?.poker?.blindTimer?.nextLevelAt) {
      throw new Error("自动盲注恢复后缺少截止时间");
    }
    expect(await service.tickActiveGames(state.poker.blindTimer.nextLevelAt)).toEqual([
      owner.roomCode
    ]);
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable).toMatchObject({
      blindLevel: 0,
      smallBlind: 5,
      bigBlind: 10,
      blindTimer: { status: "pending" }
    });
    await expect(service.advancePokerBlinds(owner.roomCode, owner.playerId)).rejects.toThrow(
      "自动盲注模式不能手动提升级别"
    );

    await service.dealPokerHand(owner.roomCode, owner.playerId);
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable).toMatchObject({
      status: "in-hand",
      blindLevel: 1,
      smallBlind: 10,
      bigBlind: 20,
      ante: 2,
      blindTimer: { status: "running" }
    });

    state = repository.getRoom(owner.roomCode);
    if (!state?.poker?.blindTimer?.nextLevelAt) {
      throw new Error("第二级自动盲注缺少截止时间");
    }
    await service.tickActiveGames(state.poker.blindTimer.nextLevelAt);
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable).toMatchObject({
      status: "in-hand",
      blindLevel: 1,
      smallBlind: 10,
      bigBlind: 20,
      blindTimer: { status: "pending" }
    });

    const actionPlayerId = view.room.pokerTable?.actionPlayerId;
    if (!actionPlayerId) throw new Error("自动盲注测试缺少行动玩家");
    await service.actPoker(owner.roomCode, actionPlayerId, "fold");
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.pokerTable).toMatchObject({
      status: "waiting-hand",
      blindLevel: 1,
      blindTimer: { status: "pending" }
    });

    await service.dealPokerHand(owner.roomCode, owner.playerId);
    expect(service.getView(owner.roomCode, owner.playerId).room.pokerTable).toMatchObject({
      status: "in-hand",
      blindLevel: 2,
      smallBlind: 20,
      bigBlind: 40,
      ante: 4,
      blindTimer: { status: "finished" }
    });
  });

  it("records tournament places and lets only the owner start a fresh match", async () => {
    const { repository } = createRepository();
    const service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const { owner, second } = await createStartedPokerRoom(service, {
      mode: "tournament",
      smallBlind: 250,
      bigBlind: 500,
      blindStructure: [{ smallBlind: 250, bigBlind: 500, ante: 0 }]
    });

    await service.dealPokerHand(owner.roomCode, owner.playerId);
    const actionPlayerId = service.getView(owner.roomCode, owner.playerId).room.pokerTable
      ?.actionPlayerId;
    if (!actionPlayerId) throw new Error("淘汰赛测试缺少行动玩家");
    await service.actPoker(owner.roomCode, actionPlayerId, "call");
    const completeView = service.getView(owner.roomCode, owner.playerId);
    expect(completeView.room.phase).toBe("game-over");
    expect(
      completeView.room.pokerTable?.players.map((player) => player.finishPlace).sort()
    ).toEqual([1, 2]);

    await expect(service.rematchPoker(owner.roomCode, second.playerId)).rejects.toThrow(
      "只有房主可以执行该操作"
    );
    await service.rematchPoker(owner.roomCode, owner.playerId);
    const rematchView = service.getView(owner.roomCode, owner.playerId);
    expect(rematchView.room.phase).toBe("playing");
    expect(rematchView.room.pokerTable).toMatchObject({
      status: "waiting-hand",
      handNumber: 0
    });
    expect(rematchView.room.pokerTable?.players).toEqual([
      expect.objectContaining({ stack: 500, buyIns: 1 }),
      expect.objectContaining({ stack: 500, buyIns: 1 })
    ]);
    expect(
      rematchView.room.pokerTable?.players.every(
        (player) => player.finishPlace === undefined
      )
    ).toBe(true);
  });
});
