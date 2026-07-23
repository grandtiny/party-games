import type { GameCommand } from "@party-games/game-core";
import {
  ActionType,
  Street,
  type BlindLevel,
  type PokerEngine,
  type PublicState
} from "@pokertools/engine";
import {
  POKER_ENGINE_ENVELOPE_VERSION,
  advancePokerBlindLevel,
  createPokerEngine,
  createPokerEngineEnvelope,
  dealNextHand,
  nextPokerTimestamp,
  restorePokerEngine,
  seatPokerPlayer,
  type PokerEngineEnvelope
} from "./engine.js";

export const POKER_TABLE_STATE_VERSION = 1;
export const POKER_FIXED_BUY_IN = 500;

export type PokerTableMode = "tournament" | "points";
export type PokerTableStatus = "waiting-hand" | "in-hand" | "complete";
export type PokerPlayerAction = "fold" | "check" | "call" | "bet" | "raise";
export type PokerBlindLevel = BlindLevel;

export interface PokerTableSettings {
  mode: PokerTableMode;
  smallBlind: number;
  bigBlind: number;
  blindStructure?: readonly PokerBlindLevel[];
}

export interface PokerTablePlayer {
  playerId: string;
  nickname: string;
  seat: number;
  buyIns: number;
  totalBuyIn: number;
  cashedOut: number;
}

export interface PokerTableState {
  schemaVersion: typeof POKER_TABLE_STATE_VERSION;
  mode: PokerTableMode;
  status: PokerTableStatus;
  engine: PokerEngineEnvelope;
  players: PokerTablePlayer[];
  winnerPlayerId?: string;
}

export interface CreatePokerTableInput extends PokerTableSettings {
  tableSeed: string;
  now: number;
  players: Array<{ playerId: string; nickname: string; seat: number }>;
}

export type PokerTableCommand =
  | GameCommand<"poker:deal">
  | GameCommand<
      "poker:act",
      { action: PokerPlayerAction; amount?: number }
    >
  | GameCommand<"poker:rebuy">
  | GameCommand<"poker:advance-blinds">;

export interface PokerCommandContext {
  now: number;
  ownerPlayerId: string;
}

export interface PokerTableView {
  mode: PokerTableMode;
  status: PokerTableStatus;
  table: PublicState;
  winnerPlayerId?: string;
  players: Array<
    Pick<PokerTablePlayer, "playerId" | "nickname" | "seat" | "buyIns"> & {
      netPoints?: number;
    }
  >;
  self?: {
    totalBuyIn: number;
    cashedOut: number;
    netPoints: number;
  };
}

export function createPokerTable(input: CreatePokerTableInput): PokerTableState {
  validateCreateInput(input);
  const maxPlayers = Math.max(...input.players.map((player) => player.seat)) + 1;
  const engine = createPokerEngine(
    {
      smallBlind: input.smallBlind,
      bigBlind: input.bigBlind,
      maxPlayers,
      ...(input.mode === "tournament"
        ? { blindStructure: input.blindStructure }
        : {})
    },
    input.tableSeed,
    input.now
  );

  const players = [...input.players]
    .sort((left, right) => left.seat - right.seat)
    .map((player, index) => {
      seatPokerPlayer(
        engine,
        { ...player, stack: POKER_FIXED_BUY_IN },
        input.now + index + 1
      );
      return {
        ...player,
        buyIns: 1,
        totalBuyIn: POKER_FIXED_BUY_IN,
        cashedOut: 0
      };
    });

  const state: PokerTableState = {
    schemaVersion: POKER_TABLE_STATE_VERSION,
    mode: input.mode,
    status: "waiting-hand",
    engine: createPokerEngineEnvelope(engine, input.tableSeed),
    players
  };
  validatePokerTable(state);
  return state;
}

