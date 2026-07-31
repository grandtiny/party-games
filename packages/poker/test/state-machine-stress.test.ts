import { describe, expect, it } from "vitest";
import {
  ActionType,
  createDeterministicRandom,
  createPokerTable,
  decidePokerBotAction,
  handlePokerTableCommand,
  projectPokerTable,
  restorePokerEngine,
  type PokerBotDifficulty,
  type PokerPlayerAction,
  type PokerTableCommand,
  type PokerTableState
} from "../src/index.js";

const OWNER_ID = "p0";
const MAX_ACTIONS_PER_HAND = 200;
const STRESS_BATCH = process.env.POKER_STRESS_BATCH?.trim();

interface Clock {
  now: number;
}

function stressSeed(seed: string): string {
  return STRESS_BATCH ? `${STRESS_BATCH}:${seed}` : seed;
}

describe("poker state-machine stress", () => {
  it(
    "completes randomized multi-hand points games for 2-9 players",
    () => {
      for (let playerCount = 2; playerCount <= 9; playerCount += 1) {
        for (let seedIndex = 0; seedIndex < 12; seedIndex += 1) {
          const seed = stressSeed(`points:${playerCount}:${seedIndex}`);
          const random = createDeterministicRandom(seed);
          const clock = { now: 10_000 };
          let state = createTable(playerCount, seed, seedIndex % 2 === 1, "points");

          for (let hand = 0; hand < 6; hand += 1) {
            state = rebuyBustedPlayers(state, clock);
            state = deal(state, clock, `${seed}:hand:${hand}`);
            state = playRandomHand(state, random, clock, seed, 0.35, 0.18);
            assertStateInvariants(state, `${seed}:hand:${hand}`);
          }
        }
      }
    },
    30_000
  );

  it(
    "runs every bot difficulty through deep multi-hand action sequences",
    () => {
      const difficulties = ["easy", "normal", "hard"] as const satisfies readonly PokerBotDifficulty[];
      for (const difficulty of difficulties) {
        for (const playerCount of [2, 4, 6, 9]) {
          for (let seedIndex = 0; seedIndex < 6; seedIndex += 1) {
            const seed = stressSeed(`bots:${difficulty}:${playerCount}:${seedIndex}`);
            const clock = { now: 100_000 };
            let state = createTable(playerCount, seed, seedIndex % 2 === 1, "points");

            for (let hand = 0; hand < 4; hand += 1) {
              state = rebuyBustedPlayers(state, clock);
              state = deal(state, clock, `${seed}:hand:${hand}`);
              state = playBotHand(state, difficulty, clock, seed);
              assertStateInvariants(state, `${seed}:hand:${hand}`);
            }
          }
        }
      }
    },
    30_000
  );

  it(
    "finishes randomized tournaments with unique places and conserved chips",
    () => {
      for (const playerCount of [2, 3, 4, 6, 9]) {
        for (let seedIndex = 0; seedIndex < 10; seedIndex += 1) {
          const seed = stressSeed(`tournament:${playerCount}:${seedIndex}`);
          const random = createDeterministicRandom(seed);
          const clock = { now: 200_000 };
          let state = createTable(playerCount, seed, seedIndex % 2 === 1, "tournament");

          for (let hand = 0; state.status !== "complete" && hand < 60; hand += 1) {
            const blindLevel = projectPokerTable(state).table.blindLevel;
            if (hand > 0 && hand % 2 === 0 && blindLevel < 3) {
              state = applyCommand(
                state,
                { type: "poker:advance-blinds", actorPlayerId: OWNER_ID, payload: {} },
                clock
              );
            }
            state = deal(state, clock, `${seed}:hand:${hand}`);
            state = playRandomHand(state, random, clock, seed, 0.55, 0.38);
            assertStateInvariants(state, `${seed}:hand:${hand}`);
          }

          expect(state.status, seed).toBe("complete");
          expect(
            state.players.map((player) => player.finishPlace).sort((left, right) => (left ?? 0) - (right ?? 0)),
            seed
          ).toEqual(Array.from({ length: playerCount }, (_, index) => index + 1));
        }
      }
    },
    30_000
  );

  it("reports the actual blind seats when three funded players have seat gaps", () => {
    const clock = { now: 300_000 };
    let state = deal(
      createPokerTable({
        mode: "points",
        tableSeed: "sparse-blind-positions",
        now: 1_000,
        smallBlind: 5,
        bigBlind: 10,
        players: [
          { playerId: OWNER_ID, nickname: "Player 0", seat: 0 },
          { playerId: "p1", nickname: "Player 1", seat: 2 },
          { playerId: "p2", nickname: "Player 2", seat: 8 }
        ]
      }),
      clock,
      "sparse-blind-positions:first-hand"
    );
    state = playRandomHand(
      state,
      createDeterministicRandom("sparse-blind-positions:first-hand"),
      clock,
      "sparse-blind-positions:first-hand",
      0,
      0
    );
    state = deal(state, clock, "sparse-blind-positions:second-hand");
    const engine = restorePokerEngine(state.engine);
    const smallBlindSeat = [...engine.state.currentBets].find(([, amount]) => amount === 5)?.[0];
    const bigBlindSeat = [...engine.state.currentBets].find(([, amount]) => amount === 10)?.[0];

    expect(state.blindPositions).toEqual({ smallBlindSeat, bigBlindSeat });
  });
});

