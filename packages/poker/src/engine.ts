import {
  ActionType,
  PlayerStatus,
  PokerEngine,
  Street,
  type GameState,
  type Player,
  type Snapshot,
  type TableConfig
} from "@pokertools/engine";
import { createDeterministicRandom } from "./random.js";

export const POKER_ENGINE_ENVELOPE_VERSION = 1;

export interface PokerEngineEnvelope {
  schemaVersion: typeof POKER_ENGINE_ENVELOPE_VERSION;
  tableSeed: string;
  snapshot: Snapshot;
}

export interface PokerBlindPositions {
  smallBlindSeat?: number;
  bigBlindSeat?: number;
}

export type PokerTableConfig = Omit<TableConfig, "randomProvider">;

export function createPokerEngine(
  config: PokerTableConfig,
  tableSeed: string,
  initialTimestamp = Date.now()
): PokerEngine {
  const engine = new PokerEngine({
    ...config,
    randomProvider: randomForHand(tableSeed, 1)
  });
  Object.assign(engine.state, { timestamp: initialTimestamp });
  return engine;
}

export function nextPokerTimestamp(engine: PokerEngine, timestamp: number): number {
  return Math.max(timestamp, engine.state.timestamp + 1);
}

export function seatPokerPlayer(
  engine: PokerEngine,
  player: { seat: number; playerId: string; nickname: string; stack: number },
  timestamp: number
): void {
  engine.act({
    type: ActionType.SIT,
    playerId: player.playerId,
    playerName: player.nickname,
    seat: player.seat,
    stack: player.stack,
    timestamp: nextPokerTimestamp(engine, timestamp)
  });
}

export function dealNextHand(
  engine: PokerEngine,
  tableSeed: string,
  timestamp: number
): PokerBlindPositions {
  const parkedPlayers = parkBustedPlayers(engine);
  const nextHandNumber = engine.state.handNumber + 1;
  setRandomProvider(engine, randomForHand(tableSeed, nextHandNumber));
  engine.act({
    type: ActionType.DEAL,
    timestamp: nextPokerTimestamp(engine, timestamp)
  });
  const blindPositions = blindPositionsForState(engine.state);
  restoreParkedPlayers(engine, parkedPlayers);
  return blindPositions;
}

export function advancePokerBlindLevel(engine: PokerEngine, timestamp: number): void {
  engine.act({
    type: ActionType.NEXT_BLIND_LEVEL,
    timestamp: nextPokerTimestamp(engine, timestamp)
  });
}

export function createPokerEngineEnvelope(
  engine: PokerEngine,
  tableSeed: string
): PokerEngineEnvelope {
  const snapshot = JSON.parse(JSON.stringify(engine.snapshot)) as Snapshot;
  return {
    schemaVersion: POKER_ENGINE_ENVELOPE_VERSION,
    tableSeed,
    snapshot
  };
}

export function restorePokerEngine(envelope: PokerEngineEnvelope): PokerEngine {
  if (envelope.schemaVersion !== POKER_ENGINE_ENVELOPE_VERSION) {
    throw new Error(`不支持的德扑引擎快照版本: ${envelope.schemaVersion}`);
  }
  if (!envelope.tableSeed) throw new Error("德扑桌种子不存在");

  const engine = PokerEngine.restore(envelope.snapshot);
  repairInactiveBustedPlayers(engine);
  setRandomProvider(
    engine,
    randomForHand(envelope.tableSeed, engine.state.handNumber + 1)
  );
  return engine;
}

export function inferPokerBlindPositions(engine: PokerEngine): PokerBlindPositions {
  if (engine.state.handNumber === 0 || !engine.state.handId) return {};
  const handStart = [...engine.state.previousStates, engine.state].find(
    (state) =>
      state.handId === engine.state.handId &&
      state.street === Street.PREFLOP &&
      state.actionHistory.length === 0
  );
  return blindPositionsForState(handStart ?? engine.state);
}

export function serializePokerEngine(
  engine: PokerEngine,
  tableSeed: string
): string {
  return JSON.stringify(createPokerEngineEnvelope(engine, tableSeed));
}

export function deserializePokerEngine(value: string): {
  engine: PokerEngine;
  tableSeed: string;
} {
  const envelope = JSON.parse(value) as PokerEngineEnvelope;
  return {
    engine: restorePokerEngine(envelope),
    tableSeed: envelope.tableSeed
  };
}

function randomForHand(tableSeed: string, handNumber: number): () => number {
  return createDeterministicRandom(`${tableSeed}:hand:${handNumber}`);
}

function setRandomProvider(engine: PokerEngine, randomProvider: () => number): void {
  Object.assign(engine.state.config, { randomProvider });
}