export function handlePokerTableCommand(
  state: PokerTableState,
  command: PokerTableCommand,
  context: PokerCommandContext
): PokerTableState {
  validatePokerTable(state);
  const engine = restorePokerEngine(state.engine);
  let players = state.players;

  if (command.type === "poker:deal") {
    requireOwner(command.actorPlayerId, context.ownerPlayerId);
    if (state.status === "in-hand") throw new Error("当前牌局尚未结束");
    if (state.status === "complete") throw new Error("淘汰赛已经结束");
    dealNextHand(engine, state.engine.tableSeed, context.now);
  } else if (command.type === "poker:act") {
    if (state.status !== "in-hand") throw new Error("当前没有进行中的牌局");
    act(engine, command, context.now);
  } else if (command.type === "poker:rebuy") {
    if (state.mode !== "points") throw new Error("淘汰赛不允许重新买入");
    if (state.status === "in-hand") throw new Error("本手牌结束后才能重新买入");
    const player = engine.state.players.find(
      (candidate) => candidate?.id === command.actorPlayerId
    );
    if (!player) throw new Error("玩家不在德扑桌中");
    if (player.stack > 0 || player.pendingAddOn > 0) {
      throw new Error("仍有筹码时不能重新买入");
    }
    engine.act({
      type: ActionType.ADD_CHIPS,
      playerId: command.actorPlayerId,
      amount: POKER_FIXED_BUY_IN,
      timestamp: nextPokerTimestamp(engine, context.now)
    });
    players = players.map((candidate) =>
      candidate.playerId === command.actorPlayerId
        ? {
            ...candidate,
            buyIns: candidate.buyIns + 1,
            totalBuyIn: candidate.totalBuyIn + POKER_FIXED_BUY_IN
          }
        : candidate
    );
  } else {
    requireOwner(command.actorPlayerId, context.ownerPlayerId);
    if (state.mode !== "tournament") throw new Error("积分桌没有盲注级别");
    if (state.status === "complete") throw new Error("淘汰赛已经结束");
    if (state.status === "in-hand") throw new Error("本手牌结束后才能提升盲注");
    advancePokerBlindLevel(engine, context.now);
  }

  const winnerPlayerId = tournamentWinner(state.mode, engine);
  const nextState: PokerTableState = {
    ...state,
    status: winnerPlayerId
      ? "complete"
      : engine.state.street === Street.SHOWDOWN
        ? "waiting-hand"
        : "in-hand",
    engine: createPokerEngineEnvelope(engine, state.engine.tableSeed),
    players,
    ...(winnerPlayerId ? { winnerPlayerId } : {})
  };
  validatePokerTable(nextState);
  return nextState;
}

export function projectPokerTable(
  state: PokerTableState,
  viewerPlayerId?: string
): PokerTableView {
  validatePokerTable(state);
  const engine = restorePokerEngine(state.engine);
  const self = state.players.find((player) => player.playerId === viewerPlayerId);
  return {
    mode: state.mode,
    status: state.status,
    table: engine.view(viewerPlayerId),
    ...(state.winnerPlayerId ? { winnerPlayerId: state.winnerPlayerId } : {}),
    players: state.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      seat: player.seat,
      buyIns: player.buyIns,
      ...(state.mode === "points"
        ? { netPoints: currentStack(engine, player.playerId) + player.cashedOut - player.totalBuyIn }
        : {})
    })),
    ...(self
      ? {
          self: {
            totalBuyIn: self.totalBuyIn,
            cashedOut: self.cashedOut,
            netPoints: currentStack(engine, self.playerId) + self.cashedOut - self.totalBuyIn
          }
        }
      : {})
  };
}

export function migratePokerTable(value: unknown): PokerTableState {
  const state = value as PokerTableState;
  return {
    ...state,
    schemaVersion: POKER_TABLE_STATE_VERSION,
    players: state.players.map((player) => ({
      ...player,
      buyIns: player.buyIns ?? Math.max(1, player.totalBuyIn / POKER_FIXED_BUY_IN),
      cashedOut: player.cashedOut ?? 0
    }))
  };
}

export function validatePokerTable(state: PokerTableState): void {
  if (state.schemaVersion !== POKER_TABLE_STATE_VERSION) {
    throw new Error(`不支持的德扑桌状态版本: ${state.schemaVersion}`);
  }
  if (state.engine.schemaVersion !== POKER_ENGINE_ENVELOPE_VERSION) {
    throw new Error("德扑引擎快照版本不匹配");
  }
  const playerIds = state.players.map((player) => player.playerId);
  const seats = state.players.map((player) => player.seat);
  if (new Set(playerIds).size !== playerIds.length) throw new Error("德扑桌存在重复玩家");
  if (new Set(seats).size !== seats.length) throw new Error("德扑桌存在重复座位");

  const engine = restorePokerEngine(state.engine);
  for (const player of state.players) {
    const enginePlayer = engine.state.players[player.seat];
    if (enginePlayer?.id !== player.playerId) throw new Error("德扑桌玩家与引擎座位不一致");
    if (player.totalBuyIn !== player.buyIns * POKER_FIXED_BUY_IN) {
      throw new Error("德扑玩家买入账目不一致");
    }
    if (state.mode === "tournament" && player.buyIns !== 1) {
      throw new Error("淘汰赛玩家只能买入一次");
    }
  }
}

