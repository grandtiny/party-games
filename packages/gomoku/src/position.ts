import {
  Player as RenjuPlayer,
  RowKind,
  createBoard as createRenjuBoard,
  wrapBoard,
  type WrappedBoard
} from "renjukit";
import {
  GOMOKU_BOARD_SIZE,
  type GomokuForbiddenReason,
  type GomokuMove,
  type GomokuPoint,
  type GomokuRuleSet,
  type GomokuStone
} from "./types.js";

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
] as const;

export interface GomokuPlacementAnalysis {
  legal: boolean;
  forbidden?: GomokuForbiddenReason;
  winningLine: GomokuPoint[];
}

export class GomokuPosition {
  readonly #cells: Uint8Array;
  readonly #renjuBoard: WrappedBoard;
  readonly moveCount: number;

  private constructor(cells: Uint8Array, renjuBoard: WrappedBoard, moveCount: number) {
    this.#cells = cells;
    this.#renjuBoard = renjuBoard;
    this.moveCount = moveCount;
  }

  static empty(): GomokuPosition {
    return new GomokuPosition(
      new Uint8Array(GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE),
      wrapBoard(createRenjuBoard()),
      0
    );
  }

  static fromMoves(moves: readonly GomokuMove[]): GomokuPosition {
    let position = GomokuPosition.empty();
    for (const move of moves) {
      if (!position.isEmpty(move)) throw new Error(`棋谱包含重复落点: ${move.x},${move.y}`);
      position = position.placeUnchecked(move, move.player);
    }
    return position;
  }

  stoneAt(point: GomokuPoint): GomokuStone | null {
    if (!isInsideBoard(point)) return null;
    const value = this.#cells[pointIndex(point)];
    return value === BLACK ? "black" : value === WHITE ? "white" : null;
  }

  isEmpty(point: GomokuPoint): boolean {
    return isInsideBoard(point) && this.#cells[pointIndex(point)] === EMPTY;
  }

  cells(): readonly number[] {
    return [...this.#cells];
  }

  analyzePlacement(
    point: GomokuPoint,
    player: GomokuStone,
    ruleSet: GomokuRuleSet
  ): GomokuPlacementAnalysis {
    if (!isInsideBoard(point) || !this.isEmpty(point)) {
      return { legal: false, winningLine: [] };
    }

    const next = this.placeUnchecked(point, player);
    const winningLine = next.winningLine(point, player, ruleSet);
    if (winningLine.length > 0) return { legal: true, winningLine };

    if (ruleSet === "renju" && player === "black") {
      const forbidden = renjuForbidden(this.#renjuBoard, point);
      if (forbidden) return { legal: false, forbidden, winningLine: [] };
    }

    return { legal: true, winningLine: [] };
  }

  place(point: GomokuPoint, player: GomokuStone, ruleSet: GomokuRuleSet): GomokuPosition {
    const analysis = this.analyzePlacement(point, player, ruleSet);
    if (!analysis.legal) throw new Error("不能在该位置落子");
    return this.placeUnchecked(point, player);
  }

  legalMoves(player: GomokuStone, ruleSet: GomokuRuleSet): GomokuPoint[] {
    const moves: GomokuPoint[] = [];
    for (let y = 0; y < GOMOKU_BOARD_SIZE; y += 1) {
      for (let x = 0; x < GOMOKU_BOARD_SIZE; x += 1) {
        const point = { x, y };
        if (this.analyzePlacement(point, player, ruleSet).legal) moves.push(point);
      }
    }
    return moves;
  }

  candidateMoves(radius = 2): GomokuPoint[] {
    if (this.moveCount === 0) return [{ x: 7, y: 7 }];
    const candidates = new Set<number>();
    for (let y = 0; y < GOMOKU_BOARD_SIZE; y += 1) {
      for (let x = 0; x < GOMOKU_BOARD_SIZE; x += 1) {
        if (this.#cells[pointIndex({ x, y })] === EMPTY) continue;
        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
          for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            const point = { x: x + offsetX, y: y + offsetY };
            if (this.isEmpty(point)) candidates.add(pointIndex(point));
          }
        }
      }
    }
    return [...candidates].map(pointFromIndex);
  }

  hasRow(point: GomokuPoint, player: GomokuStone, kind: "five" | "overline"): boolean {
    const rowKind = kind === "five" ? RowKind.five : RowKind.overline;
    return this.#renjuBoard.rowsOn(toRenjuPlayer(player), rowKind, toTuple(point)).length > 0;
  }

  private placeUnchecked(point: GomokuPoint, player: GomokuStone): GomokuPosition {
    const cells = this.#cells.slice();
    cells[pointIndex(point)] = player === "black" ? BLACK : WHITE;
    return new GomokuPosition(
      cells,
      this.#renjuBoard.put(toRenjuPlayer(player), toTuple(point)),
      this.moveCount + 1
    );
  }

  private winningLine(
    point: GomokuPoint,
    player: GomokuStone,
    ruleSet: GomokuRuleSet
  ): GomokuPoint[] {
    for (const [dx, dy] of DIRECTIONS) {
      const line = this.contiguousLine(point, player, dx, dy);
      const wins =
        ruleSet === "renju" && player === "black" ? line.length === 5 : line.length >= 5;
      if (wins) return line;
    }
    return [];
  }

  private contiguousLine(
    point: GomokuPoint,
    player: GomokuStone,
    dx: number,
    dy: number
  ): GomokuPoint[] {
    const line: GomokuPoint[] = [point];
    for (const sign of [-1, 1] as const) {
      const side: GomokuPoint[] = [];
      for (let distance = 1; distance < GOMOKU_BOARD_SIZE; distance += 1) {
        const candidate = {
          x: point.x + dx * distance * sign,
          y: point.y + dy * distance * sign
        };
        if (this.stoneAt(candidate) !== player) break;
        side.push(candidate);
      }
      if (sign === -1) line.unshift(...side.reverse());
      else line.push(...side);
    }
    return line;
  }
}

export function isInsideBoard(point: GomokuPoint): boolean {
  return (
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < GOMOKU_BOARD_SIZE &&
    point.y < GOMOKU_BOARD_SIZE
  );
}

export function otherStone(player: GomokuStone): GomokuStone {
  return player === "black" ? "white" : "black";
}

function renjuForbidden(board: WrappedBoard, point: GomokuPoint): GomokuForbiddenReason | undefined {
  const forbidden = board.forbidden(toTuple(point));
  if (forbidden === "doubleThree") return "double-three";
  if (forbidden === "doubleFour") return "double-four";
  if (forbidden === "overline") return "overline";
  return undefined;
}

function toRenjuPlayer(player: GomokuStone): boolean {
  return player === "black" ? RenjuPlayer.black : RenjuPlayer.white;
}

function toTuple(point: GomokuPoint): [number, number] {
  return [point.x, point.y];
}

function pointIndex(point: GomokuPoint): number {
  return point.y * GOMOKU_BOARD_SIZE + point.x;
}

function pointFromIndex(index: number): GomokuPoint {
  return { x: index % GOMOKU_BOARD_SIZE, y: Math.floor(index / GOMOKU_BOARD_SIZE) };
}
