import type { TroubleBrewingGameState } from "./day.js";
import { SeededRandom } from "./random.js";
import {
  GOOD_ROLE_IDS,
  MINION_IDS,
  ROLE_BY_ID,
  TROUBLE_BREWING_ROLES,
  type RoleId
} from "./roles.js";
import type { TroubleBrewingSetup } from "./setup.js";

export const OTHER_NIGHT_ORDER = [
  "poisoner",
  "monk",
  "imp",
  "ravenkeeper",
  "empath",
  "fortuneteller",
  "undertaker",
  "butler",
  "spy"
] as const;

export type OtherNightStepId = (typeof OTHER_NIGHT_ORDER)[number];

export type OtherNightResult =
  | { kind: "number"; value: number }
  | { kind: "yes-no"; value: boolean }
  | { kind: "role"; roleId: RoleId }
  | {
      kind: "current-grimoire";
      poisonTargetPlayerId?: string;
      monkProtectedPlayerId?: string;
    };

export interface OtherNightPrompt {
  stepId: OtherNightStepId;
  title: string;
  instruction: string;
  kind: "acknowledge" | "select-one" | "select-two";
  allowedPlayerIds?: string[];
  result?: OtherNightResult;
}

export interface OtherNightHistoryEntry {
  stepId: OtherNightStepId;
  playerId: string;
  action: "acknowledge" | "select";
  selectedPlayerIds?: string[];
  result?: OtherNightResult;
}

export interface OtherNightState {
  number: number;
  stepIndex: number;
  completedPlayerIds: string[];
  pendingResults: Record<string, OtherNightResult>;
  monkProtectedPlayerId?: string;
  deathPlayerIds: string[];
  history: OtherNightHistoryEntry[];
}

export function startOtherNight(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState
): TroubleBrewingGameState {
  if (game.winner) throw new Error("游戏已经结束");
  if (game.day.stage !== "complete") throw new Error("白天尚未结束");
  if (game.night) throw new Error("普通夜晚已经开始");

  const next = cloneGame(game);
  delete next.poisonTargetPlayerId;
  next.night = {
    number: game.day.number,
    stepIndex: 0,
    completedPlayerIds: [],
    pendingResults: {},
    deathPlayerIds: [],
    history: []
  };
  return normalizeNight(setup, next);
}

