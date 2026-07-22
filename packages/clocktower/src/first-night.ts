import { SeededRandom } from "./random.js";
import {
  MINION_IDS,
  OUTSIDER_IDS,
  ROLE_BY_ID,
  TOWNSFOLK_IDS,
  type RoleId
} from "./roles.js";
import type { RoleAssignment, TroubleBrewingSetup } from "./setup.js";

export const FIRST_NIGHT_ORDER = [
  "minioninfo",
  "demoninfo",
  "poisoner",
  "washerwoman",
  "librarian",
  "investigator",
  "chef",
  "empath",
  "fortuneteller",
  "butler",
  "spy"
] as const;

export type FirstNightStepId = (typeof FIRST_NIGHT_ORDER)[number];

export type FirstNightResult =
  | { kind: "number"; value: number }
  | { kind: "role-pair"; roleId: RoleId; playerIds: [string, string] }
  | { kind: "no-outsiders" }
  | { kind: "yes-no"; value: boolean }
  | {
      kind: "evil-team";
      demonPlayerIds: string[];
      minionPlayerIds: string[];
      bluffRoleIds: RoleId[];
    }
  | {
      kind: "grimoire";
      assignments: RoleAssignment[];
      redHerringPlayerId?: string;
      poisonTargetPlayerId?: string;
    };

export interface FirstNightPrompt {
  stepId: FirstNightStepId;
  title: string;
  instruction: string;
  kind: "acknowledge" | "select-one" | "select-two";
  allowedPlayerIds?: string[];
  result?: FirstNightResult;
}

export interface FirstNightHistoryEntry {
  stepId: FirstNightStepId;
  playerId: string;
  action: "acknowledge" | "select";
  selectedPlayerIds?: string[];
  result?: FirstNightResult;
}

export interface FirstNightState {
  stepIndex: number;
  completedPlayerIds: string[];
  fortuneTellerResults: Record<string, boolean>;
  poisonTargetPlayerId?: string;
  butlerMasters: Record<string, string>;
  history: FirstNightHistoryEntry[];
  complete: boolean;
}

const ROLE_STEP: Partial<Record<FirstNightStepId, RoleId>> = {
  poisoner: "poisoner",
  washerwoman: "washerwoman",
  librarian: "librarian",
  investigator: "investigator",
  chef: "chef",
  empath: "empath",
  fortuneteller: "fortuneteller",
  butler: "butler",
  spy: "spy"
};

export function createFirstNightState(setup: TroubleBrewingSetup): FirstNightState {
  return normalize(setup, {
    stepIndex: 0,
    completedPlayerIds: [],
    fortuneTellerResults: {},
    butlerMasters: {},
    history: [],
    complete: false
  });
}

