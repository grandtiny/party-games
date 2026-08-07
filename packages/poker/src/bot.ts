import { evaluateStrings } from "@pokertools/evaluator";
import { createDeterministicRandom } from "./random.js";
import { restorePokerEngine } from "./engine.js";
import {
  projectPokerTable,
  type PokerHandAction,
  type PokerLegalActions,
  type PokerPlayerAction,
  type PokerTableState
} from "./table.js";

export interface PokerBotDecision {
  action: PokerPlayerAction;
  amount?: number;
}

export type PokerBotDifficulty = "easy" | "normal" | "hard";

interface PokerBotPersonality {
  aggression: number;
  patience: number;
  riskTolerance: number;
  bluffRate: number;
}

interface PokerActionContext {
  pressure: number;
  opponentAggressionCount: number;
  opponentCallCount: number;
  checkedToPlayer: boolean;
  facingAllIn: boolean;
  wasAggressor: boolean;
}

interface PokerBotContext {
  legalActions: PokerLegalActions;
  equity: number;
  strength: number;
  playerBet: number;
  totalPot: number;
  activeOpponentCount: number;
  positionAdjustment: number;
  stackBigBlinds: number;
  shortStackUrgency: number;
  survivalPressure: number;
  effectiveMaxAmount: number;
  preflop: boolean;
  action: PokerActionContext;
  personality: PokerBotPersonality;
}

const RANKS = "23456789TJQKA";
const SUITS = "cdhs";
const FULL_DECK = [...RANKS].flatMap((rank) =>
  [...SUITS].map((suit) => `${rank}${suit}`)
);

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

  const actionRandom = createDeterministicRandom(
    `${state.engine.tableSeed}:bot:${playerId}:hand:${engine.state.handNumber}:action:${engine.state.actionHistory.length}`
  );
  const equityRandom = createDeterministicRandom(
    `${state.engine.tableSeed}:bot:${playerId}:hand:${engine.state.handNumber}:equity:${engine.state.actionHistory.length}`
  );
  const activeOpponents = engine.state.players.flatMap((candidate) =>
    candidate &&
    candidate.id !== playerId &&
    (candidate.status === "ACTIVE" || candidate.status === "ALL_IN")
      ? [candidate]
      : []
  );
  const activeOpponentCount = Math.max(1, activeOpponents.length);
  const holeCards = (player.hand ?? []).filter((card): card is string => card !== null);
  const equity = estimateShowdownEquity(
    holeCards,
    engine.state.board,
    activeOpponentCount,
    equitySamples(difficulty),
    equityRandom
  );
  const totalPot = projection.totalPot;
  const heroTotalChips = player.stack + player.betThisStreet;
  const largestOpponentTotal = Math.max(
    0,
    ...activeOpponents.map(
      (opponent) => opponent.stack + opponent.betThisStreet
    )
  );
  const fundedPlayerCount = engine.state.players.filter(
    (candidate) =>
      candidate &&
      candidate.stack + candidate.betThisStreet + candidate.pendingAddOn > 0 &&
      candidate.status !== "SITTING_OUT" &&
      candidate.status !== "BUSTED"
  ).length;
  const bigBlind = Math.max(1, engine.state.bigBlind);
  const orbitCost = Math.max(
    1,
    engine.state.smallBlind +
      engine.state.bigBlind +
      engine.state.ante * fundedPlayerCount
  );
  const stackBigBlinds = heroTotalChips / bigBlind;
  const mRatio = heroTotalChips / orbitCost;
  const shortStackUrgency =
    state.mode === "tournament"
      ? clamp(Math.max((12 - stackBigBlinds) / 12, (8 - mRatio) / 8), 0, 1)
      : 0;
  const callPressure = legalActions.callAmount / Math.max(1, player.stack);
  const covered = largestOpponentTotal >= heroTotalChips;
  const survivalPressure =
    state.mode === "tournament" && covered && stackBigBlinds > 12
      ? clamp((callPressure - 0.12) * 0.42, 0, 0.14)
      : 0;
  const currentStreetActions = projection.actionHistory.filter(
    (action) => action.street === engine.state.street
  );
  const actionContext = summarizeActionContext(
    currentStreetActions,
    playerId,
    legalActions
  );
  const positionAdjustment = estimatePositionAdjustment(
    player.seat,
    engine.state.buttonSeat,
    projection.blindPositions.smallBlindSeat,
    projection.blindPositions.bigBlindSeat,
    engine.state.board.length === 0
  );
  const maxAmount = legalActions.maxAmount ?? heroTotalChips;
  const effectiveMaxAmount = Math.max(
    legalActions.minAmount ?? 0,
    Math.min(maxAmount, largestOpponentTotal || maxAmount)
  );
  const context: PokerBotContext = {
    legalActions,
    equity,
    strength: normalizeEquity(equity, activeOpponentCount),
    playerBet: player.betThisStreet,
    totalPot,
    activeOpponentCount,
    positionAdjustment,
    stackBigBlinds,
    shortStackUrgency,
    survivalPressure,
    effectiveMaxAmount,
    preflop: engine.state.board.length === 0,
    action: actionContext,
    personality: pokerBotPersonality(state.engine.tableSeed, playerId)
  };

  if (difficulty === "easy") return decideEasyAction(context, actionRandom);
  if (difficulty === "hard") return decideHardAction(context, actionRandom);
  return decideNormalAction(context, actionRandom);
}

