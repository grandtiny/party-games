import type { InternalPlayer } from "../domain.js";

export function comparePlayersBySeat(left: InternalPlayer, right: InternalPlayer): number {
  if (left.seat === null && right.seat === null) {
    return left.nickname.localeCompare(right.nickname, "zh-CN");
  }
  if (left.seat === null) return 1;
  if (right.seat === null) return -1;
  return left.seat - right.seat;
}