function createTable(
  playerCount: number,
  seed: string,
  sparseSeats: boolean,
  mode: "points" | "tournament"
): PokerTableState {
  const seats = sparseSeats ? sparseSeatPattern(playerCount) : Array.from({ length: playerCount }, (_, seat) => seat);
  return createPokerTable({
    mode,
    tableSeed: seed,
    now: 1_000,
    smallBlind: mode === "tournament" ? 25 : 5,
    bigBlind: mode === "tournament" ? 50 : 10,
    ...(mode === "tournament"
      ? {
          blindStructure: [
            { smallBlind: 25, bigBlind: 50, ante: 0 },
            { smallBlind: 50, bigBlind: 100, ante: 5 },
            { smallBlind: 100, bigBlind: 200, ante: 10 },
            { smallBlind: 200, bigBlind: 400, ante: 25 }
          ]
        }
      : {}),
    players: seats.map((seat, index) => ({
      playerId: `p${index}`,
      nickname: `Player ${index}`,
      seat
    }))
  });
}

function sparseSeatPattern(playerCount: number): number[] {
  const patterns: Record<number, number[]> = {
    2: [0, 8],
    3: [0, 2, 8],
    4: [0, 2, 5, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 1, 3, 5, 7, 8],
    7: [0, 1, 2, 4, 6, 7, 8],
    8: [0, 1, 2, 3, 5, 6, 7, 8],
    9: [0, 1, 2, 3, 4, 5, 6, 7, 8]
  };
  const seats = patterns[playerCount];
  if (!seats) throw new Error(`Missing sparse seat pattern for ${playerCount} players`);
  return seats;
}

function deal(state: PokerTableState, clock: Clock, label = "deal"): PokerTableState {
  try {
    const beforeEngine = restorePokerEngine(state.engine);
    const beforeValue = engineChipValue(beforeEngine);
    const nextState = applyCommand(
      state,
      { type: "poker:deal", actorPlayerId: OWNER_ID, payload: {} },
      clock
    );
    const afterEngine = restorePokerEngine(nextState.engine);
    const afterValue = engineChipValue(afterEngine);
    if (afterValue !== beforeValue) {
      throw new Error(
        `${label}: deal changed table chips (${beforeValue} !== ${afterValue}): ${JSON.stringify({
          before: engineSummary(beforeEngine),
          after: engineSummary(afterEngine)
        })}`
      );
    }
    return nextState;
  } catch (error) {
    const engine = restorePokerEngine(state.engine);
    const players = engine.state.players.map((player, seat) =>
      player
        ? {
            seat,
            id: player.id,
            stack: player.stack,
            pendingAddOn: player.pendingAddOn,
            status: player.status,
            sittingOut: player.isSittingOut
          }
        : null
    );
    throw new Error(`${label}: deal failed with players ${JSON.stringify(players)}`, {
      cause: error
    });
  }
}

function engineChipValue(engine: ReturnType<typeof restorePokerEngine>): number {
  return (
    engine.state.players.reduce(
      (total, player) => total + (player?.stack ?? 0) + (player?.pendingAddOn ?? 0),
      0
    ) +
    engine.state.pots.reduce((total, pot) => total + pot.amount, 0) +
    [...engine.state.currentBets.values()].reduce((total, amount) => total + amount, 0)
  );
}