function decideEasyAction(
  context: PokerBotContext,
  random: () => number
): PokerBotDecision {
  const { legalActions } = context;
  const can = (action: PokerPlayerAction) => legalActions.actions.includes(action);

  if (can("check")) {
    const attackChance = 0.06 + context.strength * 0.2;
    if (legalActions.aggressiveAction && random() < attackChance) {
      return potSizedAggressiveDecision(
        legalActions.aggressiveAction,
        context,
        0.42 + random() * 0.48,
        shouldCommitStack(context, 0.84),
        random
      );
    }
    return { action: "check" };
  }

  if (can("call")) {
    const unopenedPreflop =
      context.preflop && context.action.opponentAggressionCount === 0;
    if (unopenedPreflop) {
      if (
        legalActions.aggressiveAction === "raise" &&
        context.strength >= 0.68 &&
        random() < 0.32
      ) {
        return potSizedAggressiveDecision(
          "raise",
          context,
          0.52 + random() * 0.3,
          shouldCommitStack(context, 0.88),
          random
        );
      }
      if (can("fold") && context.strength < 0.3 && random() < 0.7) {
        return { action: "fold" };
      }
      return { action: "call" };
    }
    const potOdds = callPotOdds(context);
    if (
      legalActions.aggressiveAction === "raise" &&
      context.strength >= 0.8 &&
      random() >= 0.82
    ) {
      return potSizedAggressiveDecision(
        "raise",
        context,
        0.58 + random() * 0.42,
        shouldCommitStack(context, 0.88),
        random
      );
    }
    const noisyEquity = context.equity + random() * 0.14 - 0.04;
    const requiredEquity = potOdds + context.action.pressure * 0.12;
    if (can("fold") && noisyEquity < requiredEquity) return { action: "fold" };
    return { action: "call" };
  }

  if (legalActions.aggressiveAction) {
    return potSizedAggressiveDecision(
      legalActions.aggressiveAction,
      context,
      0.48 + random() * 0.42,
      shouldCommitStack(context, 0.9),
      random
    );
  }
  if (can("fold")) return { action: "fold" };
  throw new Error("AI 玩家没有可执行的行动");
}

