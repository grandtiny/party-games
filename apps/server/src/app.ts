import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyCompress from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyReply } from "fastify";
import {
  AccountBootstrapRequestSchema,
  AccountInviteCreateRequestSchema,
  AccountLoginRequestSchema,
  AccountPasswordChangeRequestSchema,
  AccountProfileUpdateRequestSchema,
  AccountRegisterRequestSchema,
  AdminLlmConfigUpdateRequestSchema,
  AdminLoginRequestSchema,
  AdminPasswordChangeRequestSchema,
  AdminSetupRequestSchema,
  CreateRoomRequestSchema,
  GomokuMatchSubmitRequestSchema,
  GomokuProgressSyncRequestSchema,
  GomokuSaveUpdateRequestSchema,
  JoinRoomRequestSchema,
  PuzzleResultSubmitRequestSchema,
  RecoverRoomRequestSchema,
  RulesQuestionRequestSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData
} from "@party-games/shared";
import { Server as SocketServer } from "socket.io";
import { AccountService } from "./account-service.js";
import { AdminService } from "./admin-service.js";
import { createGameRegistry } from "./games/index.js";
import { ModelTurtleSoupAiAdapter } from "./games/turtle-soup-ai.js";
import { PresenceTracker } from "./presence.js";
import { SqliteRoomRepository } from "./repository.js";
import { RoomService } from "./room-service.js";
import { RulesAssistant } from "./rules-assistant.js";

export interface AppOptions {
  databasePath: string;
  webDistPath?: string;
  webOrigin?: string;
  logger?: boolean;
  rulesAssistant?: RulesAssistant;
  environment?: NodeJS.ProcessEnv;
}

