import type { ManorV7Area, ManorV7State } from "./types.js";

export const MANOR_V7_REWARD_MULTIPLIER = 5;
export const MANOR_V7_PASTURE_PRODUCTION_EXPERIENCE_MULTIPLIER = 3;

export function manorV7RewardAmount(baseAmount: number): number {
  if (!Number.isInteger(baseAmount) || baseAmount < 0) throw new Error("奖励数值无效");
  return baseAmount * MANOR_V7_REWARD_MULTIPLIER;
}

export function manorV7PastureProductionExperience(baseAmount: number): number {
  return manorV7RewardAmount(baseAmount * MANOR_V7_PASTURE_PRODUCTION_EXPERIENCE_MULTIPLIER);
}

export function grantManorV7Coins(state: ManorV7State, baseAmount: number): number {
  const amount = manorV7RewardAmount(baseAmount);
  state.coins += amount;
  return amount;
}

export function grantManorV7Experience(
  state: ManorV7State,
  area: ManorV7Area,
  baseAmount: number
): number {
  const amount = manorV7RewardAmount(baseAmount);
  if (area === "farm") state.farmExperience += amount;
  else state.pastureExperience += amount;
  return amount;
}