export function getOtherNightPrompt(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string
): OtherNightPrompt | undefined {
  const night = game.night;
  if (!night || night.completedPlayerIds.includes(playerId)) return undefined;
  const stepId = OTHER_NIGHT_ORDER[night.stepIndex];
  if (!stepId || !actorsForStep(game, stepId).includes(playerId)) return undefined;

  if (stepId === "poisoner") {
    return {
      stepId,
      kind: "select-one",
      title: "选择投毒目标",
      instruction: "该玩家在今晚和明天白天中毒。",
      allowedPlayerIds: [...setup.playerOrder]
    };
  }
  if (stepId === "monk") {
    return {
      stepId,
      kind: "select-one",
      title: "选择保护目标",
      instruction: "该玩家今晚免受恶魔伤害。",
      allowedPlayerIds: setup.playerOrder.filter((candidate) => candidate !== playerId)
    };
  }
  if (stepId === "imp") {
    return {
      stepId,
      kind: "select-one",
      title: "选择击杀目标",
      instruction: "选择一名玩家。如果选择自己，一名存活爪牙将成为新的小恶魔。",
      allowedPlayerIds: [...setup.playerOrder]
    };
  }
  if (stepId === "ravenkeeper") {
    const result = night.pendingResults[playerId];
    return result
      ? {
          stepId,
          kind: "acknowledge",
          title: "守鸦人信息",
          instruction: "确认你得知的角色。",
          result
        }
      : {
          stepId,
          kind: "select-one",
          title: "选择查验目标",
          instruction: "你在夜晚死亡，选择一名玩家并得知其角色。",
          allowedPlayerIds: [...setup.playerOrder]
        };
  }
  if (stepId === "fortuneteller") {
    const result = night.pendingResults[playerId];
    return result
      ? {
          stepId,
          kind: "acknowledge",
          title: "占卜结果",
          instruction: "确认本次占卜结果。",
          result
        }
      : {
          stepId,
          kind: "select-two",
          title: "选择两名玩家",
          instruction: "你将得知其中是否有玩家登记为恶魔。",
          allowedPlayerIds: [...setup.playerOrder]
        };
  }
  if (stepId === "butler") {
    return {
      stepId,
      kind: "select-one",
      title: "选择主人",
      instruction: "明天只有主人投票时，你才能投票。",
      allowedPlayerIds: setup.playerOrder.filter((candidate) => candidate !== playerId)
    };
  }
  if (stepId === "spy") {
    const poisonTargetPlayerId = game.poisonTargetPlayerId;
    const monkProtectedPlayerId = game.night?.monkProtectedPlayerId;
    return {
      stepId,
      kind: "acknowledge",
      title: "查看魔典",
      instruction: "查看当前完整魔典后确认。",
      result: {
        kind: "current-grimoire",
        ...(poisonTargetPlayerId ? { poisonTargetPlayerId } : {}),
        ...(monkProtectedPlayerId ? { monkProtectedPlayerId } : {})
      }
    };
  }

  return {
    stepId,
    kind: "acknowledge",
    title: ROLE_BY_ID.get(stepId)?.name ?? "夜间信息",
    instruction: "确认你在今晚获得的信息。",
    result: informationResult(setup, game, stepId, playerId)
  };
}

export function submitOtherNightSelection(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string,
  selectedPlayerIds: readonly string[]
): TroubleBrewingGameState {
  const prompt = getOtherNightPrompt(setup, game, playerId);
  if (!prompt || prompt.kind === "acknowledge") {
    throw new Error("当前没有可提交的夜间选择");
  }
  const expectedCount = prompt.kind === "select-two" ? 2 : 1;
  if (selectedPlayerIds.length !== expectedCount) {
    throw new Error(`需要选择 ${expectedCount} 名玩家`);
  }
  if (new Set(selectedPlayerIds).size !== selectedPlayerIds.length) {
    throw new Error("不能重复选择同一名玩家");
  }
  const allowed = new Set(prompt.allowedPlayerIds ?? []);
  if (selectedPlayerIds.some((candidate) => !allowed.has(candidate))) {
    throw new Error("选择中包含不可用玩家");
  }

  let next = cloneGame(game);
  const night = requireNight(next);
  const selection = [...selectedPlayerIds];
  if (prompt.stepId === "poisoner") {
    next.poisonTargetPlayerId = requireSelection(selection);
    completePlayer(night, playerId, prompt.stepId, selection);
  } else if (prompt.stepId === "monk") {
    night.monkProtectedPlayerId = requireSelection(selection);
    completePlayer(night, playerId, prompt.stepId, selection);
  } else if (prompt.stepId === "imp") {
    next = resolveImpAttack(setup, next, playerId, requireSelection(selection));
    completePlayer(requireNight(next), playerId, prompt.stepId, selection);
  } else if (prompt.stepId === "butler") {
    next.butlerMasters[playerId] = requireSelection(selection);
    completePlayer(night, playerId, prompt.stepId, selection);
  } else if (prompt.stepId === "fortuneteller") {
    const result: OtherNightResult = {
      kind: "yes-no",
      value: resolveFortuneTeller(setup, next, playerId, selection)
    };
    night.pendingResults[playerId] = result;
    night.history.push({
      stepId: prompt.stepId,
      playerId,
      action: "select",
      selectedPlayerIds: selection,
      result
    });
    return next;
  } else if (prompt.stepId === "ravenkeeper") {
    const result: OtherNightResult = {
      kind: "role",
      roleId: resolveRoleInformation(
        setup,
        next,
        playerId,
        requireSelection(selection),
        "ravenkeeper"
      )
    };
    night.pendingResults[playerId] = result;
    night.history.push({
      stepId: prompt.stepId,
      playerId,
      action: "select",
      selectedPlayerIds: selection,
      result
    });
    return next;
  } else {
    throw new Error("当前步骤不接受玩家选择");
  }

  return advanceIfComplete(setup, next);
}

