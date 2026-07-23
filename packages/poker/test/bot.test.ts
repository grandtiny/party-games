import { describe, expect, it } from "vitest";
import {
  createPokerTable,
  decidePokerBotAction,
  handlePokerTableCommand,
  projectPokerTable,
  restorePokerEngine,
  type PokerBotDifficulty,
  type PokerTableState
} from "../src/index.js";

describe("deterministic poker bot", () => {
  it("chooses deterministic server-legal actions at every difficulty", () => {
    const state = createDealtTable("bot-test-table");
    const actingPlayerId = actingPlayer(state);
    const legalActions = projectPokerTable(state, actingPlayerId).self?.legalActions;

    for (const difficulty of difficulties) {
      const first = decidePokerBotAction(state, actingPlayerId, difficulty);
      const second = decidePokerBotAction(state, actingPlayerId, difficulty);

      expect(first).toEqual(second);
      expect(legalActions?.actions).toContain(first.action);
      if (first.amount !== undefined) {
        expect(first.amount).toBeGreaterThanOrEqual(legalActions?.minAmount ?? 0);
        expect(first.amount).toBeLessThanOrEqual(legalActions?.maxAmount ?? 0);
      }
    }

    expect(decidePokerBotAction(state, actingPlayerId)).toEqual(
      decidePokerBotAction(state, actingPlayerId, "normal")
    );
  });

  it("uses distinct decision profiles for easy, normal, and hard", () => {
    const profiles = new Map<PokerBotDifficulty, string[]>(
      difficulties.map((difficulty) => [difficulty, []])
    );

    for (let index = 0; index < 40; index += 1) {
      const state = createDealtTable(`bot-profile-${index}`);
      const playerId = actingPlayer(state);
      for (const difficulty of difficulties) {
        profiles.get(difficulty)?.push(
          JSON.stringify(decidePokerBotAction(state, playerId, difficulty))
        );
      }
    }

    expect(profiles.get("easy")).not.toEqual(profiles.get("normal"));
    expect(profiles.get("hard")).not.toEqual(profiles.get("normal"));
    expect(profiles.get("easy")).not.toEqual(profiles.get("hard"));
  });

  it("does not use opponents' hidden hole cards", () => {
    const state = createDealtTable("bot-hidden-information");
    const playerId = actingPlayer(state);
    const altered = JSON.parse(JSON.stringify(state)) as PokerTableState;
    altered.engine.snapshot.players.forEach((player, seat) => {
      if (!player || player.id === playerId) return;
      altered.engine.snapshot.players[seat] = { ...player, hand: ["As", "Ad"] };
    });

    for (const difficulty of difficulties) {
      expect(decidePokerBotAction(altered, playerId, difficulty)).toEqual(
        decidePokerBotAction(state, playerId, difficulty)
      );
    }
  });
});

const difficulties = ["easy", "normal", "hard"] as const satisfies readonly PokerBotDifficulty[];

function createDealtTable(tableSeed: string): PokerTableState {
  const ownerPlayerId = "player-0";
  const state = createPokerTable({
    mode: "points",
    tableSeed,
    now: 1_000,
    smallBlind: 5,
    bigBlind: 10,
    players: Array.from({ length: 4 }, (_, seat) => ({
      playerId: `player-${seat}`,
      nickname: seat === 0 ? "Human" : `AI ${seat}`,
      seat
    }))
  });
  return handlePokerTableCommand(
    state,
    { type: "poker:deal", actorPlayerId: ownerPlayerId, payload: {} },
    { now: 2_000, ownerPlayerId }
  );
}

function actingPlayer(state: PokerTableState): string {
  const engine = restorePokerEngine(state.engine);
  const playerId = engine.state.players[engine.state.actionTo ?? -1]?.id;
  if (!playerId) throw new Error("测试牌局没有行动玩家");
  return playerId;
}
