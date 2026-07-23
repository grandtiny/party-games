import { describe, expect, it } from "vitest";
import {
  ActionType,
  Street,
  createPokerEngine,
  dealNextHand,
  deserializePokerEngine,
  serializePokerEngine,
  type PokerEngine
} from "../src/index.js";

const TABLE_SEED = "party-games-poker-engine-validation";

function seatPlayers(engine: PokerEngine, stacks: number[]): void {
  stacks.forEach((stack, seat) => {
    engine.sit(seat, `p${seat}`, `Player ${seat}`, stack);
  });
}

function nextTimestamp(engine: PokerEngine): number {
  return engine.state.timestamp + 1;
}

function playPassivelyToShowdown(engine: PokerEngine): void {
  let guard = 0;
  while (engine.state.street !== Street.SHOWDOWN) {
    guard += 1;
    if (guard > 30) throw new Error("被动牌局没有进入摊牌");
    const seat = engine.state.actionTo;
    if (seat === null) throw new Error("牌局未结束但没有行动玩家");
    const player = engine.state.players[seat];
    if (!player) throw new Error("行动座位没有玩家");
    const highestBet = Math.max(...engine.state.currentBets.values(), 0);
    const playerBet = engine.state.currentBets.get(seat) ?? 0;
    engine.act({
      type: highestBet > playerBet ? ActionType.CALL : ActionType.CHECK,
      playerId: player.id,
      timestamp: nextTimestamp(engine)
    });
  }
}