export function acknowledgeOtherNightPrompt(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string
): TroubleBrewingGameState {
  const prompt = getOtherNightPrompt(setup, game, playerId);
  if (!prompt || prompt.kind !== "acknowledge") {
    throw new Error("当前没有需要确认的夜间信息");
  }

  const next = cloneGame(game);
  const night = requireNight(next);
  completePlayer(night, playerId, prompt.stepId, undefined, prompt.result);
  delete night.pendingResults[playerId];
  return advanceIfComplete(setup, next);
}

export function currentOtherNightStep(
  game: TroubleBrewingGameState
): OtherNightStepId | undefined {
  return game.night ? OTHER_NIGHT_ORDER[game.night.stepIndex] : undefined;
}

function normalizeNight(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState
): TroubleBrewingGameState {
  const next = cloneGame(game);
  const night = requireNight(next);
  while (night.stepIndex < OTHER_NIGHT_ORDER.length) {
    const stepId = OTHER_NIGHT_ORDER[night.stepIndex];
    if (stepId && actorsForStep(next, stepId).length > 0) return next;
    night.stepIndex += 1;
    night.completedPlayerIds = [];
    night.pendingResults = {};
  }
  return finishNight(next);
}

function advanceIfComplete(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState
): TroubleBrewingGameState {
  const night = requireNight(game);
  const stepId = OTHER_NIGHT_ORDER[night.stepIndex];
  if (!stepId) return normalizeNight(setup, game);
  const actors = actorsForStep(game, stepId);
  if (!actors.every((playerId) => night.completedPlayerIds.includes(playerId))) {
    return game;
  }

  const next = cloneGame(game);
  const nextNight = requireNight(next);
  nextNight.stepIndex += 1;
  nextNight.completedPlayerIds = [];
  nextNight.pendingResults = {};
  return normalizeNight(setup, next);
}

function finishNight(game: TroubleBrewingGameState): TroubleBrewingGameState {
  const next = cloneGame(game);
  const night = requireNight(next);
  const dayNumber = next.day.number + 1;
  const deathPlayerIds = [...night.deathPlayerIds];
  next.completedNights.push({
    number: night.number,
    entries: night.history.map((entry) => ({
      ...entry,
      ...(entry.selectedPlayerIds ? { selectedPlayerIds: [...entry.selectedPlayerIds] } : {})
    }))
  });
  delete next.night;
  next.day = {
    number: dayNumber,
    stage: "discussion",
    nominationRequestPlayerIds: [],
    closeRequestPlayerIds: [],
    nominatorsUsedPlayerIds: [],
    nomineesUsedPlayerIds: [],
    nominations: [],
    blockVoteCount: 0,
    blockNomineePlayerIds: [],
    publicEvents: [{ kind: "night-deaths", playerIds: deathPlayerIds }]
  };

  if (!hasLivingDemon(next)) {
    setWinner(next, "good", "恶魔在夜晚死亡且没有成功传位");
  } else if (alivePlayerIds(next).length <= 2) {
    setWinner(next, "evil", "仅剩两名玩家存活");
  }
  return next;
}

