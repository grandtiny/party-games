import { describe, expect, it } from "vitest";
import {
  GomokuPosition,
  createGomokuExerciseState,
  createGomokuPuzzleState,
  gomokuLessons,
  gomokuPuzzles,
  playGomokuMove,
  restoreGomokuGame,
  rewindGomokuGame,
  validateGomokuPuzzle
} from "../src/index.js";

describe("gomoku content", () => {
  it("provides sixty stable, validated puzzles", () => {
    expect(gomokuPuzzles).toHaveLength(60);
    expect(new Set(gomokuPuzzles.map((puzzle) => puzzle.id)).size).toBe(60);
    for (const puzzle of gomokuPuzzles) validateGomokuPuzzle(puzzle);
  });

  it("covers every planned puzzle category", () => {
    expect(new Set(gomokuPuzzles.map((puzzle) => puzzle.category))).toEqual(
      new Set(["vcf", "vct"])
    );
  });

  it("keeps puzzle mode focused on multi-step tactical problems", () => {
    expect(new Set(gomokuPuzzles.map((puzzle) => puzzle.objective))).toEqual(new Set(["prove"]));
    expect(new Set(gomokuPuzzles.map((puzzle) => puzzle.solutionLines[0]?.length))).toEqual(
      new Set([5, 7, 9, 11, 13])
    );
    expect(gomokuPuzzles.every((puzzle) => (puzzle.solutionLines[0]?.length ?? 0) >= 5)).toBe(true);
    expect(new Set(gomokuPuzzles.map((puzzle) => puzzle.difficulty))).toEqual(
      new Set(["beginner", "intermediate", "advanced"])
    );
    for (const difficulty of ["beginner", "intermediate", "advanced"]) {
      expect(gomokuPuzzles.filter((puzzle) => puzzle.difficulty === difficulty)).toHaveLength(20);
    }
  });

  it("provides eight lessons with two legal exercises each", () => {
    expect(gomokuLessons).toHaveLength(8);
    for (const lesson of gomokuLessons) {
      expect(lesson.exercises).toHaveLength(2);
      for (const exercise of lesson.exercises) {
        const state = createGomokuExerciseState(exercise);
        const position = GomokuPosition.fromMoves(state.moves);
        for (const move of exercise.correctMoves) {
          expect(position.analyzePlacement(move, exercise.toMove, exercise.ruleSet).legal).toBe(true);
        }
      }
    }
  });

  it("restores puzzle setups and never rewinds below the setup boundary", () => {
    const puzzle = gomokuPuzzles[48];
    expect(puzzle).toBeDefined();
    if (!puzzle) return;
    const state = createGomokuPuzzleState(puzzle);
    const first = puzzle.solutionLines[0]?.[0];
    expect(first).toBeDefined();
    if (!first) return;
    const played = playGomokuMove(state, first);
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(restoreGomokuGame(JSON.parse(JSON.stringify(played.state)))).toEqual(played.state);
    const rewound = rewindGomokuGame(played.state, 0);
    expect(rewound.moves).toHaveLength(state.moves.length);
    expect(rewound.currentPlayer).toBe(state.currentPlayer);
  });
});
