import {
  GOMOKU_BOARD_SIZE,
  type GomokuGameState,
  type GomokuPoint,
  type GomokuStone
} from "@party-games/gomoku";
import { useId } from "react";

interface GomokuBoardProps {
  state: GomokuGameState;
  forbiddenPoints: readonly GomokuPoint[];
  pendingPoint?: GomokuPoint;
  disabled?: boolean;
  initialMoveCount?: number;
  onPoint: (point: GomokuPoint) => void;
}

const VIEW_SIZE = 640;
const BOARD_START = 40;
const GRID_STEP = 40;
const BOARD_END = BOARD_START + GRID_STEP * (GOMOKU_BOARD_SIZE - 1);
const STAR_POINTS = [
  [3, 3],
  [11, 3],
  [7, 7],
  [3, 11],
  [11, 11]
] as const;

export function GomokuBoard({
  state,
  forbiddenPoints,
  pendingPoint,
  disabled = false,
  initialMoveCount = 0,
  onPoint
}: GomokuBoardProps) {
  const gradientId = useId().replaceAll(":", "");
  const forbidden = new Set(forbiddenPoints.map(pointKey));
  const winning = new Set(state.result?.winningLine.map(pointKey) ?? []);
  const lastMove = state.moves.length > initialMoveCount ? state.moves.at(-1) : undefined;

  return (
    <svg
      className="gomoku-board"
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      role="grid"
      aria-label="十五路五子棋棋盘"
    >
      <defs>
        <radialGradient id={`${gradientId}-black`} cx="35%" cy="28%" r="68%">
          <stop offset="0" stopColor="#555" />
          <stop offset="0.48" stopColor="#1d1d1c" />
          <stop offset="1" stopColor="#030303" />
        </radialGradient>
        <radialGradient id={`${gradientId}-white`} cx="34%" cy="28%" r="70%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.7" stopColor="#eee9df" />
          <stop offset="1" stopColor="#c7c0b5" />
        </radialGradient>
        <filter id={`${gradientId}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodOpacity="0.34" />
        </filter>
      </defs>

      <rect className="gomoku-board__surface" x="4" y="4" width="632" height="632" rx="6" />
      {Array.from({ length: GOMOKU_BOARD_SIZE }, (_, index) => {
        const coordinate = BOARD_START + index * GRID_STEP;
        return (
          <g key={`grid-${index}`} className="gomoku-board__grid">
            <line x1={BOARD_START} x2={BOARD_END} y1={coordinate} y2={coordinate} />
            <line x1={coordinate} x2={coordinate} y1={BOARD_START} y2={BOARD_END} />
          </g>
        );
      })}
      {STAR_POINTS.map(([x, y]) => (
        <circle
          className="gomoku-board__star"
          cx={boardCoordinate(x)}
          cy={boardCoordinate(y)}
          r="5"
          key={`${x}-${y}`}
        />
      ))}

      {state.result?.winningLine.length ? (
        <line
          className="gomoku-board__winning-line"
          x1={boardCoordinate(state.result.winningLine[0]?.x ?? 0)}
          y1={boardCoordinate(state.result.winningLine[0]?.y ?? 0)}
          x2={boardCoordinate(state.result.winningLine.at(-1)?.x ?? 0)}
          y2={boardCoordinate(state.result.winningLine.at(-1)?.y ?? 0)}
        />
      ) : null}

      {state.moves.map((move) => (
        <Stone
          key={move.moveNumber}
          point={move}
          player={move.player}
          gradientId={gradientId}
          isLast={move.moveNumber === lastMove?.moveNumber}
          isWinning={winning.has(pointKey(move))}
        />
      ))}

      {pendingPoint ? (
        <circle
          className={`gomoku-board__pending is-${state.currentPlayer}`}
          cx={boardCoordinate(pendingPoint.x)}
          cy={boardCoordinate(pendingPoint.y)}
          r="16"
        />
      ) : null}

      {forbiddenPoints.map((point) => (
        <g
          className="gomoku-board__forbidden"
          transform={`translate(${boardCoordinate(point.x)} ${boardCoordinate(point.y)})`}
          key={`forbidden-${pointKey(point)}`}
          aria-hidden="true"
        >
          <circle r="8" />
          <path d="M-4-4 4 4M4-4-4 4" />
        </g>
      ))}

      {Array.from({ length: GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE }, (_, index) => {
        const point = { x: index % GOMOKU_BOARD_SIZE, y: Math.floor(index / GOMOKU_BOARD_SIZE) };
        const occupied = state.moves.some((move) => move.x === point.x && move.y === point.y);
        const isForbidden = forbidden.has(pointKey(point));
        return (
          <circle
            className="gomoku-board__hit"
            cx={boardCoordinate(point.x)}
            cy={boardCoordinate(point.y)}
            r="18"
            role="gridcell"
            tabIndex={!disabled && !occupied && !isForbidden ? 0 : -1}
            aria-label={`${coordinateLabel(point)}${occupied ? "，已有棋子" : isForbidden ? "，禁手" : "，可落子"}`}
            aria-disabled={disabled || occupied || isForbidden}
            onClick={() => {
              if (!disabled && !occupied && !isForbidden) onPoint(point);
            }}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && !disabled && !occupied && !isForbidden) {
                event.preventDefault();
                onPoint(point);
              }
            }}
            key={`hit-${index}`}
          />
        );
      })}
    </svg>
  );
}

function Stone({
  point,
  player,
  gradientId,
  isLast,
  isWinning
}: {
  point: GomokuPoint;
  player: GomokuStone;
  gradientId: string;
  isLast: boolean;
  isWinning: boolean;
}) {
  return (
    <g
      className={`gomoku-stone is-${player} ${isLast ? "is-last" : ""} ${isWinning ? "is-winning" : ""}`}
      transform={`translate(${boardCoordinate(point.x)} ${boardCoordinate(point.y)})`}
      filter={`url(#${gradientId}-shadow)`}
    >
      <circle r="17.5" fill={`url(#${gradientId}-${player})`} />
      {isLast ? <circle className="gomoku-stone__last" r="4.2" /> : null}
    </g>
  );
}

function boardCoordinate(value: number): number {
  return BOARD_START + value * GRID_STEP;
}

function pointKey(point: GomokuPoint): string {
  return `${point.x}:${point.y}`;
}

function coordinateLabel(point: GomokuPoint): string {
  const letters = "ABCDEFGHJKLMNOP";
  return `${letters[point.x] ?? "?"}${15 - point.y}`;
}
