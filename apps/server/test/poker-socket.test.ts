import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RoomSessionResponse, RoomView } from "@party-games/shared";
import { io, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const cleanupTasks: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanupTasks.splice(0).reverse()) await cleanup();
});

describe("poker socket boundary", () => {
  it("enables poker explicitly and broadcasts private views after dealing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "party-games-poker-socket-"));
    const context = await createApp({
      databasePath: join(directory, "test.sqlite"),
      logger: false,
      environment: { POKER_ENABLED: "true" }
    });
    await context.app.listen({ host: "127.0.0.1", port: 0 });
    cleanupTasks.push(async () => {
      await context.app.close();
      rmSync(directory, { recursive: true, force: true });
    });
    const address = context.app.server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const platformResponse = await context.app.inject({ method: "GET", url: "/api/platform" });
    expect(platformResponse.json()).toEqual({ enabledGames: ["clocktower", "poker"] });

    const owner = await context.roomService.createRoom({
      gameType: "poker",
      nickname: "Owner",
      password: "secret",
      poker: { mode: "points", smallBlind: 5, bigBlind: 10 }
    });
    const second = await context.roomService.joinRoom({
      roomCode: owner.roomCode,
      nickname: "Player 2",
      password: "secret"
    });
    await context.roomService.setSeat(owner.roomCode, owner.playerId, 1);
    await context.roomService.setSeat(owner.roomCode, second.playerId, 2);
    await context.roomService.setReady(owner.roomCode, owner.playerId, true);
    await context.roomService.setReady(owner.roomCode, second.playerId, true);
    await context.roomService.startRoom(owner.roomCode, owner.playerId);

    const ownerSocket = await connect(baseUrl, owner);
    const secondSocket = await connect(baseUrl, second);
    cleanupTasks.push(() => {
      ownerSocket.disconnect();
      secondSocket.disconnect();
    });

    const ownerViewPromise = nextInHandView(ownerSocket);
    const secondViewPromise = nextInHandView(secondSocket);
    await emit(ownerSocket, "poker:deal");
    const [ownerView, secondView] = await Promise.all([ownerViewPromise, secondViewPromise]);

    expect(ownerView.room.pokerTable?.players[0]?.hand).toHaveLength(2);
    expect(ownerView.room.pokerTable?.players[1]?.hand).toBeNull();
    expect(secondView.room.pokerTable?.players[0]?.hand).toBeNull();
    expect(secondView.room.pokerTable?.players[1]?.hand).toHaveLength(2);

    secondSocket.disconnect();
    const reconnected = await reconnectWithView(baseUrl, second);
    cleanupTasks.push(() => reconnected.socket.disconnect());
    expect(reconnected.view.room.pokerTable?.players[0]?.hand).toBeNull();
    expect(reconnected.view.room.pokerTable?.players[1]?.hand).toHaveLength(2);
    expect(reconnected.view.room.pokerTable?.actionPlayerId).toBe(
      ownerView.room.pokerTable?.actionPlayerId
    );

    const actionPlayerId = ownerView.room.pokerTable?.actionPlayerId;
    if (!actionPlayerId) throw new Error("Poker socket test is missing the action player");
    const actorSocket = actionPlayerId === owner.playerId ? ownerSocket : reconnected.socket;
    const settledViewPromise = nextWaitingHandView(ownerSocket);
    await emit(actorSocket, "poker:act", { action: "fold" });
    const settledView = await settledViewPromise;
    expect(settledView.room.pokerTable?.totalPot).toBe(10);
    expect(settledView.room.pokerTable?.actionHistory).toEqual([
      expect.objectContaining({ playerId: actionPlayerId, action: "fold", potAfter: 15 }),
      expect.objectContaining({ action: "uncalled-return", amount: 5, potAfter: 10 })
    ]);

    const cashedOutViewPromise = nextView(ownerSocket, (view) =>
      view.room.pokerTable?.players.some(
        (player) => player.playerId === actionPlayerId && !player.atTable
      ) ?? false
    );
    await emit(actorSocket, "poker:cash-out");
    const cashedOutView = await cashedOutViewPromise;
    expect(
      cashedOutView.room.pokerTable?.players.find(
        (player) => player.playerId === actionPlayerId
      )
    ).toMatchObject({ atTable: false, stack: 0, netPoints: -5 });

    const boughtInViewPromise = nextView(ownerSocket, (view) =>
      view.room.pokerTable?.players.some(
        (player) => player.playerId === actionPlayerId && player.atTable && player.buyIns === 2
      ) ?? false
    );
    await emit(actorSocket, "poker:buy-in");
    const boughtInView = await boughtInViewPromise;
    expect(
      boughtInView.room.pokerTable?.players.find(
        (player) => player.playerId === actionPlayerId
      )
    ).toMatchObject({ atTable: true, stack: 500, buyIns: 2, netPoints: -5 });
  });
});

function connect(baseUrl: string, session: RoomSessionResponse): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      auth: { roomCode: session.roomCode, sessionToken: session.sessionToken }
    });
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Poker socket connection timed out"));
    }, 5_000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", reject);
  });
}

function nextInHandView(socket: Socket): Promise<RoomView> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Poker room view timed out")), 5_000);
    const handleView = (view: RoomView) => {
      if (view.room.pokerTable?.status !== "in-hand") return;
      clearTimeout(timeout);
      socket.off("room:view", handleView);
      resolve(view);
    };
    socket.on("room:view", handleView);
  });
}

function nextWaitingHandView(socket: Socket): Promise<RoomView> {
  return nextView(socket, (view) => view.room.pokerTable?.status === "waiting-hand");
}

function nextView(
  socket: Socket,
  predicate: (view: RoomView) => boolean
): Promise<RoomView> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Poker matching view timed out")), 5_000);
    const handleView = (view: RoomView) => {
      if (!predicate(view)) return;
      clearTimeout(timeout);
      socket.off("room:view", handleView);
      resolve(view);
    };
    socket.on("room:view", handleView);
  });
}

function reconnectWithView(
  baseUrl: string,
  session: RoomSessionResponse
): Promise<{ socket: Socket; view: RoomView }> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      autoConnect: false,
      transports: ["websocket"],
      auth: { roomCode: session.roomCode, sessionToken: session.sessionToken }
    });
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Poker reconnect view timed out"));
    }, 5_000);
    socket.once("room:view", (view) => {
      clearTimeout(timeout);
      resolve({ socket, view });
    });
    socket.once("connect_error", reject);
    socket.connect();
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
