import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameRegistry } from "@party-games/game-core";
import {
  CreateRoomRequestSchema,
  type GameType,
  type RoomSessionResponse
} from "@party-games/shared";
import { afterEach, describe, expect, it } from "vitest";
import { PokerGameModule } from "../src/games/poker.js";
import type { ServerGameModule } from "../src/platform/game-module.js";
import { PresenceTracker } from "../src/presence.js";
import { SqliteRoomRepository } from "../src/repository.js";
import { RoomService } from "../src/room-service.js";

const tempDirectories: string[] = [];
const openRepositories = new Set<SqliteRoomRepository>();

afterEach(() => {
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
  }
): Promise<{ owner: RoomSessionResponse; second: RoomSessionResponse }> {
  const owner = await service.createRoom({
    gameType: "poker",
    nickname: "Owner",
    password: "secret",
    poker
  });
  const second = await service.joinRoom({
    roomCode: owner.roomCode,
    nickname: "Player 2",
    password: "secret"
  });
  await service.setSeat(owner.roomCode, owner.playerId, 1);
  await service.setSeat(owner.roomCode, second.playerId, 2);
  await service.setReady(owner.roomCode, owner.playerId, true);
  await service.setReady(owner.roomCode, second.playerId, true);
  await service.startRoom(owner.roomCode, owner.playerId);
  return { owner, second };
}

describe("poker server module", () => {
  it("validates poker room parameters while keeping the default registry closed", async () => {
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

    const { repository } = createRepository();
    const defaultService = new RoomService(repository, new PresenceTracker());
    await expect(
      defaultService.createRoom({
        gameType: "poker",
        nickname: "Owner",
        password: "secret",
        poker: { mode: "points", smallBlind: 5, bigBlind: 10 }
      })
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
    expect(JSON.stringify(ownerView)).not.toContain("tableSeed");
    expect(JSON.stringify(ownerView)).not.toContain('"deck"');

    const actionPlayerId = ownerView.room.pokerTable?.actionPlayerId;
    if (!actionPlayerId) throw new Error("德扑测试牌局缺少行动玩家");
    await service.actPoker(owner.roomCode, actionPlayerId, "fold");
    const settledView = service.getView(owner.roomCode, owner.playerId);
    expect(settledView.room.pokerTable?.status).toBe("waiting-hand");

    closeRepository(repository);
    ({ repository } = createRepository(context.databasePath));
    service = new RoomService(repository, new PresenceTracker(), pokerRegistry());
    const restoredView = service.getView(owner.roomCode, owner.playerId);
    expect(restoredView.room.pokerTable).toEqual(settledView.room.pokerTable);
    expect(restoredView.room.version).toBe(settledView.room.version);
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
});