function repairInactiveBustedPlayers(engine: PokerEngine): void {
  // Engine 1.0.16 skips zero-stack seats during a new-hand reset, leaving prior-hand chips behind.
  const handComplete =
    engine.state.street === Street.SHOWDOWN && engine.state.winners !== null;
  let changed = false;
  const players = engine.state.players.map((player, seat) => {
    if (!player || player.stack > 0 || player.pendingAddOn > 0) return player;
    const representedInCurrentHand =
      engine.state.activePlayers.includes(seat) ||
      engine.state.currentBets.has(seat) ||
      engine.state.pots.some((pot) => pot.eligibleSeats.includes(seat));
    if (!handComplete && representedInCurrentHand) return player;
    if (
      player.status === PlayerStatus.BUSTED &&
      player.hand === null &&
      player.shownCards === null &&
      player.betThisStreet === 0 &&
      player.totalInvestedThisHand === 0
    ) {
      return player;
    }
    changed = true;
    return {
      ...player,
      hand: null,
      shownCards: null,
      status: PlayerStatus.BUSTED,
      betThisStreet: 0,
      totalInvestedThisHand: 0
    };
  });
  if (changed) Object.assign(engine.state, { players });
}

interface ParkedPlayer {
  seat: number;
  player: Player;
  timeBank?: number;
}

function parkBustedPlayers(engine: PokerEngine): ParkedPlayer[] {
  // Exclude unfunded seats only while dealing so heads-up blinds use the funded players.
  repairInactiveBustedPlayers(engine);
  const players = [...engine.state.players];
  const timeBanks = new Map(engine.state.timeBanks);
  const parkedPlayers: ParkedPlayer[] = [];
  players.forEach((player, seat) => {
    if (!player || player.stack > 0 || player.pendingAddOn > 0) return;
    const timeBank = timeBanks.get(seat);
    parkedPlayers.push(
      timeBank === undefined ? { seat, player } : { seat, player, timeBank }
    );
    players[seat] = null;
    timeBanks.delete(seat);
  });
  if (parkedPlayers.length > 0) {
    Object.assign(engine.state, {
      players,
      activePlayers: engine.state.activePlayers.filter(
        (seat) => !parkedPlayers.some((player) => player.seat === seat)
      ),
      timeBanks
    });
  }
  return parkedPlayers;
}

function restoreParkedPlayers(engine: PokerEngine, parkedPlayers: ParkedPlayer[]): void {
  if (parkedPlayers.length === 0) return;
  const players = [...engine.state.players];
  const timeBanks = new Map(engine.state.timeBanks);
  parkedPlayers.forEach(({ seat, player, timeBank }) => {
    players[seat] = player;
    if (timeBank !== undefined) timeBanks.set(seat, timeBank);
  });
  Object.assign(engine.state, { players, timeBanks });
}

function blindPositionsForState(state: GameState): PokerBlindPositions {
  if (state.buttonSeat === null) return {};
  const isTournament = Boolean(state.config.blindStructure);
  const fundedSeats = state.players.flatMap((player, seat) =>
    player &&
    player.status !== PlayerStatus.RESERVED &&
    player.stack + (state.currentBets.get(seat) ?? 0) > 0 &&
    (isTournament || !player.isSittingOut)
      ? [seat]
      : []
  );
  if (fundedSeats.length < 2) return {};

  if (fundedSeats.length === 2) {
    const smallBlindSeat = fundedSeats.includes(state.buttonSeat)
      ? state.buttonSeat
      : nextFundedSeat(state.buttonSeat, fundedSeats, state.maxPlayers);
    const bigBlindSeat =
      smallBlindSeat === undefined
        ? undefined
        : nextFundedSeat(smallBlindSeat, fundedSeats, state.maxPlayers);
    return {
      ...(smallBlindSeat !== undefined && state.currentBets.has(smallBlindSeat)
        ? { smallBlindSeat }
        : {}),
      ...(bigBlindSeat !== undefined && state.currentBets.has(bigBlindSeat)
        ? { bigBlindSeat }
        : {})
    };
  }

  const smallBlindSeat = (state.buttonSeat + 1) % state.maxPlayers;
  const bigBlindSeat = nextFundedSeat(smallBlindSeat, fundedSeats, state.maxPlayers);
  return {
    ...(state.currentBets.has(smallBlindSeat) ? { smallBlindSeat } : {}),
    ...(bigBlindSeat !== undefined && state.currentBets.has(bigBlindSeat)
      ? { bigBlindSeat }
      : {})
  };
}

function nextFundedSeat(
  currentSeat: number,
  fundedSeats: readonly number[],
  maxPlayers: number
): number | undefined {
  for (let distance = 1; distance < maxPlayers; distance += 1) {
    const seat = (currentSeat + distance) % maxPlayers;
    if (fundedSeats.includes(seat)) return seat;
  }
  return undefined;
}