export function validatePokerTableSettings(settings: PokerTableSettings): void {
  validateBlindLevel(
    { smallBlind: settings.smallBlind, bigBlind: settings.bigBlind, ante: 0 },
    "初始盲注"
  );
  if (settings.mode === "points" && settings.blindStructure) {
    throw new Error("积分桌不使用盲注级别");
  }
  if (settings.mode === "tournament") {
    const blindStructure = settings.blindStructure;
    const firstLevel = blindStructure?.[0];
    if (!firstLevel) throw new Error("淘汰赛必须配置盲注级别");
    blindStructure.forEach((level, index) =>
      validateBlindLevel(level, `第 ${index + 1} 个盲注级别`)
    );
    if (
      firstLevel.smallBlind !== settings.smallBlind ||
      firstLevel.bigBlind !== settings.bigBlind
    ) {
      throw new Error("首个盲注级别必须与初始盲注一致");
    }
  }
}

function act(
  engine: PokerEngine,
  command: Extract<PokerTableCommand, { type: "poker:act" }>,
  now: number
): void {
  const timestamp = nextPokerTimestamp(engine, now);
  if (command.payload.action === "bet" || command.payload.action === "raise") {
    if (!Number.isInteger(command.payload.amount) || (command.payload.amount ?? 0) <= 0) {
      throw new Error("下注或加注金额无效");
    }
    engine.act({
      type: command.payload.action === "bet" ? ActionType.BET : ActionType.RAISE,
      playerId: command.actorPlayerId,
      amount: command.payload.amount as number,
      timestamp
    });
    return;
  }

  if (command.payload.action === "fold") {
    engine.act({ type: ActionType.FOLD, playerId: command.actorPlayerId, timestamp });
  } else if (command.payload.action === "check") {
    engine.act({ type: ActionType.CHECK, playerId: command.actorPlayerId, timestamp });
  } else {
    engine.act({ type: ActionType.CALL, playerId: command.actorPlayerId, timestamp });
  }
}

function tournamentWinner(mode: PokerTableMode, engine: PokerEngine): string | undefined {
  if (mode !== "tournament" || engine.state.street !== Street.SHOWDOWN) return undefined;
  const remaining = engine.state.players.filter(
    (player) => player && player.stack + player.pendingAddOn > 0
  );
  return remaining.length === 1 ? remaining[0]?.id : undefined;
}

function currentStack(engine: PokerEngine, playerId: string): number {
  const player = engine.state.players.find((candidate) => candidate?.id === playerId);
  return (player?.stack ?? 0) + (player?.pendingAddOn ?? 0);
}

function requireOwner(actorPlayerId: string, ownerPlayerId: string): void {
  if (actorPlayerId !== ownerPlayerId) throw new Error("只有房主可以执行该操作");
}

function validateCreateInput(input: CreatePokerTableInput): void {
  validatePokerTableSettings(input);
  if (input.players.length < 2 || input.players.length > 9) {
    throw new Error("德州扑克需要 2 到 9 名玩家");
  }
  if (!input.tableSeed) throw new Error("德扑桌种子不能为空");
  const seats = input.players.map((player) => player.seat);
  if (seats.some((seat) => !Number.isInteger(seat) || seat < 0 || seat > 8)) {
    throw new Error("德扑座位必须在 0 到 8 之间");
  }
  if (new Set(seats).size !== seats.length) throw new Error("德扑座位不能重复");
}

function validateBlindLevel(level: PokerBlindLevel, label: string): void {
  if (!Number.isInteger(level.smallBlind) || level.smallBlind <= 0) {
    throw new Error(`${label}的小盲必须是正整数`);
  }
  if (!Number.isInteger(level.bigBlind) || level.bigBlind <= level.smallBlind) {
    throw new Error(`${label}的大盲必须高于小盲`);
  }
  if (!Number.isInteger(level.ante) || level.ante < 0) {
    throw new Error(`${label}的前注必须是非负整数`);
  }
}
