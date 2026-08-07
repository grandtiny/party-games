import { describe, expect, it } from "vitest";
import {
  createPokerEngineEnvelope,
  createPokerTable,
  decidePokerBotAction,
  handlePokerTableCommand,
  projectPokerTable,
  restorePokerEngine,
  Street,
  type PokerBotDecision,
  type PokerBotDifficulty,
  type PokerPlayerAction,
  type PokerTableState
} from "../src/index.js";

describe("deterministic poker bot", () => {
  it("chooses deterministic server-legal actions at every difficulty", () => {
    const state = createDealtTable("bot-test-table");
    const actingPlayerId = actingPlayer(state);
    const legalActions = projectPokerTable(state, actingPlayerId).self?.legalActions;

    for (const difficulty of difficulties) {
      const first = decidePokerBotAction(state, actingPlayerId, difficulty);
      const second = decidePokerBotAction(state, actingPlayerId, difficulty);

      expect(first).toEqual(second);
      expect(legalActions?.actions).toContain(first.action);
      if (first.amount !== undefined) {
        expect(first.amount).toBeGreaterThanOrEqual(legalActions?.minAmount ?? 0);
        expect(first.amount).toBeLessThanOrEqual(legalActions?.maxAmount ?? 0);
      }
    }

    expect(decidePokerBotAction(state, actingPlayerId)).toEqual(
      decidePokerBotAction(state, actingPlayerId, "normal")
    );
  });

  it("uses distinct decision profiles for easy, normal, and hard", () => {
    const profiles = new Map<PokerBotDifficulty, string[]>(
      difficulties.map((difficulty) => [difficulty, []])
    );

    for (let index = 0; index < 40; index += 1) {
      const state = createDealtTable(`bot-profile-${index}`);
      const playerId = actingPlayer(state);
      for (const difficulty of difficulties) {
        profiles.get(difficulty)?.push(
          JSON.stringify(decidePokerBotAction(state, playerId, difficulty))
        );
      }
    }

    expect(profiles.get("easy")).not.toEqual(profiles.get("normal"));
    expect(profiles.get("hard")).not.toEqual(profiles.get("normal"));
    expect(profiles.get("easy")).not.toEqual(profiles.get("hard"));
  });

  it("does not use opponents' hidden hole cards", () => {
    const state = createDealtTable("bot-hidden-information");
    const playerId = actingPlayer(state);
    const altered = JSON.parse(JSON.stringify(state)) as PokerTableState;
    altered.engine.snapshot.players.forEach((player, seat) => {
      if (!player || player.id === playerId) return;
      altered.engine.snapshot.players[seat] = { ...player, hand: ["As", "Ad"] };
    });

    for (const difficulty of difficulties) {
      expect(decidePokerBotAction(altered, playerId, difficulty)).toEqual(
        decidePokerBotAction(state, playerId, difficulty)
      );
    }
  });

  it("keeps deep-stack premium-hand raises proportional to the pot", () => {
    const raiseAmounts: number[] = [];

    for (let index = 0; index < 12; index += 1) {
      const state = withCurrentPlayerHand(
        createDealtTable(`bot-deep-premium-${index}`),
        ["As", "Ah"]
      );
      const playerId = actingPlayer(state);

      for (const difficulty of ["normal", "hard"] as const) {
        const decision = expectServerLegalDecision(state, playerId, difficulty);
        expect(decision.action).not.toBe("fold");
        if (decision.action === "raise" && decision.amount !== undefined) {
          raiseAmounts.push(decision.amount);
          expect(decision.amount).toBeLessThanOrEqual(50);
        }
      }
    }

    expect(raiseAmounts.length).toBeGreaterThan(0);
  });

  it("tightens its response when an opponent changes from limping to a large raise", () => {
    const initial = createDealtTable("bot-preflop-pressure");
    const limped = actCurrentPlayer(initial, "call");
    const raised = actCurrentPlayer(initial, "raise", 150);
    const playerId = actingPlayer(limped);
    expect(actingPlayer(raised)).toBe(playerId);

    const limpedWithHand = withCurrentPlayerHand(limped, ["Ah", "Jd"]);
    const raisedWithHand = withCurrentPlayerHand(raised, ["Ah", "Jd"]);
    const lowPressure = expectServerLegalDecision(limpedWithHand, playerId, "hard");
    const highPressure = expectServerLegalDecision(raisedWithHand, playerId, "hard");

    expect(lowPressure.action).not.toBe("fold");
    expect(highPressure.action).toBe("fold");
  });

  it("uses postflop action history instead of treating every decision alike", () => {
    const flop = withBoard(advanceToFlop(createDealtTable("bot-flop-pressure", 2)), [
      "Jh",
      "Jd",
      "As"
    ]);
    const checked = actCurrentPlayer(flop, "check");
    const bet = actCurrentPlayer(flop, "bet", 80);
    const playerId = actingPlayer(checked);
    expect(actingPlayer(bet)).toBe(playerId);

    const checkedWithHand = withCurrentPlayerHand(checked, ["Kc", "Kd"]);
    const betWithHand = withCurrentPlayerHand(bet, ["Kc", "Kd"]);
    const checkedTo = expectServerLegalDecision(checkedWithHand, playerId, "hard");
    const facingBet = expectServerLegalDecision(betWithHand, playerId, "hard");

    expect(checkedTo.action).toBe("bet");
    expect(facingBet.action).toBe("call");
  });

  it("folds weak hands to large postflop pressure", () => {
    const flop = withBoard(advanceToFlop(createDealtTable("bot-weak-pressure", 2)), [
      "Jh",
      "Jd",
      "As"
    ]);
    const facingLargeBet = withCurrentPlayerHand(
      actCurrentPlayer(flop, "bet", 80),
      ["7c", "2d"]
    );
    const playerId = actingPlayer(facingLargeBet);

    expect(
      expectServerLegalDecision(facingLargeBet, playerId, "normal").action
    ).toBe("fold");
    expect(
      expectServerLegalDecision(facingLargeBet, playerId, "hard").action
    ).toBe("fold");
  });

  it("allows a tournament short stack with a premium hand to move all-in", () => {
    const state = withCurrentPlayerHand(
      createShortStackTournament("bot-short-stack-premium", 50),
      ["As", "Ah"]
    );
    const playerId = actingPlayer(state);
    const legalActions = projectPokerTable(state, playerId).self?.legalActions;

    for (const difficulty of ["normal", "hard"] as const) {
      const decision = expectServerLegalDecision(state, playerId, difficulty);
      expect(decision).toEqual({
        action: "raise",
        amount: legalActions?.maxAmount
      });
    }
  });
});