export async function createApp(options: AppOptions) {
  const app = Fastify({ logger: options.logger ?? true });
  await app.register(fastifyCompress, {
    global: true,
    threshold: 1024,
    customTypes: /^(application\/javascript|application\/wasm|application\/json|text\/css|text\/html)/u
  });
  const environment = options.environment ?? process.env;
  const repository = new SqliteRoomRepository(options.databasePath);
  const presence = new PresenceTracker();
  const adminService = new AdminService(repository, environment);
  const games = createGameRegistry({
    pokerEnabled: enabledFlag(environment.POKER_ENABLED, true),
    turtleSoupAi: new ModelTurtleSoupAiAdapter(adminService.createLanguageModelClient()),
    turtleSoupAiFailureHandler: (event) => {
      app.log.warn({ turtleSoupAi: event }, "Turtle soup AI fallback");
    }
  });
  const roomService = new RoomService(repository, presence, games);
  const accountService = new AccountService(repository);
  const rulesAssistant =
    options.rulesAssistant ?? new RulesAssistant(adminService.createLanguageModelAdapter());
  const rulesQuestionWindows = new Map<string, { startedAt: number; count: number }>();
  const adminLoginWindows = new Map<string, { startedAt: number; count: number }>();
  const accountLoginWindows = new Map<string, { startedAt: number; count: number }>();
  const socketOptions = options.webOrigin ? { cors: { origin: options.webOrigin } } : {};
  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(app.server, socketOptions);

  app.get("/api/health", async () => ({
    ok: true,
    databaseSchemaVersion: repository.getSchemaVersion()
  }));

  app.get("/api/platform", async () => ({
    enabledGames: games.list().map((game) => game.id)
  }));

  app.get("/api/account/status", async (request) =>
    accountService.status(accountSessionToken(request.headers.cookie))
  );

  app.post("/api/account/bootstrap", async (request, reply) => {
    try {
      const input = AccountBootstrapRequestSchema.parse(request.body);
      const authenticated = accountService.bootstrap(input);
      adminService.clearSessions();
      setAccountSessionCookie(reply, authenticated.token, request.protocol === "https");
      return accountService.status(authenticated.token);
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("已经创建") ? 409 : 400).send({ error: message });
    }
  });

  app.post("/api/account/register", async (request, reply) => {
    try {
      const input = AccountRegisterRequestSchema.parse(request.body);
      const authenticated = accountService.register(input);
      setAccountSessionCookie(reply, authenticated.token, request.protocol === "https");
      return accountService.status(authenticated.token);
    } catch (error) {
      const message = messageOf(error);
      return reply
        .code(message.includes("用户名已存在") ? 409 : 400)
        .send({ error: message });
    }
  });

  app.post("/api/account/login", async (request, reply) => {
    try {
      if (!consumeLoginAttempt(accountLoginWindows, request.ip)) {
        return reply.code(429).send({ error: "登录尝试过于频繁，请稍后再试" });
      }
      const input = AccountLoginRequestSchema.parse(request.body);
      const authenticated = accountService.login(input);
      accountLoginWindows.delete(request.ip);
      setAccountSessionCookie(reply, authenticated.token, request.protocol === "https");
      return accountService.status(authenticated.token);
    } catch (error) {
      return reply.code(401).send({ error: messageOf(error) });
    }
  });

  app.post("/api/account/logout", async (request, reply) => {
    accountService.logout(accountSessionToken(request.headers.cookie));
    clearAccountSessionCookie(reply, request.protocol === "https");
    return { ok: true };
  });

  app.put("/api/account/profile", async (request, reply) => {
    try {
      const input = AccountProfileUpdateRequestSchema.parse(request.body);
      const user = accountService.updateProfile(
        accountSessionToken(request.headers.cookie),
        input.displayName
      );
      return { ...accountService.status(accountSessionToken(request.headers.cookie)), user };
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 400).send({ error: message });
    }
  });

  app.put("/api/account/password", async (request, reply) => {
    try {
      const input = AccountPasswordChangeRequestSchema.parse(request.body);
      const authenticated = accountService.changePassword(
        accountSessionToken(request.headers.cookie),
        input.currentPassword,
        input.newPassword
      );
      setAccountSessionCookie(reply, authenticated.token, request.protocol === "https");
      return accountService.status(authenticated.token);
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 400).send({ error: message });
    }
  });

  app.get("/api/account/overview", async (request, reply) => {
    try {
      return accountService.overview(accountSessionToken(request.headers.cookie));
    } catch (error) {
      return reply.code(401).send({ error: messageOf(error) });
    }
  });

  app.post("/api/account/puzzle-results", async (request, reply) => {
    try {
      const input = PuzzleResultSubmitRequestSchema.parse(request.body);
      return accountService.submitPuzzleResult(
        accountSessionToken(request.headers.cookie),
        input
      );
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 400).send({ error: message });
    }
  });

  app.post("/api/account/gomoku/matches", async (request, reply) => {
    try {
      const input = GomokuMatchSubmitRequestSchema.parse(request.body);
      return accountService.submitGomokuMatch(
        accountSessionToken(request.headers.cookie),
        input
      );
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 400).send({ error: message });
    }
  });

  app.get("/api/account/gomoku/overview", async (request, reply) => {
    try {
      return accountService.gomokuOverview(accountSessionToken(request.headers.cookie));
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 400).send({ error: message });
    }
  });

  app.get("/api/account/gomoku/matches/:matchId", async (request, reply) => {
    try {
      const matchId = String((request.params as { matchId?: string }).matchId ?? "");
      return accountService.gomokuMatch(accountSessionToken(request.headers.cookie), matchId);
    } catch (error) {
      const message = messageOf(error);
      return reply
        .code(message.includes("会话无效") ? 401 : message.includes("不存在") ? 404 : 400)
        .send({ error: message });
    }
  });

  app.put("/api/account/gomoku/save", async (request, reply) => {
    try {
      const input = GomokuSaveUpdateRequestSchema.parse(request.body);
      return accountService.updateGomokuSave(
        accountSessionToken(request.headers.cookie),
        input
      );
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 400).send({ error: message });
    }
  });

  app.put("/api/account/gomoku/progress", async (request, reply) => {
    try {
      const input = GomokuProgressSyncRequestSchema.parse(request.body);
      return accountService.syncGomokuProgress(
        accountSessionToken(request.headers.cookie),
        input
      );
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 400).send({ error: message });
    }
  });

  app.get("/api/account/invites", async (request, reply) => {
    try {
      return accountService.listInvites(accountSessionToken(request.headers.cookie));
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("会话无效") ? 401 : 403).send({ error: message });
    }
  });

  app.post("/api/account/invites", async (request, reply) => {
    try {
      const input = AccountInviteCreateRequestSchema.parse(request.body);
      return accountService.createInvite(
        accountSessionToken(request.headers.cookie),
        input.expiresInDays
      );
    } catch (error) {
      const message = messageOf(error);
      return reply
        .code(message.includes("会话无效") ? 401 : message.includes("管理员") ? 403 : 400)
        .send({ error: message });
    }
  });

  app.delete("/api/account/invites/:inviteId", async (request, reply) => {
    try {
      const inviteId = String((request.params as { inviteId?: string }).inviteId ?? "");
      accountService.revokeInvite(accountSessionToken(request.headers.cookie), inviteId);
      return { ok: true };
    } catch (error) {
      const message = messageOf(error);
      return reply
        .code(message.includes("会话无效") ? 401 : message.includes("管理员") ? 403 : 400)
        .send({ error: message });
    }
  });

  app.get("/api/admin/status", async (request) => {
    const authenticationMode = accountService.isInitialized()
      ? "account"
      : adminService.isInitialized()
        ? "legacy"
        : "uninitialized";
    return {
      initialized: authenticationMode !== "uninitialized",
      authenticated: isAdminAuthenticated(
        request.headers.cookie,
        accountService,
        adminService
      ),
      authenticationMode
    };
  });

  app.post("/api/admin/setup", async (request, reply) => {
    try {
      if (accountService.isInitialized()) throw new Error("请使用管理员账号进入设置");
      const input = AdminSetupRequestSchema.parse(request.body);
      const token = adminService.setup(input.password);
      setAdminSessionCookie(reply, token, request.protocol === "https");
      return { initialized: true, authenticated: true };
    } catch (error) {
      const message = messageOf(error);
      return reply.code(message.includes("已经设置") ? 409 : 400).send({ error: message });
    }
  });

  app.post("/api/admin/login", async (request, reply) => {
    try {
      if (accountService.isInitialized()) throw new Error("请使用管理员账号登录");
      if (!consumeLoginAttempt(adminLoginWindows, request.ip)) {
        return reply.code(429).send({ error: "登录尝试过于频繁，请稍后再试" });
      }
      const input = AdminLoginRequestSchema.parse(request.body);
      const token = adminService.login(input.password);
      adminLoginWindows.delete(request.ip);
      setAdminSessionCookie(reply, token, request.protocol === "https");
      return { initialized: true, authenticated: true };
    } catch (error) {
      return reply.code(401).send({ error: messageOf(error) });
    }
  });

  app.post("/api/admin/logout", async (request, reply) => {
    adminService.logout(adminSessionToken(request.headers.cookie));
    clearAdminSessionCookie(reply, request.protocol === "https");
    return { ok: true };
  });

  app.get("/api/admin/config", async (request, reply) => {
    try {
      requireAdminAuthentication(request.headers.cookie, accountService, adminService);
      return adminService.getConfig();
    } catch (error) {
      return reply.code(401).send({ error: messageOf(error) });
    }
  });

  app.put("/api/admin/config/llm", async (request, reply) => {
    try {
      requireAdminAuthentication(request.headers.cookie, accountService, adminService);
      const input = AdminLlmConfigUpdateRequestSchema.parse(request.body);
      const config = adminService.updateLanguageModelConfig(input);
      rulesAssistant.clearCache();
      return config;
    } catch (error) {
      const message = messageOf(error);
      return reply
        .code(message.includes("会话无效") ? 401 : 400)
        .send({ error: message });
    }
  });

  app.post("/api/admin/config/llm/test", async (request, reply) => {
    try {
      requireAdminAuthentication(request.headers.cookie, accountService, adminService);
      const input = AdminLlmConfigUpdateRequestSchema.parse(request.body);
      return await adminService.testLanguageModelConfig(input);
    } catch (error) {
      const message = messageOf(error);
      return reply
        .code(message.includes("会话无效") ? 401 : 400)
        .send({ error: message });
    }
  });

  app.put("/api/admin/password", async (request, reply) => {
    try {
      if (accountService.isInitialized()) {
        throw new Error("账号密码请在账号页面修改");
      }
      adminService.requireAuthentication(adminSessionToken(request.headers.cookie));
      const input = AdminPasswordChangeRequestSchema.parse(request.body);
      const token = adminService.changePassword(input.currentPassword, input.newPassword);
      setAdminSessionCookie(reply, token, request.protocol === "https");
      return { ok: true };
    } catch (error) {
      const message = messageOf(error);
      return reply
        .code(message.includes("会话无效") ? 401 : 400)
        .send({ error: message });
    }
  });

  app.post("/api/clocktower/rules/ask", async (request, reply) => {
    try {
      const now = Date.now();
      if (rulesQuestionWindows.size > 1000) {
        for (const [key, value] of rulesQuestionWindows) {
          if (now - value.startedAt >= 60_000) rulesQuestionWindows.delete(key);
        }
      }
      const window = rulesQuestionWindows.get(request.ip);
      if (!window || now - window.startedAt >= 60_000) {
        rulesQuestionWindows.set(request.ip, { startedAt: now, count: 1 });
      } else {
        window.count += 1;
        if (window.count > 20) {
          return reply.code(429).send({ error: "规则问答请求过于频繁" });
        }
      }
      const input = RulesQuestionRequestSchema.parse(request.body);
      return await rulesAssistant.answer(input.question);
    } catch (error) {
      return reply.code(400).send({ error: messageOf(error) });
    }
  });

  app.post("/api/rooms", async (request, reply) => {
    try {
      const input = CreateRoomRequestSchema.parse(request.body);
      return await roomService.createRoom(
        input,
        accountService.userForToken(accountSessionToken(request.headers.cookie))
      );
    } catch (error) {
      return reply.code(400).send({ error: messageOf(error) });
    }
  });

  app.post("/api/rooms/join", async (request, reply) => {
    try {
      const input = JoinRoomRequestSchema.parse(request.body);
      return await roomService.joinRoom(
        input,
        accountService.userForToken(accountSessionToken(request.headers.cookie))
      );
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

    socket.on("clocktower:rematch", async (callback) => {
      try {
        await roomService.resetGame(roomCode, playerId);
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

    socket.on("poker:deal", async (callback) => {
      try {
        await roomService.dealPokerHand(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:act", async (action, callback) => {
      try {
        await roomService.actPoker(roomCode, playerId, action.action, action.amount);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:rebuy", async (callback) => {
      try {
        await roomService.rebuyPoker(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:cash-out", async (callback) => {
      try {
        await roomService.cashOutPoker(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:buy-in", async (callback) => {
      try {
        await roomService.buyInPoker(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:advance-blinds", async (callback) => {
      try {
        await roomService.advancePokerBlinds(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:pause-blinds", async (callback) => {
      try {
        await roomService.pausePokerBlinds(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:resume-blinds", async (callback) => {
      try {
        await roomService.resumePokerBlinds(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("poker:rematch", async (callback) => {
      try {
        await roomService.rematchPoker(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("turtle-soup:ask", async (question, callback) => {
      try {
        await roomService.askTurtleSoup(roomCode, playerId, question);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("turtle-soup:guess", async (guess, callback) => {
      try {
        await roomService.guessTurtleSoup(roomCode, playerId, guess);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("turtle-soup:hint", async (callback) => {
      try {
        await roomService.requestTurtleSoupHint(roomCode, playerId);
        callback({ ok: true });
        await broadcastRoom(roomCode);
      } catch (error) {
        callback({ ok: false, error: messageOf(error) });
      }
    });

    socket.on("turtle-soup:rematch", async (callback) => {
      try {
        await roomService.rematchTurtleSoup(roomCode, playerId);
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

  let gameTickRunning = false;
  const gameTickTimer = setInterval(async () => {
    if (gameTickRunning) return;
    gameTickRunning = true;
    try {
      const changedRoomCodes = await roomService.tickActiveGames();
      for (const roomCode of changedRoomCodes) await broadcastRoom(roomCode);
    } catch (error) {
      app.log.error(error);
    } finally {
      gameTickRunning = false;
    }
  }, 250);
  gameTickTimer.unref();

  const webDistPath = options.webDistPath ? resolve(options.webDistPath) : undefined;
  if (webDistPath && existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      immutable: true,
      maxAge: "1y"
    });
    const sendIndex = (_request: unknown, reply: FastifyReply) =>
      reply.sendFile("index.html", { immutable: false, maxAge: 0 });
    app.get("/", sendIndex);
    app.get("/index.html", sendIndex);
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html", { immutable: false, maxAge: 0 });
    });
  }

  app.addHook("onClose", async () => {
    clearInterval(gameTickTimer);
    io.close();
    repository.close();
    adminService.close();
    rulesQuestionWindows.clear();
    adminLoginWindows.clear();
    accountLoginWindows.clear();
  });

  return { app, io, roomService, repository, presence, adminService, accountService };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

function enabledFlag(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

const ADMIN_SESSION_COOKIE = "party_games_admin_session";
const ACCOUNT_SESSION_COOKIE = "party_games_account_session";

function adminSessionToken(cookieHeader: string | undefined): string | undefined {
  return sessionCookieToken(cookieHeader, ADMIN_SESSION_COOKIE);
}

function accountSessionToken(cookieHeader: string | undefined): string | undefined {
  return sessionCookieToken(cookieHeader, ACCOUNT_SESSION_COOKIE);
}

function sessionCookieToken(
  cookieHeader: string | undefined,
  cookieName: string
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== cookieName) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isAdminAuthenticated(
  cookieHeader: string | undefined,
  accountService: AccountService,
  adminService: AdminService
): boolean {
  const account = accountService.userForToken(accountSessionToken(cookieHeader));
  if (account?.role === "owner") return true;
  return (
    !accountService.isInitialized() &&
    adminService.isAuthenticated(adminSessionToken(cookieHeader))
  );
}

function requireAdminAuthentication(
  cookieHeader: string | undefined,
  accountService: AccountService,
  adminService: AdminService
): void {
  if (!isAdminAuthenticated(cookieHeader, accountService, adminService)) {
    throw new Error("管理员会话无效，请重新登录");
  }
}

function setAdminSessionCookie(
  reply: { header(name: string, value: string): unknown },
  token: string,
  secure: boolean
): void {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${8 * 60 * 60}`
  ];
  if (secure) attributes.push("Secure");
  reply.header("set-cookie", attributes.join("; "));
}

function clearAdminSessionCookie(
  reply: { header(name: string, value: string): unknown },
  secure: boolean
): void {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];
  if (secure) attributes.push("Secure");
  reply.header("set-cookie", attributes.join("; "));
}

function setAccountSessionCookie(
  reply: { header(name: string, value: string): unknown },
  token: string,
  secure: boolean
): void {
  const attributes = [
    `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${30 * 24 * 60 * 60}`
  ];
  if (secure) attributes.push("Secure");
  reply.header("set-cookie", attributes.join("; "));
}

function clearAccountSessionCookie(
  reply: { header(name: string, value: string): unknown },
  secure: boolean
): void {
  const attributes = [
    `${ACCOUNT_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];
  if (secure) attributes.push("Secure");
  reply.header("set-cookie", attributes.join("; "));
}

function consumeLoginAttempt(
  windows: Map<string, { startedAt: number; count: number }>,
  key: string
): boolean {
  const now = Date.now();
  if (windows.size > 1000) {
    for (const [candidate, value] of windows) {
      if (now - value.startedAt >= 15 * 60_000) windows.delete(candidate);
    }
  }
  const window = windows.get(key);
  if (!window || now - window.startedAt >= 15 * 60_000) {
    windows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  window.count += 1;
  return window.count <= 10;
}
