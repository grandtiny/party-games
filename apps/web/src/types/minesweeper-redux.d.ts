declare module "minesweeper-redux" {
  export type GameStatus = "waiting" | "ready" | "running" | "loss" | "win";
  export type CellStatus = "hidden" | "flagged" | "revealed" | "detonated";

  export interface Difficulty {
    height: number;
    width: number;
    numMines: number;
  }

  export interface Coordinate {
    x: number;
    y: number;
  }

  export interface Cell {
    status: CellStatus;
    mineCount: number;
  }

  export interface Minesweeper {
    difficulty: Difficulty;
    status: GameStatus;
    numCells: number;
    grid: ReadonlyArray<ReadonlyArray<Cell>>;
    savedGridState?: ReadonlyArray<ReadonlyArray<Cell>>;
    numFlagged: number;
    remainingFlags: number;
    randSeed: number;
    elapsedTime: number;
  }

  export interface StartGameAction {
    type: "START_GAME";
    difficulty: Difficulty;
    randSeed: number;
  }

  export interface RevealCellAction {
    type: "REVEAL_CELL";
    coordinate: Coordinate;
  }

  export interface ToggleFlagAction {
    type: "TOGGLE_FLAG";
    coordinate: Coordinate;
  }

  export type GameAction = StartGameAction | RevealCellAction | ToggleFlagAction;

  export const gameReducer: (
    state: Minesweeper | undefined,
    action: GameAction
  ) => Minesweeper;
  export const startGame: (options: {
    difficulty: Difficulty;
    randSeed: number;
  }) => StartGameAction;
  export const revealCell: (options: { coordinate: Coordinate }) => RevealCellAction;
  export const toggleFlag: (options: { coordinate: Coordinate }) => ToggleFlagAction;
  export const createCoordinate: (x: number, y: number) => Coordinate;
}
