import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { RoomSessionResponse, RoomView } from "@party-games/shared";
import { io, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testAccount } from "./test-account.js";

const cleanupTasks: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanupTasks.splice(0).reverse()) await cleanup();
});

async function createTestApp() {
  const directory = mkdtempSync(join(tmpdir(), "party-games-reconnect-test-"));
  const context = await createApp({
    databasePath: join(directory, "test.sqlite"),
    logger: false
  });
  await context.app.listen({ host: "127.0.0.1", port: 0 });
  const address = context.app.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  cleanupTasks.push(async () => {
    await context.app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { ...context, baseUrl };
}

function connectWithView(baseUrl: string, session: RoomSessionResponse) {
  return new Promise<{ socket: Socket; view: RoomView }>((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      auth: { roomCode: session.roomCode, sessionToken: session.sessionToken }
    });
    let connected = false;
    let view: RoomView | undefined;
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket view timed out"));
    }, 5000);
    const complete = () => {
      if (!connected || !view) return;
      clearTimeout(timeout);
      resolve({ socket, view });
    };
    socket.once("connect", () => {
      connected = true;
      complete();
    });
    socket.once("room:view", (nextView: RoomView) => {
      view = nextView;
      complete();
    });
    socket.once("connect_error", reject);
  });
}

function emit(socket: Socket, event: string, ...args: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit(event, ...args, (ack: { ok: boolean; error?: string }) => {
      if (ack.ok) resolve();
      else reject(new Error(ack.error ?? `${event} failed`));
    });
  });
}

async function createDayRoom(context: Awaited<ReturnType<typeof createTestApp>>, count = 5) {
  const owner = await context.roomService.createRoom({
    gameType: "clocktower",
    nickname: "Player 1",
    password: "secret"
  }, testAccount("Player 1"));
  const sessions = [owner];
  for (let index = 2; index <= count; index += 1) {
    sessions.push(
      await context.roomService.joinRoom({
        roomCode: owner.roomCode,
        nickname: `Player ${index}`,
        password: "secret"
      }, testAccount(`Player ${index}`))
    );
  }
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (!session) continue;
    await context.roomService.setSeat(owner.roomCode, session.playerId, index + 1);
    await context.roomService.setReady(owner.roomCode, session.playerId, true);
  }
  await context.roomService.startRoom(owner.roomCode, owner.playerId);
  for (const session of sessions) {
    await context.roomService.confirmRole(owner.roomCode, session.playerId);
  }

  let guard = 0;
  while (context.roomService.getView(owner.roomCode, owner.playerId).room.phase === "first-night") {
    guard += 1;
    if (guard > 100) throw new Error("First night stalled");
    const actor = sessions.find(
      (session) =>
        context.roomService.getView(owner.roomCode, session.playerId).self.privateGame?.nightAction
    );
    if (!actor) throw new Error("First-night actor missing");
    const action = context.roomService.getView(owner.roomCode, actor.playerId).self.privateGame
      ?.nightAction;
    if (!action) throw new Error("First-night action missing");
    if (action.kind === "acknowledge") {
      await context.roomService.acknowledgeNight(owner.roomCode, actor.playerId);
    } else {
      await context.roomService.submitNightSelection(
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

describe("socket reconnect", () => {
  it("preserves a raised vote intent across a disconnect before lock time", async () => {
    const context = await createTestApp();
    const { owner, sessions } = await createDayRoom(context);
    const connections = await Promise.all(
      sessions.map((session) => connectWithView(context.baseUrl, session))
    );
    cleanupTasks.push(() => connections.forEach(({ socket }) => socket.disconnect()));

    for (const connection of connections.slice(0, 3)) {
      await emit(connection.socket, "clocktower:request-nominations");
    }
    await emit(connections[0]?.socket as Socket, "clocktower:nominate", sessions[1]?.playerId);

    const voterIndex = sessions.findIndex(
      (session) =>
        context.roomService.getView(owner.roomCode, session.playerId).self.privateGame?.role.id !==
        "butler"
    );
    const voterSession = sessions[voterIndex];
    const voterConnection = connections[voterIndex];
    if (!voterSession || !voterConnection) throw new Error("Reconnect voter missing");
    await emit(voterConnection.socket, "clocktower:set-vote", true);
    voterConnection.socket.disconnect();

    const reconnected = await connectWithView(context.baseUrl, voterSession);
    cleanupTasks.push(() => reconnected.socket.disconnect());
    expect(reconnected.view.self.dayActions?.currentVoteIntent).toBe(true);
    expect(reconnected.view.room.clocktowerDay?.currentVote?.raisedPlayerIds).toContain(
      voterSession.playerId
    );

    await context.roomService.tickActiveVotes(Date.now() + 60_000);
    const completedVote = context.roomService
      .getView(owner.roomCode, voterSession.playerId)
      .room.clocktowerDay?.publicEvents.findLast((event) => event.kind === "vote-completed");
    expect(completedVote?.kind).toBe("vote-completed");
    if (completedVote?.kind === "vote-completed") {
      expect(completedVote.votedPlayerIds).toContain(voterSession.playerId);
    }
  });

  it("reconnects fifteen player sessions repeatedly without losing room membership", async () => {
    const context = await createTestApp();
    const owner = await context.roomService.createRoom({
      gameType: "clocktower",
      nickname: "Player 1",
      password: "secret"
    }, testAccount("Player 1"));
    const sessions = [owner];
    for (let index = 2; index <= 15; index += 1) {
      sessions.push(
        await context.roomService.joinRoom({
          roomCode: owner.roomCode,
          nickname: `Player ${index}`,
          password: "secret"
        }, testAccount(`Player ${index}`))
      );
    }

    let connections = await Promise.all(
      sessions.map((session) => connectWithView(context.baseUrl, session))
    );
    for (let cycle = 0; cycle < 5; cycle += 1) {
      connections.forEach(({ socket }) => socket.disconnect());
      connections = await Promise.all(
        sessions.map((session) => connectWithView(context.baseUrl, session))
      );
      expect(connections.every(({ view }) => view.room.players.length === 15)).toBe(true);
    }
    cleanupTasks.push(() => connections.forEach(({ socket }) => socket.disconnect()));
    expect(
      sessions.every((session) =>
        context.presence.isConnected(owner.roomCode, session.playerId)
      )
    ).toBe(true);
  });
});
