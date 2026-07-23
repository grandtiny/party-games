import {
  createPokerTable,
  decidePokerBotAction,
  handlePokerTableCommand,
  migratePokerTable,
  projectPokerTable,
  restorePokerEngine,
  validatePokerTable,
  validatePokerTableSettings,
  type PokerPlayerAction,
  type PokerTableCommand,
  type PokerTableSettings
} from "@party-games/poker";
import type {
  PokerPlayerStatusView,
  PokerRoomConfig,
  PokerTableView as PublicPokerTableView
} from "@party-games/shared";
import { migrateInternalRoomState, type InternalRoomState } from "../domain.js";
import type {
  GameRoomCommand,
  GameRoomCreateContext,
  GameRoomHandleContext,
  GameRoomProjection,
  GameRoomProjectionContext,
  GameRoomTickContext,
  GameRoomUpdate,
  ServerGameModule
} from "../platform/game-module.js";
import { comparePlayersBySeat } from "../platform/players.js";

export const POKER_BOT_ACTION_DELAY_MS = 900;

export class PokerGameModule implements ServerGameModule {
  readonly id = "poker" as const;
  readonly displayName = "德州扑克";
  readonly minPlayers = 2;
  readonly maxPlayers = 9;

  create(state: InternalRoomState, context: GameRoomCreateContext): GameRoomUpdate {
    this.#assertPokerRoom(state);
    const poker = this.#requirePokerState(state);
    const table = this.#createTable(state, poker.config, context.seed, context.now);

    return {
      changes: {
        phase: "playing",
        poker: { ...poker, table }
      },
      eventPayload: {
        mode: poker.config.mode,
        playerCount: state.players.length,
        smallBlind: poker.config.smallBlind,
        bigBlind: poker.config.bigBlind
      }
    };
  }

  handle(
    state: InternalRoomState,
    command: GameRoomCommand,
    context: GameRoomHandleContext
  ): GameRoomUpdate {
    this.#assertPokerRoom(state);
    const poker = this.#requirePokerState(state);
    if (!poker.table) throw new Error("德扑牌桌尚未初始化");
    if (command.type === "poker:rematch") {
      if (state.ownerPlayerId !== command.actorPlayerId) {
        throw new Error("只有房主可以执行该操作");
      }
      if (poker.table.mode !== "tournament" || poker.table.status !== "complete") {
        throw new Error("只有已结束的淘汰赛可以重新开赛");
      }
      const table = this.#createTable(state, poker.config, context.seed, context.now);
      return {
        changes: { phase: "playing", poker: { ...poker, table } },
        eventPayload: { mode: poker.config.mode, playerCount: state.players.length }
      };
    }
    let table = handlePokerTableCommand(
      poker.table,
      this.#pokerCommand(command),
      { now: context.now, ownerPlayerId: state.ownerPlayerId }
    );
    if (
      (command.type === "poker:deal" || command.type === "poker:act") &&
      table.status !== "in-hand"
    ) {
      table = this.#rebuyBustedBots(state, table, context.now + 1);
    }
    return {
      changes: {
        phase: table.status === "complete" ? "game-over" : "playing",
        poker: { ...poker, table }
      },
      eventPayload: {
        command: command.type,
        handNumber: projectPokerTable(table).table.handNumber,
        status: table.status
      }
    };
  }

  project(
    state: InternalRoomState,
    context: GameRoomProjectionContext
  ): GameRoomProjection {
    this.#assertPokerRoom(state);
    const poker = this.#requirePokerState(state);
    if (!poker.table) {
      return {
        room: { pokerConfig: poker.config },
        self: {},
        playerStates: {}
      };
    }

    const projection = projectPokerTable(poker.table, context.playerId);
    return {
      room: {
        pokerConfig: poker.config,
        pokerTable: this.#tableView(projection)
      },
      self: projection.self ? { poker: projection.self } : {},
      playerStates: {}
    };
  }

  tick(
    state: InternalRoomState,
    context: GameRoomTickContext
  ): GameRoomUpdate | undefined {
    this.#assertPokerRoom(state);
    const poker = this.#requirePokerState(state);
    if (!poker.table || poker.table.status !== "in-hand") return undefined;
    const actorPlayerId = this.#botActorPlayerId(state, poker.table);
    if (!actorPlayerId) return undefined;

    const lastUpdatedAt = Date.parse(state.updatedAt);
    if (
      Number.isFinite(lastUpdatedAt) &&
      context.now < lastUpdatedAt + POKER_BOT_ACTION_DELAY_MS
    ) {
      return undefined;
    }

    const decision = decidePokerBotAction(poker.table, actorPlayerId);
    let table = handlePokerTableCommand(
      poker.table,
      {
        type: "poker:act",
        actorPlayerId,
        payload: decision
      },
      { now: context.now, ownerPlayerId: state.ownerPlayerId }
    );
    if (table.status !== "in-hand") {
      table = this.#rebuyBustedBots(state, table, context.now + 1);
    }
    return {
      changes: {
        phase: table.status === "complete" ? "game-over" : "playing",
        poker: { ...poker, table }
      },
      event: {
        type: "POKER_BOT_ACTION",
        actorPlayerId,
        payload: {
          action: decision.action,
          ...(decision.amount === undefined ? {} : { amount: decision.amount }),
          handNumber: projectPokerTable(table).table.handNumber,
          status: table.status
        }
      }
    };
  }

