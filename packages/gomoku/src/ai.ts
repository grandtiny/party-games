import { GomokuPosition, otherStone } from "./position.js";
import type {
  GomokuAiDifficulty,
  GomokuGameState,
  GomokuPoint,
  GomokuRuleSet,
  GomokuStone
} from "./types.js";

const WIN_SCORE = 10_000_000;
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
] as const;

interface AiProfile {
  maxDepth: number;
  rootCandidates: number;
  branchCandidates: number;
  timeBudgetMs: number;
  randomTopChoices: number;
}

export interface GomokuAiRequest {
  state: GomokuGameState;
  difficulty?: GomokuAiDifficulty;
  timeBudgetMs?: number;
  tacticalMove?: GomokuPoint;
}

export interface GomokuAiDecision {
  point: GomokuPoint;
  score: number;
  depth: number;
  nodes: number;
  elapsedMs: number;
  source: "search" | "tactical";
}

export function chooseGomokuMove(request: GomokuAiRequest): GomokuAiDecision {
  const startedAt = Date.now();
  const difficulty = request.difficulty ?? request.state.aiDifficulty ?? "normal";
  const profile = profileFor(difficulty, request.timeBudgetMs);
  const position = GomokuPosition.fromMoves(request.state.moves);
  const player = request.state.currentPlayer;

  if (
    request.tacticalMove &&
    position.analyzePlacement(request.tacticalMove, player, request.state.ruleSet).legal
  ) {
    return {
      point: request.tacticalMove,
      score: WIN_SCORE,
      depth: 0,
      nodes: 0,
      elapsedMs: Date.now() - startedAt,
      source: "tactical"
    };
  }

  const legal = orderedCandidates(
    position,
    player,
    request.state.ruleSet,
    profile.rootCandidates
  );
  if (legal.length === 0) throw new Error("AI 没有合法落子");

  const immediateWin = legal.find((candidate) => candidate.analysis.winningLine.length > 0);
  if (immediateWin) {
    return {
      point: immediateWin.point,
      score: WIN_SCORE,
      depth: 1,
      nodes: 1,
      elapsedMs: Date.now() - startedAt,
      source: "search"
    };
  }

  const deadline = startedAt + profile.timeBudgetMs;
  let best = legal[0];
  let bestScore = best?.priority ?? 0;
  let completedDepth = 0;
  const counters = { nodes: 0, timedOut: false };

  if (difficulty === "easy") {
    const choiceCount = Math.min(profile.randomTopChoices, legal.length);
    const selected = legal[seededIndex(request.state.seed, request.state.moves.length, choiceCount)];
    if (selected) best = selected;
  } else {
    for (let depth = 1; depth <= profile.maxDepth; depth += 1) {
      const result = searchRoot(
        position,
        player,
        request.state.ruleSet,
        depth,
        deadline,
        profile,
        counters
      );
      if (counters.timedOut || !result) break;
      best = result.candidate;
      bestScore = result.score;
      completedDepth = depth;
      if (Math.abs(bestScore) >= WIN_SCORE - 100) break;
    }
  }

  if (!best) throw new Error("AI 无法选出落子");
  return {
    point: best.point,
    score: bestScore,
    depth: Math.max(1, completedDepth),
    nodes: counters.nodes,
    elapsedMs: Date.now() - startedAt,
    source: "search"
  };
}

interface Candidate {
  point: GomokuPoint;
  priority: number;
  analysis: ReturnType<GomokuPosition["analyzePlacement"]>;
}

function searchRoot(
  position: GomokuPosition,
  player: GomokuStone,
  ruleSet: GomokuRuleSet,
  depth: number,
  deadline: number,
  profile: AiProfile,
  counters: { nodes: number; timedOut: boolean }
): { candidate: Candidate; score: number } | undefined {
  const candidates = orderedCandidates(position, player, ruleSet, profile.rootCandidates);
  let best: Candidate | undefined;
  let bestScore = -Infinity;
  let alpha = -Infinity;

  for (const candidate of candidates) {
    if (Date.now() >= deadline) {
      counters.timedOut = true;
      return undefined;
    }
    counters.nodes += 1;
    const score = candidate.analysis.winningLine.length
      ? WIN_SCORE
      : minimax(
          position.place(candidate.point, player, ruleSet),
          otherStone(player),
          player,
          ruleSet,
          depth - 1,
          alpha,
          Infinity,
          deadline,
          profile,
          counters
        );
    if (counters.timedOut) return undefined;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
    alpha = Math.max(alpha, score);
  }
  return best ? { candidate: best, score: bestScore } : undefined;
}

