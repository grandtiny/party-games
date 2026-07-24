import { decode_x, decode_y, solve_vcf, solve_vct } from "@renju-note/quintet";
import type { GomokuMove, GomokuPoint, GomokuStone } from "./types.js";

export function findForcedGomokuMove(
  moves: readonly GomokuMove[],
  player: GomokuStone,
  mode: "vcf" | "vct" = "vcf",
  limit = mode === "vcf" ? 9 : 7
): GomokuPoint | undefined {
  const black = new Uint8Array(
    moves.filter((move) => move.player === "black").map(encodePoint)
  );
  const white = new Uint8Array(
    moves.filter((move) => move.player === "white").map(encodePoint)
  );
  const solution =
    mode === "vcf"
      ? solve_vcf(black, white, player === "black", limit)
      : solve_vct(black, white, player === "black", limit);
  const first = solution?.[0];
  return first === undefined ? undefined : { x: decode_x(first), y: decode_y(first) };
}

function encodePoint(point: GomokuPoint): number {
  return point.x * 15 + point.y;
}
