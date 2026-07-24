import { randomBytes, randomUUID } from "node:crypto";
import type { GameRegistry } from "@party-games/game-core";
import type { PokerPlayerAction } from "@party-games/poker";
import type {
  AccountUserView,
  CreateRoomRequest,
  GameType,
  JoinRoomRequest,
  RecoverRoomRequest,
  RoomSessionResponse,
  RoomView
} from "@party-games/shared";
import {
  createRecoveryCode,
  createSessionToken,
  hashPassword,
  hashSecret,
  verifyPassword
} from "./auth.js";
import {
  ROOM_STATE_SCHEMA_VERSION,
  type InternalRoomState,
  type RoomEvent
} from "./domain.js";
import { createGameRegistry } from "./games/index.js";
import type { ServerGameModule } from "./platform/game-module.js";
import { comparePlayersBySeat } from "./platform/players.js";
import type { PresenceTracker } from "./presence.js";
import type { SqliteRoomRepository } from "./repository.js";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class RoomService {
  readonly #locks = new Map<string, Promise<void>>();
  readonly #lastChatAt = new Map<string, number>();

  constructor(
    private readonly repository: SqliteRoomRepository,
    private readonly presence: PresenceTracker,
    private readonly games: GameRegistry<GameType, ServerGameModule> = createGameRegistry()
  ) {}

  async createRoom(
    input: CreateRoomRequest,
    accountUser?: AccountUserView
  ): Promise<RoomSessionResponse> {
    if (!this.games.has(input.gameType)) {
      throw new Error(input.gameType === "poker" ? "德州扑克模块尚未开放" : "游戏模块尚未开放");
    }

    const roomCode = this.#createRoomCode();
    const playerId = randomUUID();
    const sessionToken = createSessionToken();
    const recoveryCode = createRecoveryCode();
    const now = new Date().toISOString();
    const aiPlayerCount = input.gameType === "poker" ? (input.poker.aiPlayerCount ?? 0) : 0;
    const pokerConfig =
      input.gameType === "poker" && aiPlayerCount > 0
        ? { ...input.poker, aiDifficulty: input.poker.aiDifficulty ?? "normal" }
        : input.gameType === "poker"
          ? input.poker
          : undefined;
    const state: InternalRoomState = {
      schemaVersion: ROOM_STATE_SCHEMA_VERSION,
      id: randomUUID(),
      code: roomCode,
      gameType: input.gameType,
      phase: "lobby",
      ownerPlayerId: playerId,
      version: 0,
      createdAt: now,
      updatedAt: now,
      players: [
        {
          id: playerId,
          ...(accountUser ? { accountUserId: accountUser.id } : {}),
          nickname: input.nickname,
          seat: aiPlayerCount > 0 ? 1 : null,
          ready: aiPlayerCount > 0
        },
        ...Array.from({ length: aiPlayerCount }, (_, index) => ({
          id: `bot:${randomUUID()}`,
          nickname: `AI ${index + 1}`,
          seat: index + 2,
          ready: true,
          isBot: true
        }))
      ],
      ...(pokerConfig ? { poker: { config: pokerConfig } } : {})
    };
    this.#gameModule(state).validate(state);

    this.repository.createRoom(
      state,
      hashPassword(input.password),
      {
        playerId,
        tokenHash: hashSecret(sessionToken),
        recoveryHash: hashSecret(recoveryCode)
      },
      {
        type: "ROOM_CREATED",
        actorPlayerId: playerId,
        payload: { gameType: input.gameType }
      }
    );

    return { roomCode, playerId, sessionToken, recoveryCode };
  }

  async joinRoom(
    input: JoinRoomRequest,
    accountUser?: AccountUserView
  ): Promise<RoomSessionResponse> {
    return this.#withLock(input.roomCode, async () => {
      const state = this.#requireRoom(input.roomCode);
      if (state.phase !== "lobby") throw new Error("游戏已经开始");
      if (state.gameType === "poker" && (state.poker?.config.aiPlayerCount ?? 0) > 0) {
        throw new Error("单人 AI 房间不接受其他玩家加入");
      }
      if (state.players.length >= 15) throw new Error("房间人数已满");
      if (
        accountUser &&
        state.players.some((player) => player.accountUserId === accountUser.id)
      ) {
        throw new Error("当前账号已在房间中，请使用恢复码恢复身份");
      }
      if (
        state.players.some(
          (player) => player.nickname.localeCompare(input.nickname, undefined, { sensitivity: "accent" }) === 0
        )
      ) {
        throw new Error("房间中已经存在相同昵称");
      }

      const password = this.repository.getPassword(input.roomCode);
      if (!password || !verifyPassword(input.password, password)) {
        throw new Error("房间口令错误");
      }

      const playerId = randomUUID();
      const sessionToken = createSessionToken();
      const recoveryCode = createRecoveryCode();
      const nextState = this.#nextState(state, {
        players: [
          ...state.players,
          {
            id: playerId,
            ...(accountUser ? { accountUserId: accountUser.id } : {}),
            nickname: input.nickname,
            seat: null,
            ready: false
          }
        ]
      });
      const event: RoomEvent = {
        type: "PLAYER_JOINED",
        actorPlayerId: playerId,
        payload: { nickname: input.nickname, seat: null }
      };

      this.repository.commit(state.version, nextState, event, {
        newSession: {
          playerId,
          tokenHash: hashSecret(sessionToken),
          recoveryHash: hashSecret(recoveryCode)
        }
      });

      return { roomCode: state.code, playerId, sessionToken, recoveryCode };
    });
  }

  async recoverRoom(input: RecoverRoomRequest): Promise<RoomSessionResponse> {
    const session = this.repository.findSessionByRecovery(
      input.roomCode,
      hashSecret(input.recoveryCode)
    );
    if (!session) throw new Error("恢复码无效");

    const state = this.#requireRoom(input.roomCode);
    if (state.id !== session.room_id) throw new Error("恢复码与房间不匹配");

    const sessionToken = createSessionToken();
    this.repository.rotateSessionToken(session.player_id, hashSecret(sessionToken));
    return {
      roomCode: input.roomCode,
      playerId: session.player_id,
      sessionToken,
      recoveryCode: input.recoveryCode
    };
  }

  authenticate(roomCode: string, sessionToken: string): string {
    const session = this.repository.findSessionByToken(hashSecret(sessionToken));
    if (!session) throw new Error("会话无效，请重新加入或使用恢复码");
    const room = this.#requireRoom(roomCode);
    if (room.id !== session.room_id) throw new Error("会话与房间不匹配");
    return session.player_id;
  }

  getView(roomCode: string, playerId: string): RoomView {
    const state = this.#requireRoom(roomCode);
    const self = state.players.find((player) => player.id === playerId);
    if (!self) throw new Error("玩家不在房间中");
    const projection = this.#gameModule(state).project(state, { playerId });
    const chatMessages = this.repository.getVisibleChatMessages(state.id, playerId);

    return {
      room: {
        code: state.code,
        gameType: state.gameType,
        phase: state.phase,
        ownerPlayerId: state.ownerPlayerId,
        version: state.version,
        ...projection.room,
        players: [...state.players]
          .sort(comparePlayersBySeat)
          .map((player) => ({
            id: player.id,
            ...(player.accountUserId ? { accountUserId: player.accountUserId } : {}),
            nickname: player.nickname,
            seat: player.seat,
            ready: player.ready,
            connected: this.presence.isConnected(state.code, player.id),
            ...(player.isBot ? { isBot: true } : {}),
            ...projection.playerStates[player.id]
          }))
      },
      self: {
        playerId,
        isOwner: state.ownerPlayerId === playerId,
        ...projection.self
      },
      chatMessages
    };
  }

  async setReady(roomCode: string, playerId: string, ready: boolean): Promise<void> {
    await this.#mutate(roomCode, playerId, "PLAYER_READY_SET", { ready }, (state) => {
      if (state.phase !== "lobby") throw new Error("游戏开始后不能修改准备状态");
      const player = state.players.find((candidate) => candidate.id === playerId);
      if (ready && player?.seat === null) throw new Error("请先选择座位");
      return {
        players: state.players.map((player) =>
          player.id === playerId ? { ...player, ready } : player
        )
      };
    });
  }

  async setSeat(roomCode: string, playerId: string, seat: number | null): Promise<void> {
    await this.#mutate(roomCode, playerId, "PLAYER_SEAT_SET", { seat }, (state) => {
      if (state.phase !== "lobby") throw new Error("游戏开始后不能调整座位");
      if (
        seat !== null &&
        (!Number.isInteger(seat) || seat < 1 || seat > state.players.length)
      ) {
        throw new Error(`座位必须在 1 到 ${state.players.length} 之间`);
      }
      if (
        seat !== null &&
        state.players.some((player) => player.id !== playerId && player.seat === seat)
      ) {
        throw new Error("该座位已被占用");
      }
      return {
        players: state.players.map((player) =>
          player.id === playerId ? { ...player, seat, ready: false } : player
        )
      };
    });
  }

  async startRoom(roomCode: string, playerId: string): Promise<void> {
    await this.#withLock(roomCode, async () => {
      const state = this.#requireRoom(roomCode);
      if (state.ownerPlayerId !== playerId) throw new Error("只有房主可以开始游戏");
      if (state.phase !== "lobby") throw new Error("游戏已经开始");
      if (state.players.some((player) => player.seat === null)) {
        throw new Error("仍有玩家未入座");
      }
      if (state.players.some((player) => !player.ready)) {
        throw new Error("仍有玩家未准备");
      }

      const seed = randomBytes(32).toString("hex");
      const update = this.#gameModule(state).create(state, { seed, now: Date.now() });
      const nextState = this.#nextState(state, update.changes);

      this.repository.commit(state.version, nextState, {
        type: "GAME_STARTED",
        actorPlayerId: playerId,
        payload: update.eventPayload ?? {}
      });
    });
  }

  async confirmRole(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "ROLE_CONFIRMED",
      "clocktower:confirm-role",
      {}
    );
  }

  async resetGame(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "GAME_RESET",
      "clocktower:rematch",
      {}
    );
  }

  async submitFirstNightSelection(
    roomCode: string,
    playerId: string,
    selectedPlayerIds: string[]
  ): Promise<void> {
    await this.submitNightSelection(roomCode, playerId, selectedPlayerIds);
  }

  async submitNightSelection(
    roomCode: string,
    playerId: string,
    selectedPlayerIds: string[]
  ): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "NIGHT_SELECTION",
      "clocktower:night-select",
      { selectedPlayerIds }
    );
  }

  async acknowledgeFirstNight(roomCode: string, playerId: string): Promise<void> {
    await this.acknowledgeNight(roomCode, playerId);
  }

  async acknowledgeNight(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "NIGHT_ACKNOWLEDGED",
      "clocktower:night-ack",
      {}
    );
  }

  async requestNominations(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "NOMINATIONS_REQUESTED",
      "clocktower:request-nominations",
      {}
    );
  }

  async nominate(roomCode: string, playerId: string, targetPlayerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "PLAYER_NOMINATED",
      "clocktower:nominate",
      { targetPlayerId }
    );
  }

  async requestCloseNominations(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "NOMINATIONS_CLOSE_REQUESTED",
      "clocktower:request-close-nominations",
      {}
    );
  }

  async setVoteIntent(roomCode: string, playerId: string, voting: boolean): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "VOTE_INTENT_SET",
      "clocktower:set-vote",
      { voting }
    );
  }

  async claimSlayer(
    roomCode: string,
    playerId: string,
    targetPlayerId: string
  ): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "SLAYER_CLAIMED",
      "clocktower:slayer-claim",
      { targetPlayerId }
    );
  }

  async dealPokerHand(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_HAND_DEALT",
      "poker:deal",
      {}
    );
  }

  async actPoker(
    roomCode: string,
    playerId: string,
    action: PokerPlayerAction,
    amount?: number
  ): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_ACTION",
      "poker:act",
      { action, ...(amount === undefined ? {} : { amount }) }
    );
  }

  async rebuyPoker(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(roomCode, playerId, "POKER_REBUY", "poker:rebuy", {});
  }

  async cashOutPoker(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_CASHED_OUT",
      "poker:cash-out",
      {}
    );
  }

  async buyInPoker(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_BOUGHT_IN",
      "poker:buy-in",
      {}
    );
  }

  async advancePokerBlinds(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_BLINDS_ADVANCED",
      "poker:advance-blinds",
      {}
    );
  }

  async pausePokerBlinds(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_BLINDS_PAUSED",
      "poker:pause-blinds",
      {}
    );
  }

  async resumePokerBlinds(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_BLINDS_RESUMED",
      "poker:resume-blinds",
      {}
    );
  }

  async rematchPoker(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "POKER_REMATCHED",
      "poker:rematch",
      {}
    );
  }

  async askTurtleSoup(
    roomCode: string,
    playerId: string,
    question: string
  ): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "TURTLE_SOUP_QUESTION_ASKED",
      "turtle-soup:ask",
      { question }
    );
  }

  async guessTurtleSoup(
    roomCode: string,
    playerId: string,
    guess: string
  ): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "TURTLE_SOUP_GUESS_SUBMITTED",
      "turtle-soup:guess",
      { guess }
    );
  }

  async requestTurtleSoupHint(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "TURTLE_SOUP_HINT_REQUESTED",
      "turtle-soup:hint",
      {}
    );
  }

  async rematchTurtleSoup(roomCode: string, playerId: string): Promise<void> {
    await this.#handleGameCommand(
      roomCode,
      playerId,
      "TURTLE_SOUP_REMATCHED",
      "turtle-soup:rematch",
      {}
    );
  }

  sendChat(
    roomCode: string,
    playerId: string,
    message: { recipientPlayerId?: string; content: string }
  ): void {
    const state = this.#requireRoom(roomCode);
    if (!state.players.some((player) => player.id === playerId)) {
      throw new Error("玩家不在房间中");
    }
    if (!['day', 'nominations', 'voting'].includes(state.phase)) {
      throw new Error("当前阶段不能发送聊天消息");
    }

    const content = message.content.trim();
    if (content.length === 0 || content.length > 500) {
      throw new Error("消息长度必须在 1 到 500 个字符之间");
    }
    if (
      message.recipientPlayerId &&
      !state.players.some((player) => player.id === message.recipientPlayerId)
    ) {
      throw new Error("私聊目标不在房间中");
    }
    if (message.recipientPlayerId === playerId) {
      throw new Error("不能给自己发送私聊");
    }

    const now = Date.now();
    const rateKey = `${roomCode}:${playerId}`;
    if (now - (this.#lastChatAt.get(rateKey) ?? 0) < 400) {
      throw new Error("发送过快，请稍后再试");
    }
    this.#lastChatAt.set(rateKey, now);
    this.repository.addChatMessage(state.id, {
      id: randomUUID(),
      senderPlayerId: playerId,
      ...(message.recipientPlayerId
        ? { recipientPlayerId: message.recipientPlayerId }
        : {}),
      content,
      createdAt: new Date(now).toISOString()
    });
  }

  async tickActiveVotes(now = Date.now()): Promise<string[]> {
    return this.#tickRooms(this.repository.listRoomCodes("voting"), now);
  }

  async tickActiveGames(now = Date.now()): Promise<string[]> {
    const roomCodes = new Set([
      ...this.repository.listRoomCodes("voting"),
      ...this.repository.listRoomCodes("playing")
    ]);
    return this.#tickRooms([...roomCodes], now);
  }

  async #tickRooms(roomCodes: readonly string[], now: number): Promise<string[]> {
    const changedRoomCodes: string[] = [];
    for (const roomCode of roomCodes) {
      await this.#withLock(roomCode, async () => {
        const state = this.#requireRoom(roomCode);
        const update = this.#gameModule(state).tick(state, { now });
        if (!update) return;
        if (!update.event) throw new Error("游戏计时更新缺少事件");
        const nextState = this.#nextState(state, update.changes);
        this.repository.commit(state.version, nextState, update.event);
        changedRoomCodes.push(roomCode);
      });
    }
    return changedRoomCodes;
  }

  #requireRoom(code: string): InternalRoomState {
    const stored = this.repository.getRoom(code);
    if (!stored) throw new Error("房间不存在");
    const module = this.#gameModule(stored);
    const state = module.migrate(stored);
    module.validate(state);
    return state;
  }

  #gameModule(state: Pick<InternalRoomState, "gameType">): ServerGameModule {
    return this.games.get(state.gameType);
  }

  #createRoomCode(): string {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const bytes = randomBytes(6);
      const code = Array.from(bytes, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join("");
      if (!this.repository.roomCodeExists(code)) return code;
    }
    throw new Error("暂时无法生成房间码，请重试");
  }

  async #mutate(
    roomCode: string,
    playerId: string,
    type: RoomEvent["type"],
    payload: Record<string, unknown>,
    mutate: (state: InternalRoomState) => Partial<InternalRoomState>
  ): Promise<void> {
    await this.#withLock(roomCode, async () => {
      const state = this.#requireRoom(roomCode);
      if (!state.players.some((player) => player.id === playerId)) {
        throw new Error("玩家不在房间中");
      }
      const nextState = this.#nextState(state, mutate(state));
      this.repository.commit(state.version, nextState, {
        type,
        actorPlayerId: playerId,
        payload
      });
    });
  }

  async #handleGameCommand(
    roomCode: string,
    playerId: string,
    eventType: RoomEvent["type"],
    commandType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.#withLock(roomCode, async () => {
      const state = this.#requireRoom(roomCode);
      if (!state.players.some((player) => player.id === playerId)) {
        throw new Error("玩家不在房间中");
      }
      const update = this.#gameModule(state).handle(
        state,
        { type: commandType, actorPlayerId: playerId, payload },
        { now: Date.now(), seed: randomBytes(32).toString("hex"), voteIntervalMs: 2500 }
      );
      const nextState = this.#nextState(state, update.changes);
      this.repository.commit(
        state.version,
        nextState,
        {
          type: eventType,
          actorPlayerId: playerId,
          payload: update.eventPayload ?? payload
        },
        update.clearChatMessages ? { clearChatMessages: true } : undefined
      );
    });
  }

  #nextState(
    state: InternalRoomState,
    changes: Partial<InternalRoomState>
  ): InternalRoomState {
    const nextState = {
      ...state,
      ...changes,
      version: state.version + 1,
      updatedAt: new Date().toISOString()
    };
    this.#gameModule(nextState).validate(nextState);
    return nextState;
  }

  async #withLock<T>(roomCode: string, task: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(roomCode) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.#locks.set(roomCode, tail);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.#locks.get(roomCode) === tail) this.#locks.delete(roomCode);
    }
  }
}