const difficulties = ["easy", "normal", "hard"] as const satisfies readonly PokerBotDifficulty[];

function createDealtTable(tableSeed: string, playerCount = 4): PokerTableState {
  const ownerPlayerId = "player-0";
  const state = createPokerTable({
    mode: "points",
    tableSeed,
    now: 1_000,
    smallBlind: 5,
    bigBlind: 10,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `player-${seat}`,
      nickname: seat === 0 ? "Human" : `AI ${seat}`,
      seat
    }))
  });
  return handlePokerTableCommand(
    state,
    { type: "poker:deal", actorPlayerId: ownerPlayerId, payload: {} },
    { now: 2_000, ownerPlayerId }
  );
}

function createShortStackTournament(
  tableSeed: string,
  shortStack: number
): PokerTableState {
  const ownerPlayerId = "player-0";
  const input = {
    mode: "tournament" as const,
    tableSeed,
    now: 1_000,
    smallBlind: 5,
    bigBlind: 10,
    blindStructure: [{ smallBlind: 5, bigBlind: 10, ante: 0 }],
    players: Array.from({ length: 4 }, (_, seat) => ({
      playerId: `player-${seat}`,
      nickname: seat === 0 ? "Human" : `AI ${seat}`,
      seat
    }))
  };
  const initial = createPokerTable(input);
  const probe = handlePokerTableCommand(
    initial,
    { type: "poker:deal", actorPlayerId: ownerPlayerId, payload: {} },
    { now: 2_000, ownerPlayerId }
  );
  const shortSeat = restorePokerEngine(probe.engine).state.actionTo;
  if (shortSeat === null) throw new Error("测试牌局没有行动玩家");

  const engine = restorePokerEngine(initial.engine);
  const donorSeat = shortSeat === 0 ? 1 : 0;
  const transferredChips = 500 - shortStack;
  const players = engine.state.players.map((player, seat) => {
    if (!player) return player;
    if (seat === shortSeat) return { ...player, stack: shortStack };
    if (seat === donorSeat) return { ...player, stack: player.stack + transferredChips };
    return player;
  });
  Object.assign(engine.state, { players, initialChips: 2_000 });
  const prepared = {
    ...initial,
    engine: createPokerEngineEnvelope(engine, initial.engine.tableSeed)
  };
  const dealt = handlePokerTableCommand(
    prepared,
    { type: "poker:deal", actorPlayerId: ownerPlayerId, payload: {} },
    { now: 2_000, ownerPlayerId }
  );
  expect(restorePokerEngine(dealt.engine).state.actionTo).toBe(shortSeat);
  return dealt;
}