function engineSummary(engine: ReturnType<typeof restorePokerEngine>) {
  return {
    handNumber: engine.state.handNumber,
    street: engine.state.street,
    winners: engine.state.winners,
    rakeThisHand: engine.state.rakeThisHand,
    players: engine.state.players.map((player, seat) =>
      player
        ? {
            seat,
            id: player.id,
            status: player.status,
            stack: player.stack,
            pendingAddOn: player.pendingAddOn,
            betThisStreet: player.betThisStreet,
            totalInvestedThisHand: player.totalInvestedThisHand
          }
        : null
    ),
    currentBets: [...engine.state.currentBets],
    pots: engine.state.pots
  };
}

function rebuyBustedPlayers(state: PokerTableState, clock: Clock): PokerTableState {
  let nextState = state;
  for (const player of state.players) {
    const enginePlayer = restorePokerEngine(nextState.engine).state.players[player.seat];
    if (!player.atTable || !enginePlayer || enginePlayer.stack + enginePlayer.pendingAddOn > 0) continue;
    nextState = applyCommand(
      nextState,
      { type: "poker:rebuy", actorPlayerId: player.playerId, payload: {} },
      clock
    );
  }
  return nextState;
}

function playRandomHand(
  initialState: PokerTableState,
  random: () => number,
  clock: Clock,
  seed: string,
  aggressionRate: number,
  allInRate: number
): PokerTableState {
  let state = initialState;
  const trace: string[] = [];
  for (let step = 0; state.status === "in-hand"; step += 1) {
    if (step >= MAX_ACTIONS_PER_HAND) {
      throw new Error(`Poker hand stalled for ${seed}: ${trace.slice(-20).join(" | ")}`);
    }
    try {
      assertStateInvariants(state, `${seed}:step:${step}`);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; trace=${trace.slice(-30).join(" | ")}`,
        { cause: error }
      );
    }
    const actorPlayerId = actingPlayerId(state);
    const decision = randomLegalDecision(state, actorPlayerId, random, aggressionRate, allInRate);
    trace.push(`${projectPokerTable(state).table.street}:${actorPlayerId}:${decision.action}:${decision.amount ?? ""}`);
    try {
      state = applyCommand(
        state,
        {
          type: "poker:act",
          actorPlayerId,
          payload: decision
        },
        clock
      );
    } catch (error) {
      throw new Error(
        `Legal action failed for ${seed}: ${trace.slice(-20).join(" | ")}`,
        { cause: error }
      );
    }
  }
  return state;
}

function playBotHand(
  initialState: PokerTableState,
  difficulty: PokerBotDifficulty,
  clock: Clock,
  seed: string
): PokerTableState {
  let state = initialState;
  const trace: string[] = [];
  for (let step = 0; state.status === "in-hand"; step += 1) {
    if (step >= MAX_ACTIONS_PER_HAND) {
      throw new Error(`Bot hand stalled for ${seed}: ${trace.slice(-20).join(" | ")}`);
    }
    try {
      assertStateInvariants(state, `${seed}:step:${step}`);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; trace=${trace.slice(-30).join(" | ")}`,
        { cause: error }
      );
    }
    const actorPlayerId = actingPlayerId(state);
    const decision = decidePokerBotAction(state, actorPlayerId, difficulty);
    trace.push(`${projectPokerTable(state).table.street}:${actorPlayerId}:${decision.action}:${decision.amount ?? ""}`);
    try {
      state = applyCommand(
        state,
        { type: "poker:act", actorPlayerId, payload: decision },
        clock
      );
    } catch (error) {
      throw new Error(
        `Bot action failed for ${seed}: ${trace.slice(-20).join(" | ")}`,
        { cause: error }
      );
    }
  }
  return state;
}

function randomLegalDecision(
  state: PokerTableState,
  actorPlayerId: string,
  random: () => number,
  aggressionRate: number,
  allInRate: number
): { action: PokerPlayerAction; amount?: number } {
  const legal = projectPokerTable(state, actorPlayerId).self?.legalActions;
  if (!legal || legal.actions.length === 0) throw new Error("Acting player has no legal actions");

  if (legal.aggressiveAction && random() < aggressionRate) {
    const minAmount = legal.minAmount;
    const maxAmount = legal.maxAmount;
    if (minAmount === undefined || maxAmount === undefined) {
      throw new Error("Aggressive action is missing its amount range");
    }
    const amount =
      random() < allInRate
        ? maxAmount
        : minAmount + Math.floor(random() * (maxAmount - minAmount + 1));
    return { action: legal.aggressiveAction, amount };
  }
  if (legal.actions.includes("check") && random() < 0.75) return { action: "check" };
  if (legal.actions.includes("call") && random() < 0.82) return { action: "call" };
  if (legal.actions.includes("fold")) return { action: "fold" };
  if (legal.actions.includes("call")) return { action: "call" };
  if (legal.actions.includes("check")) return { action: "check" };
  const action = legal.actions[0];
  if (!action) throw new Error("Acting player has no fallback action");
  return { action };
}

