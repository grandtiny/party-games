import { describe, expect, it } from "vitest";
import {
  SeededRandom,
  TROUBLE_BREWING_ROLES,
  acknowledgeFirstNightPrompt,
  acknowledgeOtherNightPrompt,
  alivePlayerIds,
  canPlayerVote,
  createFirstNightState,
  createGameStateAfterFirstNight,
  createTroubleBrewingSetup,
  getFirstNightPrompt,
  getOtherNightPrompt,
  nominatePlayer,
  requestCloseNominations,
  requestNominations,
  setVoteIntent,
  startOtherNight,
  submitFirstNightSelection,
  submitOtherNightSelection,
  tickVote,
  useSlayerClaim,
  type FirstNightState,
  type RoleId,
  type TroubleBrewingGameState,
  type TroubleBrewingSetup
} from "../src/index.js";

const PLAYER_COUNTS = Array.from({ length: 11 }, (_, index) => index + 5);
const STRATEGIES = ["execution", "tie", "chaos"] as const;
const GAMES_PER_SIZE = positiveInteger(process.env.CLOCKTOWER_STRESS_GAMES_PER_SIZE, 4);
const STRESS_BATCH = process.env.CLOCKTOWER_STRESS_BATCH?.trim() || "default";
const MAX_PROMPTS_PER_NIGHT = 200;
const MAX_DAY_NIGHT_CYCLES = 40;
const ROLE_IDS = new Set<RoleId>(
  TROUBLE_BREWING_ROLES.map((role) => role.id as RoleId)
);

type Strategy = (typeof STRATEGIES)[number];

interface Clock {
  now: number;
}

describe("Trouble Brewing state-machine stress", () => {
  it(
    "completes randomized games across every supported player count and day strategy",
    () => {
      let completedGames = 0;
      const winners = new Set<string>();
      let longestGameDays = 0;
      for (const playerCount of PLAYER_COUNTS) {
        for (const strategy of STRATEGIES) {
          for (let index = 0; index < GAMES_PER_SIZE; index += 1) {
            const seed = `${STRESS_BATCH}:${strategy}:${playerCount}:${index}`;
            const game = simulateGame(playerCount, strategy, seed);
            expect(game.winner, seed).toMatch(/^(good|evil)$/);
            winners.add(game.winner as string);
            longestGameDays = Math.max(longestGameDays, game.day.number);
            completedGames += 1;
          }
        }
      }
      expect(completedGames).toBe(PLAYER_COUNTS.length * STRATEGIES.length * GAMES_PER_SIZE);
      expect([...winners].sort()).toEqual(["evil", "good"]);
      expect(longestGameDays).toBeGreaterThanOrEqual(4);
    },
    120_000
  );

  it("replays representative stress games deterministically", () => {
    for (const playerCount of PLAYER_COUNTS) {
      for (const strategy of STRATEGIES) {
        const seed = `${STRESS_BATCH}:replay:${strategy}:${playerCount}`;
        expect(simulateGame(playerCount, strategy, seed), seed).toEqual(
          simulateGame(playerCount, strategy, seed)
        );
      }
    }
  });
});

function simulateGame(
  playerCount: number,
  strategy: Strategy,
  seed: string
): TroubleBrewingGameState {
  const setup = createTroubleBrewingSetup(playerIds(playerCount), seed);
  const random = new SeededRandom(`${seed}:decisions`);
  const clock = { now: 10_000 };
  const firstNight = finishFirstNight(setup, random, seed);
  let game = createGameStateAfterFirstNight(setup, firstNight);
  let previouslyDead = deadPlayerIds(game);
  assertGameInvariants(setup, game, `${seed}:start`);

  for (let cycle = 0; cycle < MAX_DAY_NIGHT_CYCLES && !game.winner; cycle += 1) {
    game = playDay(setup, game, strategy, random, clock, `${seed}:day:${cycle + 1}`);
    assertDeathIsMonotonic(previouslyDead, game, `${seed}:day:${cycle + 1}`);
    previouslyDead = deadPlayerIds(game);
    assertGameInvariants(setup, game, `${seed}:day:${cycle + 1}`);
    if (game.winner) break;

    game = finishOtherNight(setup, game, strategy, random, `${seed}:night:${cycle + 1}`);
    assertDeathIsMonotonic(previouslyDead, game, `${seed}:night:${cycle + 1}`);
    previouslyDead = deadPlayerIds(game);
    assertGameInvariants(setup, game, `${seed}:night:${cycle + 1}`);
  }

  if (!game.winner) {
    throw new Error(
      `${seed}: game did not finish after ${MAX_DAY_NIGHT_CYCLES} cycles: ${JSON.stringify({
        day: game.day.number,
        stage: game.day.stage,
        alive: alivePlayerIds(game),
        roles: Object.fromEntries(
          game.playerOrder.map((playerId) => [playerId, game.players[playerId]?.roleId])
        )
      })}`
    );
  }
  return game;
}