function decideNormalAction(
  context: PokerBotContext,
  random: () => number
): PokerBotDecision {
  const { legalActions, personality } = context;
  const can = (action: PokerPlayerAction) => legalActions.actions.includes(action);
  const multiwayPenalty = Math.max(0, context.activeOpponentCount - 1) * 0.022;
  const personalityAggression = (personality.aggression - 1) * 0.24;
  const adjustedStrength =
    context.strength +
    context.positionAdjustment * 0.55 +
    personalityAggression +
    context.shortStackUrgency * 0.05 -
    (personality.patience - 1) * 0.16 -
    context.action.pressure * 0.55 -
    context.survivalPressure;

  if (can("check")) {
    const valueThreshold = 0.66 + multiwayPenalty;
    const bluff =
      context.action.checkedToPlayer &&
      context.strength >= 0.35 &&
      context.strength < valueThreshold &&
      random() < personality.bluffRate * 0.65;
    if (
      legalActions.aggressiveAction &&
      (adjustedStrength >= valueThreshold || bluff)
    ) {
      const fraction = bluff
        ? 0.42 + random() * 0.16
        : valueBetFraction(context, adjustedStrength, false);
      return potSizedAggressiveDecision(
        legalActions.aggressiveAction,
        context,
        fraction,
        shouldCommitStack(context, 0.86),
        random
      );
    }
    return { action: "check" };
  }

  if (can("call")) {
    const unopenedPreflop =
      context.preflop && context.action.opponentAggressionCount === 0;
    if (unopenedPreflop) {
      const openThreshold =
        0.63 + multiwayPenalty - context.positionAdjustment * 0.45;
      const commitStack = shouldCommitStack(context, 0.85);
      if (
        legalActions.aggressiveAction === "raise" &&
        adjustedStrength >= openThreshold &&
        (commitStack || random() < 0.58)
      ) {
        return potSizedAggressiveDecision(
          "raise",
          context,
          valueBetFraction(context, adjustedStrength, false),
          commitStack,
          random
        );
      }
      const foldThreshold =
        0.37 + multiwayPenalty - context.positionAdjustment * 0.35;
      if (can("fold") && adjustedStrength < foldThreshold) {
        return { action: "fold" };
      }
      return { action: "call" };
    }
    const potOdds = callPotOdds(context);
    const requiredEquity =
      potOdds +
      0.025 +
      context.action.pressure * 0.24 +
      context.survivalPressure -
      context.shortStackUrgency * 0.02;
    const raiseThreshold =
      0.75 + multiwayPenalty + context.action.pressure * 1.02;
    const raiseChance = clamp(
      0.42 + (personality.aggression - 0.9) * 0.8,
      0.3,
      0.68
    );
    const commitStack = shouldCommitStack(context, 0.85);
    if (
      legalActions.aggressiveAction === "raise" &&
      adjustedStrength >= raiseThreshold &&
      context.equity >= requiredEquity + 0.1 &&
      (commitStack || random() < raiseChance)
    ) {
      return potSizedAggressiveDecision(
        "raise",
        context,
        valueBetFraction(context, adjustedStrength, false),
        commitStack,
        random
      );
    }
    const futureCardAllowance = context.preflop ? 0 : 0.015;
    if (
      can("fold") &&
      context.equity + futureCardAllowance < requiredEquity
    ) {
      return { action: "fold" };
    }
    return { action: "call" };
  }

  if (legalActions.aggressiveAction) {
    return potSizedAggressiveDecision(
      legalActions.aggressiveAction,
      context,
      valueBetFraction(context, adjustedStrength, false),
      shouldCommitStack(context, 0.88),
      random
    );
  }
  if (can("fold")) return { action: "fold" };
  throw new Error("AI 玩家没有可执行的行动");
}

