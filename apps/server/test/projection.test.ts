import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PresenceTracker } from "../src/presence.js";
import { SqliteRoomRepository } from "../src/repository.js";
import { RoomService } from "../src/room-service.js";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createService() {
  const directory = mkdtempSync(join(tmpdir(), "party-games-test-"));
  tempDirectories.push(directory);
  const databasePath = join(directory, "test.sqlite");
  const repository = new SqliteRoomRepository(databasePath);
  return {
    databasePath,
    repository,
    service: new RoomService(repository, new PresenceTracker())
  };
}

describe("room projections", () => {
  it("only reveals the requesting player's role after setup", async () => {
    const context = createService();
    let { repository, service } = context;
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
      await service.setSeat(owner.roomCode, sessions[index]?.playerId ?? "", index + 1);
    }
    for (const session of sessions) {
      await service.setReady(owner.roomCode, session.playerId, true);
    }
    await service.startRoom(owner.roomCode, owner.playerId);

    const views = sessions.map((session) => service.getView(owner.roomCode, session.playerId));
    for (const view of views) {
      expect(view.self.privateGame?.role.id).toBeTruthy();
      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain("actualRoleId");
      expect(serialized).not.toContain("rolesInPlay");
      expect(serialized).not.toContain("demonBluffRoleIds");
    }

    const roleIds = views.map((view) => view.self.privateGame?.role.id);
    expect(roleIds).toHaveLength(5);

    const originalToken = sessions[1]?.sessionToken;
    const recovered = await service.recoverRoom({
      roomCode: owner.roomCode,
      recoveryCode: sessions[1]?.recoveryCode ?? ""
    });
    expect(service.authenticate(owner.roomCode, recovered.sessionToken)).toBe(
      sessions[1]?.playerId
    );
    expect(() => service.authenticate(owner.roomCode, originalToken ?? "")).toThrow();
    expect(service.getView(owner.roomCode, recovered.playerId).self.privateGame?.role.id).toBe(
      views[1]?.self.privateGame?.role.id
    );

    for (const session of sessions) {
      await service.confirmRole(owner.roomCode, session.playerId);
    }

    let guard = 0;
    while (service.getView(owner.roomCode, owner.playerId).room.phase === "first-night") {
      guard += 1;
      if (guard > 100) throw new Error("First night service flow stalled");

      let acted = false;
      for (const session of sessions) {
        const view = service.getView(owner.roomCode, session.playerId);
        const action = view.self.privateGame?.nightAction;
        if (!action) continue;
        acted = true;
        if (action.kind === "acknowledge") {
          await service.acknowledgeFirstNight(owner.roomCode, session.playerId);
        } else {
          await service.submitFirstNightSelection(
            owner.roomCode,
            session.playerId,
            (action.options ?? [])
              .slice(0, action.kind === "select-two" ? 2 : 1)
              .map((option) => option.playerId)
          );
        }
        break;
      }
      if (!acted) throw new Error("No player received the current first-night action");
    }

    const dayView = service.getView(owner.roomCode, owner.playerId);
    expect(dayView.room.phase).toBe("day");
    expect(dayView.room.dayNumber).toBe(1);
    expect(dayView.self.privateGame?.nightAction).toBeUndefined();

    service.sendChat(owner.roomCode, owner.playerId, { content: "public message" });
    service.sendChat(owner.roomCode, sessions[1]?.playerId ?? "", {
      recipientPlayerId: owner.playerId,
      content: "private message"
    });
    expect(service.getView(owner.roomCode, owner.playerId).chatMessages).toHaveLength(2);
    expect(service.getView(owner.roomCode, sessions[2]?.playerId ?? "").chatMessages).toHaveLength(
      1
    );

    for (const session of sessions.slice(0, 3)) {
      await service.requestNominations(owner.roomCode, session.playerId);
    }
    expect(service.getView(owner.roomCode, owner.playerId).room.phase).toBe("nominations");

    const internalState = repository.getRoom(owner.roomCode);
    const targetAssignment = internalState?.clocktower?.setup.assignments.find(
      (assignment) =>
        assignment.playerId !== owner.playerId &&
        !["virgin", "saint", "imp"].includes(assignment.actualRoleId)
    );
    if (!targetAssignment) throw new Error("A safe execution target was not found");

    await service.nominate(owner.roomCode, owner.playerId, targetAssignment.playerId);
    for (const session of sessions) {
      await service.setVoteIntent(owner.roomCode, session.playerId, true);
    }
    await service.tickActiveVotes(Date.now() + 60_000);
    expect(service.getView(owner.roomCode, owner.playerId).room.phase).toBe("nominations");

    for (const session of sessions.slice(0, 3)) {
      await service.requestCloseNominations(owner.roomCode, session.playerId);
    }
    const nightView = service.getView(owner.roomCode, owner.playerId);
    expect(nightView.room.phase).toBe("night");
    expect(
      nightView.room.players.find((player) => player.id === targetAssignment.playerId)?.alive
    ).toBe(false);

    const nightActionByPlayer = sessions.map((session) =>
      service.getView(owner.roomCode, session.playerId).self.privateGame?.nightAction
    );
    repository.close();
    repository = new SqliteRoomRepository(context.databasePath);
    service = new RoomService(repository, new PresenceTracker());
    const restoredNightView = service.getView(owner.roomCode, owner.playerId);
    expect(restoredNightView.room.phase).toBe("night");
    expect(restoredNightView.room.version).toBe(nightView.room.version);
    expect(
      sessions.map((session) =>
        service.getView(owner.roomCode, session.playerId).self.privateGame?.nightAction
      )
    ).toEqual(nightActionByPlayer);

    guard = 0;
    while (service.getView(owner.roomCode, owner.playerId).room.phase === "night") {
      guard += 1;
      if (guard > 100) throw new Error("Other-night service flow stalled");

      const actionViews = sessions
        .map((session) => ({
          session,
          view: service.getView(owner.roomCode, session.playerId)
        }))
        .filter(({ view }) => view.self.privateGame?.nightAction);
      expect(actionViews).toHaveLength(1);
      const actor = actionViews[0];
      if (!actor) throw new Error("No player received the current other-night action");
      const action = actor.view.self.privateGame?.nightAction;
      if (!action) throw new Error("Other-night action disappeared");

      if (action.kind === "acknowledge") {
        await service.acknowledgeNight(owner.roomCode, actor.session.playerId);
      } else {
        const optionCount = action.kind === "select-two" ? 2 : 1;
        const options = [...(action.options ?? [])];
        if (actor.view.self.privateGame?.role.id === "imp") {
          options.sort((left, right) => {
            const leftPreferred = left.playerId !== actor.session.playerId && left.alive;
            const rightPreferred = right.playerId !== actor.session.playerId && right.alive;
            return Number(rightPreferred) - Number(leftPreferred);
          });
        }
        await service.submitNightSelection(
          owner.roomCode,
          actor.session.playerId,
          options.slice(0, optionCount).map((option) => option.playerId)
        );
      }
    }

    const secondDayView = service.getView(owner.roomCode, owner.playerId);
    expect(secondDayView.room.phase).toBe("day");
    expect(secondDayView.room.dayNumber).toBe(2);
    expect(
      secondDayView.room.clocktowerDay?.publicEvents.some(
        (event) => event.kind === "night-deaths"
      )
    ).toBe(true);
    const secondDayState = repository.getRoom(owner.roomCode);
    expect(secondDayState?.clocktower?.timeline.map((entry) => entry.event.kind)).toEqual(
      expect.arrayContaining([
        "nominations-opened",
        "nomination",
        "vote-completed",
        "execution",
        "night-deaths"
      ])
    );
    expect(secondDayState?.clocktower?.game?.completedNights).toHaveLength(1);
    repository.close();
  });
});