function finishFirstNight(
  setup: TroubleBrewingSetup,
  random: SeededRandom,
  label: string
): FirstNightState {
  let state = createFirstNightState(setup);
  for (let step = 0; !state.complete; step += 1) {
    if (step >= MAX_PROMPTS_PER_NIGHT) {
      throw new Error(`${label}: first night stalled`);
    }
    const actor = setup.playerOrder
      .map((playerId) => ({ playerId, prompt: getFirstNightPrompt(setup, state, playerId) }))
      .find(({ prompt }) => prompt);
    if (!actor?.prompt) throw new Error(`${label}: first-night actor was not found`);

    if (actor.prompt.kind === "acknowledge") {
      state = acknowledgeFirstNightPrompt(setup, state, actor.playerId);
      continue;
    }

    const count = actor.prompt.kind === "select-two" ? 2 : 1;
    const selectedPlayerIds = selectTargets(
      actor.prompt.allowedPlayerIds ?? [],
      count,
      random,
      `${label}:first-night:${actor.prompt.stepId}`
    );
    state = submitFirstNightSelection(setup, state, actor.playerId, selectedPlayerIds);
  }
  return state;
}

function playDay(
  setup: TroubleBrewingSetup,
  initialGame: TroubleBrewingGameState,
  strategy: Strategy,
  random: SeededRandom,
  clock: Clock,
  label: string
): TroubleBrewingGameState {
  let game = initialGame;
  if (game.day.stage !== "discussion") {
    throw new Error(`${label}: day started in ${game.day.stage}`);
  }

  game = makeSlayerClaims(setup, game, strategy, random, label);
  if (game.winner) return game;

  const openers = random.shuffle(alivePlayerIds(game));
  const majority = majorityThreshold(openers.length);
  for (const playerId of openers.slice(0, majority)) {
    game = requestNominations(game, playerId);
  }
  if (game.day.stage !== "nominations") {
    throw new Error(`${label}: nominations did not open`);
  }

  const requestedNominations = nominationCount(strategy, alivePlayerIds(game).length, random);
  const tiedVoters =
    strategy === "tie"
      ? random.shuffle(alivePlayerIds(game)).slice(0, majorityThreshold(alivePlayerIds(game).length))
      : [];

  for (let index = 0; index < requestedNominations; index += 1) {
    if (game.winner || game.day.stage !== "nominations") break;
    const nominators = random.shuffle(
      alivePlayerIds(game).filter(
        (playerId) => !game.day.nominatorsUsedPlayerIds.includes(playerId)
      )
    );
    const nominees = random.shuffle(
      alivePlayerIds(game).filter(
        (playerId) => !game.day.nomineesUsedPlayerIds.includes(playerId)
      )
    );
    const nominatorPlayerId = nominators[0];
    const nomineePlayerId = nominees[0];
    if (!nominatorPlayerId || !nomineePlayerId) break;

    clock.now += 100;
    game = nominatePlayer(
      setup,
      game,
      nominatorPlayerId,
      nomineePlayerId,
      clock.now,
      1
    );
    if (game.winner || game.day.stage === "complete") break;
    if (!game.day.currentVote) throw new Error(`${label}: nomination did not start a vote`);

    game = castVotes(game, strategy, tiedVoters, random);
    const voteLength = game.day.currentVote?.order.length ?? 0;
    clock.now += voteLength + 2;
    game = tickVote(game, clock.now);
    if (!game.winner && game.day.stage !== "nominations") {
      throw new Error(`${label}: vote did not return to nominations`);
    }
    assertGameInvariants(setup, game, `${label}:nomination:${index + 1}`);
  }

  if (game.winner || game.day.stage === "complete") return game;
  const closers = random.shuffle(alivePlayerIds(game));
  const closeMajority = majorityThreshold(closers.length);
  for (const playerId of closers.slice(0, closeMajority)) {
    game = requestCloseNominations(setup, game, playerId);
  }
  if (!game.winner && game.day.stage !== "complete") {
    throw new Error(`${label}: day did not close`);
  }
  return game;
}