function advanceToFlop(initial: PokerTableState): PokerTableState {
  let state = initial;
  while (restorePokerEngine(state.engine).state.street === Street.PREFLOP) {
    const playerId = actingPlayer(state);
    const legalActions = projectPokerTable(state, playerId).self?.legalActions;
    const action = legalActions?.actions.includes("call") ? "call" : "check";
    state = actCurrentPlayer(state, action);
  }
  expect(restorePokerEngine(state.engine).state.street).toBe(Street.FLOP);
  return state;
}

function actCurrentPlayer(
  state: PokerTableState,
  action: PokerPlayerAction,
  amount?: number
): PokerTableState {
  const playerId = actingPlayer(state);
  return handlePokerTableCommand(
    state,
    {
      type: "poker:act",
      actorPlayerId: playerId,
      payload: amount === undefined ? { action } : { action, amount }
    },
    {
      now: restorePokerEngine(state.engine).state.timestamp + 10,
      ownerPlayerId: "player-0"
    }
  );
}

function withCurrentPlayerHand(
  state: PokerTableState,
  hand: [string, string]
): PokerTableState {
  const playerId = actingPlayer(state);
  const engine = restorePokerEngine(state.engine);
  const players = engine.state.players.map((player) =>
    player?.id === playerId ? { ...player, hand } : player
  );
  Object.assign(engine.state, { players });
  return {
    ...state,
    engine: createPokerEngineEnvelope(engine, state.engine.tableSeed)
  };
}

function withBoard(
  state: PokerTableState,
  board: readonly string[]
): PokerTableState {
  const engine = restorePokerEngine(state.engine);
  Object.assign(engine.state, { board: [...board] });
  return {
    ...state,
    engine: createPokerEngineEnvelope(engine, state.engine.tableSeed)
  };
}

function expectServerLegalDecision(
  state: PokerTableState,
  playerId: string,
  difficulty: PokerBotDifficulty
): PokerBotDecision {
  const decision = decidePokerBotAction(state, playerId, difficulty);
  const legalActions = projectPokerTable(state, playerId).self?.legalActions;
  expect(legalActions?.actions).toContain(decision.action);
  if (decision.amount !== undefined) {
    expect(decision.amount).toBeGreaterThanOrEqual(legalActions?.minAmount ?? 0);
    expect(decision.amount).toBeLessThanOrEqual(legalActions?.maxAmount ?? 0);
  }
  expect(() =>
    handlePokerTableCommand(
      state,
      {
        type: "poker:act",
        actorPlayerId: playerId,
        payload: decision
      },
      {
        now: restorePokerEngine(state.engine).state.timestamp + 10,
        ownerPlayerId: "player-0"
      }
    )
  ).not.toThrow();
  return decision;
}

function actingPlayer(state: PokerTableState): string {
  const engine = restorePokerEngine(state.engine);
  const playerId = engine.state.players[engine.state.actionTo ?? -1]?.id;
  if (!playerId) throw new Error("测试牌局没有行动玩家");
  return playerId;
}
