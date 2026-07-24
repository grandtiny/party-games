import { GomokuPosition, isInsideBoard, otherStone } from "./position.js";
import {
  GOMOKU_BOARD_SIZE,
  GOMOKU_STATE_VERSION,
  type CreateGomokuGameOptions,
  type GomokuGameState,
  type GomokuMove,
  type GomokuMoveResult,
  type GomokuPoint,
  type GomokuStone
} from "./types.js";

export function createGomokuGame(options: CreateGomokuGameOptions): GomokuGameState {
  if (options.mode === "ai" && (!options.aiDifficulty || !options.humanColor)) {
    throw new Error("人机对局必须指定难度和玩家颜色");
  }
  return {
    version: GOMOKU_STATE_VERSION,
    id: options.id,
    ruleSet: options.ruleSet,
    mode: options.mode,
    currentPlayer: "black",
    moves: [],
    result: null,
    startedAt: options.startedAt,
    elapsedSeconds: 0,
    seed: options.seed,
    usedUndo: false,
    usedHint: false,
    ...(options.aiDifficulty ? { aiDifficulty: options.aiDifficulty } : {}),
    ...(options.humanColor ? { humanColor: options.humanColor } : {})
  };
}

export function playGomokuMove(
  state: GomokuGameState,
  point: GomokuPoint,
  player: GomokuStone = state.currentPlayer,
  elapsedSeconds = state.elapsedSeconds
): GomokuMoveResult {
  if (state.result) return { ok: false, failure: { reason: "game-over" } };
  if (!isInsideBoard(point)) return { ok: false, failure: { reason: "out-of-bounds" } };
  if (player !== state.currentPlayer) {
    return { ok: false, failure: { reason: "wrong-player" } };
  }

  const position = GomokuPosition.fromMoves(state.moves);
  if (!position.isEmpty(point)) return { ok: false, failure: { reason: "occupied" } };
  const analysis = position.analyzePlacement(point, player, state.ruleSet);
  if (!analysis.legal && analysis.forbidden) {
    return {
      ok: false,
      failure: { reason: "forbidden", forbidden: analysis.forbidden }
    };
  }

  const move: GomokuMove = {
    ...point,
    player,
    moveNumber: state.moves.length + 1
  };
  const moves = [...state.moves, move];
  const result =
    analysis.winningLine.length > 0
      ? { outcome: player, reason: "five" as const, winningLine: analysis.winningLine }
      : moves.length === GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE
        ? { outcome: "draw" as const, reason: "board-full" as const, winningLine: [] }
        : null;
  return {
    ok: true,
    move,
    state: {
      ...state,
      currentPlayer: result ? player : otherStone(player),
      moves,
      result,
      elapsedSeconds: Math.max(state.elapsedSeconds, Math.floor(elapsedSeconds))
    }
  };
}

export function resignGomokuGame(
  state: GomokuGameState,
  player: GomokuStone,
  elapsedSeconds = state.elapsedSeconds
): GomokuGameState {
  if (state.result) return state;
  return {
    ...state,
    result: {
      outcome: otherStone(player),
      reason: "resign",
      winningLine: []
    },
    elapsedSeconds: Math.max(state.elapsedSeconds, Math.floor(elapsedSeconds))
  };
}

export function rewindGomokuGame(
  state: GomokuGameState,
  moveCount: number
): GomokuGameState {
  const setupMoveCount = state.setupMoveCount ?? 0;
  const safeCount = Math.max(
    setupMoveCount,
    Math.min(state.moves.length, Math.floor(moveCount))
  );
  const moves = state.moves.slice(0, safeCount).map((move, index) => ({
    ...move,
    moveNumber: index + 1
  }));
  const setupCurrentPlayer = state.setupCurrentPlayer ?? "black";
  const playedAfterSetup = moves.length - setupMoveCount;
  return {
    ...state,
    currentPlayer:
      playedAfterSetup % 2 === 0 ? setupCurrentPlayer : otherStone(setupCurrentPlayer),
    moves,
    result: null,
    usedUndo: true
  };
}

export function markGomokuHintUsed(state: GomokuGameState): GomokuGameState {
  return state.usedHint ? state : { ...state, usedHint: true };
}

export function restoreGomokuGame(value: unknown): GomokuGameState {
  if (!isRecord(value) || value.version !== GOMOKU_STATE_VERSION) {
    throw new Error("不支持的五子棋存档版本");
  }
  const state = value as unknown as GomokuGameState;
  if (
    typeof state.id !== "string" ||
    (state.ruleSet !== "freestyle" && state.ruleSet !== "renju") ||
    (state.mode !== "ai" && state.mode !== "local") ||
    !Array.isArray(state.moves) ||
    typeof state.startedAt !== "number" ||
    typeof state.seed !== "number"
  ) {
    throw new Error("五子棋存档格式无效");
  }

  let replay = createGomokuGame({
    id: state.id,
    ruleSet: state.ruleSet,
    mode: state.mode,
    startedAt: state.startedAt,
    seed: state.seed,
    ...(state.aiDifficulty ? { aiDifficulty: state.aiDifficulty } : {}),
    ...(state.humanColor ? { humanColor: state.humanColor } : {})
  });
  const setupMoveCount = Math.max(
    0,
    Math.min(state.moves.length, Math.floor(state.setupMoveCount ?? 0))
  );
  if (setupMoveCount > 0) {
    const setupMoves = state.moves.slice(0, setupMoveCount).map((move, index) => ({
      x: move.x,
      y: move.y,
      player: move.player,
      moveNumber: index + 1
    }));
    GomokuPosition.fromMoves(setupMoves);
    const setupCurrentPlayer = state.setupCurrentPlayer ?? state.currentPlayer;
    replay = {
      ...replay,
      moves: setupMoves,
      currentPlayer: setupCurrentPlayer,
      setupMoveCount,
      setupCurrentPlayer
    };
  }
  for (const rawMove of state.moves.slice(setupMoveCount)) {
    const move = rawMove as GomokuMove;
    const result = playGomokuMove(replay, { x: move.x, y: move.y }, move.player);
    if (!result.ok) throw new Error("五子棋存档包含非法落子");
    replay = result.state;
  }
  let result = replay.result;
  if (state.result?.reason === "resign") {
    if (result || state.result.winningLine.length > 0) {
      throw new Error("五子棋存档包含无效认输结果");
    }
    const resigningPlayer = state.mode === "ai" ? state.humanColor : state.currentPlayer;
    const expectedWinner = resigningPlayer === "black" ? "white" : "black";
    if (!resigningPlayer || state.result.outcome !== expectedWinner) {
      throw new Error("五子棋存档认输胜方无效");
    }
    result = state.result;
  } else if (JSON.stringify(result) !== JSON.stringify(state.result)) {
    throw new Error("五子棋存档结算结果与棋谱不一致");
  }
  return {
    ...replay,
    result,
    elapsedSeconds: Math.max(0, Math.floor(state.elapsedSeconds ?? 0)),
    usedUndo: Boolean(state.usedUndo),
    usedHint: Boolean(state.usedHint)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