function makeSlayerClaims(
  setup: TroubleBrewingSetup,
  initialGame: TroubleBrewingGameState,
  strategy: Strategy,
  random: SeededRandom,
  label: string
): TroubleBrewingGameState {
  let game = initialGame;
  const living = random.shuffle(
    alivePlayerIds(game).filter(
      (playerId) => !game.slayerClaimUsedPlayerIds.includes(playerId)
    )
  );
  const claimLimit =
    strategy === "chaos"
      ? random.integer(Math.min(3, living.length) + 1)
      : random.float() < 0.15
        ? 1
        : 0;

  for (const playerId of living.slice(0, claimLimit)) {
    if (game.winner || !game.players[playerId]?.alive) break;
    const targets = alivePlayerIds(game);
    if (targets.length === 0) throw new Error(`${label}: Slayer claim has no target`);
    game = useSlayerClaim(setup, game, playerId, random.pick(targets));
  }
  return game;
}

function nominationCount(strategy: Strategy, aliveCount: number, random: SeededRandom): number {
  if (strategy === "execution") return 1;
  if (strategy === "tie") return Math.min(2, aliveCount);
  return random.integer(Math.min(6, aliveCount) + 1);
}

function castVotes(
  initialGame: TroubleBrewingGameState,
  strategy: Strategy,
  tiedVoters: readonly string[],
  random: SeededRandom
): TroubleBrewingGameState {
  let game = initialGame;
  const vote = game.day.currentVote;
  if (!vote) throw new Error("Vote state is missing");

  for (const playerId of vote.order) {
    if (!canPlayerVote(game, playerId)) continue;
    const voting =
      strategy === "execution"
        ? Boolean(game.players[playerId]?.alive)
        : strategy === "tie"
          ? tiedVoters.includes(playerId)
          : random.float() < (game.players[playerId]?.alive ? 0.55 : 0.25);
    game = setVoteIntent(game, playerId, voting);
  }
  return game;
}

function finishOtherNight(
  setup: TroubleBrewingSetup,
  initialGame: TroubleBrewingGameState,
  strategy: Strategy,
  random: SeededRandom,
  label: string
): TroubleBrewingGameState {
  let game = startOtherNight(setup, initialGame);
  for (let step = 0; game.night; step += 1) {
    if (step >= MAX_PROMPTS_PER_NIGHT) {
      throw new Error(`${label}: other night stalled`);
    }
    const actor = setup.playerOrder
      .map((playerId) => ({ playerId, prompt: getOtherNightPrompt(setup, game, playerId) }))
      .find(({ prompt }) => prompt);
    if (!actor?.prompt) throw new Error(`${label}: other-night actor was not found`);

    if (actor.prompt.kind === "acknowledge") {
      game = acknowledgeOtherNightPrompt(setup, game, actor.playerId);
      continue;
    }

    const count = actor.prompt.kind === "select-two" ? 2 : 1;
    const allowedPlayerIds = actor.prompt.allowedPlayerIds ?? [];
    let selectedPlayerIds: string[];
    if (actor.prompt.stepId === "imp") {
      const livingTargets = allowedPlayerIds.filter(
        (playerId) => game.players[playerId]?.alive && playerId !== actor.playerId
      );
      if (
        strategy === "chaos" &&
        allowedPlayerIds.includes(actor.playerId) &&
        random.float() < 0.2
      ) {
        selectedPlayerIds = [actor.playerId];
      } else if (strategy === "chaos" && random.float() < 0.15) {
        selectedPlayerIds = selectTargets(
          allowedPlayerIds,
          count,
          random,
          `${label}:${actor.prompt.stepId}:all-targets`
        );
      } else {
        selectedPlayerIds = selectTargets(
          livingTargets.length >= count ? livingTargets : allowedPlayerIds,
          count,
          random,
          `${label}:${actor.prompt.stepId}:living-targets`
        );
      }
    } else {
      selectedPlayerIds = selectTargets(
        allowedPlayerIds,
        count,
        random,
        `${label}:${actor.prompt.stepId}`
      );
    }
    game = submitOtherNightSelection(setup, game, actor.playerId, selectedPlayerIds);
    assertGameInvariants(setup, game, `${label}:step:${step + 1}`);
  }
  return game;
}