function decideHardAction(
  context: PokerBotContext,
  random: () => number
): PokerBotDecision {
  const { legalActions, personality } = context;
  const can = (action: PokerPlayerAction) => legalActions.actions.includes(action);
  const multiwayPenalty = Math.max(0, context.activeOpponentCount - 1) * 0.027;
  const personalityAggression = (personality.aggression - 1) * 0.32;
  const riskAdjustment = (personality.riskTolerance - 1) * 0.18;
  const adjustedStrength =
    context.strength +
    context.positionAdjustment +
    personalityAggression +
    riskAdjustment +
    context.shortStackUrgency * 0.08 -
    (personality.patience - 1) * 0.12 -
    context.action.pressure * 0.62 -
    context.survivalPressure;

  if (can("check")) {
    const valueThreshold = 0.62 + multiwayPenalty;
    const continuationPressure =
      context.action.wasAggressor && context.strength >= 0.5
        ? 0.05 * personality.aggression
        : 0;
    const bluffChance =
      personality.bluffRate *
      (context.positionAdjustment >= 0 ? 1.35 : 0.65) *
      (context.action.checkedToPlayer ? 1.35 : 0.75) *
      (1 - context.action.pressure);
    const bluff =
      context.strength >= 0.34 &&
      context.strength < valueThreshold &&
      random() < bluffChance;
    if (
      legalActions.aggressiveAction &&
      (adjustedStrength + continuationPressure >= valueThreshold || bluff)
    ) {
      const fraction = bluff
        ? 0.38 + random() * 0.18
        : valueBetFraction(context, adjustedStrength, true);
      return potSizedAggressiveDecision(
        legalActions.aggressiveAction,
        context,
        fraction,
        shouldCommitStack(context, 0.82),
        random
      );
    }
    return { action: "check" };
  }

  if (can("call")) {
    const unopenedPreflop =
      context.preflop && context.action.opponentAggressionCount === 0;
    if (unopenedPreflop) {
      const openThreshold =
        0.58 + multiwayPenalty - context.positionAdjustment * 0.7;
      const raiseChance = clamp(
        0.66 + (personality.aggression - 1) * 0.9,
        0.5,
        0.82
      );
      const commitStack = shouldCommitStack(context, 0.8);
      if (
        legalActions.aggressiveAction === "raise" &&
        adjustedStrength >= openThreshold &&
        (commitStack || random() < raiseChance)
      ) {
        return potSizedAggressiveDecision(
          "raise",
          context,
          valueBetFraction(context, adjustedStrength, true),
          commitStack,
          random
        );
      }
      const foldThreshold =
        0.33 + multiwayPenalty - context.positionAdjustment * 0.5;
      if (can("fold") && adjustedStrength < foldThreshold) {
        return { action: "fold" };
      }
      return { action: "call" };
    }
    const potOdds = callPotOdds(context);
    const rangePremium =
      context.action.pressure * 0.3 +
      Number(context.action.facingAllIn) * 0.035 +
      Number(context.action.wasAggressor) * 0.018;
    const requiredEquity =
      potOdds +
      0.012 +
      rangePremium +
      context.survivalPressure -
      context.shortStackUrgency * 0.025;
    const raiseThreshold =
      0.7 +
      multiwayPenalty +
      context.action.pressure * 1.08 +
      context.survivalPressure * 0.5;
    const raiseChance = clamp(
      0.55 + (personality.aggression - 1) * 1.1,
      0.38,
      0.76
    );
    const commitStack = shouldCommitStack(context, 0.8);
    if (
      legalActions.aggressiveAction === "raise" &&
      adjustedStrength >= raiseThreshold &&
      context.equity >= requiredEquity + 0.08 &&
      (commitStack || random() < raiseChance)
    ) {
      return potSizedAggressiveDecision(
        "raise",
        context,
        valueBetFraction(context, adjustedStrength, true),
        commitStack,
        random
      );
    }
    const futureCardAllowance = context.preflop ? 0 : 0.02;
    if (
      can("fold") &&
      context.equity + futureCardAllowance < requiredEquity
    ) {
      return { action: "fold" };
    }
    return { action: "call" };
  }

  if (legalActions.aggressiveAction) {
    return potSizedAggressiveDecision(
      legalActions.aggressiveAction,
      context,
      valueBetFraction(context, adjustedStrength, true),
      shouldCommitStack(context, 0.84),
      random
    );
  }
  if (can("fold")) return { action: "fold" };
  throw new Error("AI 玩家没有可执行的行动");
}

