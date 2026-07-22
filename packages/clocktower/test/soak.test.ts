import { describe, expect, it } from "vitest";
import {
  acknowledgeFirstNightPrompt,
  acknowledgeOtherNightPrompt,
  alivePlayerIds,
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
  TROUBLE_BREWING_ROLES,
  type FirstNightState,
  type RoleId,
  type TroubleBrewingGameState,
  type TroubleBrewingSetup
} from "../src/index.js";

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

function finishFirstNight(setup: TroubleBrewingSetup): FirstNightState {
  let state = createFirstNightState(setup);
  let guard = 0;
  while (!state.complete) {
    guard += 1;
    if (guard > 200) throw new Error("First-night soak flow stalled");
    const actor = setup.playerOrder
      .map((playerId) => ({ playerId, prompt: getFirstNightPrompt(setup, state, playerId) }))
      .find(({ prompt }) => prompt);
    if (!actor?.prompt) throw new Error("First-night actor was not found");

    if (actor.prompt.kind === "acknowledge") {
      state = acknowledgeFirstNightPrompt(setup, state, actor.playerId);
    } else {
      const count = actor.prompt.kind === "select-two" ? 2 : 1;
      state = submitFirstNightSelection(
        setup,
        state,
        actor.playerId,
        (actor.prompt.allowedPlayerIds ?? []).slice(0, count)
      );
    }
  }
  return state;
}

function playDay(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  execute: boolean
): TroubleBrewingGameState {
  let next = game;
  const living = alivePlayerIds(next);
  const majority = Math.floor(living.length / 2) + 1;
  for (const playerId of living.slice(0, majority)) {
    next = requestNominations(next, playerId);
  }

  if (execute) {
    const targetPlayerId = alivePlayerIds(next).find((playerId) => {
      const roleId = next.players[playerId]?.roleId;
      return roleId && !["imp", "saint", "virgin"].includes(roleId);
    });
    const nominatorPlayerId = alivePlayerIds(next)[0];
    if (targetPlayerId && nominatorPlayerId) {
      next = nominatePlayer(setup, next, nominatorPlayerId, targetPlayerId, 0, 1);
      for (const playerId of alivePlayerIds(next)) {
        next = setVoteIntent(next, playerId, true);
      }
      next = tickVote(next, 100_000);
    }
  }

  if (next.winner) return next;
  const closers = alivePlayerIds(next);
  const closeMajority = Math.floor(closers.length / 2) + 1;
  for (const playerId of closers.slice(0, closeMajority)) {
    next = requestCloseNominations(setup, next, playerId);
  }
  return next;
}

function finishOtherNight(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState
): TroubleBrewingGameState {
  let next = startOtherNight(setup, game);
  let guard = 0;
  while (next.night) {
    guard += 1;
    if (guard > 200) throw new Error("Other-night soak flow stalled");
    const actor = setup.playerOrder
      .map((playerId) => ({ playerId, prompt: getOtherNightPrompt(setup, next, playerId) }))
      .find(({ prompt }) => prompt);
    if (!actor?.prompt) throw new Error("Other-night actor was not found");

    if (actor.prompt.kind === "acknowledge") {
      next = acknowledgeOtherNightPrompt(setup, next, actor.playerId);
      continue;
    }

    const count = actor.prompt.kind === "select-two" ? 2 : 1;
    const options = [...(actor.prompt.allowedPlayerIds ?? [])];
    const actorRoleId = next.players[actor.playerId]?.roleId;
    if (actor.prompt.stepId === "poisoner") {
      options.sort((left, right) => {
        const leftPreferred = next.players[left]?.roleId !== "imp";
        const rightPreferred = next.players[right]?.roleId !== "imp";
        return Number(rightPreferred) - Number(leftPreferred);
      });
    } else if (actor.prompt.stepId === "monk") {
      options.sort((left, right) => {
        const leftPreferred = next.players[left]?.roleId === "imp";
        const rightPreferred = next.players[right]?.roleId === "imp";
        return Number(rightPreferred) - Number(leftPreferred);
      });
    } else if (actor.prompt.stepId === "imp" || actorRoleId === "imp") {
      options.sort((left, right) => {
        const leftRole = next.players[left]?.roleId;
        const rightRole = next.players[right]?.roleId;
        const leftPreferred =
          left !== actor.playerId &&
          next.players[left]?.alive &&
          left !== next.night?.monkProtectedPlayerId &&
          leftRole !== "soldier" &&
          leftRole !== "mayor";
        const rightPreferred =
          right !== actor.playerId &&
          next.players[right]?.alive &&
          right !== next.night?.monkProtectedPlayerId &&
          rightRole !== "soldier" &&
          rightRole !== "mayor";
        return Number(rightPreferred) - Number(leftPreferred);
      });
    } else if (actor.prompt.stepId === "fortuneteller") {
      options.sort((left, right) => {
        const leftPreferred = next.players[left]?.roleId === "imp";
        const rightPreferred = next.players[right]?.roleId === "imp";
        return Number(rightPreferred) - Number(leftPreferred);
      });
    }

    next = submitOtherNightSelection(
      setup,
      next,
      actor.playerId,
      options.slice(0, count)
    );
  }
  return next;
}

function assertInvariants(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  expectedDayNumber: number
): void {
  expect(game.playerOrder).toEqual(setup.playerOrder);
  expect(Object.keys(game.players).sort()).toEqual([...setup.playerOrder].sort());
  expect(game.day.number).toBe(expectedDayNumber);
  const livingImps = game.playerOrder.filter(
    (playerId) => game.players[playerId]?.alive && game.players[playerId]?.roleId === "imp"
  );
  expect(livingImps.length).toBeLessThanOrEqual(1);
  if (!game.winner) expect(livingImps).toHaveLength(1);
  if (game.night) expect(game.day.stage).toBe("complete");
  if (game.winner) expect(game.endReason).toBeTruthy();
}

function simulateGame(playerCount: number, seed: string): TroubleBrewingGameState {
  const setup = createTroubleBrewingSetup(playerIds(playerCount), seed);
  const firstNight = finishFirstNight(setup);
  let game = createGameStateAfterFirstNight(setup, firstNight);
  let expectedDayNumber = 1;
  assertInvariants(setup, game, expectedDayNumber);

  for (let cycle = 0; cycle < 20 && !game.winner; cycle += 1) {
    game = playDay(setup, game, cycle % 2 === 1);
    assertInvariants(setup, game, expectedDayNumber);
    if (game.winner) break;
    game = finishOtherNight(setup, game);
    expectedDayNumber += 1;
    assertInvariants(setup, game, expectedDayNumber);
  }

  if (!game.winner) throw new Error(`Soak game did not finish: ${playerCount}/${seed}`);
  return game;
}

describe("Trouble Brewing soak simulations", () => {
  it("covers every role across deterministic 5-15 player setups", () => {
    const covered = new Set<RoleId>();
    for (let count = 5; count <= 15; count += 1) {
      for (let index = 0; index < 20; index += 1) {
        const setup = createTroubleBrewingSetup(playerIds(count), `coverage-${count}-${index}`);
        setup.rolesInPlay.forEach((roleId) => covered.add(roleId));
      }
    }
    expect([...covered].sort()).toEqual(
      TROUBLE_BREWING_ROLES.map((role) => role.id as RoleId).sort()
    );
  });

  it("runs repeatable multi-day games for every supported player count", () => {
    for (let count = 5; count <= 15; count += 1) {
      for (let index = 0; index < 4; index += 1) {
        const seed = `soak-${count}-${index}`;
        expect(simulateGame(count, seed)).toEqual(simulateGame(count, seed));
      }
    }
  });
});