function assertGameInvariants(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  label: string
): void {
  assertUnique(game.playerOrder, `${label}: player order`);
  if (game.playerOrder.length !== setup.playerOrder.length) {
    throw new Error(`${label}: player count changed`);
  }
  if ([...game.playerOrder].sort().join("|") !== [...setup.playerOrder].sort().join("|")) {
    throw new Error(`${label}: player identities changed`);
  }
  if (game.day.number < 1) throw new Error(`${label}: invalid day number`);

  const completedNightNumbers = game.completedNights.map((night) => night.number);
  const expectedNightNumbers = Array.from(
    { length: game.day.number - 1 },
    (_, index) => index + 1
  );
  if (completedNightNumbers.join("|") !== expectedNightNumbers.join("|")) {
    throw new Error(`${label}: completed-night sequence is invalid`);
  }
  if (game.night?.number !== undefined && game.night.number !== game.day.number) {
    throw new Error(`${label}: active night number does not match the day`);
  }
  if (game.night && game.day.stage !== "complete") {
    throw new Error(`${label}: active night requires a completed day`);
  }
  if ((game.day.stage === "voting") !== Boolean(game.day.currentVote)) {
    throw new Error(`${label}: voting stage and vote state disagree`);
  }

  assertUnique(game.day.nominationRequestPlayerIds, `${label}: nomination requests`);
  assertUnique(game.day.closeRequestPlayerIds, `${label}: close requests`);
  assertUnique(game.day.nominatorsUsedPlayerIds, `${label}: used nominators`);
  assertUnique(game.day.nomineesUsedPlayerIds, `${label}: used nominees`);
  assertUnique(game.day.blockNomineePlayerIds, `${label}: block nominees`);
  assertUnique(game.ghostVoteUsedPlayerIds, `${label}: ghost votes`);
  assertUnique(game.virginSpentPlayerIds, `${label}: Virgin uses`);
  assertUnique(game.slayerClaimUsedPlayerIds, `${label}: Slayer claims`);

  for (const nomination of game.day.nominations) {
    assertKnownPlayer(game, nomination.nominatorPlayerId, `${label}: nomination nominator`);
    assertKnownPlayer(game, nomination.nomineePlayerId, `${label}: nomination nominee`);
    assertUnique(nomination.votedPlayerIds, `${label}: nomination voters`);
    if (nomination.votes !== nomination.votedPlayerIds.length) {
      throw new Error(`${label}: vote total does not match recorded voters`);
    }
  }

  const livingImps = game.playerOrder.filter(
    (playerId) => game.players[playerId]?.alive && game.players[playerId]?.roleId === "imp"
  );
  if (livingImps.length > 1) throw new Error(`${label}: multiple living Imps`);
  if (!game.winner && !game.night && livingImps.length !== 1) {
    throw new Error(`${label}: active game does not have exactly one living Imp`);
  }

  for (const playerId of game.playerOrder) {
    const player = game.players[playerId];
    if (!player) throw new Error(`${label}: player state is missing for ${playerId}`);
    if (!ROLE_IDS.has(player.roleId) || !ROLE_IDS.has(player.shownRoleId)) {
      throw new Error(`${label}: unknown role for ${playerId}`);
    }
  }
  for (const playerId of game.ghostVoteUsedPlayerIds) {
    if (game.players[playerId]?.alive) {
      throw new Error(`${label}: living player ${playerId} spent a ghost vote`);
    }
  }

  if (game.winner) {
    if (!game.endReason) throw new Error(`${label}: winner has no end reason`);
    if (game.day.stage !== "complete" || game.day.currentVote || game.night) {
      throw new Error(`${label}: completed game still has an active phase`);
    }
    const gameOverEvents = game.day.publicEvents.filter((event) => event.kind === "game-over");
    if (gameOverEvents.length !== 1) {
      throw new Error(`${label}: completed game has ${gameOverEvents.length} game-over events`);
    }
  }
}

function assertDeathIsMonotonic(
  previouslyDead: ReadonlySet<string>,
  game: TroubleBrewingGameState,
  label: string
): void {
  for (const playerId of previouslyDead) {
    if (game.players[playerId]?.alive) {
      throw new Error(`${label}: dead player ${playerId} became alive again`);
    }
  }
}

function deadPlayerIds(game: TroubleBrewingGameState): Set<string> {
  return new Set(
    game.playerOrder.filter((playerId) => game.players[playerId]?.alive === false)
  );
}

function selectTargets(
  allowedPlayerIds: readonly string[],
  count: number,
  random: SeededRandom,
  label: string
): string[] {
  if (allowedPlayerIds.length < count) {
    throw new Error(`${label}: requires ${count} targets but only has ${allowedPlayerIds.length}`);
  }
  return random.shuffle(allowedPlayerIds).slice(0, count);
}

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

function majorityThreshold(playerCount: number): number {
  return Math.floor(playerCount / 2) + 1;
}

function assertKnownPlayer(
  game: TroubleBrewingGameState,
  playerId: string,
  label: string
): void {
  if (!game.players[playerId]) throw new Error(`${label}: unknown player ${playerId}`);
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label}: duplicate values`);
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${value}`);
  }
  return parsed;
}
