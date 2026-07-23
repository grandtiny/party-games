import { SeededRandom } from "./random.js";
import { ROLE_BY_ID, type Alignment, type RoleId } from "./roles.js";
import type { FirstNightState } from "./first-night.js";
import type { OtherNightHistoryEntry, OtherNightState } from "./night.js";
import type { TroubleBrewingSetup } from "./setup.js";

export type DayStage = "discussion" | "nominations" | "voting" | "complete";
export type Winner = "good" | "evil";

export interface GamePlayerState {
  roleId: RoleId;
  shownRoleId: RoleId;
  alignment: Alignment;
  alive: boolean;
}

export interface NominationRecord {
  nominatorPlayerId: string;
  nomineePlayerId: string;
  votes: number;
  votedPlayerIds: string[];
}

export interface VoteState {
  nominatorPlayerId: string;
  nomineePlayerId: string;
  order: string[];
  cursorIndex: number;
  nextLockAt: number;
  stepDurationMs: number;
  intents: Record<string, boolean>;
  lockedVotes: Record<string, boolean>;
}

export type DayPublicEvent =
  | { kind: "nominations-opened" }
  | { kind: "nomination"; nominatorPlayerId: string; nomineePlayerId: string }
  | {
      kind: "vote-completed";
      nomineePlayerId: string;
      votes: number;
      votedPlayerIds: string[];
    }
  | {
      kind: "slayer-claim";
      playerId: string;
      targetPlayerId: string;
      targetDied: boolean;
    }
  | { kind: "night-deaths"; playerIds: string[] }
  | { kind: "execution"; playerId?: string; reason: "vote" | "virgin" | "none" }
  | { kind: "game-over"; winner: Winner; reason: string };

export interface DayState {
  number: number;
  stage: DayStage;
  nominationRequestPlayerIds: string[];
  closeRequestPlayerIds: string[];
  nominatorsUsedPlayerIds: string[];
  nomineesUsedPlayerIds: string[];
  nominations: NominationRecord[];
  blockVoteCount: number;
  blockNomineePlayerIds: string[];
  currentVote?: VoteState;
  executedPlayerId?: string;
  publicEvents: DayPublicEvent[];
}

export interface TroubleBrewingGameState {
  players: Record<string, GamePlayerState>;
  playerOrder: string[];
  poisonTargetPlayerId?: string;
  butlerMasters: Record<string, string>;
  ghostVoteUsedPlayerIds: string[];
  virginSpentPlayerIds: string[];
  slayerClaimUsedPlayerIds: string[];
  completedNights: Array<{ number: number; entries: OtherNightHistoryEntry[] }>;
  winner?: Winner;
  endReason?: string;
  night?: OtherNightState;
  day: DayState;
}

export function createGameStateAfterFirstNight(
  setup: TroubleBrewingSetup,
  firstNight: FirstNightState
): TroubleBrewingGameState {
  return {
    players: Object.fromEntries(
      setup.assignments.map((assignment) => [
        assignment.playerId,
        {
          roleId: assignment.actualRoleId,
          shownRoleId: assignment.shownRoleId,
          alignment: assignment.alignment,
          alive: true
        }
      ])
    ),
    playerOrder: [...setup.playerOrder],
    ...(firstNight.poisonTargetPlayerId
      ? { poisonTargetPlayerId: firstNight.poisonTargetPlayerId }
      : {}),
    butlerMasters: { ...firstNight.butlerMasters },
    ghostVoteUsedPlayerIds: [],
    virginSpentPlayerIds: [],
    slayerClaimUsedPlayerIds: [],
    completedNights: [],
    day: {
      number: 1,
      stage: "discussion",
      nominationRequestPlayerIds: [],
      closeRequestPlayerIds: [],
      nominatorsUsedPlayerIds: [],
      nomineesUsedPlayerIds: [],
      nominations: [],
      blockVoteCount: 0,
      blockNomineePlayerIds: [],
      publicEvents: []
    }
  };
}

export function requestNominations(
  game: TroubleBrewingGameState,
  playerId: string
): TroubleBrewingGameState {
  requireActiveGame(game);
  if (game.day.stage !== "discussion") throw new Error("当前不在白天讨论阶段");
  requireAlive(game, playerId);

  const next = cloneGame(game);
  addUnique(next.day.nominationRequestPlayerIds, playerId);
  if (next.day.nominationRequestPlayerIds.length >= majorityThreshold(next)) {
    next.day.stage = "nominations";
    next.day.publicEvents.push({ kind: "nominations-opened" });
  }
  return next;
}

