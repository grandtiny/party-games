import { describe, expect, it } from "vitest";
import {
  createTroubleBrewingSetup,
  getRoleCounts,
  ROLE_BY_ID,
  type RoleId
} from "../src/index.js";

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `player-${index + 1}`);
}

describe("Trouble Brewing setup", () => {
  it.each(Array.from({ length: 11 }, (_, index) => index + 5))(
    "creates a valid %i-player setup",
    (count) => {
      const setup = createTroubleBrewingSetup(playerIds(count), `seed-${count}`);
      const actualRoleIds = setup.assignments.map((assignment) => assignment.actualRoleId);

      expect(setup.assignments).toHaveLength(count);
      expect(new Set(actualRoleIds)).toHaveLength(count);
      expect(actualRoleIds).toContain("imp");

      const hasBaron = actualRoleIds.includes("baron");
      const expectedCounts = getRoleCounts(count, hasBaron);
      const countType = (type: string) =>
        actualRoleIds.filter((roleId) => ROLE_BY_ID.get(roleId as RoleId)?.type === type).length;

      expect(countType("townsfolk")).toBe(expectedCounts.townsfolk);
      expect(countType("outsider")).toBe(expectedCounts.outsiders);
      expect(countType("minion")).toBe(expectedCounts.minions);
      expect(countType("demon")).toBe(1);
    }
  );

  it("is deterministic for the same seed", () => {
    const ids = playerIds(10);
    expect(createTroubleBrewingSetup(ids, "repeatable")).toEqual(
      createTroubleBrewingSetup(ids, "repeatable")
    );
  });

  it("gives the Drunk an out-of-play Townsfolk facade", () => {
    const ids = playerIds(15);
    let setup = createTroubleBrewingSetup(ids, "drunk-search-0");

    for (let index = 1; index < 200 && !setup.rolesInPlay.includes("drunk"); index += 1) {
      setup = createTroubleBrewingSetup(ids, `drunk-search-${index}`);
    }

    expect(setup.rolesInPlay).toContain("drunk");
    expect(setup.drunkFacadeRoleId).toBeDefined();
    expect(setup.rolesInPlay).not.toContain(setup.drunkFacadeRoleId);
    expect(ROLE_BY_ID.get(setup.drunkFacadeRoleId as RoleId)?.type).toBe("townsfolk");

    const drunk = setup.assignments.find((assignment) => assignment.actualRoleId === "drunk");
    expect(drunk?.shownRoleId).toBe(setup.drunkFacadeRoleId);
  });

  it("only gives Demon bluffs in games with seven or more players", () => {
    expect(createTroubleBrewingSetup(playerIds(6), "small").demonBluffRoleIds).toEqual([]);

    const large = createTroubleBrewingSetup(playerIds(7), "large");
    expect(large.demonBluffRoleIds).toHaveLength(3);
    for (const bluff of large.demonBluffRoleIds) {
      expect(large.rolesInPlay).not.toContain(bluff);
      expect(bluff).not.toBe(large.drunkFacadeRoleId);
    }
  });
});