export function getFirstNightPrompt(
  setup: TroubleBrewingSetup,
  state: FirstNightState,
  playerId: string
): FirstNightPrompt | undefined {
  if (state.complete || state.completedPlayerIds.includes(playerId)) return undefined;
  const stepId = FIRST_NIGHT_ORDER[state.stepIndex];
  if (!stepId || !actorsForStep(setup, stepId).includes(playerId)) return undefined;

  if (stepId === "minioninfo") {
    return {
      stepId,
      kind: "acknowledge",
      title: "邪恶阵营",
      instruction: "确认恶魔与其他爪牙的位置。",
      result: evilTeamResult(setup, false)
    };
  }

  if (stepId === "demoninfo") {
    return {
      stepId,
      kind: "acknowledge",
      title: "恶魔信息",
      instruction: "确认爪牙与三个不在场的善良角色。",
      result: evilTeamResult(setup, true)
    };
  }

  if (stepId === "poisoner") {
    return {
      stepId,
      kind: "select-one",
      title: "选择投毒目标",
      instruction: "该玩家在今晚和明天白天中毒。",
      allowedPlayerIds: [...setup.playerOrder]
    };
  }

  if (stepId === "fortuneteller") {
    const pendingResult = state.fortuneTellerResults[playerId];
    if (pendingResult !== undefined) {
      return {
        stepId,
        kind: "acknowledge",
        title: "占卜结果",
        instruction: "确认本次占卜结果。",
        result: { kind: "yes-no", value: pendingResult }
      };
    }
    return {
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
    return {
      stepId,
      kind: "acknowledge",
      title: "查看魔典",
      instruction: "查看当前完整魔典后确认。",
      result: {
        kind: "grimoire",
        assignments: setup.assignments,
        ...(setup.redHerringPlayerId
          ? { redHerringPlayerId: setup.redHerringPlayerId }
          : {}),
        ...(state.poisonTargetPlayerId
          ? { poisonTargetPlayerId: state.poisonTargetPlayerId }
          : {})
      }
    };
  }

  return {
    stepId,
    kind: "acknowledge",
    title: ROLE_BY_ID.get(ROLE_STEP[stepId] as RoleId)?.name ?? "夜间信息",
    instruction: "确认你在首夜获得的信息。",
    result: informationResult(setup, state, stepId, playerId)
  };
}

export function submitFirstNightSelection(
  setup: TroubleBrewingSetup,
  state: FirstNightState,
  playerId: string,
  selectedPlayerIds: readonly string[]
): FirstNightState {
  const prompt = getFirstNightPrompt(setup, state, playerId);
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

  const next = cloneState(state);
  const selection = [...selectedPlayerIds];

  if (prompt.stepId === "poisoner") {
    const target = selection[0];
    if (!target) throw new Error("投毒者必须选择目标");
    next.poisonTargetPlayerId = target;
    completePlayer(next, playerId, {
      stepId: prompt.stepId,
      playerId,
      action: "select",
      selectedPlayerIds: selection
    });
  } else if (prompt.stepId === "butler") {
    const master = selection[0];
    if (!master) throw new Error("管家必须选择主人");
    next.butlerMasters[playerId] = master;
    completePlayer(next, playerId, {
      stepId: prompt.stepId,
      playerId,
      action: "select",
      selectedPlayerIds: selection
    });
  } else if (prompt.stepId === "fortuneteller") {
    next.fortuneTellerResults[playerId] = resolveFortuneTeller(
      setup,
      next,
      playerId,
      selection
    );
    next.history.push({
      stepId: prompt.stepId,
      playerId,
      action: "select",
      selectedPlayerIds: selection,
      result: { kind: "yes-no", value: next.fortuneTellerResults[playerId] as boolean }
    });
    return next;
  } else {
    throw new Error("当前步骤不接受玩家选择");
  }

  return advanceIfComplete(setup, next);
}

export function acknowledgeFirstNightPrompt(
  setup: TroubleBrewingSetup,
  state: FirstNightState,
  playerId: string
): FirstNightState {
  const prompt = getFirstNightPrompt(setup, state, playerId);
  if (!prompt || prompt.kind !== "acknowledge") {
    throw new Error("当前没有需要确认的夜间信息");
  }

  const next = cloneState(state);
  completePlayer(next, playerId, {
    stepId: prompt.stepId,
    playerId,
    action: "acknowledge",
    ...(prompt.result ? { result: prompt.result } : {})
  });
  delete next.fortuneTellerResults[playerId];
  return advanceIfComplete(setup, next);
}

export function currentFirstNightStep(
  state: FirstNightState
): FirstNightStepId | undefined {
  return FIRST_NIGHT_ORDER[state.stepIndex];
}

function normalize(setup: TroubleBrewingSetup, state: FirstNightState): FirstNightState {
  const next = cloneState(state);
  while (next.stepIndex < FIRST_NIGHT_ORDER.length) {
    const stepId = FIRST_NIGHT_ORDER[next.stepIndex];
    if (stepId && actorsForStep(setup, stepId).length > 0) return next;
    next.stepIndex += 1;
  }
  next.complete = true;
  return next;
}

function advanceIfComplete(
  setup: TroubleBrewingSetup,
  state: FirstNightState
): FirstNightState {
  const stepId = FIRST_NIGHT_ORDER[state.stepIndex];
  if (!stepId) return normalize(setup, state);
  const actors = actorsForStep(setup, stepId);
  if (!actors.every((playerId) => state.completedPlayerIds.includes(playerId))) {
    return state;
  }

  return normalize(setup, {
    ...state,
    stepIndex: state.stepIndex + 1,
    completedPlayerIds: [],
    fortuneTellerResults: {}
  });
}

function actorsForStep(setup: TroubleBrewingSetup, stepId: FirstNightStepId): string[] {
  if (stepId === "minioninfo") {
    return setup.playerOrder.length >= 7
      ? setup.assignments
          .filter((assignment) => roleOf(assignment.actualRoleId)?.type === "minion")
          .map((assignment) => assignment.playerId)
      : [];
  }
  if (stepId === "demoninfo") {
    return setup.playerOrder.length >= 7
      ? setup.assignments
          .filter((assignment) => assignment.actualRoleId === "imp")
          .map((assignment) => assignment.playerId)
      : [];
  }

  const roleId = ROLE_STEP[stepId];
  if (!roleId) return [];
  return setup.assignments
    .filter(
      (assignment) =>
        assignment.actualRoleId === roleId ||
        (assignment.actualRoleId === "drunk" && assignment.shownRoleId === roleId)
    )
    .map((assignment) => assignment.playerId);
}

function informationResult(
  setup: TroubleBrewingSetup,
  state: FirstNightState,
  stepId: FirstNightStepId,
  playerId: string
): FirstNightResult {
  const malfunctioning = isMalfunctioning(setup, state, playerId);
  const random = randomFor(setup, `${stepId}:${playerId}:${state.poisonTargetPlayerId ?? "none"}`);

  if (stepId === "washerwoman") {
    return rolePairInformation(setup, random, "townsfolk", malfunctioning, "spy");
  }
  if (stepId === "librarian") {
    if (malfunctioning) {
      if (random.float() < 0.2) return { kind: "no-outsiders" };
      return randomRolePair(setup, random, OUTSIDER_IDS);
    }
    const outsiders = setup.assignments.filter(
      (assignment) => roleOf(assignment.actualRoleId)?.type === "outsider"
    );
    const spy = setup.assignments.find((assignment) => assignment.actualRoleId === "spy");
    if (outsiders.length === 0 && (!spy || random.float() >= 0.2)) {
      return { kind: "no-outsiders" };
    }
    if (spy && (outsiders.length === 0 || random.float() < 0.2)) {
      return pairWithDecoy(setup, random, spy.playerId, random.pick(OUTSIDER_IDS));
    }
    const target = random.pick(outsiders);
    return pairWithDecoy(setup, random, target.playerId, target.actualRoleId);
  }
  if (stepId === "investigator") {
    if (malfunctioning) return randomRolePair(setup, random, MINION_IDS);
    const minions = setup.assignments.filter(
      (assignment) => roleOf(assignment.actualRoleId)?.type === "minion"
    );
    const recluse = setup.assignments.find((assignment) => assignment.actualRoleId === "recluse");
    if (recluse && random.float() < 0.25) {
      return pairWithDecoy(setup, random, recluse.playerId, random.pick(MINION_IDS));
    }
    const target = random.pick(minions);
    return pairWithDecoy(setup, random, target.playerId, target.actualRoleId);
  }
  if (stepId === "chef") {
    if (malfunctioning) {
      const evilCount = setup.counts.minions + 1;
      return { kind: "number", value: random.integer(Math.max(1, evilCount)) };
    }
    const registrations = new Map(
      setup.playerOrder.map((candidate) => [
        candidate,
        registersEvil(setup, candidate, `${stepId}:${playerId}:${candidate}`)
      ])
    );
    let pairs = 0;
    for (let index = 0; index < setup.playerOrder.length; index += 1) {
      const left = setup.playerOrder[index];
      const right = setup.playerOrder[(index + 1) % setup.playerOrder.length];
      if (left && right && registrations.get(left) && registrations.get(right)) pairs += 1;
    }
    return { kind: "number", value: pairs };
  }
  if (stepId === "empath") {
    if (malfunctioning) return { kind: "number", value: random.integer(3) };
    const index = setup.playerOrder.indexOf(playerId);
    const left = setup.playerOrder[(index - 1 + setup.playerOrder.length) % setup.playerOrder.length];
    const right = setup.playerOrder[(index + 1) % setup.playerOrder.length];
    const value = [left, right].filter(
      (candidate): candidate is string =>
        Boolean(candidate) && registersEvil(setup, candidate as string, `${stepId}:${playerId}:${candidate}`)
    ).length;
    return { kind: "number", value };
  }

  throw new Error(`No first-night information resolver for ${stepId}`);
}

function rolePairInformation(
  setup: TroubleBrewingSetup,
  random: SeededRandom,
  type: "townsfolk",
  malfunctioning: boolean,
  registeringRoleId: "spy"
): FirstNightResult {
  if (malfunctioning) return randomRolePair(setup, random, TOWNSFOLK_IDS);
  const candidates = setup.assignments.filter(
    (assignment) => roleOf(assignment.actualRoleId)?.type === type
  );
  const registering = setup.assignments.find(
    (assignment) => assignment.actualRoleId === registeringRoleId
  );
  if (registering && random.float() < 0.2) {
    return pairWithDecoy(setup, random, registering.playerId, random.pick(TOWNSFOLK_IDS));
  }
  const target = random.pick(candidates);
  return pairWithDecoy(setup, random, target.playerId, target.actualRoleId);
}

function randomRolePair(
  setup: TroubleBrewingSetup,
  random: SeededRandom,
  roleIds: readonly RoleId[]
): FirstNightResult {
  const players = random.shuffle(setup.playerOrder).slice(0, 2);
  const first = players[0];
  const second = players[1];
  if (!first || !second) throw new Error("At least two players are required");
  return { kind: "role-pair", roleId: random.pick(roleIds), playerIds: [first, second] };
}

function pairWithDecoy(
  setup: TroubleBrewingSetup,
  random: SeededRandom,
  targetPlayerId: string,
  roleId: RoleId
): FirstNightResult {
  const decoy = random.pick(setup.playerOrder.filter((candidate) => candidate !== targetPlayerId));
  const pair = random.shuffle([targetPlayerId, decoy]);
  return { kind: "role-pair", roleId, playerIds: [pair[0] as string, pair[1] as string] };
}

function resolveFortuneTeller(
  setup: TroubleBrewingSetup,
  state: FirstNightState,
  playerId: string,
  selectedPlayerIds: readonly string[]
): boolean {
  const random = randomFor(
    setup,
    `fortuneteller:${playerId}:${selectedPlayerIds.join(":")}:${state.poisonTargetPlayerId ?? "none"}`
  );
  if (isMalfunctioning(setup, state, playerId)) return random.float() < 0.5;

  return selectedPlayerIds.some((candidate) => {
    const assignment = assignmentOf(setup, candidate);
    if (assignment.actualRoleId === "imp") return true;
    if (candidate === setup.redHerringPlayerId) return true;
    return assignment.actualRoleId === "recluse" && random.float() < 0.65;
  });
}

function registersEvil(
  setup: TroubleBrewingSetup,
  playerId: string,
  key: string
): boolean {
  const assignment = assignmentOf(setup, playerId);
  const random = randomFor(setup, `registration:${key}`);
  if (assignment.actualRoleId === "spy") return random.float() >= 0.25;
  if (assignment.actualRoleId === "recluse") return random.float() < 0.65;
  return assignment.alignment === "evil";
}

function isMalfunctioning(
  setup: TroubleBrewingSetup,
  state: FirstNightState,
  playerId: string
): boolean {
  const assignment = assignmentOf(setup, playerId);
  return assignment.actualRoleId === "drunk" || state.poisonTargetPlayerId === playerId;
}

function evilTeamResult(setup: TroubleBrewingSetup, includeBluffs: boolean): FirstNightResult {
  return {
    kind: "evil-team",
    demonPlayerIds: setup.assignments
      .filter((assignment) => assignment.actualRoleId === "imp")
      .map((assignment) => assignment.playerId),
    minionPlayerIds: setup.assignments
      .filter((assignment) => roleOf(assignment.actualRoleId)?.type === "minion")
      .map((assignment) => assignment.playerId),
    bluffRoleIds: includeBluffs ? [...setup.demonBluffRoleIds] : []
  };
}

function randomFor(setup: TroubleBrewingSetup, key: string): SeededRandom {
  return new SeededRandom(`${setup.seed}:first-night:${key}`);
}

function assignmentOf(setup: TroubleBrewingSetup, playerId: string): RoleAssignment {
  const assignment = setup.assignments.find((candidate) => candidate.playerId === playerId);
  if (!assignment) throw new Error("Player assignment was not found");
  return assignment;
}

function roleOf(roleId: RoleId) {
  return ROLE_BY_ID.get(roleId);
}

function completePlayer(
  state: FirstNightState,
  playerId: string,
  historyEntry: FirstNightHistoryEntry
): void {
  if (!state.completedPlayerIds.includes(playerId)) state.completedPlayerIds.push(playerId);
  state.history.push(historyEntry);
}

function cloneState(state: FirstNightState): FirstNightState {
  return {
    ...state,
    completedPlayerIds: [...state.completedPlayerIds],
    fortuneTellerResults: { ...state.fortuneTellerResults },
    butlerMasters: { ...state.butlerMasters },
    history: [...state.history]
  };
}
