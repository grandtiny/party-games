import { describe, expect, it } from "vitest";
import {
  acknowledgeFirstNightPrompt,
  createFirstNightState,
  createTroubleBrewingSetup,
  FIRST_NIGHT_ORDER,
  getFirstNightPrompt,
  submitFirstNightSelection,
  type FirstNightState,
  type TroubleBrewingSetup
} from "../src/index.js";

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `player-${index + 1}`);
}

function completeFirstNight(setup: TroubleBrewingSetup): FirstNightState {
  let state = createFirstNightState(setup);
  let guard = 0;

  while (!state.complete && guard < 200) {
    guard += 1;
    let acted = false;
    for (const playerId of setup.playerOrder) {
      const prompt = getFirstNightPrompt(setup, state, playerId);
      if (!prompt) continue;
      acted = true;
      if (prompt.kind === "acknowledge") {
        state = acknowledgeFirstNightPrompt(setup, state, playerId);
      } else {
        const count = prompt.kind === "select-two" ? 2 : 1;
        state = submitFirstNightSelection(
          setup,
          state,
          playerId,
          (prompt.allowedPlayerIds ?? []).slice(0, count)
        );
      }
      break;
    }
    if (!acted) throw new Error("First night state machine stalled");
  }

  expect(guard).toBeLessThan(200);
  return state;
}

describe("first night state machine", () => {
  it("uses the official Trouble Brewing order", () => {
    expect(FIRST_NIGHT_ORDER).toEqual([
      "minioninfo",
      "demoninfo",
      "poisoner",
      "washerwoman",
      "librarian",
      "investigator",
      "chef",
      "empath",
      "fortuneteller",
      "butler",
      "spy"
    ]);
  });

  it.each(Array.from({ length: 11 }, (_, index) => index + 5))(
    "completes a %i-player first night without stalling",
    (count) => {
      for (let seedIndex = 0; seedIndex < 15; seedIndex += 1) {
        const setup = createTroubleBrewingSetup(playerIds(count), `night-${count}-${seedIndex}`);
        const state = completeFirstNight(setup);
        expect(state.complete).toBe(true);
      }
    }
  );

  it("wakes a Drunk according to the Townsfolk facade", () => {
    const ids = playerIds(15);
    let setup: TroubleBrewingSetup | undefined;
    const wakingRoles = new Set([
      "washerwoman",
      "librarian",
      "investigator",
      "chef",
      "empath",
      "fortuneteller"
    ]);

    for (let index = 0; index < 2000; index += 1) {
      const candidate = createTroubleBrewingSetup(ids, `drunk-night-${index}`);
      const drunk = candidate.assignments.find(
        (assignment) => assignment.actualRoleId === "drunk"
      );
      if (drunk && wakingRoles.has(drunk.shownRoleId)) {
        setup = candidate;
        break;
      }
    }

    expect(setup).toBeDefined();
    const drunk = setup?.assignments.find((assignment) => assignment.actualRoleId === "drunk");
    let state = createFirstNightState(setup as TroubleBrewingSetup);
    let prompt;

    for (let guard = 0; guard < 200 && !prompt; guard += 1) {
      prompt = getFirstNightPrompt(setup as TroubleBrewingSetup, state, drunk?.playerId ?? "");
      if (prompt) break;
      for (const playerId of (setup as TroubleBrewingSetup).playerOrder) {
        const current = getFirstNightPrompt(setup as TroubleBrewingSetup, state, playerId);
        if (!current) continue;
        state =
          current.kind === "acknowledge"
            ? acknowledgeFirstNightPrompt(setup as TroubleBrewingSetup, state, playerId)
            : submitFirstNightSelection(
                setup as TroubleBrewingSetup,
                state,
                playerId,
                (current.allowedPlayerIds ?? []).slice(0, current.kind === "select-two" ? 2 : 1)
              );
        break;
      }
    }

    expect(prompt?.stepId).toBe(drunk?.shownRoleId);
    expect(prompt?.kind).toBe("acknowledge");
  });
});
