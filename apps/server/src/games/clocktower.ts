import { createHash } from "node:crypto";
import {
  acknowledgeFirstNightPrompt,
  acknowledgeOtherNightPrompt,
  canPlayerVote,
  createFirstNightState,
  createGameStateAfterFirstNight,
  createTroubleBrewingSetup,
  currentVoterPlayerId,
  getFirstNightPrompt,
  getOtherNightPrompt,
  nominatePlayer,
  requestCloseNominations,
  requestNominations,
  ROLE_BY_ID,
  setVoteIntent,
  startOtherNight,
  submitFirstNightSelection,
  submitOtherNightSelection,
  tickVote,
  useSlayerClaim,
  type FirstNightPrompt,
  type FirstNightResult,
  type OtherNightPrompt,
  type OtherNightResult,
  type RoleId,
  type TroubleBrewingGameState
} from "@party-games/clocktower";
import type {
  ClocktowerDayView,
  ClocktowerNightActionView,
  ClocktowerNightResultView,
  ClocktowerReviewView,
  ClocktowerRoleView,
  DayActionPermissions,
  NightPlayerView,
  RoomPhase,
  RoomView
} from "@party-games/shared";
import { migrateInternalRoomState, type InternalRoomState } from "../domain.js";
import type {
  GameRoomCommand,
  GameRoomCreateContext,
  GameRoomHandleContext,
  GameRoomProjection,
  GameRoomProjectionContext,
  GameRoomTickContext,
  GameRoomUpdate,
  ServerGameModule
} from "../platform/game-module.js";
import { comparePlayersBySeat } from "../platform/players.js";

export class ClocktowerGameModule implements ServerGameModule {
  readonly id = "clocktower" as const;
  readonly displayName = "血染钟楼";
  readonly minPlayers = 5;
  readonly maxPlayers = 15;

  create(state: InternalRoomState, context: GameRoomCreateContext): GameRoomUpdate {
    this.#assertClocktowerRoom(state);
    if (state.players.length < this.minPlayers || state.players.length > this.maxPlayers) {
      throw new Error(`暗流涌动需要 ${this.minPlayers} 到 ${this.maxPlayers} 名玩家`);
    }

    const orderedPlayerIds = [...state.players]
      .sort(comparePlayersBySeat)
      .map((player) => player.id);
    const setup = createTroubleBrewingSetup(orderedPlayerIds, context.seed);
    const seedCommitment = createHash("sha256")
      .update(`clocktower:${state.id}:${context.seed}`)
      .digest("hex");

    return {
      changes: {
        phase: "role-reveal",
        clocktower: {
          setup,
          seedCommitment,
          roleConfirmedPlayerIds: [],
          dayNumber: 0,
          timeline: []
        }
      },
      eventPayload: {
        seedCommitment,
        playerCount: state.players.length,
        rolesInPlay: setup.rolesInPlay
      }
    };
  }