export function nominatePlayer(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  nominatorPlayerId: string,
  nomineePlayerId: string,
  now: number,
  stepDurationMs = 3000
): TroubleBrewingGameState {
  requireActiveGame(game);
  if (game.day.stage !== "nominations") throw new Error("当前不能提名");
  requireAlive(game, nominatorPlayerId);
  requireAlive(game, nomineePlayerId);
  if (game.day.nominatorsUsedPlayerIds.includes(nominatorPlayerId)) {
    throw new Error("你今天已经提名过");
  }
  if (game.day.nomineesUsedPlayerIds.includes(nomineePlayerId)) {
    throw new Error("该玩家今天已经被提名过");
  }

  const next = cloneGame(game);
  next.day.nominatorsUsedPlayerIds.push(nominatorPlayerId);
  next.day.nomineesUsedPlayerIds.push(nomineePlayerId);
  next.day.closeRequestPlayerIds = [];
  next.day.publicEvents.push({
    kind: "nomination",
    nominatorPlayerId,
    nomineePlayerId
  });

  if (
    currentRole(next, nomineePlayerId) === "virgin" &&
    !next.virginSpentPlayerIds.includes(nomineePlayerId)
  ) {
    addUnique(next.virginSpentPlayerIds, nomineePlayerId);
    if (
      abilityActive(next, nomineePlayerId) &&
      registersAsTownsfolk(setup, next, nominatorPlayerId)
    ) {
      const resolved = killPlayer(setup, next, nominatorPlayerId, "execution");
      resolved.day.executedPlayerId = nominatorPlayerId;
      resolved.day.stage = "complete";
      resolved.day.publicEvents.push({
        kind: "execution",
        playerId: nominatorPlayerId,
        reason: "virgin"
      });
      return resolved;
    }
  }

  next.day.stage = "voting";
  next.day.currentVote = {
    nominatorPlayerId,
    nomineePlayerId,
    order: voteOrder(next.playerOrder, nomineePlayerId),
    cursorIndex: 0,
    nextLockAt: now + stepDurationMs,
    stepDurationMs,
    intents: {},
    lockedVotes: {}
  };
  return next;
}

export function setVoteIntent(
  game: TroubleBrewingGameState,
  playerId: string,
  voting: boolean
): TroubleBrewingGameState {
  requireActiveGame(game);
  const vote = game.day.currentVote;
  if (game.day.stage !== "voting" || !vote) throw new Error("当前没有进行中的投票");

  const voterIndex = vote.order.indexOf(playerId);
  if (voterIndex < vote.cursorIndex) throw new Error("你的投票已经锁定");
  if (!canVote(game, playerId)) throw new Error("你当前没有可用票");

  const next = cloneGame(game);
  const currentVote = requireVote(next);
  currentVote.intents[playerId] = voting;
  return next;
}

export function tickVote(
  game: TroubleBrewingGameState,
  now: number
): TroubleBrewingGameState {
  const vote = game.day.currentVote;
  if (game.day.stage !== "voting" || !vote || now < vote.nextLockAt) return game;

  const next = cloneGame(game);
  const currentVote = requireVote(next);
  while (currentVote.cursorIndex < currentVote.order.length && now >= currentVote.nextLockAt) {
    const playerId = currentVote.order[currentVote.cursorIndex];
    if (!playerId) break;
    let counted = canVote(next, playerId) && currentVote.intents[playerId] === true;

    if (counted && currentRole(next, playerId) === "butler" && abilityActive(next, playerId)) {
      const masterPlayerId = next.butlerMasters[playerId];
      counted = Boolean(
        masterPlayerId &&
          (currentVote.lockedVotes[masterPlayerId] === true ||
            currentVote.intents[masterPlayerId] === true)
      );
    }

    currentVote.lockedVotes[playerId] = counted;
    if (counted && !next.players[playerId]?.alive) {
      addUnique(next.ghostVoteUsedPlayerIds, playerId);
    }
    currentVote.cursorIndex += 1;
    currentVote.nextLockAt += currentVote.stepDurationMs;
  }

  if (currentVote.cursorIndex < currentVote.order.length) return next;
  return finishVote(next);
}

