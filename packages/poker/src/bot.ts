import { createDeterministicRandom } from "./random.js";
import { restorePokerEngine } from "./engine.js";
import {
  projectPokerTable,
  type PokerLegalActions,
  type PokerPlayerAction,
  type PokerTableState
} from "./table.js";

export interface PokerBotDecision {
  action: PokerPlayerAction;
  amount?: number;
}

export function decidePokerBotAction(
  state: PokerTableState,
  playerId: string
): PokerBotDecision {
  const engine = restorePokerEngine(state.engine);
  const player = engine.state.players.find((candidate) => candidate?.id === playerId);
  const legalActions = projectPokerTable(state, playerId).self?.legalActions;
  if (!player || !legalActions) throw new Error("AI 玩家当前没有合法行动");

  const random = createDeterministicRandom(
    `${state.engine.tableSeed}:bot:${playerId}:hand:${engine.state.handNumber}:action:${engine.state.actionHistory.length}`
  );
  const confidence = estimateHandConfidence(player.hand, engine.state.board);
  const can = (action: PokerPlayerAction) => legalActions.actions.includes(action);

  if (can("check")) {
    if (
      legalActions.aggressiveAction &&
      confidence + random() * 0.28 >= 0.68
    ) {
      return aggressiveDecision(legalActions.aggressiveAction, legalActions, confidence, random);
    }
    return { action: "check" };
  }

  if (can("call")) {
    const callAmount = legalActions.callAmount;
    const potOdds = callAmount / Math.max(1, projectPokerTable(state).totalPot + callAmount);
    const stackPressure = callAmount / Math.max(1, player.stack);
    const willingness = confidence * 0.78 + random() * 0.22;
    if (
      legalActions.aggressiveAction === "raise" &&
      confidence >= 0.72 &&
      random() >= 0.48
    ) {
      return aggressiveDecision("raise", legalActions, confidence, random);
    }
    if (can("fold") && stackPressure > 0.12 && willingness < potOdds + 0.16) {
      return { action: "fold" };
    }
    return { action: "call" };
  }

  if (legalActions.aggressiveAction) {
    return aggressiveDecision(legalActions.aggressiveAction, legalActions, confidence, random);
  }
  if (can("fold")) return { action: "fold" };
  throw new Error("AI 玩家没有可执行的行动");
}

function aggressiveDecision(
  action: "bet" | "raise",
  legalActions: PokerLegalActions,
  confidence: number,
  random: () => number
): PokerBotDecision {
  if (!legalActions.minAmount || !legalActions.maxAmount) {
    throw new Error("AI 下注范围不存在");
  }
  const span = legalActions.maxAmount - legalActions.minAmount;
  const amount =
    confidence >= 0.9 && random() >= 0.72
      ? legalActions.maxAmount
      : Math.min(
          legalActions.maxAmount,
          legalActions.minAmount + Math.round(span * (0.12 + random() * 0.28))
        );
  return { action, amount };
}

function estimateHandConfidence(
  hand: readonly (string | null)[] | null,
  board: readonly string[]
): number {
  const holeCards = (hand ?? []).filter((card): card is string => card !== null);
  if (holeCards.length !== 2) return 0.35;
  const preflop = preflopConfidence(holeCards);
  if (board.length === 0) return preflop;

  const cards = [...holeCards, ...board];
  const rankCounts = countBy(cards.map((card) => cardRank(card)));
  const suitCounts = countBy(cards.map((card) => card.at(-1) ?? ""));
  const counts = [...rankCounts.values()].sort((left, right) => right - left);
  const hasFlush = [...suitCounts.values()].some((count) => count >= 5);
  const hasFlushDraw = [...suitCounts.values()].some((count) => count === 4);
  const straightLength = longestStraight(cards.map((card) => cardRank(card)));

  let madeHand = 0.32;
  if ((counts[0] ?? 0) >= 4) madeHand = 0.98;
  else if ((counts[0] ?? 0) === 3 && (counts[1] ?? 0) >= 2) madeHand = 0.95;
  else if (hasFlush || straightLength >= 5) madeHand = 0.9;
  else if ((counts[0] ?? 0) === 3) madeHand = 0.8;
  else if ((counts[0] ?? 0) === 2 && (counts[1] ?? 0) === 2) madeHand = 0.72;
  else if ((counts[0] ?? 0) === 2) madeHand = 0.56;
  else if (hasFlushDraw || straightLength === 4) madeHand = 0.62;

  return clamp(preflop * 0.35 + madeHand * 0.65, 0.08, 0.98);
}

function preflopConfidence(cards: readonly [string, string] | readonly string[]): number {
  const ranks = cards.map((card) => cardRank(card)).sort((left, right) => right - left);
  const high = ranks[0] ?? 2;
  const low = ranks[1] ?? 2;
  if (high === low) return clamp(0.5 + high / 32, 0.55, 0.94);

  const suited = cards[0]?.at(-1) === cards[1]?.at(-1);
  const gap = high - low;
  let confidence = 0.18 + ((high - 2) / 12) * 0.38 + ((low - 2) / 12) * 0.18;
  if (suited) confidence += 0.08;
  if (gap <= 1) confidence += 0.08;
  else if (gap >= 5) confidence -= 0.08;
  if (high >= 11 && low >= 10) confidence += 0.09;
  return clamp(confidence, 0.12, 0.88);
}

function cardRank(card: string): number {
  const rank = card.slice(0, -1);
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "T") return 10;
  return Number(rank);
}

function countBy(values: readonly (string | number)[]): Map<string | number, number> {
  const counts = new Map<string | number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function longestStraight(ranks: readonly number[]): number {
  const unique = [...new Set(ranks)];
  if (unique.includes(14)) unique.push(1);
  unique.sort((left, right) => left - right);
  let longest = 0;
  let current = 0;
  let previous: number | undefined;
  unique.forEach((rank) => {
    current = previous !== undefined && rank === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = rank;
  });
  return longest;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