function potSizedAggressiveDecision(
  action: "bet" | "raise",
  context: PokerBotContext,
  potFraction: number,
  commitStack: boolean,
  random: () => number
): PokerBotDecision {
  const { minAmount, maxAmount } = aggressiveRange(context.legalActions);
  const effectiveCap = Math.max(
    minAmount,
    Math.min(maxAmount, context.effectiveMaxAmount)
  );
  if (commitStack) return { action, amount: effectiveCap };

  const currentBet =
    action === "raise"
      ? context.playerBet + context.legalActions.callAmount
      : context.playerBet;
  const potAfterCall = context.totalPot + context.legalActions.callAmount;
  const noise = 0.92 + random() * 0.16;
  const target =
    currentBet + Math.round(potAfterCall * clamp(potFraction, 0.32, 1.1) * noise);
  return {
    action,
    amount: Math.min(effectiveCap, Math.max(minAmount, target))
  };
}

function valueBetFraction(
  context: PokerBotContext,
  adjustedStrength: number,
  hard: boolean
): number {
  let fraction = context.preflop ? 0.62 : adjustedStrength >= 0.82 ? 0.78 : 0.56;
  fraction += Math.min(0.18, context.action.opponentCallCount * 0.055);
  fraction += Math.min(0.16, context.action.opponentAggressionCount * 0.06);
  if (context.activeOpponentCount >= 3) fraction += 0.06;
  if (hard && context.positionAdjustment > 0) fraction -= 0.035;
  return clamp(fraction, 0.4, 1.02);
}

function shouldCommitStack(
  context: PokerBotContext,
  strengthThreshold: number
): boolean {
  const potAfterCall = context.totalPot + context.legalActions.callAmount;
  const effectiveRisk = Math.max(0, context.effectiveMaxAmount - context.playerBet);
  const effectiveStackToPot = effectiveRisk / Math.max(1, potAfterCall);
  if (
    context.stackBigBlinds <= 8 &&
    context.shortStackUrgency >= 0.34 &&
    context.strength >= strengthThreshold - 0.14
  ) {
    return true;
  }
  return (
    effectiveStackToPot <= 1.05 &&
    context.strength >= strengthThreshold &&
    context.equity >= callPotOdds(context) + 0.14
  );
}

function aggressiveRange(legalActions: PokerLegalActions): {
  minAmount: number;
  maxAmount: number;
} {
  if (legalActions.minAmount === undefined || legalActions.maxAmount === undefined) {
    throw new Error("AI 下注范围不存在");
  }
  return { minAmount: legalActions.minAmount, maxAmount: legalActions.maxAmount };
}

function callPotOdds(context: PokerBotContext): number {
  return (
    context.legalActions.callAmount /
    Math.max(1, context.totalPot + context.legalActions.callAmount)
  );
}

function summarizeActionContext(
  actions: readonly PokerHandAction[],
  playerId: string,
  legalActions: PokerLegalActions
): PokerActionContext {
  const opponentActions = actions.filter((action) => action.playerId !== playerId);
  const opponentAggressiveActions = opponentActions.filter(
    (action) => action.action === "bet" || action.action === "raise"
  );
  const latestAggression = opponentAggressiveActions.at(-1);
  const opponentCallCount = opponentActions.filter(
    (action) => action.action === "call"
  ).length;
  const opponentCheckCount = opponentActions.filter(
    (action) => action.action === "check"
  ).length;
  const wasAggressor = actions.some(
    (action) =>
      action.playerId === playerId &&
      (action.action === "bet" || action.action === "raise")
  );
  const latestBetRatio = latestAggression?.amount
    ? latestAggression.amount / Math.max(1, latestAggression.potAfter)
    : 0;
  const pressure = clamp(
    opponentAggressiveActions.length * 0.045 +
      Math.max(0, opponentAggressiveActions.length - 1) * 0.045 +
      Math.min(0.09, latestBetRatio * 0.11) +
      opponentCallCount * 0.012 +
      Number(Boolean(latestAggression?.allIn)) * 0.11 +
      Number(wasAggressor && opponentAggressiveActions.length > 0) * 0.055,
    0,
    0.34
  );
  return {
    pressure,
    opponentAggressionCount: opponentAggressiveActions.length,
    opponentCallCount,
    checkedToPlayer:
      legalActions.callAmount === 0 &&
      opponentCheckCount > 0 &&
      opponentAggressiveActions.length === 0,
    facingAllIn:
      legalActions.callAmount > 0 && Boolean(latestAggression?.allIn),
    wasAggressor
  };
}

