import {
  ActionType,
  PokerEngine,
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
): void {
  const nextHandNumber = engine.state.handNumber + 1;
  setRandomProvider(engine, randomForHand(tableSeed, nextHandNumber));
  engine.act({
    type: ActionType.DEAL,
    timestamp: nextPokerTimestamp(engine, timestamp)
  });
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
  setRandomProvider(
    engine,
    randomForHand(envelope.tableSeed, engine.state.handNumber + 1)
  );
  return engine;
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