describe("@pokertools/engine compatibility", () => {
  it("uses deterministic per-hand shuffles", () => {
    const first = createPokerEngine({ smallBlind: 5, bigBlind: 10, maxPlayers: 3 }, TABLE_SEED);
    const second = createPokerEngine({ smallBlind: 5, bigBlind: 10, maxPlayers: 3 }, TABLE_SEED);
    seatPlayers(first, [500, 500, 500]);
    seatPlayers(second, [500, 500, 500]);

    dealNextHand(first, TABLE_SEED, 100);
    dealNextHand(second, TABLE_SEED, 100);

    expect(first.state.deck).toEqual(second.state.deck);
    expect(first.state.players.map((player) => player?.hand)).toEqual(
      second.state.players.map((player) => player?.hand)
    );
  });

  it("applies original heads-up blind and action order", () => {
    const engine = createPokerEngine({ smallBlind: 5, bigBlind: 10, maxPlayers: 2 }, TABLE_SEED);
    seatPlayers(engine, [500, 500]);
    dealNextHand(engine, TABLE_SEED, 200);

    expect(engine.state.buttonSeat).toBe(0);
    expect(engine.state.currentBets.get(0)).toBe(5);
    expect(engine.state.currentBets.get(1)).toBe(10);
    expect(engine.state.actionTo).toBe(0);
  });

  it("rejects illegal checks and progresses legal calls", () => {
    const engine = createPokerEngine({ smallBlind: 5, bigBlind: 10, maxPlayers: 2 }, TABLE_SEED);
    seatPlayers(engine, [500, 500]);
    dealNextHand(engine, TABLE_SEED, 300);

    expect(
      engine.validate({
        type: ActionType.CHECK,
        playerId: "p0",
        timestamp: nextTimestamp(engine)
      })
    ).toMatchObject({ valid: false });
    expect(
      engine.validate({
        type: ActionType.CALL,
        playerId: "p0",
        timestamp: nextTimestamp(engine)
      })
    ).toEqual({ valid: true });

    engine.act({ type: ActionType.CALL, playerId: "p0", timestamp: nextTimestamp(engine) });
    engine.act({ type: ActionType.CHECK, playerId: "p1", timestamp: nextTimestamp(engine) });
    expect(engine.state.street).toBe(Street.FLOP);
    expect(engine.state.board).toHaveLength(3);
  });

  it("creates a main pot and side pot for unequal all-ins", () => {
    const engine = createPokerEngine({ smallBlind: 10, bigBlind: 20, maxPlayers: 3 }, TABLE_SEED);
    seatPlayers(engine, [100, 1000, 1000]);
    dealNextHand(engine, TABLE_SEED, 400);

    engine.act({
      type: ActionType.RAISE,
      playerId: "p0",
      amount: 100,
      timestamp: nextTimestamp(engine)
    });
    engine.act({ type: ActionType.CALL, playerId: "p1", timestamp: nextTimestamp(engine) });
    engine.act({
      type: ActionType.RAISE,
      playerId: "p2",
      amount: 200,
      timestamp: nextTimestamp(engine)
    });
    engine.act({ type: ActionType.CALL, playerId: "p1", timestamp: nextTimestamp(engine) });

    expect(engine.state.street).toBe(Street.FLOP);
    expect(engine.state.pots.map((pot) => pot.amount)).toEqual([300, 200]);
    expect(engine.state.pots[0]?.eligibleSeats).toEqual([0, 1, 2]);
    expect(engine.state.pots[1]?.eligibleSeats).toEqual([1, 2]);
  });

  it("masks deck and opponent cards in player projections", () => {
    const engine = createPokerEngine({ smallBlind: 5, bigBlind: 10, maxPlayers: 3 }, TABLE_SEED);
    seatPlayers(engine, [500, 500, 500]);
    dealNextHand(engine, TABLE_SEED, 500);

    const view = engine.view("p0");
    expect(view.deck).toEqual([]);
    expect(view.players[0]?.hand).toEqual(engine.state.players[0]?.hand);
    expect(view.players[1]?.hand).toBeNull();
    expect(view.players[2]?.hand).toBeNull();
  });

  it("restores JSON snapshots and preserves the next deterministic hand", () => {
    const original = createPokerEngine({ smallBlind: 5, bigBlind: 10, maxPlayers: 2 }, TABLE_SEED);
    seatPlayers(original, [500, 500]);
    dealNextHand(original, TABLE_SEED, 600);
    original.act({
      type: ActionType.FOLD,
      playerId: "p0",
      timestamp: nextTimestamp(original)
    });

    const serialized = serializePokerEngine(original, TABLE_SEED);
    const { engine: restored, tableSeed } = deserializePokerEngine(serialized);
    expect(restored.state.currentBets).toBeInstanceOf(Map);
    expect(restored.state.handNumber).toBe(original.state.handNumber);
    expect(restored.state.players).toEqual(original.state.players);

    dealNextHand(original, TABLE_SEED, 700);
    dealNextHand(restored, tableSeed, 700);
    expect(restored.state.deck).toEqual(original.state.deck);
    expect(restored.state.players.map((player) => player?.hand)).toEqual(
      original.state.players.map((player) => player?.hand)
    );
  });

  it("advances tournament blind levels without changing table mode", () => {
    const engine = createPokerEngine(
      {
        smallBlind: 5,
        bigBlind: 10,
        maxPlayers: 3,
        blindStructure: [
          { smallBlind: 5, bigBlind: 10, ante: 0 },
          { smallBlind: 10, bigBlind: 20, ante: 2 }
        ]
      },
      TABLE_SEED
    );

    engine.nextBlindLevel();
    expect(engine.state.blindLevel).toBe(1);
    expect(engine.state.smallBlind).toBe(10);
    expect(engine.state.bigBlind).toBe(20);
    expect(engine.state.ante).toBe(2);
  });

  it("handles split-pot showdown while conserving all chips", () => {
    let splitEngine: PokerEngine | undefined;
    for (let seedIndex = 0; seedIndex < 200; seedIndex += 1) {
      const seed = `${TABLE_SEED}:split:${seedIndex}`;
      const engine = createPokerEngine({ smallBlind: 5, bigBlind: 10, maxPlayers: 2 }, seed);
      seatPlayers(engine, [500, 500]);
      dealNextHand(engine, seed, 800);
      playPassivelyToShowdown(engine);
      if (engine.state.winners?.length === 2) {
        splitEngine = engine;
        break;
      }
    }

    expect(splitEngine).toBeDefined();
    const finalStacks = splitEngine?.state.players.reduce(
      (total, player) => total + (player?.stack ?? 0),
      0
    );
    expect(finalStacks).toBe(1000);
  });
});