function pokerBotPersonality(
  tableSeed: string,
  playerId: string
): PokerBotPersonality {
  const random = createDeterministicRandom(`${tableSeed}:bot:${playerId}:personality`);
  return {
    aggression: 0.88 + random() * 0.24,
    patience: 0.88 + random() * 0.24,
    riskTolerance: 0.88 + random() * 0.24,
    bluffRate: 0.025 + random() * 0.045
  };
}

function equitySamples(difficulty: PokerBotDifficulty): number {
  if (difficulty === "easy") return 96;
  if (difficulty === "hard") return 384;
  return 192;
}

function estimateShowdownEquity(
  holeCards: readonly string[],
  board: readonly string[],
  opponentCount: number,
  samples: number,
  random: () => number
): number {
  if (holeCards.length !== 2) return 1 / (opponentCount + 1);
  const knownCards = new Set([...holeCards, ...board]);
  const available = FULL_DECK.filter((card) => !knownCards.has(card));
  const boardCardsNeeded = Math.max(0, 5 - board.length);
  const cardsNeeded = boardCardsNeeded + opponentCount * 2;
  if (available.length < cardsNeeded) return 1 / (opponentCount + 1);

  let equity = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const deck = [...available];
    for (let index = 0; index < cardsNeeded; index += 1) {
      const swapIndex = index + Math.floor(random() * (deck.length - index));
      [deck[index], deck[swapIndex]] = [deck[swapIndex] as string, deck[index] as string];
    }
    const runout = [...board, ...deck.slice(0, boardCardsNeeded)];
    const heroScore = evaluateStrings([...holeCards, ...runout]);
    let bestScore = heroScore;
    let winnerCount = 1;
    for (let opponent = 0; opponent < opponentCount; opponent += 1) {
      const offset = boardCardsNeeded + opponent * 2;
      const opponentScore = evaluateStrings([
        deck[offset] as string,
        deck[offset + 1] as string,
        ...runout
      ]);
      if (opponentScore < bestScore) {
        bestScore = opponentScore;
        winnerCount = 1;
      } else if (opponentScore === bestScore) {
        winnerCount += 1;
      }
    }
    if (heroScore === bestScore) equity += 1 / winnerCount;
  }
  return equity / samples;
}

function normalizeEquity(equity: number, opponentCount: number): number {
  const baseline = 1 / (opponentCount + 1);
  if (equity >= baseline) {
    return clamp(0.5 + ((equity - baseline) / Math.max(0.01, 1 - baseline)) * 0.5, 0, 1);
  }
  return clamp((equity / Math.max(0.01, baseline)) * 0.5, 0, 1);
}

function estimatePositionAdjustment(
  playerSeat: number,
  buttonSeat: number | null,
  smallBlindSeat: number | undefined,
  bigBlindSeat: number | undefined,
  preflop: boolean
): number {
  if (playerSeat === buttonSeat) return preflop ? 0.025 : 0.065;
  if (playerSeat === smallBlindSeat) return preflop ? -0.045 : -0.05;
  if (playerSeat === bigBlindSeat) return preflop ? 0.015 : -0.035;
  return 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
