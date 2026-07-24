export const GOMOKU_BOARD_SIZE = 15;
export const GOMOKU_STATE_VERSION = 1;

export type GomokuStone = "black" | "white";
export type GomokuRuleSet = "freestyle" | "renju";
export type GomokuMatchMode = "ai" | "local";
export type GomokuAiDifficulty = "easy" | "normal" | "hard";
export type GomokuOutcome = "black" | "white" | "draw";
export type GomokuForbiddenReason = "double-three" | "double-four" | "overline";

export interface GomokuPoint {
  x: number;
  y: number;
}

export interface GomokuMove extends GomokuPoint {
  player: GomokuStone;
  moveNumber: number;
}

export interface GomokuResult {
  outcome: GomokuOutcome;
  reason: "five" | "board-full" | "resign";
  winningLine: GomokuPoint[];
}

export interface GomokuGameState {
  version: typeof GOMOKU_STATE_VERSION;
  id: string;
  ruleSet: GomokuRuleSet;
  mode: GomokuMatchMode;
  currentPlayer: GomokuStone;
  moves: GomokuMove[];
  result: GomokuResult | null;
  startedAt: number;
  elapsedSeconds: number;
  seed: number;
  usedUndo: boolean;
  usedHint: boolean;
  setupMoveCount?: number;
  setupCurrentPlayer?: GomokuStone;
  aiDifficulty?: GomokuAiDifficulty;
  humanColor?: GomokuStone;
}

export interface CreateGomokuGameOptions {
  id: string;
  ruleSet: GomokuRuleSet;
  mode: GomokuMatchMode;
  startedAt: number;
  seed: number;
  aiDifficulty?: GomokuAiDifficulty;
  humanColor?: GomokuStone;
}

export type GomokuMoveFailure =
  | { reason: "game-over" }
  | { reason: "out-of-bounds" }
  | { reason: "occupied" }
  | { reason: "wrong-player" }
  | { reason: "forbidden"; forbidden: GomokuForbiddenReason };

export type GomokuMoveResult =
  | { ok: true; state: GomokuGameState; move: GomokuMove }
  | { ok: false; failure: GomokuMoveFailure };
