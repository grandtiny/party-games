import { describe, expect, it } from "vitest";
import { GameRegistry } from "../src/index.js";

describe("GameRegistry", () => {
  it("registers and resolves modules", () => {
    const clocktower = { id: "clocktower" as const, displayName: "血染钟楼" };
    const registry = new GameRegistry<"clocktower", typeof clocktower>([clocktower]);

    expect(registry.has("clocktower")).toBe(true);
    expect(registry.get("clocktower")).toBe(clocktower);
    expect(registry.list()).toEqual([clocktower]);
  });

  it("rejects duplicate module ids", () => {
    const registry = new GameRegistry<"clocktower", { id: "clocktower"; displayName: string }>();
    registry.register({ id: "clocktower", displayName: "血染钟楼" });

    expect(() =>
      registry.register({ id: "clocktower", displayName: "重复模块" })
    ).toThrow("游戏模块已注册");
  });
});
