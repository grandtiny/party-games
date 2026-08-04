import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PresenceTracker } from "../src/presence.js";
import { SqliteRoomRepository } from "../src/repository.js";
import { RoomService } from "../src/room-service.js";
import { testAccount } from "./test-account.js";

const cleanupTasks: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanupTasks.splice(0)) cleanup();
});

function createService() {
  const directory = mkdtempSync(join(tmpdir(), "party-games-lobby-test-"));
  const repository = new SqliteRoomRepository(join(directory, "test.sqlite"));
  cleanupTasks.push(() => {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return new RoomService(repository, new PresenceTracker());
}

async function createFivePlayerRoom(service: RoomService) {
  const owner = await service.createRoom({
    gameType: "clocktower",
    nickname: "Owner",
    password: "secret"
  }, testAccount("Owner"));
  const sessions = [owner];
  for (let index = 2; index <= 5; index += 1) {
    sessions.push(
      await service.joinRoom({
        roomCode: owner.roomCode,
        nickname: `Player ${index}`,
        password: "secret"
      }, testAccount(`Player ${index}`))
    );
  }
  return { owner, sessions };
}

describe("lobby seating", () => {
  it("keeps joined players unseated until they choose a chair", async () => {
    const service = createService();
    const { owner, sessions } = await createFivePlayerRoom(service);

    expect(service.getView(owner.roomCode, owner.playerId).room.players).toEqual(
      expect.arrayContaining(
        sessions.map((session) =>
          expect.objectContaining({ id: session.playerId, seat: null, ready: false })
        )
      )
    );
    await expect(service.setReady(owner.roomCode, owner.playerId, true)).rejects.toThrow(
      "请先选择座位"
    );
  });

  it("supports taking, changing and leaving a seat while resetting ready state", async () => {
    const service = createService();
    const { owner, sessions } = await createFivePlayerRoom(service);
    const second = sessions[1];
    if (!second) throw new Error("Second session missing");

    await service.setSeat(owner.roomCode, owner.playerId, 1);
    await service.setReady(owner.roomCode, owner.playerId, true);
    await service.setSeat(owner.roomCode, owner.playerId, 5);
    expect(
      service.getView(owner.roomCode, owner.playerId).room.players.find(
        (player) => player.id === owner.playerId
      )
    ).toMatchObject({ seat: 5, ready: false });

    await service.setSeat(owner.roomCode, second.playerId, 1);
    await expect(service.setSeat(owner.roomCode, owner.playerId, 1)).rejects.toThrow(
      "该座位已被占用"
    );
    await service.setSeat(owner.roomCode, owner.playerId, null);
    expect(
      service.getView(owner.roomCode, owner.playerId).room.players.find(
        (player) => player.id === owner.playerId
      )?.seat
    ).toBeNull();
    await expect(service.setSeat(owner.roomCode, owner.playerId, 6)).rejects.toThrow(
      "座位必须在 1 到 5 之间"
    );
  });

  it("requires every player to be seated and ready before starting", async () => {
    const service = createService();
    const { owner, sessions } = await createFivePlayerRoom(service);

    for (let index = 0; index < sessions.length - 1; index += 1) {
      const session = sessions[index];
      if (!session) continue;
      await service.setSeat(owner.roomCode, session.playerId, index + 1);
      await service.setReady(owner.roomCode, session.playerId, true);
    }
    await expect(service.startRoom(owner.roomCode, owner.playerId)).rejects.toThrow(
      "仍有玩家未入座"
    );

    const last = sessions.at(-1);
    if (!last) throw new Error("Last session missing");
    await service.setSeat(owner.roomCode, last.playerId, sessions.length);
    await expect(service.startRoom(owner.roomCode, owner.playerId)).rejects.toThrow(
      "仍有玩家未准备"
    );
    await service.setReady(owner.roomCode, last.playerId, true);
    await service.startRoom(owner.roomCode, owner.playerId);
    expect(service.getView(owner.roomCode, owner.playerId).room.phase).toBe("role-reveal");
  });
});