  handle(
    state: InternalRoomState,
    command: GameRoomCommand,
    context: GameRoomHandleContext
  ): GameRoomUpdate {
    this.#assertClocktowerRoom(state);

    if (command.type === "clocktower:rematch") {
      if (state.ownerPlayerId !== command.actorPlayerId) {
        throw new Error("只有房主可以发起再来一局");
      }
      if (state.phase !== "game-over") throw new Error("当前对局尚未结束");
      return {
        changes: {
          phase: "lobby",
          players: state.players.map((player) => ({ ...player, ready: false })),
          clocktower: undefined
        },
        clearChatMessages: true
      };
    }

    const clocktower = state.clocktower;
    if (!clocktower) throw new Error("血染钟楼状态不存在");

    if (command.type === "clocktower:confirm-role") {
      if (state.phase !== "role-reveal") throw new Error("当前不能确认身份");
      if (clocktower.roleConfirmedPlayerIds.includes(command.actorPlayerId)) {
        return { changes: {} };
      }

      const roleConfirmedPlayerIds = [
        ...clocktower.roleConfirmedPlayerIds,
        command.actorPlayerId
      ];
      if (roleConfirmedPlayerIds.length < state.players.length) {
        return {
          changes: { clocktower: { ...clocktower, roleConfirmedPlayerIds } }
        };
      }

      const firstNight = createFirstNightState(clocktower.setup);
      const game = firstNight.complete
        ? createGameStateAfterFirstNight(clocktower.setup, firstNight)
        : undefined;
      return {
        changes: {
          phase: firstNight.complete ? "day" : "first-night",
          clocktower: {
            ...clocktower,
            roleConfirmedPlayerIds,
            firstNight,
            ...(game ? { game } : {}),
            dayNumber: firstNight.complete ? 1 : 0
          }
        }
      };
    }

    if (command.type === "clocktower:night-select") {
      const selectedPlayerIds = this.#stringArrayPayload(
        command.payload,
        "selectedPlayerIds"
      );
      if (state.phase === "first-night" && clocktower.firstNight) {
        const firstNight = submitFirstNightSelection(
          clocktower.setup,
          clocktower.firstNight,
          command.actorPlayerId,
          selectedPlayerIds
        );
        const game = firstNight.complete
          ? createGameStateAfterFirstNight(clocktower.setup, firstNight)
          : undefined;
        return {
          changes: {
            phase: firstNight.complete ? "day" : "first-night",
            clocktower: {
              ...clocktower,
              firstNight,
              ...(game ? { game } : {}),
              dayNumber: firstNight.complete ? 1 : clocktower.dayNumber
            }
          }
        };
      }

      if (state.phase !== "night" || !clocktower.game?.night) {
        throw new Error("当前没有可提交的夜间行动");
      }
      const game = submitOtherNightSelection(
        clocktower.setup,
        clocktower.game,
        command.actorPlayerId,
        selectedPlayerIds
      );
      return this.#gameUpdate(state, game);
    }

    if (command.type === "clocktower:night-ack") {
      if (state.phase === "first-night" && clocktower.firstNight) {
        const firstNight = acknowledgeFirstNightPrompt(
          clocktower.setup,
          clocktower.firstNight,
          command.actorPlayerId
        );
        const game = firstNight.complete
          ? createGameStateAfterFirstNight(clocktower.setup, firstNight)
          : undefined;
        return {
          changes: {
            phase: firstNight.complete ? "day" : "first-night",
            clocktower: {
              ...clocktower,
              firstNight,
              ...(game ? { game } : {}),
              dayNumber: firstNight.complete ? 1 : clocktower.dayNumber
            }
          }
        };
      }

      if (state.phase !== "night" || !clocktower.game?.night) {
        throw new Error("当前没有需要确认的夜间信息");
      }
      const game = acknowledgeOtherNightPrompt(
        clocktower.setup,
        clocktower.game,
        command.actorPlayerId
      );
      return this.#gameUpdate(state, game);
    }

    const game = clocktower.game;
    if (!game) throw new Error("白天游戏状态尚未初始化");
    let nextGame: TroubleBrewingGameState;

    if (command.type === "clocktower:request-nominations") {
      nextGame = requestNominations(game, command.actorPlayerId);
    } else if (command.type === "clocktower:nominate") {
      nextGame = nominatePlayer(
        clocktower.setup,
        game,
        command.actorPlayerId,
        this.#stringPayload(command.payload, "targetPlayerId"),
        context.now,
        context.voteIntervalMs
      );
    } else if (command.type === "clocktower:request-close-nominations") {
      nextGame = requestCloseNominations(
        clocktower.setup,
        game,
        command.actorPlayerId
      );
    } else if (command.type === "clocktower:set-vote") {
      nextGame = setVoteIntent(
        game,
        command.actorPlayerId,
        this.#booleanPayload(command.payload, "voting")
      );
    } else if (command.type === "clocktower:slayer-claim") {
      nextGame = useSlayerClaim(
        clocktower.setup,
        game,
        command.actorPlayerId,
        this.#stringPayload(command.payload, "targetPlayerId")
      );
    } else {
      throw new Error(`血染钟楼命令不受支持: ${command.type}`);
    }