export function requestCloseNominations(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string
): TroubleBrewingGameState {
  requireActiveGame(game);
  if (game.day.stage !== "nominations") throw new Error("当前不能结束提名");
  requireAlive(game, playerId);

  const next = cloneGame(game);
  addUnique(next.day.closeRequestPlayerIds, playerId);
  if (next.day.closeRequestPlayerIds.length < majorityThreshold(next)) return next;
  return resolveDayEnd(setup, next);
}

export function useSlayerClaim(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string,
  targetPlayerId: string
): TroubleBrewingGameState {
  requireActiveGame(game);
  if (game.day.stage !== "discussion" && game.day.stage !== "nominations") {
    throw new Error("投票进行中不能发动猎手声明");
  }
  requireAlive(game, playerId);
  requireAlive(game, targetPlayerId);
  if (game.slayerClaimUsedPlayerIds.includes(playerId)) {
    throw new Error("你已经公开发动过猎手声明");
  }

  let next = cloneGame(game);
  next.slayerClaimUsedPlayerIds.push(playerId);
  let targetDied = false;
  const isRealSlayer = currentRole(next, playerId) === "slayer";
  if (isRealSlayer && abilityActive(next, playerId)) {
    const targetRole = currentRole(next, targetPlayerId);
    const recluseRegisters =
      targetRole === "recluse" &&
      randomFor(setup, `slayer:${next.day.number}:${playerId}:${targetPlayerId}`).float() < 0.65;
    if (targetRole === "imp" || recluseRegisters) {
      next = killPlayer(setup, next, targetPlayerId, "slayer");
      targetDied = true;
    }
  }

  next.day.publicEvents.push({
    kind: "slayer-claim",
    playerId,
    targetPlayerId,
    targetDied
  });
  return next;
}

export function currentVoterPlayerId(game: TroubleBrewingGameState): string | undefined {
  return game.day.currentVote?.order[game.day.currentVote.cursorIndex];
}

export function alivePlayerIds(game: TroubleBrewingGameState): string[] {
  return game.playerOrder.filter((playerId) => game.players[playerId]?.alive);
}

export function canPlayerVote(game: TroubleBrewingGameState, playerId: string): boolean {
  return canVote(game, playerId);
}

function finishVote(game: TroubleBrewingGameState): TroubleBrewingGameState {
  const next = cloneGame(game);
  const vote = requireVote(next);
  const votedPlayerIds = vote.order.filter((playerId) => vote.lockedVotes[playerId]);
  const votes = votedPlayerIds.length;
  next.day.nominations.push({
    nominatorPlayerId: vote.nominatorPlayerId,
    nomineePlayerId: vote.nomineePlayerId,
    votes,
    votedPlayerIds
  });
  next.day.publicEvents.push({
    kind: "vote-completed",
    nomineePlayerId: vote.nomineePlayerId,
    votes,
    votedPlayerIds
  });

  if (votes >= Math.ceil(alivePlayerIds(next).length / 2)) {
    if (votes > next.day.blockVoteCount) {
      next.day.blockVoteCount = votes;
      next.day.blockNomineePlayerIds = [vote.nomineePlayerId];
    } else if (votes === next.day.blockVoteCount) {
      addUnique(next.day.blockNomineePlayerIds, vote.nomineePlayerId);
    }
  }

  delete next.day.currentVote;
  next.day.stage = "nominations";
  return next;
}

function resolveDayEnd(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState
): TroubleBrewingGameState {
  const uniqueExecution =
    game.day.blockNomineePlayerIds.length === 1
      ? game.day.blockNomineePlayerIds[0]
      : undefined;

  if (uniqueExecution) {
    const next = killPlayer(setup, cloneGame(game), uniqueExecution, "execution");
    next.day.executedPlayerId = uniqueExecution;
    next.day.stage = "complete";
    next.day.publicEvents.push({
      kind: "execution",
      playerId: uniqueExecution,
      reason: "vote"
    });
    return next;
  }

  const next = cloneGame(game);
  next.day.stage = "complete";
  next.day.publicEvents.push({ kind: "execution", reason: "none" });
  if (alivePlayerIds(next).length === 3) {
    const mayor = next.playerOrder.find(
      (playerId) => currentRole(next, playerId) === "mayor" && abilityActive(next, playerId)
    );
    if (mayor) setWinner(next, "good", "三人存活且当天无人被处决，镇长获胜");
  }
  return next;
}

