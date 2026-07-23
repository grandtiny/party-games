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

export type PokerBotDifficulty = "easy" | "normal" | "hard";

export function decidePokerBotAction(
  state: PokerTableState,
  playerId: string,
  difficulty: PokerBotDifficulty = "normal"
): PokerBotDecision {
  const engine = restorePokerEngine(state.engine);
  const player = engine.state.players.find((candidate) => candidate?.id === playerId);
  const projection = projectPokerTable(state, playerId);
  const legalActions = projection.self?.legalActions;
  if (!player || !legalActions) throw new Error("AI 玩家当前没有合法行动");

  const random = createDeterministicRandom(
    `${state.engine.tableSeed}:bot:${playerId}:hand:${engine.state.handNumber}:action:${engine.state.actionHistory.length}`
  );
  const confidence = estimateHandConfidence(player.hand, engine.state.board);
  const totalPot = projection.totalPot;

  if (difficulty === "easy") {
    return decideEasyAction(legalActions, confidence, player.stack, totalPot, random);
  }
  if (difficulty === "hard") {
    const activeOpponentCount = engine.state.players.filter(
      (candidate) =>
        candidate &&
        candidate.id !== playerId &&
        (candidate.status === "ACTIVE" || candidate.status === "ALL_IN")
    ).length;
    const positionAdjustment = estimatePositionAdjustment(
      player.seat,
      engine.state.buttonSeat,
      projection.blindPositions.smallBlindSeat,
      projection.blindPositions.bigBlindSeat,
      engine.state.board.length === 0
    );
    return decideHardAction(
      legalActions,
      clamp(confidence + positionAdjustment, 0.05, 0.99),
      player.stack,
      player.betThisStreet,
      totalPot,
      activeOpponentCount,
      positionAdjustment > 0,
      random
    );
  }

  return decideNormalAction(legalActions, confidence, player.stack, totalPot, random);
}

function decideEasyAction(
  legalActions: PokerLegalActions,
  confidence: number,
  stack: number,
  totalPot: number,
  random: () => number
): PokerBotDecision {
  const can = (action: PokerPlayerAction) => legalActions.actions.includes(action);

  if (can("check")) {
    if (
      legalActions.aggressiveAction &&
      random() < 0.1 + confidence * 0.16
    ) {
      return easyAggressiveDecision(legalActions.aggressiveAction, legalActions, random);
    }
    return { action: "check" };
  }

  if (can("call")) {
    const stackPressure = legalActions.callAmount / Math.max(1, stack);
    const potOdds = legalActions.callAmount / Math.max(1, totalPot + legalActions.callAmount);
    const roll = random();
    if (legalActions.aggressiveAction === "raise" && roll >= 0.9) {
      return easyAggressiveDecision("raise", legalActions, random);
    }
    const foldChance = clamp(
      0.18 + stackPressure * 0.35 + potOdds * 0.2 - confidence * 0.18,
      0.08,
      0.58
    );
    if (can("fold") && roll < foldChance) return { action: "fold" };
    return { action: "call" };
  }

  if (legalActions.aggressiveAction) {
    return easyAggressiveDecision(legalActions.aggressiveAction, legalActions, random);
  }
  if (can("fold")) return { action: "fold" };
  throw new Error("AI 玩家没有可执行的行动");
}

function decideNormalAction(
  legalActions: PokerLegalActions,
  confidence: number,
  stack: number,
  totalPot: number,
  random: () => number
): PokerBotDecision {
  const can = (action: PokerPlayerAction) => legalActions.actions.includes(action);

  if (can("check")) {
    if (
      legalActions.aggressiveAction &&
      confidence + random() * 0.28 >= 0.68
    ) {
      return normalAggressiveDecision(
        legalActions.aggressiveAction,
        legalActions,
        confidence,
        random
      );
    }
    return { action: "check" };
  }

  if (can("call")) {
    const callAmount = legalActions.callAmount;
    const potOdds = callAmount / Math.max(1, totalPot + callAmount);
    const stackPressure = callAmount / Math.max(1, stack);
    const willingness = confidence * 0.78 + random() * 0.22;
    if (
      legalActions.aggressiveAction === "raise" &&
      confidence >= 0.72 &&
      random() >= 0.48
    ) {
      return normalAggressiveDecision("raise", legalActions, confidence, random);
    }
    if (can("fold") && stackPressure > 0.12 && willingness < potOdds + 0.16) {
      return { action: "fold" };
    }
    return { action: "call" };
  }

  if (legalActions.aggressiveAction) {
    return normalAggressiveDecision(
      legalActions.aggressiveAction,
      legalActions,
      confidence,
      random
    );
  }
  if (can("fold")) return { action: "fold" };
  throw new Error("AI 玩家没有可执行的行动");
}

