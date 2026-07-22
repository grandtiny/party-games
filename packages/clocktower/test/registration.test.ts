import { describe, expect, it } from "vitest";
import {
  createGameStateAfterFirstNight,
  getFirstNightPrompt,
  getOtherNightPrompt,
  nominatePlayer,
  requestNominations,
  startOtherNight,
  submitFirstNightSelection,
  submitOtherNightSelection,
  useSlayerClaim,
  FIRST_NIGHT_ORDER,
  GOOD_ROLE_IDS,
  ROLE_BY_ID,
  type FirstNightState,
  type RoleId,
  type TroubleBrewingGameState,
  type TroubleBrewingSetup
} from "../src/index.js";

const players = ["p1", "p2", "p3", "p4", "p5"];

function setupWith(roleIds: RoleId[], seed: string): TroubleBrewingSetup {
  return {
    seed,
    playerOrder: [...players],
    counts: { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
    rolesInPlay: [...roleIds],
    assignments: players.map((playerId, index) => {
      const roleId = roleIds[index] as RoleId;
      return {
        playerId,
        actualRoleId: roleId,
        shownRoleId: roleId,
        alignment: ROLE_BY_ID.get(roleId)?.alignment ?? "good"
      };
    }),
    demonBluffRoleIds: []
  };
}

function firstNightAt(stepId: (typeof FIRST_NIGHT_ORDER)[number]): FirstNightState {
  return {
    stepIndex: FIRST_NIGHT_ORDER.indexOf(stepId),
    completedPlayerIds: [],
    fortuneTellerResults: {},
    butlerMasters: {},
    history: [],
    complete: false
  };
}

function completedFirstNight(): FirstNightState {
  return {
    stepIndex: FIRST_NIGHT_ORDER.length,
    completedPlayerIds: [],
    fortuneTellerResults: {},
    butlerMasters: {},
    history: [],
    complete: true
  };
}

function openNominations(game: TroubleBrewingGameState): TroubleBrewingGameState {
  let next = game;
  for (const playerId of players.slice(0, 3)) next = requestNominations(next, playerId);
  return next;
}

describe("seeded registration rulings", () => {
  it("allows the Spy to register both good and evil to the Empath", () => {
    const values = new Set<number>();
    for (let index = 0; index < 200 && values.size < 2; index += 1) {
      const setup = setupWith(
        ["empath", "spy", "imp", "chef", "washerwoman"],
        `empath-spy-${index}`
      );
      const state = firstNightAt("empath");
      const first = getFirstNightPrompt(setup, state, "p1");
      const second = getFirstNightPrompt(setup, state, "p1");
      expect(first).toEqual(second);
      if (first?.result?.kind === "number") values.add(first.result.value);
    }
    expect([...values].sort()).toEqual([0, 1]);
  });

  it("allows the Recluse to register both as Demon and not Demon to the Fortune Teller", () => {
    const values = new Set<boolean>();
    for (let index = 0; index < 200 && values.size < 2; index += 1) {
      const setup = setupWith(
        ["fortuneteller", "recluse", "imp", "chef", "washerwoman"],
        `fortune-recluse-${index}`
      );
      setup.redHerringPlayerId = "p5";
      let state = firstNightAt("fortuneteller");
      state = submitFirstNightSelection(setup, state, "p1", ["p2", "p4"]);
      const result = getFirstNightPrompt(setup, state, "p1")?.result;
      if (result?.kind === "yes-no") values.add(result.value);
    }
    expect([...values].sort()).toEqual([false, true]);
  });

  it("allows a dead Spy to register as the Spy or a good role to the Undertaker", () => {
    const values = new Set<RoleId>();
    for (let index = 0; index < 300 && (values.size < 2 || !values.has("spy")); index += 1) {
      const setup = setupWith(
        ["undertaker", "spy", "imp", "chef", "washerwoman"],
        `undertaker-spy-${index}`
      );
      const game = createGameStateAfterFirstNight(setup, completedFirstNight());
      const executed = game.players.p2;
      if (executed) executed.alive = false;
      game.day.executedPlayerId = "p2";
      game.day.stage = "complete";
      let nightGame = startOtherNight(setup, game);
      nightGame = submitOtherNightSelection(setup, nightGame, "p3", ["p2"]);
      const result = getOtherNightPrompt(setup, nightGame, "p1")?.result;
      if (result?.kind === "role") values.add(result.roleId);
    }

    expect(values.has("spy")).toBe(true);
    expect([...values].some((roleId) => GOOD_ROLE_IDS.includes(roleId))).toBe(true);
  });

  it("uses both legal Spy/Virgin and Recluse/Slayer registration outcomes", () => {
    const virginOutcomes = new Set<boolean>();
    const slayerOutcomes = new Set<boolean>();
    for (let index = 0; index < 300 && (virginOutcomes.size < 2 || slayerOutcomes.size < 2); index += 1) {
      const virginSetup = setupWith(
        ["virgin", "spy", "mayor", "washerwoman", "imp"],
        `virgin-spy-${index}`
      );
      let virginGame = openNominations(
        createGameStateAfterFirstNight(virginSetup, completedFirstNight())
      );
      virginGame = nominatePlayer(virginSetup, virginGame, "p2", "p1", 0, 1);
      virginOutcomes.add(virginGame.players.p2?.alive === false);

      const recluseSetup = setupWith(
        ["slayer", "recluse", "mayor", "poisoner", "imp"],
        `slayer-recluse-${index}`
      );
      const recluseGame = useSlayerClaim(
        recluseSetup,
        createGameStateAfterFirstNight(recluseSetup, completedFirstNight()),
        "p1",
        "p2"
      );
      slayerOutcomes.add(recluseGame.players.p2?.alive === false);
    }

    expect([...virginOutcomes].sort()).toEqual([false, true]);
    expect([...slayerOutcomes].sort()).toEqual([false, true]);
  });
});
