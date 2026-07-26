import { describe, expect, it } from "vitest";
import {
  GomokuPosition,
  chooseGomokuMove,
  createGomokuGame,
  playGomokuMove,
  type GomokuGameState
} from "../src/index.js";

describe("gomoku ai", () => {
  it("takes an immediate win", () => {
    const state = play([
      [3, 7],
      [0, 0],
      [4, 7],
      [0, 1],
      [5, 7],
      [0, 2],
      [6, 7],
      [1, 0]
    ]);
    const decision = chooseGomokuMove({ state, difficulty: "normal", timeBudgetMs: 100 });
    expect(decision.point).toEqual({ x: 7, y: 7 });
  });

  it("blocks an immediate opponent win", () => {
    const state = play([
      [2, 7],
      [3, 7],
      [0, 0],
      [4, 7],
      [0, 1],
      [5, 7],
      [1, 0],
      [6, 7]
    ]);
    const decision = chooseGomokuMove({ state, difficulty: "normal", timeBudgetMs: 150 });
    expect(decision.point).toEqual({ x: 7, y: 7 });
  });

  it("returns deterministic legal moves at every difficulty", () => {
    const state = play([
      [7, 7],
      [7, 8],
      [8, 7],
      [6, 7],
      [8, 8],
      [6, 8]
    ]);
    const position = GomokuPosition.fromMoves(state.moves);
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const first = chooseGomokuMove({ state, difficulty, timeBudgetMs: 100 });
      const second = chooseGomokuMove({ state, difficulty, timeBudgetMs: 100 });
      expect(first.point).toEqual(second.point);
      expect(position.analyzePlacement(first.point, state.currentPlayer, state.ruleSet).legal).toBe(
        true
      );
    }
  });
});

function play(points: readonly (readonly [number, number])[]): GomokuGameState {
  let state = createGomokuGame({
    id: "ai-test",
    ruleSet: "renju",
    mode: "ai",
    humanColor: "white",
    aiDifficulty: "normal",
    startedAt: 1_000,
    seed: 19
  });
  for (const [x, y] of points) {
    const result = playGomokuMove(state, { x, y });
    if (!result.ok) throw new Error(JSON.stringify(result.failure));
    state = result.state;
  }
  return state;
}
