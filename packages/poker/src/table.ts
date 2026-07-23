import type { GameCommand } from "@party-games/game-core";
import {
  ActionType,
  Street,
  type ActionRecord,
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
  inferPokerBlindPositions,
  nextPokerTimestamp,
  restorePokerEngine,
  seatPokerPlayer,
  type PokerBlindPositions,
  type PokerEngineEnvelope
} from "./engine.js";

export const POKER_TABLE_STATE_VERSION = 2;
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
  atTable: boolean;
  buyIns: number;
  totalBuyIn: number;
  cashedOut: number;
  stackAtHandStart: number;
  finishPlace?: number;
}

export interface PokerTableState {
  schemaVersion: typeof POKER_TABLE_STATE_VERSION;
  mode: PokerTableMode;
  status: PokerTableStatus;
  engine: PokerEngineEnvelope;
  players: PokerTablePlayer[];
  blindPositions?: PokerBlindPositions;
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
  | GameCommand<"poker:cash-out">
  | GameCommand<"poker:buy-in">
  | GameCommand<"poker:advance-blinds">;

export interface PokerCommandContext {
  now: number;
  ownerPlayerId: string;
}

export interface PokerTableView {
  mode: PokerTableMode;
  status: PokerTableStatus;
  table: PublicState;
  totalPot: number;
  actionHistory: PokerHandAction[];
  blindPositions: PokerBlindPositions;
  winnerPlayerId?: string;
  players: Array<
    Pick<PokerTablePlayer, "playerId" | "nickname" | "seat" | "buyIns"> & {
      atTable: boolean;
      netPoints?: number;
      finishPlace?: number;
    }
  >;
  self?: {
    totalBuyIn: number;
    cashedOut: number;
    netPoints: number;
    legalActions?: PokerLegalActions;
  };
}

export interface PokerLegalActions {
  actions: PokerPlayerAction[];
  callAmount: number;
  aggressiveAction?: "bet" | "raise";
  minAmount?: number;
  maxAmount?: number;
}

export interface PokerHandAction {
  playerId: string;
  street: Street;
  action: PokerPlayerAction | "uncalled-return";
  amount?: number;
  potAfter: number;
  stackAfter: number;
  allIn: boolean;
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
        atTable: true,
        buyIns: 1,
        totalBuyIn: POKER_FIXED_BUY_IN,
        cashedOut: 0,
        stackAtHandStart: POKER_FIXED_BUY_IN
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
  let blindPositions = state.blindPositions;