  migrate(value: unknown): InternalRoomState {
    const state = migrateInternalRoomState(value);
    if (state.gameType !== this.id || !state.poker?.table) return state;
    return {
      ...state,
      poker: {
        ...state.poker,
        table: migratePokerTable(state.poker.table)
      }
    };
  }

  validate(state: InternalRoomState): void {
    this.#assertPokerRoom(state);
    if (state.players.length > this.maxPlayers) {
      throw new Error(`德州扑克最多支持 ${this.maxPlayers} 名玩家`);
    }
    if (!state.players.some((player) => player.id === state.ownerPlayerId)) {
      throw new Error("德扑房主不在玩家列表中");
    }
    const poker = this.#requirePokerState(state);
    validatePokerTableSettings(pokerTableSettings(poker.config));
    if (!poker.table) {
      if (state.phase !== "lobby") throw new Error("非大厅阶段缺少德扑牌桌状态");
      return;
    }

    validatePokerTable(poker.table);
    if (poker.table.mode !== poker.config.mode) throw new Error("德扑模式与房间配置不一致");
    const roomPlayers = new Map(state.players.map((player) => [player.id, player]));
    if (poker.table.players.length !== roomPlayers.size) {
      throw new Error("德扑牌桌玩家与房间玩家数量不一致");
    }
    for (const tablePlayer of poker.table.players) {
      const roomPlayer = roomPlayers.get(tablePlayer.playerId);
      if (!roomPlayer || roomPlayer.seat === null || roomPlayer.seat - 1 !== tablePlayer.seat) {
        throw new Error("德扑牌桌玩家与房间座位不一致");
      }
    }
    const expectedPhase = poker.table.status === "complete" ? "game-over" : "playing";
    if (state.phase !== expectedPhase) throw new Error("德扑牌桌状态与房间阶段不一致");
  }