function actorsForStep(
  game: TroubleBrewingGameState,
  stepId: OtherNightStepId
): string[] {
  const night = requireNight(game);
  if (stepId === "ravenkeeper") {
    return game.playerOrder.filter(
      (playerId) =>
        night.deathPlayerIds.includes(playerId) && actsAsRole(game, playerId, "ravenkeeper")
    );
  }
  if (stepId === "undertaker" && !game.day.executedPlayerId) return [];
  return game.playerOrder.filter(
    (playerId) => game.players[playerId]?.alive && actsAsRole(game, playerId, stepId)
  );
}

function informationResult(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  stepId: "empath" | "undertaker",
  playerId: string
): OtherNightResult {
  if (stepId === "empath") {
    const random = randomFor(setup, game, `${stepId}:${playerId}`);
    if (isMalfunctioning(game, playerId, false)) {
      return { kind: "number", value: random.integer(3) };
    }
    const neighbors = livingNeighbors(game, playerId);
    return {
      kind: "number",
      value: neighbors.filter((candidate) =>
        registersEvil(setup, game, candidate, `${stepId}:${playerId}:${candidate}`)
      ).length
    };
  }

  const executedPlayerId = game.day.executedPlayerId;
  if (!executedPlayerId) throw new Error("送葬者没有可查验的处决目标");
  return {
    kind: "role",
    roleId: resolveRoleInformation(
      setup,
      game,
      playerId,
      executedPlayerId,
      "undertaker"
    )
  };
}

function resolveImpAttack(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  impPlayerId: string,
  targetPlayerId: string
): TroubleBrewingGameState {
  const next = cloneGame(game);
  if (isMalfunctioning(next, impPlayerId, false)) return next;

  if (targetPlayerId === impPlayerId) {
    killAtNight(next, impPlayerId);
    const minions = next.playerOrder.filter(
      (candidate) =>
        next.players[candidate]?.alive &&
        ROLE_BY_ID.get(currentRole(next, candidate))?.type === "minion"
    );
    if (minions.length > 0) {
      const successor = randomFor(setup, next, `imp-successor:${impPlayerId}`).pick(minions);
      const player = next.players[successor];
      if (player) player.roleId = "imp";
      const night = requireNight(next);
      if (!night.completedPlayerIds.includes(successor)) {
        night.completedPlayerIds.push(successor);
      }
    }
    return next;
  }

  if (!next.players[targetPlayerId]?.alive) return next;
  if (!canDieFromDemon(next, targetPlayerId)) return next;

  let deathPlayerId = targetPlayerId;
  if (currentRole(next, targetPlayerId) === "mayor" && !isMalfunctioning(next, targetPlayerId, false)) {
    const random = randomFor(setup, next, `mayor:${targetPlayerId}:${impPlayerId}`);
    const alternatives = next.playerOrder.filter(
      (candidate) =>
        candidate !== targetPlayerId &&
        candidate !== impPlayerId &&
        next.players[candidate]?.alive &&
        canDieFromDemon(next, candidate)
    );
    if (alternatives.length > 0 && random.float() < 0.65) {
      deathPlayerId = random.pick(alternatives);
    }
  }

  killAtNight(next, deathPlayerId);
  return next;
}

function canDieFromDemon(game: TroubleBrewingGameState, playerId: string): boolean {
  if (currentRole(game, playerId) === "soldier" && !isMalfunctioning(game, playerId, false)) {
    return false;
  }
  return activeMonkProtection(game) !== playerId;
}

function activeMonkProtection(game: TroubleBrewingGameState): string | undefined {
  const target = game.night?.monkProtectedPlayerId;
  if (!target) return undefined;
  const monkPlayerId = game.playerOrder.find(
    (playerId) => game.players[playerId]?.alive && actsAsRole(game, playerId, "monk")
  );
  if (!monkPlayerId || isMalfunctioning(game, monkPlayerId, false)) return undefined;
  return target;
}