  if (command.type === "poker:deal") {
    requireOwner(command.actorPlayerId, context.ownerPlayerId);
    if (state.status === "in-hand") throw new Error("当前牌局尚未结束");
    if (state.status === "complete") throw new Error("淘汰赛已经结束");
    players = players.map((player) => ({
      ...player,
      stackAtHandStart: player.atTable ? currentStack(engine, player.playerId) : 0
    }));
    blindPositions = dealNextHand(engine, state.engine.tableSeed, context.now);
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
  } else if (command.type === "poker:cash-out") {
    if (state.mode !== "points") throw new Error("淘汰赛不能离桌结算");
    if (state.status === "in-hand") throw new Error("本手牌结束后才能离桌结算");
    const player = players.find((candidate) => candidate.playerId === command.actorPlayerId);
    if (!player?.atTable) throw new Error("玩家当前不在牌桌中");
    const enginePlayer = engine.state.players[player.seat];
    if (!enginePlayer || enginePlayer.id !== command.actorPlayerId) {
      throw new Error("玩家牌桌座位不存在");
    }
    const cashOutAmount = enginePlayer.stack + enginePlayer.pendingAddOn;
    if (cashOutAmount <= 0) throw new Error("当前没有可结算筹码");
    engine.act({
      type: ActionType.STAND,
      playerId: command.actorPlayerId,
      timestamp: nextPokerTimestamp(engine, context.now)
    });
    players = players.map((candidate) =>
      candidate.playerId === command.actorPlayerId
        ? {
            ...candidate,
            atTable: false,
            cashedOut: candidate.cashedOut + cashOutAmount,
            stackAtHandStart: 0
          }
        : candidate
    );
  } else if (command.type === "poker:buy-in") {
    if (state.mode !== "points") throw new Error("淘汰赛不能重新买入");
    if (state.status === "in-hand") throw new Error("本手牌结束后才能重新入座");
    const player = players.find((candidate) => candidate.playerId === command.actorPlayerId);
    if (!player) throw new Error("玩家不在德扑桌中");
    if (player.atTable) throw new Error("玩家已经在牌桌中");
    seatPokerPlayer(
      engine,
      {
        seat: player.seat,
        playerId: player.playerId,
        nickname: player.nickname,
        stack: POKER_FIXED_BUY_IN
      },
      context.now
    );
    players = players.map((candidate) =>
      candidate.playerId === command.actorPlayerId
        ? {
            ...candidate,
            atTable: true,
            buyIns: candidate.buyIns + 1,
            totalBuyIn: candidate.totalBuyIn + POKER_FIXED_BUY_IN,
            stackAtHandStart: POKER_FIXED_BUY_IN
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

  const tournament = settleTournamentPlayers(state.mode, engine, players);
  players = tournament.players;
  const winnerPlayerId = tournament.winnerPlayerId;
  const nextState: PokerTableState = {
    ...state,
    status: winnerPlayerId
      ? "complete"
      : engine.state.street === Street.SHOWDOWN
        ? "waiting-hand"
        : "in-hand",
    engine: createPokerEngineEnvelope(engine, state.engine.tableSeed),
    players,
    ...(blindPositions ? { blindPositions } : {}),
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
  const legalActions = viewerPlayerId
    ? projectLegalActions(engine, viewerPlayerId, state.status)
    : undefined;
  const blindPositions = state.blindPositions ?? inferPokerBlindPositions(engine);
  return {
    mode: state.mode,
    status: state.status,
    table: engine.view(viewerPlayerId),
    totalPot: currentPot(engine),
    actionHistory: projectActionHistory(engine.state.actionHistory),
    blindPositions,
    ...(state.winnerPlayerId ? { winnerPlayerId: state.winnerPlayerId } : {}),
    players: state.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      seat: player.seat,
      atTable: player.atTable,
      buyIns: player.buyIns,
      ...(player.finishPlace ? { finishPlace: player.finishPlace } : {}),
      ...(state.mode === "points"
        ? { netPoints: currentStack(engine, player.playerId) + player.cashedOut - player.totalBuyIn }
        : {})
    })),
    ...(self
      ? {
          self: {
            totalBuyIn: self.totalBuyIn,
            cashedOut: self.cashedOut,
            netPoints: currentStack(engine, self.playerId) + self.cashedOut - self.totalBuyIn,
            ...(legalActions ? { legalActions } : {})
          }
        }
      : {})
  };
}

export function migratePokerTable(value: unknown): PokerTableState {
  const state = value as PokerTableState;
  const engine = restorePokerEngine(state.engine);
  const migratedPlayers = state.players.map((player) => ({
    ...player,
    atTable:
      player.atTable ?? engine.state.players[player.seat]?.id === player.playerId,
    buyIns: player.buyIns ?? Math.max(1, player.totalBuyIn / POKER_FIXED_BUY_IN),
    cashedOut: player.cashedOut ?? 0,
    stackAtHandStart:
      player.stackAtHandStart ??
      ((engine.state.players[player.seat]?.stack ?? 0) +
        (engine.state.players[player.seat]?.pendingAddOn ?? 0))
  }));
  const tournament = settleTournamentPlayers(state.mode, engine, migratedPlayers);
  return {
    ...state,
    schemaVersion: POKER_TABLE_STATE_VERSION,
    players: tournament.players,
    ...(tournament.winnerPlayerId ? { winnerPlayerId: tournament.winnerPlayerId } : {})
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
    if (player.atTable && enginePlayer?.id !== player.playerId) {
      throw new Error("德扑桌玩家与引擎座位不一致");
    }
    if (!player.atTable && enginePlayer !== null) {
      throw new Error("已离桌玩家仍占用引擎座位");
    }
    if (player.totalBuyIn !== player.buyIns * POKER_FIXED_BUY_IN) {
      throw new Error("德扑玩家买入账目不一致");
    }
    if (state.mode === "tournament" && player.buyIns !== 1) {
      throw new Error("淘汰赛玩家只能买入一次");
    }
    if (state.mode === "tournament" && !player.atTable) {
      throw new Error("淘汰赛玩家不能离开牌桌");
    }
    if (state.mode === "points" && player.finishPlace !== undefined) {
      throw new Error("积分桌玩家不能记录淘汰名次");
    }
  }
  const finishPlaces = state.players.flatMap((player) =>
    player.finishPlace === undefined ? [] : [player.finishPlace]
  );
  if (new Set(finishPlaces).size !== finishPlaces.length) {
    throw new Error("淘汰赛名次不能重复");
  }
  if (
    finishPlaces.some(
      (place) => !Number.isInteger(place) || place < 1 || place > state.players.length
    )
  ) {
    throw new Error("淘汰赛名次超出范围");
  }
  if (
    state.winnerPlayerId &&
    state.players.find((player) => player.playerId === state.winnerPlayerId)?.finishPlace !== 1
  ) {
    throw new Error("淘汰赛冠军名次不一致");
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

function settleTournamentPlayers(
  mode: PokerTableMode,
  engine: PokerEngine,
  players: PokerTablePlayer[]
): { players: PokerTablePlayer[]; winnerPlayerId?: string } {
  if (mode !== "tournament" || engine.state.street !== Street.SHOWDOWN) {
    return { players };
  }

  let nextPlayers = [...players];
  const alreadyFinished = nextPlayers.filter(
    (player) => player.finishPlace !== undefined
  ).length;
  const newlyEliminated = nextPlayers
    .filter(
      (player) =>
        player.finishPlace === undefined && currentStack(engine, player.playerId) === 0
    )
    .sort(
      (left, right) =>
        left.stackAtHandStart - right.stackAtHandStart || right.seat - left.seat
    );
  newlyEliminated.forEach((player, index) => {
    const finishPlace = nextPlayers.length - alreadyFinished - index;
    nextPlayers = nextPlayers.map((candidate) =>
      candidate.playerId === player.playerId ? { ...candidate, finishPlace } : candidate
    );
  });

  const remaining = nextPlayers.filter(
    (player) =>
      player.finishPlace === undefined && currentStack(engine, player.playerId) > 0
  );
  if (remaining.length !== 1) return { players: nextPlayers };
  const winnerPlayerId = remaining[0]?.playerId;
  nextPlayers = nextPlayers.map((player) =>
    player.playerId === winnerPlayerId ? { ...player, finishPlace: 1 } : player
  );
  return { players: nextPlayers, ...(winnerPlayerId ? { winnerPlayerId } : {}) };
}

function currentStack(engine: PokerEngine, playerId: string): number {
  const player = engine.state.players.find((candidate) => candidate?.id === playerId);
  return (player?.stack ?? 0) + (player?.pendingAddOn ?? 0);
}

function currentPot(engine: PokerEngine): number {
  if (engine.state.winners?.length) {
    const peakCommitted = engine.state.actionHistory.reduce(
      (peak, record) => Math.max(peak, record.resultingPot),
      0
    );
    const committed = engine.state.players.reduce(
      (total, player) => total + (player?.totalInvestedThisHand ?? 0),
      0
    );
    const returned = engine.state.actionHistory.reduce(
      (total, record) =>
        record.action.type === ActionType.UNCALLED_BET_RETURNED &&
        "amount" in record.action
          ? total + record.action.amount
          : total,
      0
    );
    return Math.max(0, Math.max(peakCommitted, committed) - returned);
  }
  return (
    engine.state.pots.reduce((total, pot) => total + pot.amount, 0) +
    Array.from(engine.state.currentBets.values()).reduce((total, amount) => total + amount, 0)
  );
}

function projectLegalActions(
  engine: PokerEngine,
  playerId: string,
  status: PokerTableStatus
): PokerLegalActions | undefined {
  if (status !== "in-hand" || engine.state.actionTo === null) return undefined;
  const player = engine.state.players[engine.state.actionTo];
  if (!player || player.id !== playerId) return undefined;

  const timestamp = nextPokerTimestamp(engine, engine.state.timestamp + 1);
  const actions: PokerPlayerAction[] = [];
  const valid = (action: Parameters<PokerEngine["validate"]>[0]): boolean =>
    engine.validate(action).valid;

  if (valid({ type: ActionType.FOLD, playerId, timestamp })) actions.push("fold");
  if (valid({ type: ActionType.CHECK, playerId, timestamp })) actions.push("check");
  if (valid({ type: ActionType.CALL, playerId, timestamp })) actions.push("call");

  const currentBet = Math.max(0, ...engine.state.currentBets.values());
  const playerBet = engine.state.currentBets.get(player.seat) ?? 0;
  const maxAmount = playerBet + player.stack;
  const callAmount = Math.min(Math.max(0, currentBet - playerBet), player.stack);
  const aggressiveAction = currentBet === 0 ? "bet" : "raise";
  const normalMinimum =
    aggressiveAction === "bet"
      ? engine.state.bigBlind
      : Math.max(engine.state.minRaise, currentBet + engine.state.lastRaiseAmount);
  const minAmount = Math.min(normalMinimum, maxAmount);
  const canIncreaseBet = aggressiveAction === "bet" ? maxAmount > 0 : maxAmount > currentBet;
  const aggressiveType = aggressiveAction === "bet" ? ActionType.BET : ActionType.RAISE;
  if (
    canIncreaseBet &&
    valid({ type: aggressiveType, playerId, amount: minAmount, timestamp })
  ) {
    actions.push(aggressiveAction);
    return { actions, callAmount, aggressiveAction, minAmount, maxAmount };
  }
  return { actions, callAmount };
}

function projectActionHistory(records: readonly ActionRecord[]): PokerHandAction[] {
  return records.flatMap((record) => {
    if (!("playerId" in record.action) || !record.street) return [];
    const action = publicPokerAction(record.action.type);
    if (!action) return [];
    const amount = "amount" in record.action ? record.action.amount : undefined;
    return [
      {
        playerId: record.action.playerId,
        street: record.street as Street,
        action,
        ...(typeof amount === "number" ? { amount } : {}),
        potAfter: record.resultingPot,
        stackAfter: record.resultingStack,
        allIn:
          record.resultingStack === 0 &&
          (action === "call" || action === "bet" || action === "raise")
      }
    ];
  });
}

function publicPokerAction(type: ActionType): PokerHandAction["action"] | undefined {
  if (type === ActionType.FOLD) return "fold";
  if (type === ActionType.CHECK) return "check";
  if (type === ActionType.CALL) return "call";
  if (type === ActionType.BET) return "bet";
  if (type === ActionType.RAISE) return "raise";
  if (type === ActionType.UNCALLED_BET_RETURNED) return "uncalled-return";
  return undefined;
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