function decideHardAction(
  legalActions: PokerLegalActions,
  confidence: number,
  stack: number,
  playerBet: number,
  totalPot: number,
  activeOpponentCount: number,
  latePosition: boolean,
  random: () => number
): PokerBotDecision {
  const can = (action: PokerPlayerAction) => legalActions.actions.includes(action);
  const stackToPotRatio = stack / Math.max(1, totalPot);
  const multiwayPressure = Math.max(0, activeOpponentCount - 1) * 0.025;

  if (can("check")) {
    const latePositionBluff = latePosition && confidence >= 0.46 && random() >= 0.94;
    if (
      legalActions.aggressiveAction &&
      (confidence >= 0.69 + multiwayPressure || latePositionBluff)
    ) {
      return hardAggressiveDecision(
        legalActions.aggressiveAction,
        legalActions,
        confidence,
        playerBet,
        totalPot,
        stackToPotRatio,
        random
      );
    }
    return { action: "check" };
  }

  if (can("call")) {
    const callAmount = legalActions.callAmount;
    const potOdds = callAmount / Math.max(1, totalPot + callAmount);
    const stackPressure = callAmount / Math.max(1, stack);
    const raiseThreshold = stackToPotRatio <= 2.5 ? 0.67 : 0.75;
    if (
      legalActions.aggressiveAction === "raise" &&
      confidence >= raiseThreshold + multiwayPressure &&
      random() >= 0.22
    ) {
      return hardAggressiveDecision(
        "raise",
        legalActions,
        confidence,
        playerBet,
        totalPot,
        stackToPotRatio,
        random
      );
    }

    const requiredConfidence = potOdds + 0.08 + stackPressure * 0.12 + multiwayPressure;
    if (can("fold") && confidence + random() * 0.08 < requiredConfidence) {
      return { action: "fold" };
    }
    return { action: "call" };
  }

  if (legalActions.aggressiveAction) {
    return hardAggressiveDecision(
      legalActions.aggressiveAction,
      legalActions,
      confidence,
      playerBet,
      totalPot,
      stackToPotRatio,
      random
    );
  }
  if (can("fold")) return { action: "fold" };
  throw new Error("AI 玩家没有可执行的行动");
}

function easyAggressiveDecision(
  action: "bet" | "raise",
  legalActions: PokerLegalActions,
  random: () => number
): PokerBotDecision {
  const { minAmount, maxAmount } = aggressiveRange(legalActions);
  const span = maxAmount - minAmount;
  const amount =
    random() >= 0.94
      ? maxAmount
      : minAmount + Math.round(span * random() * 0.58);
  return { action, amount };
}

function normalAggressiveDecision(
  action: "bet" | "raise",
  legalActions: PokerLegalActions,
  confidence: number,
  random: () => number
): PokerBotDecision {
  const { minAmount, maxAmount } = aggressiveRange(legalActions);
  const span = maxAmount - minAmount;
  const amount =
    confidence >= 0.9 && random() >= 0.72
      ? maxAmount
      : Math.min(
          maxAmount,
          minAmount + Math.round(span * (0.12 + random() * 0.28))
        );
  return { action, amount };
}

function hardAggressiveDecision(
  action: "bet" | "raise",
  legalActions: PokerLegalActions,
  confidence: number,
  playerBet: number,
  totalPot: number,
  stackToPotRatio: number,
  random: () => number
): PokerBotDecision {
  const { minAmount, maxAmount } = aggressiveRange(legalActions);
  if (confidence >= 0.9 && stackToPotRatio <= 1.5 && random() >= 0.35) {
    return { action, amount: maxAmount };
  }

  const raiseBase = action === "raise" ? playerBet + legalActions.callAmount : playerBet;
  const potFraction = confidence >= 0.86 ? 0.9 : confidence >= 0.72 ? 0.7 : 0.52;
  const target = raiseBase + Math.round(totalPot * potFraction * (0.9 + random() * 0.2));
  return { action, amount: Math.min(maxAmount, Math.max(minAmount, target)) };
}

function aggressiveRange(legalActions: PokerLegalActions): {
  minAmount: number;
  maxAmount: number;
} {
  if (!legalActions.minAmount || !legalActions.maxAmount) {
    throw new Error("AI 下注范围不存在");
  }
  return { minAmount: legalActions.minAmount, maxAmount: legalActions.maxAmount };
}

function estimatePositionAdjustment(
  playerSeat: number,
  buttonSeat: number | null,
  smallBlindSeat: number | undefined,
  bigBlindSeat: number | undefined,
  preflop: boolean
): number {
  if (playerSeat === buttonSeat) return preflop ? 0.015 : 0.06;
  if (playerSeat === smallBlindSeat) return preflop ? -0.04 : -0.05;
  if (playerSeat === bigBlindSeat) return preflop ? 0.02 : -0.035;
  return 0;
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
