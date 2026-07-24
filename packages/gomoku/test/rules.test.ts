import { describe, expect, it } from "vitest";
import {
  GomokuPosition,
  createGomokuGame,
  playGomokuMove,
  resignGomokuGame,
  restoreGomokuGame,
  rewindGomokuGame,
  type GomokuGameState,
  type GomokuPoint,
  type GomokuStone
} from "../src/index.js";

describe("gomoku rules", () => {
  it("wins with five or more stones in freestyle", () => {
    const state = playSequence(
      "freestyle",
      [
        [3, 7],
        [0, 0],
        [4, 7],
        [0, 1],
        [5, 7],
        [0, 2],
        [6, 7],
        [0, 3],
        [7, 7]
      ]
    );
    expect(state.result).toMatchObject({ outcome: "black", reason: "five" });
    expect(state.result?.winningLine).toHaveLength(5);
  });

  it("allows white overlines in renju", () => {
    const moves = alternatingMoves(
      [
        [0, 0],
        [2, 8],
        [0, 1],
        [3, 8],
        [0, 2],
        [4, 8],
        [1, 0],
        [5, 8],
        [1, 1],
        [7, 8],
        [1, 2],
        [6, 8]
      ],
      "renju"
    );
    expect(moves.result).toMatchObject({ outcome: "white", reason: "five" });
    expect(moves.result?.winningLine).toHaveLength(6);
  });

  it("rejects black overline, double-four, and double-three", () => {
    const overline = positionWithBlack([
      [3, 7],
      [4, 7],
      [5, 7],
      [6, 7],
      [8, 7]
    ]).analyzePlacement({ x: 7, y: 7 }, "black", "renju");
    expect(overline).toMatchObject({ legal: false, forbidden: "overline" });

    const doubleFour = positionWithBlack([
      [5, 7],
      [6, 7],
      [8, 7],
      [7, 5],
      [7, 6],
      [7, 8]
    ]).analyzePlacement({ x: 7, y: 7 }, "black", "renju");
    expect(doubleFour).toMatchObject({ legal: false, forbidden: "double-four" });

    const doubleThree = positionWithBlack([
      [6, 7],
      [8, 7],
      [7, 6],
      [7, 8]
    ]).analyzePlacement({ x: 7, y: 7 }, "black", "renju");
    expect(doubleThree).toMatchObject({ legal: false, forbidden: "double-three" });
  });

  it("does not treat a false three as forbidden", () => {
    const position = positionFromStones(
      [
        [7, 6],
        [6, 8],
        [7, 8],
        [6, 9],
        [8, 9],
        [9, 9]
      ],
      [
        [7, 4],
        [9, 6],
        [6, 7],
        [10, 9]
      ]
    );
    expect(position.analyzePlacement({ x: 7, y: 7 }, "black", "renju")).toMatchObject({
      legal: true
    });
  });

  it("gives exact black five priority over crossing forbidden shapes", () => {
    const position = positionWithBlack([
      [3, 7],
      [4, 7],
      [5, 7],
      [6, 7],
      [7, 5],
      [7, 6],
      [7, 8]
    ]);
    const analysis = position.analyzePlacement({ x: 7, y: 7 }, "black", "renju");
    expect(analysis.legal).toBe(true);
    expect(analysis.winningLine).toHaveLength(5);
  });

  it("restores and rewinds a serialized game by replaying moves", () => {
    const state = playSequence("renju", [
      [7, 7],
      [7, 8],
      [8, 7],
      [8, 8]
    ]);
    const restored = restoreGomokuGame(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
    const rewound = rewindGomokuGame(restored, 2);
    expect(rewound.moves).toHaveLength(2);
    expect(rewound.currentPlayer).toBe("black");
    expect(rewound.usedUndo).toBe(true);
  });

  it("restores a valid resignation and rejects a forged winner", () => {
    const game = createGomokuGame({
      id: "resign-game",
      ruleSet: "renju",
      mode: "ai",
      aiDifficulty: "easy",
      humanColor: "black",
      startedAt: 1_000,
      seed: 8
    });
    const resigned = resignGomokuGame(game, "black");
    expect(restoreGomokuGame(JSON.parse(JSON.stringify(resigned)))).toEqual(resigned);
    expect(() =>
      restoreGomokuGame({
        ...resigned,
        result: { outcome: "black", reason: "resign", winningLine: [] }
      })
    ).toThrow("认输胜方无效");
  });
});

function playSequence(
  ruleSet: "freestyle" | "renju",
  points: readonly (readonly [number, number])[]
): GomokuGameState {
  return alternatingMoves(points, ruleSet);
}

function alternatingMoves(
  points: readonly (readonly [number, number])[],
  ruleSet: "freestyle" | "renju"
): GomokuGameState {
  let state = createGomokuGame({
    id: "test-game",
    ruleSet,
    mode: "local",
    startedAt: 1_000,
    seed: 7
  });
  for (const [x, y] of points) {
    const result = playGomokuMove(state, { x, y });
    if (!result.ok) throw new Error(JSON.stringify(result.failure));
    state = result.state;
  }
  return state;
}

function positionWithBlack(points: readonly (readonly [number, number])[]): GomokuPosition {
  return positionFromStones(points, []);
}

function positionFromStones(
  black: readonly (readonly [number, number])[],
  white: readonly (readonly [number, number])[]
): GomokuPosition {
  const moves: Array<GomokuPoint & { player: GomokuStone; moveNumber: number }> = [];
  for (const [x, y] of black) moves.push({ x, y, player: "black", moveNumber: moves.length + 1 });
  for (const [x, y] of white) moves.push({ x, y, player: "white", moveNumber: moves.length + 1 });
  return GomokuPosition.fromMoves(moves);
}
