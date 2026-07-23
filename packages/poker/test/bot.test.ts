import { describe, expect, it } from "vitest";
import {
  createPokerTable,
  decidePokerBotAction,
  handlePokerTableCommand,
  projectPokerTable,
  restorePokerEngine
} from "../src/index.js";

describe("deterministic poker bot", () => {
  it("chooses the same server-legal action for the same private view", () => {
    let state = createPokerTable({
      mode: "points",
      tableSeed: "bot-test-table",
      now: 1_000,
      smallBlind: 5,
      bigBlind: 10,
      players: [
        { playerId: "bot", nickname: "AI", seat: 0 },
        { playerId: "human", nickname: "Human", seat: 1 }
      ]
    });
    state = handlePokerTableCommand(
      state,
      { type: "poker:deal", actorPlayerId: "bot", payload: {} },
      { now: 2_000, ownerPlayerId: "bot" }
    );
    const engine = restorePokerEngine(state.engine);
    const actingPlayerId = engine.state.players[engine.state.actionTo ?? -1]?.id;
    if (!actingPlayerId) throw new Error("测试牌局没有行动玩家");

    const first = decidePokerBotAction(state, actingPlayerId);
    const second = decidePokerBotAction(state, actingPlayerId);
    const legalActions = projectPokerTable(state, actingPlayerId).self?.legalActions;

    expect(first).toEqual(second);
    expect(legalActions?.actions).toContain(first.action);
    if (first.amount !== undefined) {
      expect(first.amount).toBeGreaterThanOrEqual(legalActions?.minAmount ?? 0);
      expect(first.amount).toBeLessThanOrEqual(legalActions?.maxAmount ?? 0);
    }
  });
});
