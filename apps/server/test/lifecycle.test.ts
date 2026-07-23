import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PresenceTracker } from "../src/presence.js";
import { SqliteRoomRepository } from "../src/repository.js";
import { RoomService } from "../src/room-service.js";

const cleanupTasks: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanupTasks.splice(0)) cleanup();
});

function createService() {
  const directory = mkdtempSync(join(tmpdir(), "party-games-lifecycle-test-"));
  const repository = new SqliteRoomRepository(join(directory, "test.sqlite"));
  cleanupTasks.push(() => {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    repository,
    service: new RoomService(repository, new PresenceTracker())
  };
}

async function createDayRoom(service: RoomService) {
  const owner = await service.createRoom({
    gameType: "clocktower",
    nickname: "Owner",
    password: "secret"
  });
  const sessions = [owner];
  for (let index = 2; index <= 5; index += 1) {
    sessions.push(
      await service.joinRoom({
        roomCode: owner.roomCode,
        nickname: `Player ${index}`,
        password: "secret"
      })
    );
  }
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (!session) continue;
    await service.setSeat(owner.roomCode, session.playerId, index + 1);
    await service.setReady(owner.roomCode, session.playerId, true);
  }
  await service.startRoom(owner.roomCode, owner.playerId);
  for (const session of sessions) await service.confirmRole(owner.roomCode, session.playerId);

  let guard = 0;
  while (service.getView(owner.roomCode, owner.playerId).room.phase === "first-night") {
    guard += 1;
    if (guard > 100) throw new Error("First night stalled");
    const actor = sessions.find(
      (session) => service.getView(owner.roomCode, session.playerId).self.privateGame?.nightAction
    );
    if (!actor) throw new Error("First-night actor missing");
    const action = service.getView(owner.roomCode, actor.playerId).self.privateGame?.nightAction;
    if (!action) throw new Error("First-night action missing");
    if (action.kind === "acknowledge") {
      await service.acknowledgeNight(owner.roomCode, actor.playerId);
    } else {
      await service.submitNightSelection(
        owner.roomCode,
        actor.playerId,
        (action.options ?? [])
          .slice(0, action.kind === "select-two" ? 2 : 1)
          .map((option) => option.playerId)
      );
    }
  }
  return { owner, sessions };
}

describe("clocktower game lifecycle", () => {
  it("reveals the completed game and resets the same room for a rematch", async () => {
    const { repository, service } = createService();
    const { owner, sessions } = await createDayRoom(service);
    const dayView = service.getView(owner.roomCode, owner.playerId);
    expect(dayView.room.clocktowerReview).toBeUndefined();
    service.sendChat(owner.roomCode, owner.playerId, { content: "old game chat" });

    const current = repository.getRoom(owner.roomCode);
    const game = structuredClone(current?.clocktower?.game);
    if (!current?.clocktower || !game) throw new Error("Game state missing");
    game.winner = "good";
    game.endReason = "测试结束原因";
    game.day.stage = "complete";
    game.day.publicEvents.push({ kind: "game-over", winner: "good", reason: "测试结束原因" });
    const finished = {
      ...current,
      phase: "game-over" as const,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      clocktower: {
        ...current.clocktower,
        game,
        timeline: [
          ...current.clocktower.timeline,
          {
            id: `${current.version + 1}:0`,
            dayNumber: game.day.number,
            event: { kind: "game-over" as const, winner: "good" as const, reason: "测试结束原因" }
          }
        ]
      }
    };
    repository.commit(current.version, finished, {
      type: "VOTE_TICK",
      actorPlayerId: "system",
      payload: { forcedForTest: true }
    });

    const completedView = service.getView(owner.roomCode, owner.playerId);
    expect(completedView.room.clocktowerReview?.players).toHaveLength(5);
    expect(completedView.room.clocktowerReview?.timeline.at(-1)?.event.kind).toBe("game-over");
    expect(completedView.room.clocktowerReview?.nightHistory.length).toBeGreaterThan(0);
    const oldSeedCommitment = completedView.room.clocktowerReview?.seedCommitment;

    await service.resetGame(owner.roomCode, sessions[1]?.playerId ?? "").then(
      () => {
        throw new Error("Non-owner reset unexpectedly succeeded");
      },
      (error: unknown) => expect(String(error)).toContain("只有房主")
    );
    await service.resetGame(owner.roomCode, owner.playerId);

    const lobbyView = service.getView(owner.roomCode, owner.playerId);
    expect(lobbyView.room.phase).toBe("lobby");
    expect(lobbyView.room.clocktowerReview).toBeUndefined();
    expect(lobbyView.self.privateGame).toBeUndefined();
    expect(lobbyView.chatMessages).toHaveLength(0);
    expect(lobbyView.room.players.map((player) => player.seat)).toEqual([1, 2, 3, 4, 5]);
    expect(lobbyView.room.players.every((player) => !player.ready)).toBe(true);

    for (const session of sessions) await service.setReady(owner.roomCode, session.playerId, true);
    await service.startRoom(owner.roomCode, owner.playerId);
    const rematchView = service.getView(owner.roomCode, owner.playerId);
    expect(rematchView.room.phase).toBe("role-reveal");
    expect(rematchView.room.seedCommitment).not.toBe(oldSeedCommitment);
  });
});