    if (!nextGame.winner && nextGame.day.stage === "complete" && !nextGame.night) {
      nextGame = startOtherNight(clocktower.setup, nextGame);
    }
    return this.#gameUpdate(state, nextGame);
  }

  project(
    state: InternalRoomState,
    context: GameRoomProjectionContext
  ): GameRoomProjection {
    this.#assertClocktowerRoom(state);
    const clocktower = state.clocktower;
    if (!clocktower) return { room: {}, self: {}, playerStates: {} };

    let privateGame: RoomView["self"]["privateGame"];
    if (state.phase !== "lobby") {
      const assignment = clocktower.setup.assignments.find(
        (candidate) => candidate.playerId === context.playerId
      );
      if (!assignment) throw new Error("玩家身份尚未分配");
      const currentPlayerState = clocktower.game?.players[context.playerId];
      const visibleRoleId =
        currentPlayerState && currentPlayerState.roleId !== assignment.actualRoleId
          ? currentPlayerState.roleId
          : assignment.shownRoleId;
      const shownRole = ROLE_BY_ID.get(visibleRoleId as RoleId);
      if (!shownRole) throw new Error("角色资料不存在");
      const firstNightPrompt =
        state.phase === "first-night" && clocktower.firstNight
          ? getFirstNightPrompt(clocktower.setup, clocktower.firstNight, context.playerId)
          : undefined;
      const otherNightPrompt =
        state.phase === "night" && clocktower.game
          ? getOtherNightPrompt(clocktower.setup, clocktower.game, context.playerId)
          : undefined;
      const nightPrompt = firstNightPrompt ?? otherNightPrompt;
      privateGame = {
        role: {
          id: shownRole.id,
          name: shownRole.name,
          englishName: shownRole.englishName,
          team: currentPlayerState?.alignment ?? assignment.alignment,
          type: shownRole.type,
          ability: shownRole.ability
        },
        alignment: currentPlayerState?.alignment ?? assignment.alignment,
        ...(nightPrompt ? { nightAction: this.#nightActionView(state, nightPrompt) } : {})
      };
    }

    const game = clocktower.game;
    const dayActions = game
      ? this.#dayActionPermissions(game, context.playerId)
      : undefined;
    const review = state.phase === "game-over" ? this.#reviewView(state) : undefined;
    const playerStates = Object.fromEntries(
      state.players.map((player) => [
        player.id,
        {
          roleConfirmed: clocktower.roleConfirmedPlayerIds.includes(player.id),
          ...(game
            ? {
                alive: game.players[player.id]?.alive ?? false,
                ghostVoteAvailable:
                  game.players[player.id]?.alive === false &&
                  !game.ghostVoteUsedPlayerIds.includes(player.id)
              }
            : {})
        }
      ])
    );

    return {
      room: {
        seedCommitment: clocktower.seedCommitment,
        ...(clocktower.dayNumber ? { dayNumber: clocktower.dayNumber } : {}),
        ...(game ? { clocktowerDay: this.#dayView(game) } : {}),
        ...(review ? { clocktowerReview: review } : {})
      },
      self: {
        ...(privateGame ? { privateGame } : {}),
        ...(dayActions ? { dayActions } : {})
      },
      playerStates
    };
  }

  tick(state: InternalRoomState, context: GameRoomTickContext): GameRoomUpdate | undefined {
    this.#assertClocktowerRoom(state);
    if (state.phase !== "voting" || !state.clocktower?.game) return undefined;
    const game = tickVote(state.clocktower.game, context.now);
    if (game === state.clocktower.game) return undefined;
    return {
      ...this.#gameUpdate(state, game),
      event: {
        type: "VOTE_TICK",
        actorPlayerId: "system",
        payload: {
          cursorIndex: game.day.currentVote?.cursorIndex ?? null,
          stage: game.day.stage
        }
      }
    };
  }

  migrate(value: unknown): InternalRoomState {
    return migrateInternalRoomState(value);
  }

  validate(state: InternalRoomState): void {
    this.#assertClocktowerRoom(state);
    const clocktower = state.clocktower;
    if (!clocktower) {
      if (state.phase !== "lobby") throw new Error("非大厅阶段缺少血染钟楼状态");
      return;
    }

    const playerIds = new Set(state.players.map((player) => player.id));
    const assignmentIds = clocktower.setup.assignments.map((assignment) => assignment.playerId);
    if (assignmentIds.length !== state.players.length || new Set(assignmentIds).size !== assignmentIds.length) {
      throw new Error("血染钟楼身份分配与房间玩家不一致");
    }
    if (assignmentIds.some((playerId) => !playerIds.has(playerId))) {
      throw new Error("血染钟楼身份包含未知玩家");
    }
    if (clocktower.roleConfirmedPlayerIds.some((playerId) => !playerIds.has(playerId))) {
      throw new Error("身份确认列表包含未知玩家");
    }
    if (
      clocktower.game?.playerOrder.some(
        (playerId) => !playerIds.has(playerId) || !clocktower.game?.players[playerId]
      )
    ) {
      throw new Error("血染钟楼对局状态包含未知玩家");
    }
  }

  #assertClocktowerRoom(state: InternalRoomState): void {
    if (state.gameType !== this.id) throw new Error("房间与血染钟楼模块不匹配");
  }

  #gameUpdate(state: InternalRoomState, game: TroubleBrewingGameState): GameRoomUpdate {
    return {
      changes: {
        phase: this.#phaseForGame(game),
        clocktower: this.#clocktowerWithGame(state, game)
      }
    };
  }

  #phaseForGame(game: TroubleBrewingGameState): RoomPhase {
    if (game.winner) return "game-over";
    if (game.night) return "night";
    if (game.day.stage === "discussion") return "day";
    if (game.day.stage === "nominations") return "nominations";
    if (game.day.stage === "voting") return "voting";
    return "night";
  }

  #dayView(game: TroubleBrewingGameState): ClocktowerDayView {
    const vote = game.day.currentVote;
    const lockedPlayerIds = vote?.order.slice(0, vote.cursorIndex) ?? [];
    const currentVoter = currentVoterPlayerId(game);
    return {
      stage: game.day.stage,
      nominationRequestPlayerIds: [...game.day.nominationRequestPlayerIds],
      closeRequestPlayerIds: [...game.day.closeRequestPlayerIds],
      nominatorsUsedPlayerIds: [...game.day.nominatorsUsedPlayerIds],
      nomineesUsedPlayerIds: [...game.day.nomineesUsedPlayerIds],
      slayerClaimUsedPlayerIds: [...game.slayerClaimUsedPlayerIds],
      blockVoteCount: game.day.blockVoteCount,
      blockNomineePlayerIds: [...game.day.blockNomineePlayerIds],
      ...(vote
        ? {
            currentVote: {
              nominatorPlayerId: vote.nominatorPlayerId,
              nomineePlayerId: vote.nomineePlayerId,
              order: [...vote.order],
              cursorIndex: vote.cursorIndex,
              ...(currentVoter ? { currentVoterPlayerId: currentVoter } : {}),
              nextLockAt: vote.nextLockAt,
              raisedPlayerIds: vote.order.filter(
                (playerId, index) => index >= vote.cursorIndex && vote.intents[playerId]
              ),
              lockedYesPlayerIds: lockedPlayerIds.filter(
                (playerId) => vote.lockedVotes[playerId]
              ),
              lockedNoPlayerIds: lockedPlayerIds.filter(
                (playerId) => !vote.lockedVotes[playerId]
              )
            }
          }
        : {}),
      publicEvents: [...game.day.publicEvents],
      ...(game.winner ? { winner: game.winner } : {}),
      ...(game.endReason ? { endReason: game.endReason } : {})
    };
  }

  #clocktowerWithGame(
    state: InternalRoomState,
    game: TroubleBrewingGameState
  ): NonNullable<InternalRoomState["clocktower"]> {
    const clocktower = state.clocktower;
    if (!clocktower) throw new Error("血染钟楼状态不存在");
    const before = clocktower.game;
    const newEvents = !before
      ? game.day.publicEvents
      : game.day.number === before.day.number
        ? game.day.publicEvents.slice(before.day.publicEvents.length)
        : game.day.publicEvents;
    return {
      ...clocktower,
      game,
      dayNumber: game.day.number,
      timeline: [
        ...clocktower.timeline,
        ...newEvents.map((event, index) => ({
          id: `${state.version + 1}:${index}`,
          dayNumber: game.day.number,
          event: structuredClone(event)
        }))
      ]
    };
  }

  #reviewView(state: InternalRoomState): ClocktowerReviewView | undefined {
    const clocktower = state.clocktower;
    const game = clocktower?.game;
    if (!clocktower || !game?.winner || !game.endReason) return undefined;

    const players = [...state.players].sort(comparePlayersBySeat).map((player) => {
      if (player.seat === null) throw new Error("结束对局中的玩家缺少座位");
      const assignment = clocktower.setup.assignments.find(
        (candidate) => candidate.playerId === player.id
      );
      const finalState = game.players[player.id];
      if (!assignment || !finalState) throw new Error("结束对局身份状态不存在");
      const shownRole =
        assignment.shownRoleId !== assignment.actualRoleId
          ? this.#roleView(assignment.shownRoleId)
          : undefined;
      return {
        playerId: player.id,
        nickname: player.nickname,
        seat: player.seat,
        initialRole: this.#roleView(assignment.actualRoleId),
        ...(shownRole ? { shownRole } : {}),
        finalRole: this.#roleView(finalState.roleId),
        alignment: finalState.alignment,
        alive: finalState.alive
      };
    });

    const firstNightEntries = (clocktower.firstNight?.history ?? []).map((entry, index) => ({
      id: `first:${index}`,
      nightNumber: 0,
      stepId: entry.stepId,
      actorPlayerId: entry.playerId,
      action: entry.action,
      selectedPlayerIds: [...(entry.selectedPlayerIds ?? [])],
      ...(entry.result ? { resultText: this.#nightHistoryResultText(entry.result) } : {})
    }));
    const otherNightEntries = game.completedNights.flatMap((night) =>
      night.entries.map((entry, index) => ({
        id: `night:${night.number}:${index}`,
        nightNumber: night.number,
        stepId: entry.stepId,
        actorPlayerId: entry.playerId,
        action: entry.action,
        selectedPlayerIds: [...(entry.selectedPlayerIds ?? [])],
        ...(entry.result ? { resultText: this.#nightHistoryResultText(entry.result) } : {})
      }))
    );

    return {
      winner: game.winner,
      reason: game.endReason,
      seedCommitment: clocktower.seedCommitment,
      players,
      timeline: clocktower.timeline.map((entry) => ({
        id: entry.id,
        dayNumber: entry.dayNumber,
        event: structuredClone(entry.event)
      })),
      nightHistory: [...firstNightEntries, ...otherNightEntries]
    };
  }

  #nightHistoryResultText(result: FirstNightResult | OtherNightResult): string {
    if (result.kind === "number") return `得到数字 ${result.value}`;
    if (result.kind === "yes-no") return result.value ? "得到肯定信息" : "得到否定信息";
    if (result.kind === "role") return `得知角色：${this.#roleView(result.roleId).name}`;
    if (result.kind === "role-pair") {
      return `得知角色线索：${this.#roleView(result.roleId).name}`;
    }
    if (result.kind === "no-outsiders") return "得知场上没有外来者";
    if (result.kind === "evil-team") return "确认邪恶阵营成员和恶魔伪装角色";
    return "查看魔典";
  }

  #dayActionPermissions(
    game: TroubleBrewingGameState,
    playerId: string
  ): DayActionPermissions {
    const player = game.players[playerId];
    const alive = player?.alive === true;
    const vote = game.day.currentVote;
    const voterIndex = vote?.order.indexOf(playerId) ?? -1;
    return {
      canRequestNominations:
        alive &&
        game.day.stage === "discussion" &&
        !game.day.nominationRequestPlayerIds.includes(playerId),
      canNominate:
        alive &&
        game.day.stage === "nominations" &&
        !game.day.nominatorsUsedPlayerIds.includes(playerId),
      canRequestClose:
        alive &&
        game.day.stage === "nominations" &&
        !game.day.closeRequestPlayerIds.includes(playerId),
      canSetVoteIntent:
        game.day.stage === "voting" &&
        Boolean(vote) &&
        voterIndex >= (vote?.cursorIndex ?? Number.POSITIVE_INFINITY) &&
        canPlayerVote(game, playerId),
      currentVoteIntent: vote?.intents[playerId] === true,
      canSlayerClaim:
        alive &&
        (game.day.stage === "discussion" || game.day.stage === "nominations") &&
        !game.slayerClaimUsedPlayerIds.includes(playerId)
    };
  }

  #nightActionView(
    state: InternalRoomState,
    prompt: FirstNightPrompt | OtherNightPrompt
  ): ClocktowerNightActionView {
    return {
      stepId: prompt.stepId,
      title: prompt.title,
      instruction: prompt.instruction,
      kind: prompt.kind,
      ...(prompt.allowedPlayerIds
        ? {
            options: prompt.allowedPlayerIds.map((playerId) =>
              this.#nightPlayerView(state, playerId)
            )
          }
        : {}),
      ...(prompt.result ? { result: this.#nightResultView(state, prompt.result) } : {})
    };
  }

  #nightResultView(
    state: InternalRoomState,
    result: FirstNightResult | OtherNightResult
  ): ClocktowerNightResultView {
    if (result.kind === "number" || result.kind === "no-outsiders" || result.kind === "yes-no") {
      return result;
    }
    if (result.kind === "role") {
      return { kind: "role", role: this.#roleView(result.roleId) };
    }
    if (result.kind === "role-pair") {
      return {
        kind: result.kind,
        role: this.#roleView(result.roleId),
        players: result.playerIds.map((playerId) => this.#nightPlayerView(state, playerId))
      };
    }
    if (result.kind === "evil-team") {
      return {
        kind: result.kind,
        demonPlayers: result.demonPlayerIds.map((playerId) =>
          this.#nightPlayerView(state, playerId)
        ),
        minionPlayers: result.minionPlayerIds.map((playerId) =>
          this.#nightPlayerView(state, playerId)
        ),
        bluffs: result.bluffRoleIds.map((roleId) => this.#roleView(roleId))
      };
    }

    if (result.kind === "current-grimoire") {
      const clocktower = state.clocktower;
      const game = clocktower?.game;
      if (!clocktower || !game) throw new Error("当前魔典状态不存在");
      return {
        kind: "grimoire",
        players: game.playerOrder
          .map((playerId) => {
            const player = game.players[playerId];
            const assignment = clocktower.setup.assignments.find(
              (candidate) => candidate.playerId === playerId
            );
            if (!player || !assignment) throw new Error("魔典玩家状态不存在");
            const shownRole =
              player.roleId === "drunk" && player.shownRoleId !== player.roleId
                ? this.#roleView(player.shownRoleId)
                : undefined;
            return {
              ...this.#nightPlayerView(state, playerId),
              role: this.#roleView(player.roleId),
              ...(shownRole ? { shownRole } : {}),
              alive: player.alive,
              redHerring: clocktower.setup.redHerringPlayerId === playerId,
              poisoned: result.poisonTargetPlayerId === playerId,
              protected: result.monkProtectedPlayerId === playerId
            };
          })
          .sort((left, right) => left.seat - right.seat)
      };
    }

    return {
      kind: "grimoire",
      players: result.assignments
        .map((assignment) => {
          const shownRole =
            assignment.shownRoleId !== assignment.actualRoleId
              ? this.#roleView(assignment.shownRoleId)
              : undefined;
          return {
            ...this.#nightPlayerView(state, assignment.playerId),
            role: this.#roleView(assignment.actualRoleId),
            ...(shownRole ? { shownRole } : {}),
            alive: true,
            redHerring: result.redHerringPlayerId === assignment.playerId,
            poisoned: result.poisonTargetPlayerId === assignment.playerId,
            protected: false
          };
        })
        .sort((left, right) => left.seat - right.seat)
    };
  }

  #nightPlayerView(state: InternalRoomState, playerId: string): NightPlayerView {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error("夜间目标玩家不存在");
    if (player.seat === null) throw new Error("游戏玩家缺少座位");
    return {
      playerId,
      nickname: player.nickname,
      seat: player.seat,
      alive: state.clocktower?.game?.players[playerId]?.alive ?? true
    };
  }

  #roleView(roleId: RoleId): ClocktowerRoleView {
    const role = ROLE_BY_ID.get(roleId);
    if (!role) throw new Error(`角色资料不存在: ${roleId}`);
    return {
      id: role.id,
      name: role.name,
      englishName: role.englishName,
      team: role.alignment,
      type: role.type,
      ability: role.ability
    };
  }

  #stringPayload(payload: Record<string, unknown>, key: string): string {
    const value = payload[key];
    if (typeof value !== "string") throw new Error(`命令参数无效: ${key}`);
    return value;
  }

  #booleanPayload(payload: Record<string, unknown>, key: string): boolean {
    const value = payload[key];
    if (typeof value !== "boolean") throw new Error(`命令参数无效: ${key}`);
    return value;
  }

  #stringArrayPayload(payload: Record<string, unknown>, key: string): string[] {
    const value = payload[key];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new Error(`命令参数无效: ${key}`);
    }
    return value;
  }
}
