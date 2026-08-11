import type { PokerTableState } from "@party-games/poker";
import type {
  GameType,
  PokerRoomConfig,
  RoomPhase,
  TurtleSoupAnswerView,
  TurtleSoupDifficulty
} from "@party-games/shared";
import type {
  DayPublicEvent,
  FirstNightState,
  TroubleBrewingGameState,
  TroubleBrewingSetup
} from "@party-games/clocktower";

export const ROOM_STATE_SCHEMA_VERSION = 1;

export interface InternalPlayer {
  id: string;
  accountUserId?: string;
  nickname: string;
  seat: number | null;
  ready: boolean;
  isBot?: boolean;
}

export interface InternalRoomState {
  schemaVersion: number;
  id: string;
  code: string;
  gameType: GameType;
  phase: RoomPhase;
  ownerPlayerId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  players: InternalPlayer[];
  clocktower?: {
    setup: TroubleBrewingSetup;
    seedCommitment: string;
    roleConfirmedPlayerIds: string[];
    firstNight?: FirstNightState;
    game?: TroubleBrewingGameState;
    dayNumber: number;
    timeline: Array<{ id: string; dayNumber: number; event: DayPublicEvent }>;
  } | undefined;
  poker?: {
    config: PokerRoomConfig;
    table?: PokerTableState;
    blindTimer?: PokerBlindTimerState;
    actionTimer?: PokerActionTimerState;
    runout?: PokerRunoutState;
  } | undefined;
  turtleSoupConfig?: TurtleSoupRoomConfigState | undefined;
  turtleSoup?: TurtleSoupState | undefined;
}

export interface TurtleSoupRoomConfigState {
  difficulty: TurtleSoupDifficulty;
  tags: string[];
}

export interface TurtleSoupPuzzleState {
  id: string;
  title: string;
  surface: string;
  answer: string;
  source: "model" | "local";
  maxHints: number;
  keyPoints: TurtleSoupPuzzleKeyPointState[];
  hints?: string[];
}

export interface TurtleSoupPuzzleKeyPointState {
  id: string;
  text: string;
  aliases?: string[];
}

export interface TurtleSoupState {
  puzzleId: string;
  puzzle?: TurtleSoupPuzzleState;
  judgeSource?: "model" | "local";
  status: "playing" | "solved";
  foundKeyPoints: Record<string, { playerId: string; foundAt: string }>;
  log: TurtleSoupLogEntry[];
  hintsUsed: number;
  solvedByPlayerId?: string;
  solvedAt?: string;
}

export type TurtleSoupLogEntry =
  | {
      id: string;
      kind: "question";
      actorPlayerId: string;
      content: string;
      answer: TurtleSoupAnswerView;
      note?: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "guess";
      actorPlayerId: string;
      content: string;
      matchedKeyPointIds: string[];
      wrong: boolean;
      comment: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "hint";
      actorPlayerId: string;
      content: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "system";
      content: string;
      createdAt: string;
    };

export interface PokerBlindTimerState {
  status: "running" | "paused" | "pending" | "finished";
  nextLevelAt?: number;
  remainingMs?: number;
}

export interface PokerActionTimerState {
  playerId: string;
  deadlineAt: number;
}

export interface PokerRunoutState {
  handNumber: number;
  stage: "showdown" | "dealing" | "settling";
  revealedBoardCount: number;
  revealFrom: number;
  nextStepAt: number;
  showdownHands: Record<string, [string, string]>;
}

export interface NewSession {
  playerId: string;
  tokenHash: string;
  recoveryHash: string;
}

export interface RoomEvent {
  type:
    | "ROOM_CREATED"
    | "PLAYER_JOINED"
    | "PLAYER_READY_SET"
    | "PLAYER_SEAT_SET"
    | "GAME_STARTED"
    | "GAME_RESET"
    | "ROLE_CONFIRMED"
    | "FIRST_NIGHT_SELECTION"
    | "FIRST_NIGHT_ACKNOWLEDGED"
    | "NIGHT_SELECTION"
    | "NIGHT_ACKNOWLEDGED"
    | "NOMINATIONS_REQUESTED"
    | "PLAYER_NOMINATED"
    | "NOMINATIONS_CLOSE_REQUESTED"
    | "VOTE_INTENT_SET"
    | "VOTE_TICK"
    | "SLAYER_CLAIMED"
    | "POKER_HAND_DEALT"
    | "POKER_ACTION"
    | "POKER_BOT_ACTION"
    | "POKER_ACTION_TIMEOUT"
    | "POKER_RUNOUT_ADVANCED"
    | "POKER_REBUY"
    | "POKER_CASHED_OUT"
    | "POKER_BOUGHT_IN"
    | "POKER_BLINDS_ADVANCED"
    | "POKER_BLINDS_PAUSED"
    | "POKER_BLINDS_RESUMED"
    | "POKER_BLIND_LEVEL_DUE"
    | "POKER_REMATCHED"
    | "TURTLE_SOUP_QUESTION_ASKED"
    | "TURTLE_SOUP_GUESS_SUBMITTED"
    | "TURTLE_SOUP_HINT_REQUESTED"
    | "TURTLE_SOUP_REMATCHED";
  actorPlayerId: string;
  payload: Record<string, unknown>;
}

export function migrateInternalRoomState(value: unknown): InternalRoomState {
  const state = value as InternalRoomState & {
    schemaVersion?: number;
    clocktower?: InternalRoomState["clocktower"] & {
      timeline?: NonNullable<InternalRoomState["clocktower"]>["timeline"];
    };
  };
  return {
    ...state,
    schemaVersion: ROOM_STATE_SCHEMA_VERSION,
    ...(state.clocktower
      ? {
          clocktower: {
            ...state.clocktower,
            roleConfirmedPlayerIds: state.clocktower.roleConfirmedPlayerIds ?? [],
            dayNumber:
              state.clocktower.dayNumber ?? state.clocktower.game?.day.number ?? 0,
            timeline: state.clocktower.timeline ?? [],
            ...(state.clocktower.game
              ? {
                  game: {
                    ...state.clocktower.game,
                    completedNights: state.clocktower.game.completedNights ?? []
                  }
                }
              : {})
          }
        }
      : {}),
    ...(state.poker
      ? {
          poker: {
            ...state.poker,
            config: {
              ...state.poker.config,
              ...(state.poker.config.aiPlayerCount
                ? { aiDifficulty: state.poker.config.aiDifficulty ?? "normal" }
                : {})
            }
          }
        }
      : {}),
    ...(state.turtleSoup
      ? {
          turtleSoup: {
            ...state.turtleSoup,
            judgeSource: state.turtleSoup.judgeSource ?? state.turtleSoup.puzzle?.source ?? "local",
            status: state.turtleSoup.status ?? "playing",
            foundKeyPoints: state.turtleSoup.foundKeyPoints ?? {},
            log: state.turtleSoup.log ?? [],
            hintsUsed: state.turtleSoup.hintsUsed ?? 0
          }
        }
      : {})
  };
}
