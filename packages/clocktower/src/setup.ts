import { SeededRandom } from "./random.js";
import {
  GOOD_ROLE_IDS,
  MINION_IDS,
  OUTSIDER_IDS,
  ROLE_BY_ID,
  TOWNSFOLK_IDS,
  type Alignment,
  type RoleId,
  type RoleTag
} from "./roles.js";

export interface RoleCounts {
  townsfolk: number;
  outsiders: number;
  minions: number;
  demons: 1;
}

export interface RoleAssignment {
  playerId: string;
  actualRoleId: RoleId;
  shownRoleId: RoleId;
  alignment: Alignment;
}

export interface TroubleBrewingSetup {
  seed: string;
  playerOrder: string[];
  counts: RoleCounts;
  rolesInPlay: RoleId[];
  assignments: RoleAssignment[];
  drunkFacadeRoleId?: RoleId;
  redHerringPlayerId?: string;
  demonBluffRoleIds: RoleId[];
}

const PLAYER_COUNTS: Record<number, RoleCounts> = {
  5: { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
  6: { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 },
  7: { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 },
  8: { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 },
  9: { townsfolk: 5, outsiders: 2, minions: 1, demons: 1 },
  10: { townsfolk: 7, outsiders: 0, minions: 2, demons: 1 },
  11: { townsfolk: 7, outsiders: 1, minions: 2, demons: 1 },
  12: { townsfolk: 7, outsiders: 2, minions: 2, demons: 1 },
  13: { townsfolk: 9, outsiders: 0, minions: 3, demons: 1 },
  14: { townsfolk: 9, outsiders: 1, minions: 3, demons: 1 },
  15: { townsfolk: 9, outsiders: 2, minions: 3, demons: 1 }
};

export function getRoleCounts(playerCount: number, hasBaron = false): RoleCounts {
  const base = PLAYER_COUNTS[playerCount];
  if (!base) {
    throw new Error("Trouble Brewing requires 5 to 15 players");
  }

  if (!hasBaron) {
    return { ...base };
  }

  return {
    townsfolk: base.townsfolk - 2,
    outsiders: base.outsiders + 2,
    minions: base.minions,
    demons: 1
  };
}

function countTags(roleIds: readonly RoleId[], tag: RoleTag): number {
  return roleIds.reduce((count, roleId) => {
    const role = ROLE_BY_ID.get(roleId);
    return count + (role?.tags.includes(tag) ? 1 : 0);
  }, 0);
}

function scoreSetup(roleIds: readonly RoleId[], playerCount: number): number {
  const firstNightInfo = countTags(roleIds, "first-night-info");
  const recurringInfo = countTags(roleIds, "recurring-info");
  const protection = countTags(roleIds, "protection");
  const confirmation = countTags(roleIds, "confirmation");
  const misinformation = countTags(roleIds, "misinformation");
  const executionRisk = countTags(roleIds, "execution-risk");
  const demonSafety = countTags(roleIds, "demon-safety");
  const hasBaron = roleIds.includes("baron");
  const hasDrunk = roleIds.includes("drunk");
  const hasPoisoner = roleIds.includes("poisoner");

  let score = 100;
  const desiredInfo = playerCount <= 6 ? 2 : playerCount <= 9 ? 3 : 4;
  score -= Math.abs(firstNightInfo + recurringInfo - desiredInfo) * 7;

  if (firstNightInfo === 0) score -= 12;
  if (playerCount >= 7 && recurringInfo === 0) score -= 10;
  if (protection > 2) score -= (protection - 2) * 5;
  if (confirmation > 3) score -= (confirmation - 3) * 5;
  if (executionRisk > 0 && hasBaron && hasDrunk) score -= 6;
  if (demonSafety > 0 && confirmation === 0) score -= 5;
  if ((hasDrunk || hasPoisoner) && firstNightInfo + recurringInfo >= desiredInfo) score += 5;
  if (misinformation === 0 && firstNightInfo + recurringInfo > desiredInfo) score -= 5;

  return score;
}

function generateCandidate(random: SeededRandom, playerCount: number): RoleId[] {
  const baseCounts = getRoleCounts(playerCount);
  const minions = random.shuffle(MINION_IDS).slice(0, baseCounts.minions);
  const counts = getRoleCounts(playerCount, minions.includes("baron"));
  const outsiders = random.shuffle(OUTSIDER_IDS).slice(0, counts.outsiders);
  const townsfolk = random.shuffle(TOWNSFOLK_IDS).slice(0, counts.townsfolk);
  return [...townsfolk, ...outsiders, ...minions, "imp"];
}

function chooseRoleSet(random: SeededRandom, playerCount: number): RoleId[] {
  const candidates = Array.from({ length: 600 }, () => {
    const roleIds = generateCandidate(random, playerCount);
    return { roleIds, score: scoreSetup(roleIds, playerCount) };
  }).sort((left, right) => right.score - left.score);

  const topBandSize = Math.max(12, Math.ceil(candidates.length * 0.12));
  return [...random.pick(candidates.slice(0, topBandSize)).roleIds];
}

export function createTroubleBrewingSetup(
  playerIds: readonly string[],
  seed: string
): TroubleBrewingSetup {
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("Player ids must be unique");
  }

  const playerCount = playerIds.length;
  getRoleCounts(playerCount);

  const random = new SeededRandom(seed);
  const rolesInPlay = chooseRoleSet(random, playerCount);
  const hasBaron = rolesInPlay.includes("baron");
  const counts = getRoleCounts(playerCount, hasBaron);
  const shuffledPlayers = random.shuffle(playerIds);
  const shuffledRoles = random.shuffle(rolesInPlay);

  const inPlay = new Set<RoleId>(rolesInPlay);
  let drunkFacadeRoleId: RoleId | undefined;
  if (inPlay.has("drunk")) {
    drunkFacadeRoleId = random.pick(TOWNSFOLK_IDS.filter((roleId) => !inPlay.has(roleId)));
  }

  const assignments = shuffledPlayers.map((playerId, index): RoleAssignment => {
    const actualRoleId = shuffledRoles[index];
    if (!actualRoleId) {
      throw new Error("Role assignment is incomplete");
    }
    const role = ROLE_BY_ID.get(actualRoleId);
    if (!role) {
      throw new Error(`Unknown role: ${actualRoleId}`);
    }

    return {
      playerId,
      actualRoleId,
      shownRoleId:
        actualRoleId === "drunk" && drunkFacadeRoleId ? drunkFacadeRoleId : actualRoleId,
      alignment: role.alignment
    };
  });

  const fortuneTeller = assignments.find(
    (assignment) => assignment.actualRoleId === "fortuneteller"
  );
  const goodAssignments = assignments.filter((assignment) => assignment.alignment === "good");
  const redHerringPlayerId = fortuneTeller
    ? random.pick(goodAssignments).playerId
    : undefined;

  const excludedBluffs = new Set<RoleId>(rolesInPlay);
  if (drunkFacadeRoleId) excludedBluffs.add(drunkFacadeRoleId);
  const demonBluffRoleIds =
    playerCount >= 7
      ? random
          .shuffle(GOOD_ROLE_IDS.filter((roleId) => !excludedBluffs.has(roleId)))
          .slice(0, 3)
      : [];

  return {
    seed,
    playerOrder: [...playerIds],
    counts,
    rolesInPlay,
    assignments,
    ...(drunkFacadeRoleId ? { drunkFacadeRoleId } : {}),
    ...(redHerringPlayerId ? { redHerringPlayerId } : {}),
    demonBluffRoleIds
  };
}
