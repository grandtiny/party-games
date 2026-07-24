import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreateRoomRequestSchema } from "@party-games/shared";
import { afterEach, describe, expect, it } from "vitest";
import { createGameRegistry } from "../src/games/index.js";
import type { TurtleSoupAiAdapter } from "../src/games/turtle-soup-ai.js";
import { PresenceTracker } from "../src/presence.js";
import { SqliteRoomRepository } from "../src/repository.js";
import { RoomService } from "../src/room-service.js";

const cleanupTasks: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanupTasks.splice(0).reverse()) cleanup();
});

function createService(ai?: TurtleSoupAiAdapter) {
  const directory = mkdtempSync(join(tmpdir(), "party-games-turtle-soup-test-"));
  const repository = new SqliteRoomRepository(join(directory, "test.sqlite"));
  cleanupTasks.push(() => {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return new RoomService(
    repository,
    new PresenceTracker(),
    createGameRegistry({ pokerEnabled: true, ...(ai ? { turtleSoupAi: ai } : {}) })
  );
}

describe("turtle soup server module", () => {
  it("starts from the lobby and keeps the answer hidden until solved", async () => {
    expect(
      CreateRoomRequestSchema.safeParse({
        gameType: "turtle-soup",
        nickname: "Owner",
        password: "secret"
      }).success
    ).toBe(true);

    const service = createService();
    const owner = await service.createRoom({
      gameType: "turtle-soup",
      nickname: "Owner",
      password: "secret"
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

    let ownerView = service.getView(owner.roomCode, owner.playerId);
    expect(ownerView.room.phase).toBe("playing");
    expect(ownerView.room.turtleSoup).toMatchObject({
      source: "local",
      judgeSource: "local",
      status: "playing",
      questionCount: 0,
      hintsUsed: 0
    });
    expect(ownerView.room.turtleSoup?.surface.length).toBeGreaterThan(10);
    expect(ownerView.room.turtleSoup?.answer).toBeUndefined();
    expect(
      ownerView.room.turtleSoup?.keyPoints.every((keyPoint) => keyPoint.text === undefined)
    ).toBe(true);
    expect(JSON.stringify(ownerView)).not.toContain("answer");

    await service.askTurtleSoup(owner.roomCode, second.playerId, "这件事和伞或证件有关吗？");
    await service.requestTurtleSoupHint(owner.roomCode, owner.playerId);
    ownerView = service.getView(owner.roomCode, owner.playerId);
    expect(ownerView.room.turtleSoup?.questionCount).toBe(1);
    expect(ownerView.room.turtleSoup?.hintsUsed).toBe(1);
    expect(ownerView.room.turtleSoup?.log.some((entry) => entry.kind === "hint")).toBe(true);

    await service.guessTurtleSoup(
      owner.roomCode,
      second.playerId,
      "他个子矮，平时按不到电梯楼层按钮，雨天可以用伞按按钮。也可能是陌生人冒充他，拿了证件外套，想骗开门入室。"
    );
    ownerView = service.getView(owner.roomCode, owner.playerId);
    expect(ownerView.room.phase).toBe("game-over");
    expect(ownerView.room.turtleSoup?.status).toBe("solved");
    expect(ownerView.room.turtleSoup?.answer).toBeTruthy();
    expect(ownerView.room.turtleSoup?.solvedByPlayerId).toBe(second.playerId);
    expect(
      ownerView.room.turtleSoup?.keyPoints.every(
        (keyPoint) => keyPoint.found && keyPoint.text
      )
    ).toBe(true);
  });

  it("lets only the owner reset a solved soup", async () => {
    const service = createService();
    const owner = await service.createRoom({
      gameType: "turtle-soup",
      nickname: "Owner",
      password: "secret"
    });
    await service.setSeat(owner.roomCode, owner.playerId, 1);
    await service.setReady(owner.roomCode, owner.playerId, true);
    await service.startRoom(owner.roomCode, owner.playerId);
    await service.guessTurtleSoup(
      owner.roomCode,
      owner.playerId,
      "个子矮按不到按钮，用伞按电梯按钮；陌生人冒充，证件外套，骗开门入室。"
    );
    await service.rematchTurtleSoup(owner.roomCode, owner.playerId);
    const lobby = service.getView(owner.roomCode, owner.playerId);
    expect(lobby.room.phase).toBe("lobby");
    expect(lobby.room.turtleSoup).toBeUndefined();
    expect(lobby.room.players[0]).toMatchObject({ ready: false });
  });

  it("uses model generation and semantic judging when an AI adapter is available", async () => {
    const ai: TurtleSoupAiAdapter = {
      createPuzzle: async () => ({
        id: "model-soup",
        title: "模型汤",
        surface: "他在空房间里听见自己的名字，于是立刻离开。为什么？",
        answer: "房间里有一台延迟播放的录音设备，录音内容来自他之前的声音。",
        source: "model",
        maxHints: 2,
        keyPoints: [
          { id: "recording", text: "声音来自录音设备" },
          { id: "delay", text: "录音是延迟播放的" }
        ],
        hints: ["声音未必来自现场的人。"]
      }),
      judgeQuestion: async () => ({ answer: "yes", note: "方向有关" }),
      judgeGuess: async () => ({
        matchedKeyPointIds: ["recording", "delay"],
        wrong: false,
        comment: "完全命中"
      }),
      createHint: async () => "声音有没有可能早就被留下？"
    };
    const service = createService(ai);
    const owner = await service.createRoom({
      gameType: "turtle-soup",
      nickname: "Owner",
      password: "secret",
      turtleSoup: { difficulty: "hard", tags: ["录音", "密室"] }
    });

    await service.setSeat(owner.roomCode, owner.playerId, 1);
    await service.setReady(owner.roomCode, owner.playerId, true);
    await service.startRoom(owner.roomCode, owner.playerId);

    let view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.turtleSoup).toMatchObject({
      puzzleId: "model-soup",
      title: "模型汤",
      surface: "他在空房间里听见自己的名字，于是立刻离开。为什么？",
      source: "model",
      judgeSource: "model"
    });
    expect(view.room.turtleSoup?.answer).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("延迟播放的录音设备");

    await service.askTurtleSoup(owner.roomCode, owner.playerId, "声音和设备有关吗？");
    await service.requestTurtleSoupHint(owner.roomCode, owner.playerId);
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.turtleSoup?.log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "question", answer: "yes", note: "方向有关" }),
        expect.objectContaining({ kind: "hint", content: "声音有没有可能早就被留下？" })
      ])
    );

    await service.guessTurtleSoup(
      owner.roomCode,
      owner.playerId,
      "声音来自录音设备，而且是延迟播放的。"
    );
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.phase).toBe("game-over");
    expect(view.room.turtleSoup?.answer).toContain("延迟播放的录音设备");
    expect(view.room.turtleSoup?.keyPoints.every((point) => point.found)).toBe(true);
  });

  it("marks local fallback when the platform model is configured but unavailable", async () => {
    const ai: TurtleSoupAiAdapter = {
      createPuzzle: async () => undefined,
      judgeQuestion: async () => undefined,
      judgeGuess: async () => undefined,
      createHint: async () => undefined
    };
    const service = createService(ai);
    const owner = await service.createRoom({
      gameType: "turtle-soup",
      nickname: "Owner",
      password: "secret"
    });

    await service.setSeat(owner.roomCode, owner.playerId, 1);
    await service.setReady(owner.roomCode, owner.playerId, true);
    await service.startRoom(owner.roomCode, owner.playerId);

    let view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.turtleSoup).toMatchObject({
      source: "local",
      judgeSource: "local"
    });

    await service.askTurtleSoup(owner.roomCode, owner.playerId, "这和天气有关吗？");
    view = service.getView(owner.roomCode, owner.playerId);
    expect(view.room.turtleSoup).toMatchObject({
      source: "local",
      judgeSource: "local",
      questionCount: 1
    });
  });
});
