import { describe, expect, it } from "vitest";
import {
  acknowledgeOtherNightPrompt,
  createGameStateAfterFirstNight,
  getOtherNightPrompt,
  startOtherNight,
  submitOtherNightSelection,
  type FirstNightState,
  type RoleId,
  type TroubleBrewingGameState,
  type TroubleBrewingSetup
} from "../src/index.js";

const players = ["p1", "p2", "p3", "p4", "p5"];

function setupWith(roleIds: RoleId[], seed = "night-test"): TroubleBrewingSetup {
  return {
    seed,
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

function firstNight(): FirstNightState {
  return {
    stepIndex: 11,
    completedPlayerIds: [],
    fortuneTellerResults: {},
    butlerMasters: {},
    history: [],
    complete: true
  };
}

function beginNight(
  setup: TroubleBrewingSetup,
  prepare?: (game: TroubleBrewingGameState) => void
): TroubleBrewingGameState {
  const game = createGameStateAfterFirstNight(setup, firstNight());
  game.day.stage = "complete";
  prepare?.(game);
  return startOtherNight(setup, game);
}

describe("other-night state machine", () => {
  it("runs poison, protection, recurring information and Butler before day two", () => {
    const setup = setupWith(["poisoner", "monk", "imp", "empath", "butler"]);
    let game = beginNight(setup);

    expect(getOtherNightPrompt(setup, game, "p1")?.stepId).toBe("poisoner");
    game = submitOtherNightSelection(setup, game, "p1", ["p4"]);
    game = submitOtherNightSelection(setup, game, "p2", ["p5"]);
    game = submitOtherNightSelection(setup, game, "p3", ["p5"]);

    expect(game.players.p5?.alive).toBe(true);
    expect(getOtherNightPrompt(setup, game, "p4")?.result?.kind).toBe("number");
    game = acknowledgeOtherNightPrompt(setup, game, "p4");
    game = submitOtherNightSelection(setup, game, "p5", ["p1"]);

    expect(game.night).toBeUndefined();
    expect(game.day.number).toBe(2);
    expect(game.day.stage).toBe("discussion");
    expect(game.poisonTargetPlayerId).toBe("p4");
    expect(game.butlerMasters.p5).toBe("p1");
    expect(game.day.publicEvents).toEqual([{ kind: "night-deaths", playerIds: [] }]);
  });

  it("makes a poisoned Imp attack fail without revealing the malfunction", () => {
    const setup = setupWith(["poisoner", "imp", "chef", "baron", "washerwoman"]);
    let game = beginNight(setup);
    game = submitOtherNightSelection(setup, game, "p1", ["p2"]);
    game = submitOtherNightSelection(setup, game, "p2", ["p3"]);

    expect(game.players.p3?.alive).toBe(true);
    expect(game.day.publicEvents).toEqual([{ kind: "night-deaths", playerIds: [] }]);
  });

  it("keeps an active Soldier alive when attacked by the Imp", () => {
    const setup = setupWith(["washerwoman", "soldier", "imp", "baron", "chef"]);
    let game = beginNight(setup);
    game = submitOtherNightSelection(setup, game, "p3", ["p2"]);

    expect(game.players.p2?.alive).toBe(true);
    expect(game.day.number).toBe(2);
  });

  it("moves the Imp to a living Minion after a self-kill", () => {
    const setup = setupWith(["washerwoman", "baron", "imp", "chef", "librarian"]);
    let game = beginNight(setup);
    game = submitOtherNightSelection(setup, game, "p3", ["p3"]);

    expect(game.players.p3?.alive).toBe(false);
    expect(game.players.p2?.roleId).toBe("imp");
    expect(game.winner).toBeUndefined();
    expect(game.day.publicEvents).toEqual([{ kind: "night-deaths", playerIds: ["p3"] }]);
  });

  it("gives good the win when a self-killing Imp has no living Minion", () => {
    const setup = setupWith(["washerwoman", "soldier", "imp", "chef", "librarian"]);
    let game = beginNight(setup);
    game = submitOtherNightSelection(setup, game, "p3", ["p3"]);

    expect(game.winner).toBe("good");
    expect(game.endReason).toContain("没有成功传位");
  });

  it("uses seeded Mayor redirection without redirecting the death to the Imp", () => {
    let redirectedGame: TroubleBrewingGameState | undefined;
    for (let index = 0; index < 100 && !redirectedGame; index += 1) {
      const setup = setupWith(
        ["mayor", "chef", "imp", "baron", "washerwoman"],
        `mayor-redirect-${index}`
      );
      let game = beginNight(setup);
      game = submitOtherNightSelection(setup, game, "p3", ["p1"]);
      if (game.players.p1?.alive) redirectedGame = game;
    }

    expect(redirectedGame).toBeDefined();
    const deaths = redirectedGame?.day.publicEvents.find(
      (event) => event.kind === "night-deaths"
    );
    expect(deaths?.kind === "night-deaths" ? deaths.playerIds : []).toHaveLength(1);
    expect(redirectedGame?.players.p3?.alive).toBe(true);
  });

  it("wakes a Drunk Monk facade but does not apply the protection", () => {
    const setup = setupWith(["drunk", "imp", "chef", "baron", "washerwoman"]);
    const drunk = setup.assignments.find((assignment) => assignment.playerId === "p1");
    if (drunk) drunk.shownRoleId = "monk";
    let game = beginNight(setup);

    expect(getOtherNightPrompt(setup, game, "p1")?.stepId).toBe("monk");
    game = submitOtherNightSelection(setup, game, "p1", ["p3"]);
    game = submitOtherNightSelection(setup, game, "p2", ["p3"]);

    expect(game.players.p3?.alive).toBe(false);
  });

  it("wakes a Ravenkeeper killed by the Imp and returns the selected role", () => {
    const setup = setupWith(["ravenkeeper", "imp", "chef", "baron", "librarian"]);
    let game = beginNight(setup);
    game = submitOtherNightSelection(setup, game, "p2", ["p1"]);

    expect(getOtherNightPrompt(setup, game, "p1")?.stepId).toBe("ravenkeeper");
    game = submitOtherNightSelection(setup, game, "p1", ["p3"]);
    expect(getOtherNightPrompt(setup, game, "p1")?.result).toEqual({
      kind: "role",
      roleId: "chef"
    });
    game = acknowledgeOtherNightPrompt(setup, game, "p1");

    expect(game.day.number).toBe(2);
    expect(game.players.p1?.alive).toBe(false);
  });

  it("uses living neighbors for Empath and the executed player for Undertaker", () => {
    const setup = setupWith(["empath", "undertaker", "imp", "baron", "chef"]);
    let game = beginNight(setup, (state) => {
      const executed = state.players.p5;
      if (executed) executed.alive = false;
      state.day.executedPlayerId = "p5";
    });
    game = submitOtherNightSelection(setup, game, "p3", ["p5"]);

    expect(getOtherNightPrompt(setup, game, "p1")?.result).toEqual({
      kind: "number",
      value: 1
    });
    game = acknowledgeOtherNightPrompt(setup, game, "p1");
    expect(getOtherNightPrompt(setup, game, "p2")?.result).toEqual({
      kind: "role",
      roleId: "chef"
    });
    game = acknowledgeOtherNightPrompt(setup, game, "p2");

    expect(game.day.number).toBe(2);
  });

  it("delivers Fortune Teller results and the current grimoire to the Spy", () => {
    const setup = setupWith(["fortuneteller", "spy", "imp", "chef", "washerwoman"]);
    let game = beginNight(setup);
    game = submitOtherNightSelection(setup, game, "p3", ["p4"]);
    game = submitOtherNightSelection(setup, game, "p1", ["p3", "p4"]);

    expect(getOtherNightPrompt(setup, game, "p1")?.result).toEqual({
      kind: "yes-no",
      value: true
    });
    game = acknowledgeOtherNightPrompt(setup, game, "p1");
    expect(getOtherNightPrompt(setup, game, "p2")?.result?.kind).toBe("current-grimoire");
    game = acknowledgeOtherNightPrompt(setup, game, "p2");

    expect(game.day.publicEvents).toEqual([{ kind: "night-deaths", playerIds: ["p4"] }]);
  });
});