function resolveFortuneTeller(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string,
  selectedPlayerIds: readonly string[]
): boolean {
  const random = randomFor(
    setup,
    game,
    `fortuneteller:${playerId}:${selectedPlayerIds.join(":")}`
  );
  if (isMalfunctioning(game, playerId, false)) return random.float() < 0.5;
  return selectedPlayerIds.some((candidate) => {
    if (currentRole(game, candidate) === "imp") return true;
    if (candidate === setup.redHerringPlayerId) return true;
    return currentRole(game, candidate) === "recluse" && random.float() < 0.65;
  });
}

function resolveRoleInformation(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  actorPlayerId: string,
  targetPlayerId: string,
  source: "ravenkeeper" | "undertaker"
): RoleId {
  const random = randomFor(setup, game, `${source}:${actorPlayerId}:${targetPlayerId}`);
  if (isMalfunctioning(game, actorPlayerId, source === "ravenkeeper")) {
    return random.pick(TROUBLE_BREWING_ROLES).id as RoleId;
  }

  const targetRoleId = currentRole(game, targetPlayerId);
  if (targetRoleId === "spy" && random.float() < 0.35) {
    return random.pick(GOOD_ROLE_IDS);
  }
  if (targetRoleId === "recluse" && random.float() < 0.5) {
    return random.pick([...MINION_IDS, "imp"] as RoleId[]);
  }
  return targetRoleId;
}

function livingNeighbors(game: TroubleBrewingGameState, playerId: string): string[] {
  const order = game.playerOrder;
  const index = order.indexOf(playerId);
  if (index < 0) throw new Error("玩家不在座位顺序中");
  const neighbors: string[] = [];
  for (const direction of [-1, 1] as const) {
    for (let offset = 1; offset < order.length; offset += 1) {
      const candidate = order[(index + direction * offset + order.length) % order.length];
      if (candidate && game.players[candidate]?.alive) {
        neighbors.push(candidate);
        break;
      }
    }
  }
  return neighbors;
}

function registersEvil(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string,
  key: string
): boolean {
  const roleId = currentRole(game, playerId);
  const random = randomFor(setup, game, `registration:${key}`);
  if (roleId === "spy") return random.float() >= 0.25;
  if (roleId === "recluse") return random.float() < 0.65;
  return game.players[playerId]?.alignment === "evil";
}

function isMalfunctioning(
  game: TroubleBrewingGameState,
  playerId: string,
  allowDead: boolean
): boolean {
  const player = game.players[playerId];
  if (!player) throw new Error("玩家角色状态不存在");
  if (!allowDead && !player.alive) return true;
  return player.roleId === "drunk" || isPoisoned(game, playerId);
}

function isPoisoned(game: TroubleBrewingGameState, playerId: string): boolean {
  if (game.poisonTargetPlayerId !== playerId) return false;
  return game.playerOrder.some(
    (candidate) =>
      game.players[candidate]?.alive && currentRole(game, candidate) === "poisoner"
  );
}

function actsAsRole(
  game: TroubleBrewingGameState,
  playerId: string,
  roleId: OtherNightStepId
): boolean {
  const player = game.players[playerId];
  if (!player) return false;
  return player.roleId === roleId || (player.roleId === "drunk" && player.shownRoleId === roleId);
}

function currentRole(game: TroubleBrewingGameState, playerId: string): RoleId {
  const roleId = game.players[playerId]?.roleId;
  if (!roleId) throw new Error("玩家角色状态不存在");
  return roleId;
}

function killAtNight(game: TroubleBrewingGameState, playerId: string): void {
  const player = game.players[playerId];
  if (!player?.alive) return;
  player.alive = false;
  const night = requireNight(game);
  if (!night.deathPlayerIds.includes(playerId)) night.deathPlayerIds.push(playerId);
}

function alivePlayerIds(game: TroubleBrewingGameState): string[] {
  return game.playerOrder.filter((playerId) => game.players[playerId]?.alive);
}

function hasLivingDemon(game: TroubleBrewingGameState): boolean {
  return game.playerOrder.some(
    (playerId) => game.players[playerId]?.alive && currentRole(game, playerId) === "imp"
  );
}