function actingPlayerId(state: PokerTableState): string {
  const engine = restorePokerEngine(state.engine);
  const actionTo = engine.state.actionTo;
  if (actionTo === null) throw new Error("In-hand state has no acting seat");
  const playerId = engine.state.players[actionTo]?.id;
  if (!playerId) throw new Error(`Acting seat ${actionTo} has no player`);
  return playerId;
}

function applyCommand(
  state: PokerTableState,
  command: PokerTableCommand,
  clock: Clock
): PokerTableState {
  clock.now += 1;
  return handlePokerTableCommand(state, command, {
    now: clock.now,
    ownerPlayerId: OWNER_ID
  });
}

function assertStateInvariants(state: PokerTableState, label: string): void {
  const engine = restorePokerEngine(state.engine);
  const tableValue =
    engine.state.players.reduce(
      (total, player) => total + (player?.stack ?? 0) + (player?.pendingAddOn ?? 0),
      0
    ) +
    engine.state.pots.reduce((total, pot) => total + pot.amount, 0) +
    [...engine.state.currentBets.values()].reduce((total, amount) => total + amount, 0);
  const cashOutValue = state.players.reduce((total, player) => total + player.cashedOut, 0);
  const buyInValue = state.players.reduce((total, player) => total + player.totalBuyIn, 0);
  if (tableValue + cashOutValue !== buyInValue) {
    throw new Error(
      `${label}: chip ledger mismatch (${tableValue} + ${cashOutValue} !== ${buyInValue}): ${JSON.stringify({
        handNumber: engine.state.handNumber,
        street: engine.state.street,
        initialChips: engine.state.initialChips,
        rakeThisHand: engine.state.rakeThisHand,
        players: engine.state.players.map((player, seat) =>
          player
            ? {
                seat,
                id: player.id,
                status: player.status,
                stack: player.stack,
                pendingAddOn: player.pendingAddOn,
                betThisStreet: player.betThisStreet,
                totalInvestedThisHand: player.totalInvestedThisHand
              }
            : null
        ),
        currentBets: [...engine.state.currentBets],
        pots: engine.state.pots
      })}`
    );
  }

  for (const player of engine.state.players) {
    if (!player) continue;
    if (player.stack < 0 || player.pendingAddOn < 0 || player.betThisStreet < 0) {
      throw new Error(`${label}: player ${player.id} has negative chips`);
    }
  }
  for (const pot of engine.state.pots) {
    if (pot.amount < 0) throw new Error(`${label}: pot has a negative amount`);
  }
  for (const amount of engine.state.currentBets.values()) {
    if (amount < 0) throw new Error(`${label}: current bet has a negative amount`);
  }

  if (state.status === "in-hand") {
    const actorPlayerId = actingPlayerId(state);
    const legalActions = projectPokerTable(state, actorPlayerId).self?.legalActions;
    if (!legalActions || legalActions.actions.length === 0) {
      const actionTo = engine.state.actionTo as number;
      const actor = engine.state.players[actionTo];
      const timestamp = engine.state.timestamp + 1;
      const validations = [ActionType.FOLD, ActionType.CHECK, ActionType.CALL].map((type) => ({
        type,
        result: engine.validate({ type, playerId: actorPlayerId, timestamp })
      }));
      throw new Error(
        `${label}: acting player ${actorPlayerId} has no legal action: ${JSON.stringify({
          street: engine.state.street,
          actionTo,
          activePlayers: engine.state.activePlayers,
          players: engine.state.players.map((player, seat) =>
            player
              ? {
                  seat,
                  id: player.id,
                  status: player.status,
                  stack: player.stack,
                  betThisStreet: player.betThisStreet,
                  totalInvestedThisHand: player.totalInvestedThisHand
                }
              : null
          ),
          currentBets: [...engine.state.currentBets],
          pots: engine.state.pots,
          initialChips: engine.state.initialChips,
          minRaise: engine.state.minRaise,
          lastRaiseAmount: engine.state.lastRaiseAmount,
          validations
        })}`
      );
    }
    if (!engine.state.activePlayers.includes(engine.state.actionTo as number)) {
      throw new Error(`${label}: acting seat is not active`);
    }
  } else if (engine.state.actionTo !== null) {
    throw new Error(`${label}: settled table still has an acting seat`);
  }
}
