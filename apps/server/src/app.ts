import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import {
  CreateRoomRequestSchema,
  JoinRoomRequestSchema,
  RecoverRoomRequestSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData
} from "@party-games/shared";
import { Server as SocketServer } from "socket.io";
import { PresenceTracker } from "./presence.js";
import { SqliteRoomRepository } from "./repository.js";
import { RoomService } from "./room-service.js";

export interface AppOptions {
  databasePath: string;
  webDistPath?: string;
  webOrigin?: string;
  logger?: boolean;
}

export async function createApp(options: AppOptions) {
  const app = Fastify({ logger: options.logger ?? true });
  const repository = new SqliteRoomRepository(options.databasePath);
  const presence = new PresenceTracker();
  const roomService = new RoomService(repository, presence);
  const socketOptions = options.webOrigin ? { cors: { origin: options.webOrigin } } : {};
  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(app.server, socketOptions);

  app.get("/api/health", async () => ({ ok: true }));

  app.post("/api/rooms", async (request, reply) => {
    try {
      const input = CreateRoomRequestSchema.parse(request.body);
      return await roomService.createRoom(input);
    } catch (error) {
      return reply.code(400).send({ error: messageOf(error) });
    }
  });

  app.post("/api/rooms/join", async (request, reply) => {
    try {
      const input = JoinRoomRequestSchema.parse(request.body);
      return await roomService.joinRoom(input);
    } catch (error) {
      return reply.code(400).send({ error: messageOf(error) });
    }
  });

  app.post("/api/rooms/recover", async (request, reply) => {
    try {
      const input = RecoverRoomRequestSchema.parse(request.body);
      return await roomService.recoverRoom(input);
    } catch (error) {
      return reply.code(400).send({ error: messageOf(error) });
    }
  });

  io.use((socket, next) => {
    try {
      const roomCode = String(socket.handshake.auth.roomCode ?? "").toUpperCase();
      const sessionToken = String(socket.handshake.auth.sessionToken ?? "");
      const playerId = roomService.authenticate(roomCode, sessionToken);
      socket.data = { roomCode, playerId };
      next();
    } catch (error) {
      next(new Error(messageOf(error)));
    }
  });

  const broadcastRoom = async (roomCode: string) => {
    const sockets = await io.in(roomCode).fetchSockets();
    for (const socket of sockets) {
      socket.emit("room:view", roomService.getView(roomCode, socket.data.playerId));
    }
  };

  io.on("connection", async (socket) => {
    const { roomCode, playerId } = socket.data;
    await socket.join(roomCode);
    presence.connect(roomCode, playerId);
    await broadcastRoom(roomCode);

    socket.on("room:set-ready", async (ready, callback) => {
      try {
        await roomService.setReady(roomCode, playerId, ready);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("room:set-seat", async (seat, callback) => {
      try {
        await roomService.setSeat(roomCode, playerId, seat);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("room:start", async (callback) => {
      try {
        await roomService.startRoom(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:confirm-role", async (callback) => {
      try {
        await roomService.confirmRole(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:night-select", async (playerIds, callback) => {
      try {
        await roomService.submitNightSelection(roomCode, playerId, playerIds);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:night-ack", async (callback) => {
      try {
        await roomService.acknowledgeNight(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:request-nominations", async (callback) => {
      try {
        await roomService.requestNominations(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:nominate", async (targetPlayerId, callback) => {
      try {
        await roomService.nominate(roomCode, playerId, targetPlayerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:request-close-nominations", async (callback) => {
      try {
        await roomService.requestCloseNominations(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:set-vote", async (voting, callback) => {
      try {
        await roomService.setVoteIntent(roomCode, playerId, voting);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("clocktower:slayer-claim", async (targetPlayerId, callback) => {
      try {
        await roomService.claimSlayer(roomCode, playerId, targetPlayerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("chat:send", async (message, callback) => {
      try {
        roomService.sendChat(roomCode, playerId, message);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("disconnect", async () => {
      presence.disconnect(roomCode, playerId);
      await broadcastRoom(roomCode);
    });
  });

  let voteTickRunning = false;
  const voteTimer = setInterval(async () => {
    if (voteTickRunning) return;
    voteTickRunning = true;
    try {
      const changedRoomCodes = await roomService.tickActiveVotes();
      for (const roomCode of changedRoomCodes) await broadcastRoom(roomCode);
    } catch (error) {
      app.log.error(error);
    } finally {
      voteTickRunning = false;
    }
  }, 250);
  voteTimer.unref();

  const webDistPath = options.webDistPath ? resolve(options.webDistPath) : undefined;
  if (webDistPath && existsSync(webDistPath)) {
    await app.register(fastifyStatic, { root: webDistPath });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    clearInterval(voteTimer);
    io.close();
    repository.close();
  });

  return { app, io, roomService, repository, presence };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