  #assertPokerRoom(state: Pick<InternalRoomState, "gameType">): void {
    if (state.gameType !== this.id) throw new Error("房间与德州扑克模块不匹配");
  }

  #requirePokerState(state: InternalRoomState): NonNullable<InternalRoomState["poker"]> {
    if (!state.poker) throw new Error("德扑房间配置不存在");
    return state.poker;
  }

  #pokerCommand(command: GameRoomCommand): PokerTableCommand {
    if (
      command.type === "poker:deal" ||
      command.type === "poker:rebuy" ||
      command.type === "poker:cash-out" ||
      command.type === "poker:buy-in" ||
      command.type === "poker:advance-blinds"
    ) {
      return { type: command.type, actorPlayerId: command.actorPlayerId, payload: {} };
    }
    if (command.type !== "poker:act") {
      throw new Error(`德州扑克命令不受支持: ${command.type}`);
    }

    const action = command.payload.action;
    if (!isPokerPlayerAction(action)) throw new Error("德扑玩家动作无效");
    const amount = command.payload.amount;
    if (amount !== undefined && typeof amount !== "number") throw new Error("德扑下注金额无效");
    return {
      type: "poker:act",
      actorPlayerId: command.actorPlayerId,
      payload: { action, ...(amount === undefined ? {} : { amount }) }
    };
  }

  #tableView(projection: ReturnType<typeof projectPokerTable>): PublicPokerTableView {
    const table = projection.table;
    const playerIdAt = (seat: number | null): string | undefined =>
      seat === null ? undefined : table.players[seat]?.id;
    const buttonPlayerId = playerIdAt(table.buttonSeat);
    const smallBlindPlayerId = playerIdAt(
      projection.blindPositions.smallBlindSeat ?? null
    );
    const bigBlindPlayerId = playerIdAt(projection.blindPositions.bigBlindSeat ?? null);
    const actionPlayerId = playerIdAt(table.actionTo);
    return {
      mode: projection.mode,
      status: projection.status,
      handNumber: table.handNumber,
      street: table.street,
      board: table.board,
      ...(buttonPlayerId ? { buttonPlayerId } : {}),
      ...(smallBlindPlayerId ? { smallBlindPlayerId } : {}),
      ...(bigBlindPlayerId ? { bigBlindPlayerId } : {}),
      ...(actionPlayerId ? { actionPlayerId } : {}),
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      ante: table.ante,
      blindLevel: table.blindLevel,
      minRaise: table.minRaise,
      totalPot: projection.totalPot,
      pots: table.pots.map((pot) => ({
        amount: pot.amount,
        eligiblePlayerIds: pot.eligibleSeats.flatMap((seat) => {
          const playerId = playerIdAt(seat);
          return playerId ? [playerId] : [];
        }),
        type: pot.type
      })),
      players: projection.players.map((player) => {
        const enginePlayer = table.players[player.seat];
        if (!player.atTable) {
          if (enginePlayer !== null) throw new Error("已离桌玩家仍占用牌桌座位");
          return {
            playerId: player.playerId,
            nickname: player.nickname,
            seat: player.seat + 1,
            atTable: false,
            stack: 0,
            pendingAddOn: 0,
            hand: null,
            status: "SITTING_OUT" as const,
            betThisStreet: 0,
            totalInvestedThisHand: 0,
            buyIns: player.buyIns,
            ...(player.netPoints === undefined ? {} : { netPoints: player.netPoints }),
            ...(player.finishPlace === undefined ? {} : { finishPlace: player.finishPlace })
          };
        }
        if (!enginePlayer || enginePlayer.id !== player.playerId) {
          throw new Error("德扑公开视图玩家与牌桌座位不一致");
        }
        return {
          playerId: player.playerId,
          nickname: player.nickname,
          seat: player.seat + 1,
          atTable: true,
          stack: enginePlayer.stack,
          pendingAddOn: enginePlayer.pendingAddOn,
          hand: enginePlayer.hand,
          status: enginePlayer.status as PokerPlayerStatusView,
          betThisStreet: enginePlayer.betThisStreet,
          totalInvestedThisHand: enginePlayer.totalInvestedThisHand,
          buyIns: player.buyIns,
          ...(player.netPoints === undefined ? {} : { netPoints: player.netPoints }),
          ...(player.finishPlace === undefined ? {} : { finishPlace: player.finishPlace })
        };
      }),
      winners: (table.winners ?? []).flatMap((winner) => {
        const playerId = playerIdAt(winner.seat);
        return playerId
          ? [{ playerId, amount: winner.amount, hand: winner.hand, handRank: winner.handRank }]
          : [];
      }),
      actionHistory: projection.actionHistory,
      ...(projection.winnerPlayerId ? { winnerPlayerId: projection.winnerPlayerId } : {})
    };
  }

  #createTable(
    state: InternalRoomState,
    config: PokerRoomConfig,
    tableSeed: string,
    now: number
  ) {
    if (state.players.length < this.minPlayers || state.players.length > this.maxPlayers) {
      throw new Error(`德州扑克需要 ${this.minPlayers} 到 ${this.maxPlayers} 名玩家`);
    }
    const players = [...state.players].sort(comparePlayersBySeat).map((player) => {
      if (player.seat === null) throw new Error("仍有玩家未入座");
      return {
        playerId: player.id,
        nickname: player.nickname,
        seat: player.seat - 1
      };
    });
    return createPokerTable({
      ...pokerTableSettings(config),
      tableSeed,
      now,
      players
    });
  }

  #botActorPlayerId(
    state: InternalRoomState,
    table: ReturnType<typeof createPokerTable>
  ): string | undefined {
    const publicTable = projectPokerTable(table).table;
    const actorPlayerId =
      publicTable.actionTo === null
        ? undefined
        : publicTable.players[publicTable.actionTo]?.id;
    if (!actorPlayerId) throw new Error("德扑 AI 行动座位不存在");
    const actor = state.players.find((player) => player.id === actorPlayerId);
    if (!actor) throw new Error("德扑行动玩家不在房间中");
    return actor.isBot ? actorPlayerId : undefined;
  }

  #rebuyBustedBots(
    state: InternalRoomState,
    table: ReturnType<typeof createPokerTable>,
    now: number
  ): ReturnType<typeof createPokerTable> {
    if (table.mode !== "points" || table.status !== "waiting-hand") return table;
    let nextTable = table;
    for (const bot of state.players.filter((player) => player.isBot)) {
      const tablePlayer = nextTable.players.find((player) => player.playerId === bot.id);
      if (!tablePlayer?.atTable) continue;
      const enginePlayer = restorePokerEngine(nextTable.engine).state.players[tablePlayer.seat];
      if (!enginePlayer || enginePlayer.stack + enginePlayer.pendingAddOn > 0) continue;
      nextTable = handlePokerTableCommand(
        nextTable,
        { type: "poker:rebuy", actorPlayerId: bot.id, payload: {} },
        { now: now + tablePlayer.seat, ownerPlayerId: state.ownerPlayerId }
      );
    }
    return nextTable;
  }
}

function isPokerPlayerAction(value: unknown): value is PokerPlayerAction {
  return value === "fold" || value === "check" || value === "call" || value === "bet" || value === "raise";
}

function pokerTableSettings(config: PokerRoomConfig): PokerTableSettings {
  return {
    mode: config.mode,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    ...(config.blindStructure ? { blindStructure: config.blindStructure } : {})
  };
}
