import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  acknowledgeFirstNightPrompt,
  acknowledgeOtherNightPrompt,
  alivePlayerIds,
  canPlayerVote,
  createFirstNightState,
  createGameStateAfterFirstNight,
  createTroubleBrewingSetup,
  currentVoterPlayerId,
  getFirstNightPrompt,
  getOtherNightPrompt,
  nominatePlayer as nominateInGame,
  requestCloseNominations as requestCloseInGame,
  requestNominations as requestNominationsInGame,
  ROLE_BY_ID,
  setVoteIntent,
  startOtherNight,
  submitFirstNightSelection,
  submitOtherNightSelection,
  tickVote,
  useSlayerClaim,
  type FirstNightPrompt,
  type FirstNightResult,
  type OtherNightPrompt,
  type OtherNightResult,
  type RoleId,
  type TroubleBrewingGameState,
  type TroubleBrewingSetup
} from "@party-games/clocktower";
import type {
  ClocktowerDayView,
  ClocktowerNightActionView,
  ClocktowerNightResultView,
  ClocktowerRoleView,
  CreateRoomRequest,
  DayActionPermissions,
  JoinRoomRequest,
  NightPlayerView,
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
import type { InternalPlayer, InternalRoomState, RoomEvent } from "./domain.js";
import type { PresenceTracker } from "./presence.js";
import type { SqliteRoomRepository } from "./repository.js";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function comparePlayersBySeat(left: InternalPlayer, right: InternalPlayer): number {
  if (left.seat === null && right.seat === null) {
    return left.nickname.localeCompare(right.nickname, "zh-CN");
  }
  if (left.seat === null) return 1;
  if (right.seat === null) return -1;
  return left.seat - right.seat;
}

export class RoomService {
  readonly #locks = new Map<string, Promise<void>>();
  readonly #lastChatAt = new Map<string, number>();

  constructor(
    private readonly repository: SqliteRoomRepository,
    private readonly presence: PresenceTracker
  ) {}

  async createRoom(input: CreateRoomRequest): Promise<RoomSessionResponse> {
    if (input.gameType !== "clocktower") {
      throw new Error("德州扑克模块尚未开放");
    }

    const roomCode = this.#createRoomCode();
    const playerId = randomUUID();
    const sessionToken = createSessionToken();
    const recoveryCode = createRecoveryCode();
    const now = new Date().toISOString();
    const state: InternalRoomState = {
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
          nickname: input.nickname,
          seat: null,
          ready: false
        }
      ]
    };

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

  async joinRoom(input: JoinRoomRequest): Promise<RoomSessionResponse> {
    return this.#withLock(input.roomCode, async () => {
      const state = this.#requireRoom(input.roomCode);
      if (state.phase !== "lobby") throw new Error("游戏已经开始");
      if (state.players.length >= 15) throw new Error("房间人数已满");
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
          { id: playerId, nickname: input.nickname, seat: null, ready: false }
        ]
      });
      const event: RoomEvent = {
        type: "PLAYER_JOINED",
        actorPlayerId: playerId,
        payload: { nickname: input.nickname, seat: null }
      };

      this.repository.commit(state.version, nextState, event, {
        playerId,
        tokenHash: hashSecret(sessionToken),
        recoveryHash: hashSecret(recoveryCode)
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

    let privateGame: RoomView["self"]["privateGame"];
    if (state.phase !== "lobby" && state.clocktower) {
      const assignment = state.clocktower.setup.assignments.find(
        (candidate) => candidate.playerId === playerId
      );
      if (!assignment) throw new Error("玩家身份尚未分配");
      const currentPlayerState = state.clocktower.game?.players[playerId];
      const visibleRoleId =
        currentPlayerState && currentPlayerState.roleId !== assignment.actualRoleId
          ? currentPlayerState.roleId
          : assignment.shownRoleId;
      const shownRole = ROLE_BY_ID.get(visibleRoleId as RoleId);
      if (!shownRole) throw new Error("角色资料不存在");
      const firstNightPrompt = state.phase === "first-night" && state.clocktower.firstNight
        ? getFirstNightPrompt(state.clocktower.setup, state.clocktower.firstNight, playerId)
        : undefined;
      const otherNightPrompt =
        state.phase === "night" && state.clocktower.game
          ? getOtherNightPrompt(state.clocktower.setup, state.clocktower.game, playerId)
          : undefined;
      const nightPrompt = firstNightPrompt ?? otherNightPrompt;
      privateGame = {
        role: {
          id: shownRole.id,
          name: shownRole.name,
          englishName: shownRole.englishName,
          team: currentPlayerState?.alignment ?? assignment.alignment,
          type: shownRole.type,
          ability: shownRole.ability
        },
        alignment: currentPlayerState?.alignment ?? assignment.alignment,
        ...(nightPrompt
          ? { nightAction: this.#nightActionView(state, nightPrompt) }
          : {})
      };
    }

    const game = state.clocktower?.game;
    const dayActions = game ? this.#dayActionPermissions(game, playerId) : undefined;
    const chatMessages = this.repository.getVisibleChatMessages(state.id, playerId);

    return {
      room: {
        code: state.code,
        gameType: state.gameType,
        phase: state.phase,
        ownerPlayerId: state.ownerPlayerId,
        version: state.version,
        ...(state.clocktower ? { seedCommitment: state.clocktower.seedCommitment } : {}),
        ...(state.clocktower?.dayNumber
          ? { dayNumber: state.clocktower.dayNumber }
          : {}),
        ...(game ? { clocktowerDay: this.#dayView(game) } : {}),
        players: [...state.players]
          .sort(comparePlayersBySeat)
          .map((player) => ({
            id: player.id,
            nickname: player.nickname,
            seat: player.seat,
            ready: player.ready,
            connected: this.presence.isConnected(state.code, player.id),
            ...(state.clocktower
              ? {
                  roleConfirmed: state.clocktower.roleConfirmedPlayerIds.includes(player.id)
                }
              : {}),
            ...(game
              ? {
                  alive: game.players[player.id]?.alive ?? false,
                  ghostVoteAvailable:
                    game.players[player.id]?.alive === false &&
                    !game.ghostVoteUsedPlayerIds.includes(player.id)
                }
              : {})
          }))
      },
      self: {
        playerId,
        isOwner: state.ownerPlayerId === playerId,
        ...(privateGame ? { privateGame } : {}),
        ...(dayActions ? { dayActions } : {})
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
      if (state.players.length < 5 || state.players.length > 15) {
        throw new Error("暗流涌动需要 5 到 15 名玩家");
      }
      if (state.players.some((player) => player.seat === null)) {
        throw new Error("仍有玩家未入座");
      }
      if (state.players.some((player) => !player.ready)) {
        throw new Error("仍有玩家未准备");
      }

      const seed = randomBytes(32).toString("hex");
      const orderedPlayerIds = [...state.players]
        .sort(comparePlayersBySeat)
        .map((player) => player.id);
      const setup = createTroubleBrewingSetup(orderedPlayerIds, seed);
      const seedCommitment = createHash("sha256")
        .update(`clocktower:${state.id}:${seed}`)
        .digest("hex");
      const nextState = this.#nextState(state, {
        phase: "role-reveal",
        clocktower: {
          setup,
          seedCommitment,
          roleConfirmedPlayerIds: [],
          dayNumber: 0
        }
      });

      this.repository.commit(state.version, nextState, {
        type: "GAME_STARTED",
        actorPlayerId: playerId,
        payload: {
          seedCommitment,
          playerCount: state.players.length,
          rolesInPlay: setup.rolesInPlay
        }
      });
    });
  }

  async confirmRole(roomCode: string, playerId: string): Promise<void> {
    await this.#mutate(roomCode, playerId, "ROLE_CONFIRMED", {}, (state) => {
      if (state.phase !== "role-reveal" || !state.clocktower) {
        throw new Error("当前不能确认身份");
      }
      if (state.clocktower.roleConfirmedPlayerIds.includes(playerId)) {
        return {};
      }

      const roleConfirmedPlayerIds = [
        ...state.clocktower.roleConfirmedPlayerIds,
        playerId
      ];
      if (roleConfirmedPlayerIds.length < state.players.length) {
        return {
          clocktower: { ...state.clocktower, roleConfirmedPlayerIds }
        };
      }

      const firstNight = createFirstNightState(state.clocktower.setup);
      const game = firstNight.complete
        ? createGameStateAfterFirstNight(state.clocktower.setup, firstNight)
        : undefined;
      return {
        phase: firstNight.complete ? "day" : "first-night",
        clocktower: {
          ...state.clocktower,
          roleConfirmedPlayerIds,
          firstNight,
          ...(game ? { game } : {}),
          dayNumber: firstNight.complete ? 1 : 0
        }
      };
    });
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
    await this.#mutate(
      roomCode,
      playerId,
      "NIGHT_SELECTION",
      { selectedPlayerIds },
      (state) => {
        if (state.phase === "first-night" && state.clocktower?.firstNight) {
          const firstNight = submitFirstNightSelection(
            state.clocktower.setup,
            state.clocktower.firstNight,
            playerId,
            selectedPlayerIds
          );
          const game = firstNight.complete
            ? createGameStateAfterFirstNight(state.clocktower.setup, firstNight)
            : undefined;
          return {
            phase: firstNight.complete ? "day" : "first-night",
            clocktower: {
              ...state.clocktower,
              firstNight,
              ...(game ? { game } : {}),
              dayNumber: firstNight.complete ? 1 : state.clocktower.dayNumber
            }
          };
        }

        if (state.phase !== "night" || !state.clocktower?.game?.night) {
          throw new Error("当前没有可提交的夜间行动");
        }
        const game = submitOtherNightSelection(
          state.clocktower.setup,
          state.clocktower.game,
          playerId,
          selectedPlayerIds
        );
        return {
          phase: this.#phaseForGame(game),
          clocktower: {
            ...state.clocktower,
            game,
            dayNumber: game.day.number
          }
        };
      }
    );
  }

  async acknowledgeFirstNight(roomCode: string, playerId: string): Promise<void> {
    await this.acknowledgeNight(roomCode, playerId);
  }

  async acknowledgeNight(roomCode: string, playerId: string): Promise<void> {
    await this.#mutate(
      roomCode,
      playerId,
      "NIGHT_ACKNOWLEDGED",
      {},
      (state) => {
        if (state.phase === "first-night" && state.clocktower?.firstNight) {
          const firstNight = acknowledgeFirstNightPrompt(
            state.clocktower.setup,
            state.clocktower.firstNight,
            playerId
          );
          const game = firstNight.complete
            ? createGameStateAfterFirstNight(state.clocktower.setup, firstNight)
            : undefined;
          return {
            phase: firstNight.complete ? "day" : "first-night",
            clocktower: {
              ...state.clocktower,
              firstNight,
              ...(game ? { game } : {}),
              dayNumber: firstNight.complete ? 1 : state.clocktower.dayNumber
            }
          };
        }

        if (state.phase !== "night" || !state.clocktower?.game?.night) {
          throw new Error("当前没有需要确认的夜间信息");
        }
        const game = acknowledgeOtherNightPrompt(
          state.clocktower.setup,
          state.clocktower.game,
          playerId
        );
        return {
          phase: this.#phaseForGame(game),
          clocktower: {
            ...state.clocktower,
            game,
            dayNumber: game.day.number
          }
        };
      }
    );
  }

  async requestNominations(roomCode: string, playerId: string): Promise<void> {
    await this.#mutateGame(
      roomCode,
      playerId,
      "NOMINATIONS_REQUESTED",
      {},
      (setup, game) => requestNominationsInGame(game, playerId)
    );
  }

  async nominate(roomCode: string, playerId: string, targetPlayerId: string): Promise<void> {
    await this.#mutateGame(
      roomCode,
      playerId,
      "PLAYER_NOMINATED",
      { targetPlayerId },
      (setup, game) =>
        nominateInGame(setup, game, playerId, targetPlayerId, Date.now(), 2500)
    );
  }

  async requestCloseNominations(roomCode: string, playerId: string): Promise<void> {
    await this.#mutateGame(
      roomCode,
      playerId,
      "NOMINATIONS_CLOSE_REQUESTED",
      {},
      (setup, game) => requestCloseInGame(setup, game, playerId)
    );
  }

  async setVoteIntent(roomCode: string, playerId: string, voting: boolean): Promise<void> {
    await this.#mutateGame(
      roomCode,
      playerId,
      "VOTE_INTENT_SET",
      { voting },
      (_setup, game) => setVoteIntent(game, playerId, voting)
    );
  }

  async claimSlayer(
    roomCode: string,
    playerId: string,
    targetPlayerId: string
  ): Promise<void> {
    await this.#mutateGame(
      roomCode,
      playerId,
      "SLAYER_CLAIMED",
      { targetPlayerId },
      (setup, game) => useSlayerClaim(setup, game, playerId, targetPlayerId)
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
    const changedRoomCodes: string[] = [];
    for (const roomCode of this.repository.listRoomCodes()) {
      await this.#withLock(roomCode, async () => {
        const state = this.#requireRoom(roomCode);
        if (state.phase !== "voting" || !state.clocktower?.game) return;
        const game = tickVote(state.clocktower.game, now);
        if (game === state.clocktower.game) return;

        const nextState = this.#nextState(state, {
          phase: this.#phaseForGame(game),
          clocktower: {
            ...state.clocktower,
            game,
            dayNumber: game.day.number
          }
        });
        this.repository.commit(state.version, nextState, {
          type: "VOTE_TICK",
          actorPlayerId: "system",
          payload: {
            cursorIndex: game.day.currentVote?.cursorIndex ?? null,
            stage: game.day.stage
          }
        });
        changedRoomCodes.push(roomCode);
      });
    }
    return changedRoomCodes;
  }

  #requireRoom(code: string): InternalRoomState {
    const state = this.repository.getRoom(code);
    if (!state) throw new Error("房间不存在");
    return state;
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

  async #mutateGame(
    roomCode: string,
    playerId: string,
    type: RoomEvent["type"],
    payload: Record<string, unknown>,
    mutate: (
      setup: TroubleBrewingSetup,
      game: TroubleBrewingGameState
    ) => TroubleBrewingGameState
  ): Promise<void> {
    await this.#mutate(roomCode, playerId, type, payload, (state) => {
      if (!state.clocktower?.game) throw new Error("白天游戏状态尚未初始化");
      let game = mutate(state.clocktower.setup, state.clocktower.game);
      if (!game.winner && game.day.stage === "complete" && !game.night) {
        game = startOtherNight(state.clocktower.setup, game);
      }
      return {
        phase: this.#phaseForGame(game),
        clocktower: {
          ...state.clocktower,
          game,
          dayNumber: game.day.number
        }
      };
    });
  }

  #phaseForGame(game: TroubleBrewingGameState): InternalRoomState["phase"] {
    if (game.winner) return "game-over";
    if (game.night) return "night";
    if (game.day.stage === "discussion") return "day";
    if (game.day.stage === "nominations") return "nominations";
    if (game.day.stage === "voting") return "voting";
    return "night";
  }

  #dayView(game: TroubleBrewingGameState): ClocktowerDayView {
    const vote = game.day.currentVote;
    const lockedPlayerIds = vote?.order.slice(0, vote.cursorIndex) ?? [];
    const currentVoter = currentVoterPlayerId(game);
    return {
      stage: game.day.stage,
      nominationRequestPlayerIds: [...game.day.nominationRequestPlayerIds],
      closeRequestPlayerIds: [...game.day.closeRequestPlayerIds],
      nominatorsUsedPlayerIds: [...game.day.nominatorsUsedPlayerIds],
      nomineesUsedPlayerIds: [...game.day.nomineesUsedPlayerIds],
      slayerClaimUsedPlayerIds: [...game.slayerClaimUsedPlayerIds],
      blockVoteCount: game.day.blockVoteCount,
      blockNomineePlayerIds: [...game.day.blockNomineePlayerIds],
      ...(vote
        ? {
            currentVote: {
              nominatorPlayerId: vote.nominatorPlayerId,
              nomineePlayerId: vote.nomineePlayerId,
              order: [...vote.order],
              cursorIndex: vote.cursorIndex,
              ...(currentVoter ? { currentVoterPlayerId: currentVoter } : {}),
              nextLockAt: vote.nextLockAt,
              raisedPlayerIds: vote.order.filter(
                (playerId, index) => index >= vote.cursorIndex && vote.intents[playerId]
              ),
              lockedYesPlayerIds: lockedPlayerIds.filter(
                (playerId) => vote.lockedVotes[playerId]
              ),
              lockedNoPlayerIds: lockedPlayerIds.filter(
                (playerId) => !vote.lockedVotes[playerId]
              )
            }
          }
        : {}),
      publicEvents: [...game.day.publicEvents],
      ...(game.winner ? { winner: game.winner } : {}),
      ...(game.endReason ? { endReason: game.endReason } : {})
    };
  }

  #dayActionPermissions(
    game: TroubleBrewingGameState,
    playerId: string
  ): DayActionPermissions {
    const player = game.players[playerId];
    const alive = player?.alive === true;
    const vote = game.day.currentVote;
    const voterIndex = vote?.order.indexOf(playerId) ?? -1;
    return {
      canRequestNominations:
        alive &&
        game.day.stage === "discussion" &&
        !game.day.nominationRequestPlayerIds.includes(playerId),
      canNominate:
        alive &&
        game.day.stage === "nominations" &&
        !game.day.nominatorsUsedPlayerIds.includes(playerId),
      canRequestClose:
        alive &&
        game.day.stage === "nominations" &&
        !game.day.closeRequestPlayerIds.includes(playerId),
      canSetVoteIntent:
        game.day.stage === "voting" &&
        Boolean(vote) &&
        voterIndex >= (vote?.cursorIndex ?? Number.POSITIVE_INFINITY) &&
        canPlayerVote(game, playerId),
      currentVoteIntent: vote?.intents[playerId] === true,
      canSlayerClaim:
        alive &&
        (game.day.stage === "discussion" || game.day.stage === "nominations") &&
        !game.slayerClaimUsedPlayerIds.includes(playerId)
    };
  }

  #nextState(
    state: InternalRoomState,
    changes: Partial<InternalRoomState>
  ): InternalRoomState {
    return {
      ...state,
      ...changes,
      version: state.version + 1,
      updatedAt: new Date().toISOString()
    };
  }

  #nightActionView(
    state: InternalRoomState,
    prompt: FirstNightPrompt | OtherNightPrompt
  ): ClocktowerNightActionView {
    return {
      stepId: prompt.stepId,
      title: prompt.title,
      instruction: prompt.instruction,
      kind: prompt.kind,
      ...(prompt.allowedPlayerIds
        ? {
            options: prompt.allowedPlayerIds.map((playerId) =>
              this.#nightPlayerView(state, playerId)
            )
          }
        : {}),
      ...(prompt.result
        ? { result: this.#nightResultView(state, prompt.result) }
        : {})
    };
  }

  #nightResultView(
    state: InternalRoomState,
    result: FirstNightResult | OtherNightResult
  ): ClocktowerNightResultView {
    if (result.kind === "number") return result;
    if (result.kind === "no-outsiders") return result;
    if (result.kind === "yes-no") return result;
    if (result.kind === "role") {
      return { kind: "role", role: this.#roleView(result.roleId) };
    }
    if (result.kind === "role-pair") {
      return {
        kind: result.kind,
        role: this.#roleView(result.roleId),
        players: result.playerIds.map((playerId) => this.#nightPlayerView(state, playerId))
      };
    }
    if (result.kind === "evil-team") {
      return {
        kind: result.kind,
        demonPlayers: result.demonPlayerIds.map((playerId) =>
          this.#nightPlayerView(state, playerId)
        ),
        minionPlayers: result.minionPlayerIds.map((playerId) =>
          this.#nightPlayerView(state, playerId)
        ),
        bluffs: result.bluffRoleIds.map((roleId) => this.#roleView(roleId))
      };
    }

    if (result.kind === "current-grimoire") {
      const clocktower = state.clocktower;
      const game = clocktower?.game;
      if (!clocktower || !game) throw new Error("当前魔典状态不存在");
      return {
        kind: "grimoire",
        players: game.playerOrder
          .map((playerId) => {
            const player = game.players[playerId];
            const assignment = clocktower.setup.assignments.find(
              (candidate) => candidate.playerId === playerId
            );
            if (!player || !assignment) throw new Error("魔典玩家状态不存在");
            const shownRole =
              player.roleId === "drunk" && player.shownRoleId !== player.roleId
                ? this.#roleView(player.shownRoleId)
                : undefined;
            return {
              ...this.#nightPlayerView(state, playerId),
              role: this.#roleView(player.roleId),
              ...(shownRole ? { shownRole } : {}),
              alive: player.alive,
              redHerring: clocktower.setup.redHerringPlayerId === playerId,
              poisoned: result.poisonTargetPlayerId === playerId,
              protected: result.monkProtectedPlayerId === playerId
            };
          })
          .sort((left, right) => left.seat - right.seat)
      };
    }

    return {
      kind: "grimoire",
      players: result.assignments
        .map((assignment) => {
          const shownRole =
            assignment.shownRoleId !== assignment.actualRoleId
              ? this.#roleView(assignment.shownRoleId)
              : undefined;
          return {
            ...this.#nightPlayerView(state, assignment.playerId),
            role: this.#roleView(assignment.actualRoleId),
            ...(shownRole ? { shownRole } : {}),
            alive: true,
            redHerring: result.redHerringPlayerId === assignment.playerId,
            poisoned: result.poisonTargetPlayerId === assignment.playerId,
            protected: false
          };
        })
        .sort((left, right) => left.seat - right.seat)
    };
  }

  #nightPlayerView(state: InternalRoomState, playerId: string): NightPlayerView {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error("夜间目标玩家不存在");
    if (player.seat === null) throw new Error("游戏玩家缺少座位");
    return {
      playerId,
      nickname: player.nickname,
      seat: player.seat,
      alive: state.clocktower?.game?.players[playerId]?.alive ?? true
    };
  }

  #roleView(roleId: RoleId): ClocktowerRoleView {
    const role = ROLE_BY_ID.get(roleId);
    if (!role) throw new Error(`角色资料不存在: ${roleId}`);
    return {
      id: role.id,
      name: role.name,
      englishName: role.englishName,
      team: role.alignment,
      type: role.type,
      ability: role.ability
    };
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