function killPlayer(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string,
  cause: "execution" | "slayer"
): TroubleBrewingGameState {
  const next = cloneGame(game);
  const player = next.players[playerId];
  if (!player?.alive) return next;

  const preDeathAliveCount = alivePlayerIds(next).length;
  const roleId = player.roleId;
  const saintActive = cause === "execution" && roleId === "saint" && abilityActive(next, playerId);
  player.alive = false;

  if (saintActive) {
    setWinner(next, "evil", "圣徒死于处决");
    return next;
  }

  if (roleId === "imp") {
    const scarletWomanId = next.playerOrder.find(
      (candidate) =>
        next.players[candidate]?.alive &&
        currentRole(next, candidate) === "scarletwoman" &&
        abilityActive(next, candidate)
    );
    if (preDeathAliveCount >= 5 && scarletWomanId) {
      const scarletWoman = next.players[scarletWomanId];
      if (scarletWoman) scarletWoman.roleId = "imp";
    } else {
      setWinner(next, "good", "恶魔死亡且没有成功继承");
      return next;
    }
  }

  if (alivePlayerIds(next).length <= 2 && hasLivingDemon(next)) {
    setWinner(next, "evil", "仅剩两名玩家存活");
  }
  return next;
}

function registersAsTownsfolk(
  setup: TroubleBrewingSetup,
  game: TroubleBrewingGameState,
  playerId: string
): boolean {
  const roleId = currentRole(game, playerId);
  if (ROLE_BY_ID.get(roleId)?.type === "townsfolk") return true;
  if (roleId === "spy") {
    return randomFor(
      setup,
      `virgin:${game.day.number}:${playerId}:${game.day.nomineesUsedPlayerIds.length}`
    ).float() < 0.65;
  }
  return false;
}

function abilityActive(game: TroubleBrewingGameState, playerId: string): boolean {
  const player = game.players[playerId];
  if (!player?.alive || player.roleId === "drunk") return false;
  return !isPoisoned(game, playerId);
}

function isPoisoned(game: TroubleBrewingGameState, playerId: string): boolean {
  if (game.poisonTargetPlayerId !== playerId) return false;
  return game.playerOrder.some(
    (candidate) =>
      game.players[candidate]?.alive && currentRole(game, candidate) === "poisoner"
  );
}

function canVote(game: TroubleBrewingGameState, playerId: string): boolean {
  const player = game.players[playerId];
  if (!player) return false;
  return player.alive || !game.ghostVoteUsedPlayerIds.includes(playerId);
}

function voteOrder(playerOrder: readonly string[], nomineePlayerId: string): string[] {
  const index = playerOrder.indexOf(nomineePlayerId);
  if (index < 0) throw new Error("被提名玩家不在座位顺序中");
  return [...playerOrder.slice(index), ...playerOrder.slice(0, index)];
}

function majorityThreshold(game: TroubleBrewingGameState): number {
  return Math.floor(alivePlayerIds(game).length / 2) + 1;
}

function currentRole(game: TroubleBrewingGameState, playerId: string): RoleId {
  const roleId = game.players[playerId]?.roleId;
  if (!roleId) throw new Error("玩家角色状态不存在");
  return roleId;
}

function hasLivingDemon(game: TroubleBrewingGameState): boolean {
  return game.playerOrder.some(
    (playerId) => game.players[playerId]?.alive && currentRole(game, playerId) === "imp"
  );
}

function setWinner(game: TroubleBrewingGameState, winner: Winner, reason: string): void {
  game.winner = winner;
  game.endReason = reason;
  game.day.stage = "complete";
  game.day.publicEvents.push({ kind: "game-over", winner, reason });
}

function requireAlive(game: TroubleBrewingGameState, playerId: string): void {
  if (!game.players[playerId]?.alive) throw new Error("死亡玩家不能执行该操作");
}

function requireActiveGame(game: TroubleBrewingGameState): void {
  if (game.winner) throw new Error("游戏已经结束");
}

function requireVote(game: TroubleBrewingGameState): VoteState {
  if (!game.day.currentVote) throw new Error("投票状态不存在");
  return game.day.currentVote;
}

function randomFor(setup: TroubleBrewingSetup, key: string): SeededRandom {
  return new SeededRandom(`${setup.seed}:day:${key}`);
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
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
      publicEvents: [...game.day.publicEvents]
    }
  };
}