function minimax(
  position: GomokuPosition,
  currentPlayer: GomokuStone,
  rootPlayer: GomokuStone,
  ruleSet: GomokuRuleSet,
  depth: number,
  alphaValue: number,
  betaValue: number,
  deadline: number,
  profile: AiProfile,
  counters: { nodes: number; timedOut: boolean }
): number {
  if (Date.now() >= deadline) {
    counters.timedOut = true;
    return evaluatePosition(position, rootPlayer, ruleSet);
  }
  if (depth <= 0) return evaluatePosition(position, rootPlayer, ruleSet);

  const maximizing = currentPlayer === rootPlayer;
  let best = maximizing ? -Infinity : Infinity;
  let alpha = alphaValue;
  let beta = betaValue;
  const candidates = orderedCandidates(
    position,
    currentPlayer,
    ruleSet,
    profile.branchCandidates
  );
  if (candidates.length === 0) return evaluatePosition(position, rootPlayer, ruleSet);

  for (const candidate of candidates) {
    counters.nodes += 1;
    let score: number;
    if (candidate.analysis.winningLine.length > 0) {
      score = currentPlayer === rootPlayer ? WIN_SCORE - counters.nodes : -WIN_SCORE + counters.nodes;
    } else {
      score = minimax(
        position.place(candidate.point, currentPlayer, ruleSet),
        otherStone(currentPlayer),
        rootPlayer,
        ruleSet,
        depth - 1,
        alpha,
        beta,
        deadline,
        profile,
        counters
      );
    }
    if (counters.timedOut) return score;
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function orderedCandidates(
  position: GomokuPosition,
  player: GomokuStone,
  ruleSet: GomokuRuleSet,
  limit: number
): Candidate[] {
  const opponent = otherStone(player);
  return position
    .candidateMoves(2)
    .flatMap((point): Candidate[] => {
      const analysis = position.analyzePlacement(point, player, ruleSet);
      if (!analysis.legal) return [];
      const opponentAnalysis = position.analyzePlacement(point, opponent, ruleSet);
      const priority =
        (analysis.winningLine.length > 0 ? WIN_SCORE : 0) +
        (opponentAnalysis.legal && opponentAnalysis.winningLine.length > 0 ? WIN_SCORE / 2 : 0) +
        localMoveScore(position, point, player) * 1.05 +
        localMoveScore(position, point, opponent) -
        (Math.abs(point.x - 7) + Math.abs(point.y - 7)) * 0.01;
      return [{ point, priority, analysis }];
    })
    .sort((left, right) => right.priority - left.priority)
    .slice(0, limit);
}

function evaluatePosition(
  position: GomokuPosition,
  rootPlayer: GomokuStone,
  ruleSet: GomokuRuleSet
): number {
  const root = evaluateStone(position, rootPlayer, ruleSet);
  const opponent = evaluateStone(position, otherStone(rootPlayer), ruleSet);
  return root - opponent * 1.08;
}

function evaluateStone(
  position: GomokuPosition,
  player: GomokuStone,
  ruleSet: GomokuRuleSet
): number {
  let score = 0;
  for (let y = 0; y < 15; y += 1) {
    for (let x = 0; x < 15; x += 1) {
      if (position.stoneAt({ x, y }) !== player) continue;
      for (const [dx, dy] of DIRECTIONS) {
        if (position.stoneAt({ x: x - dx, y: y - dy }) === player) continue;
        let length = 0;
        while (position.stoneAt({ x: x + dx * length, y: y + dy * length }) === player) {
          length += 1;
        }
        const openEnds =
          Number(position.isEmpty({ x: x - dx, y: y - dy })) +
          Number(position.isEmpty({ x: x + dx * length, y: y + dy * length }));
        if (ruleSet === "renju" && player === "black" && length > 5) continue;
        score += runScore(length, openEnds);
      }
    }
  }
  return score;
}

function localMoveScore(
  position: GomokuPosition,
  point: GomokuPoint,
  player: GomokuStone
): number {
  let total = 0;
  for (const [dx, dy] of DIRECTIONS) {
    let length = 1;
    let openEnds = 0;
    for (const sign of [-1, 1] as const) {
      let distance = 1;
      while (
        position.stoneAt({
          x: point.x + dx * distance * sign,
          y: point.y + dy * distance * sign
        }) === player
      ) {
        length += 1;
        distance += 1;
      }
      if (
        position.isEmpty({
          x: point.x + dx * distance * sign,
          y: point.y + dy * distance * sign
        })
      ) {
        openEnds += 1;
      }
    }
    total += runScore(length, openEnds);
  }
  return total;
}

function runScore(length: number, openEnds: number): number {
  if (length >= 5) return WIN_SCORE;
  if (openEnds === 0) return 0;
  const base = [0, 1, 12, 180, 12_000][length] ?? 0;
  return base * (openEnds === 2 ? 3 : 1);
}

function profileFor(difficulty: GomokuAiDifficulty, override?: number): AiProfile {
  const profile: AiProfile =
    difficulty === "easy"
      ? {
          maxDepth: 1,
          rootCandidates: 12,
          branchCandidates: 8,
          timeBudgetMs: 80,
          randomTopChoices: 4
        }
      : difficulty === "hard"
        ? {
            maxDepth: 5,
            rootCandidates: 20,
            branchCandidates: 12,
            timeBudgetMs: 1_200,
            randomTopChoices: 1
          }
        : {
            maxDepth: 3,
            rootCandidates: 16,
            branchCandidates: 10,
            timeBudgetMs: 420,
            randomTopChoices: 1
          };
  return override === undefined ? profile : { ...profile, timeBudgetMs: Math.max(20, override) };
}

function seededIndex(seed: number, moveCount: number, length: number): number {
  let value = (seed ^ Math.imul(moveCount + 1, 0x9e3779b1)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) % Math.max(1, length);
}