function setWinner(
  game: TroubleBrewingGameState,
  winner: "good" | "evil",
  reason: string
): void {
  game.winner = winner;
  game.endReason = reason;
  game.day.stage = "complete";
  game.day.publicEvents.push({ kind: "game-over", winner, reason });
}

function completePlayer(
  night: OtherNightState,
  playerId: string,
  stepId: OtherNightStepId,
  selectedPlayerIds?: string[],
  result?: OtherNightResult
): void {
  if (!night.completedPlayerIds.includes(playerId)) night.completedPlayerIds.push(playerId);
  night.history.push({
    stepId,
    playerId,
    action: selectedPlayerIds ? "select" : "acknowledge",
    ...(selectedPlayerIds ? { selectedPlayerIds } : {}),
    ...(result ? { result } : {})
  });
}

function requireSelection(selectedPlayerIds: readonly string[]): string {
  const playerId = selectedPlayerIds[0];
  if (!playerId) throw new Error("夜间选择不能为空");
  return playerId;
}

function requireNight(game: TroubleBrewingGameState): OtherNightState {
  if (!game.night) throw new Error("普通夜晚尚未开始");
  return game.night;
}

function randomFor(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  key: string
): SeededRandom {
  return new SeededRandom(`${setup.seed}:night:${game.night?.number ?? game.day.number}:${key}`);
}

function cloneGame(game: TroubleBrewingGameState): TroubleBrewingGameState {
  return {
    ...game,
    players: Object.fromEntries(
      Object.entries(game.players).map(([playerId, player]) => [playerId, { ...player }])
    ),
    playerOrder: [...game.playerOrder],
    butlerMasters: { ...game.butlerMasters },
    ghostVoteUsedPlayerIds: [...game.ghostVoteUsedPlayerIds],
    virginSpentPlayerIds: [...game.virginSpentPlayerIds],
    slayerClaimUsedPlayerIds: [...game.slayerClaimUsedPlayerIds],
    completedNights: game.completedNights.map((night) => ({
      number: night.number,
      entries: night.entries.map((entry) => ({
        ...entry,
        ...(entry.selectedPlayerIds ? { selectedPlayerIds: [...entry.selectedPlayerIds] } : {})
      }))
    })),
    day: {
      ...game.day,
      nominationRequestPlayerIds: [...game.day.nominationRequestPlayerIds],
      closeRequestPlayerIds: [...game.day.closeRequestPlayerIds],
      nominatorsUsedPlayerIds: [...game.day.nominatorsUsedPlayerIds],
      nomineesUsedPlayerIds: [...game.day.nomineesUsedPlayerIds],
      nominations: game.day.nominations.map((nomination) => ({
        ...nomination,
        votedPlayerIds: [...nomination.votedPlayerIds]
      })),
      blockNomineePlayerIds: [...game.day.blockNomineePlayerIds],
      ...(game.day.currentVote
        ? {
            currentVote: {
              ...game.day.currentVote,
              order: [...game.day.currentVote.order],
              intents: { ...game.day.currentVote.intents },
              lockedVotes: { ...game.day.currentVote.lockedVotes }
            }
          }
        : {}),
      publicEvents: game.day.publicEvents.map((event) =>
        event.kind === "night-deaths" ? { ...event, playerIds: [...event.playerIds] } : { ...event }
      )
    },
    ...(game.night
      ? {
          night: {
            ...game.night,
            completedPlayerIds: [...game.night.completedPlayerIds],
            pendingResults: { ...game.night.pendingResults },
            deathPlayerIds: [...game.night.deathPlayerIds],
            history: game.night.history.map((entry) => ({
              ...entry,
              ...(entry.selectedPlayerIds
                ? { selectedPlayerIds: [...entry.selectedPlayerIds] }
                : {})
            }))
          }
        }
      : {})
  };
}
