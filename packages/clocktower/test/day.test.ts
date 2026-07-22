import { describe, expect, it } from "vitest";
import {
  createGameStateAfterFirstNight,
  nominatePlayer,
  requestCloseNominations,
  requestNominations,
  setVoteIntent,
  tickVote,
  useSlayerClaim,
  type FirstNightState,
  type RoleId,
  type TroubleBrewingGameState,
  type TroubleBrewingSetup
} from "../src/index.js";

const players = ["p1", "p2", "p3", "p4", "p5"];

function setupWith(roleIds: RoleId[]): TroubleBrewingSetup {
  return {
    seed: "day-test",
    playerOrder: [...players],
    counts: { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
    rolesInPlay: [...roleIds],
    assignments: players.map((playerId, index) => {
      const roleId = roleIds[index] as RoleId;
      const evil = roleId === "imp" || ["poisoner", "spy", "scarletwoman", "baron"].includes(roleId);
      return {
        playerId,
        actualRoleId: roleId,
        shownRoleId: roleId,
        alignment: evil ? "evil" : "good"
      };
    }),
    demonBluffRoleIds: []
  };
}

function firstNight(overrides: Partial<FirstNightState> = {}): FirstNightState {
  return {
    stepIndex: 11,
    completedPlayerIds: [],
    fortuneTellerResults: {},
    butlerMasters: {},
    history: [],
    complete: true,
    ...overrides
  };
}

function openNominations(game: TroubleBrewingGameState): TroubleBrewingGameState {
  let next = game;
  for (const playerId of players.slice(0, 3)) next = requestNominations(next, playerId);
  return next;
}

function finishCurrentVote(
  game: TroubleBrewingGameState,
  votingPlayerIds: string[]
): TroubleBrewingGameState {
  let next = game;
  for (const playerId of votingPlayerIds) next = setVoteIntent(next, playerId, true);
  return tickVote(next, 10_000);
}

function closeNominations(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState
): TroubleBrewingGameState {
  let next = game;
  for (const playerId of players.slice(0, 3)) {
    next = requestCloseNominations(setup, next, playerId);
  }
  return next;
}

describe("day state machine", () => {
  it("opens nominations after a living majority agrees", () => {
    const setup = setupWith(["washerwoman", "virgin", "slayer", "poisoner", "imp"]);
    let game = createGameStateAfterFirstNight(setup, firstNight());
    game = requestNominations(game, "p1");
    game = requestNominations(game, "p2");
    expect(game.day.stage).toBe("discussion");
    game = requestNominations(game, "p3");
    expect(game.day.stage).toBe("nominations");
  });

  it("counts a clockwise public vote and executes the unique leader", () => {
    const setup = setupWith(["washerwoman", "slayer", "mayor", "poisoner", "imp"]);
    let game = openNominations(createGameStateAfterFirstNight(setup, firstNight()));
    game = nominatePlayer(setup, game, "p1", "p2", 0, 100);
    expect(game.day.currentVote?.order).toEqual(["p2", "p3", "p4", "p5", "p1"]);
    game = finishCurrentVote(game, ["p1", "p2", "p3"]);
    expect(game.day.blockVoteCount).toBe(3);
    expect(game.day.blockNomineePlayerIds).toEqual(["p2"]);
    game = closeNominations(setup, game);
    expect(game.players.p2?.alive).toBe(false);
    expect(game.day.executedPlayerId).toBe("p2");
  });

  it("executes nobody when the highest vote is tied", () => {
    const setup = setupWith(["washerwoman", "slayer", "mayor", "poisoner", "imp"]);
    let game = openNominations(createGameStateAfterFirstNight(setup, firstNight()));
    game = finishCurrentVote(
      nominatePlayer(setup, game, "p1", "p2", 0, 100),
      ["p1", "p2", "p3"]
    );
    game = finishCurrentVote(
      nominatePlayer(setup, game, "p2", "p3", 1000, 100),
      ["p1", "p2", "p3"]
    );
    expect(game.day.blockNomineePlayerIds).toEqual(["p2", "p3"]);
    game = closeNominations(setup, game);
    expect(game.day.executedPlayerId).toBeUndefined();
    expect(Object.values(game.players).every((player) => player.alive)).toBe(true);
  });

  it("allows self-nomination and immediately resolves the Virgin", () => {
    const setup = setupWith(["virgin", "slayer", "mayor", "poisoner", "imp"]);
    let game = openNominations(createGameStateAfterFirstNight(setup, firstNight()));
    game = nominatePlayer(setup, game, "p1", "p1", 0, 100);
    expect(game.players.p1?.alive).toBe(false);
    expect(game.day.stage).toBe("complete");
    expect(game.day.publicEvents).toContainEqual({
      kind: "execution",
      playerId: "p1",
      reason: "virgin"
    });
  });

  it("spends but does not trigger a poisoned Virgin", () => {
    const setup = setupWith(["washerwoman", "virgin", "slayer", "poisoner", "imp"]);
    let game = openNominations(
      createGameStateAfterFirstNight(
        setup,
        firstNight({ poisonTargetPlayerId: "p2" })
      )
    );
    game = nominatePlayer(setup, game, "p1", "p2", 0, 100);
    expect(game.players.p1?.alive).toBe(true);
    expect(game.virginSpentPlayerIds).toContain("p2");
    expect(game.day.stage).toBe("voting");
  });

  it("lets a real Slayer kill the Imp", () => {
    const setup = setupWith(["slayer", "washerwoman", "mayor", "poisoner", "imp"]);
    const game = useSlayerClaim(
      setup,
      createGameStateAfterFirstNight(setup, firstNight()),
      "p1",
      "p5"
    );
    expect(game.players.p5?.alive).toBe(false);
    expect(game.winner).toBe("good");
  });

  it("transfers the Demon to a healthy Scarlet Woman with five alive", () => {
    const setup = setupWith(["slayer", "washerwoman", "mayor", "scarletwoman", "imp"]);
    const game = useSlayerClaim(
      setup,
      createGameStateAfterFirstNight(setup, firstNight()),
      "p1",
      "p5"
    );
    expect(game.players.p5?.alive).toBe(false);
    expect(game.players.p4?.roleId).toBe("imp");
    expect(game.winner).toBeUndefined();
    expect(JSON.stringify(game.day.publicEvents)).not.toContain("p4");
  });

  it("gives evil the win when the Saint is executed", () => {
    const setup = setupWith(["washerwoman", "saint", "slayer", "poisoner", "imp"]);
    let game = openNominations(createGameStateAfterFirstNight(setup, firstNight()));
    game = finishCurrentVote(
      nominatePlayer(setup, game, "p1", "p2", 0, 100),
      ["p1", "p2", "p3"]
    );
    game = closeNominations(setup, game);
    expect(game.winner).toBe("evil");
    expect(game.endReason).toContain("圣徒");
  });

  it("consumes a dead player's ghost vote only when counted", () => {
    const setup = setupWith(["washerwoman", "slayer", "mayor", "poisoner", "imp"]);
    let game = createGameStateAfterFirstNight(setup, firstNight());
    if (game.players.p5) game.players.p5.alive = false;
    game = openNominations(game);
    game = nominatePlayer(setup, game, "p1", "p2", 0, 100);
    game = finishCurrentVote(game, ["p1", "p2", "p5"]);
    expect(game.ghostVoteUsedPlayerIds).toContain("p5");

    game = nominatePlayer(setup, game, "p2", "p3", 1000, 100);
    expect(() => setVoteIntent(game, "p5", true)).toThrow("没有可用票");
  });

  it("does not count a healthy Butler without the master's raised vote", () => {
    const setup = setupWith(["butler", "washerwoman", "mayor", "poisoner", "imp"]);
    let game = createGameStateAfterFirstNight(
      setup,
      firstNight({ butlerMasters: { p1: "p2" } })
    );
    game = openNominations(game);
    game = nominatePlayer(setup, game, "p3", "p3", 0, 100);
    game = finishCurrentVote(game, ["p1", "p3", "p4"]);
    const record = game.day.nominations[0];
    expect(record?.votedPlayerIds).not.toContain("p1");
    expect(record?.votes).toBe(2);
  });
});
