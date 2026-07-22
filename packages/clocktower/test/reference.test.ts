import { describe, expect, it } from "vitest";
import {
  TROUBLE_BREWING_REFERENCE_ROLES,
  TROUBLE_BREWING_ROLES,
  TROUBLE_BREWING_ROLE_GUIDES,
  TROUBLE_BREWING_RULES_REFERENCE
} from "../src/index.js";

describe("trouble brewing reference", () => {
  it("provides local guide content for all 22 roles", () => {
    expect(TROUBLE_BREWING_REFERENCE_ROLES).toHaveLength(22);
    expect(Object.keys(TROUBLE_BREWING_ROLE_GUIDES).sort()).toEqual(
      TROUBLE_BREWING_ROLES.map((role) => role.id).sort()
    );
    for (const role of TROUBLE_BREWING_REFERENCE_ROLES) {
      expect(role.guide.timing.length).toBeGreaterThan(0);
      expect(role.guide.overview.length).toBeGreaterThan(0);
      expect(role.guide.rules.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("includes the core offline rule sections", () => {
    expect(TROUBLE_BREWING_RULES_REFERENCE.map((section) => section.id)).toEqual([
      "objective",
      "night",
      "day",
      "nomination",
      "death",
      "malfunction",
      "registration"
    ]);
  });
});
