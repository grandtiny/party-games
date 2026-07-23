import type { GameType, RoomPhase } from "@party-games/shared";
import type {
  DayPublicEvent,
  FirstNightState,
  TroubleBrewingGameState,
  TroubleBrewingSetup
} from "@party-games/clocktower";

export const ROOM_STATE_SCHEMA_VERSION = 1;

export interface InternalPlayer {
  id: string;
  nickname: string;
  seat: number | null;
  ready: boolean;
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
    | "SLAYER_CLAIMED";
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
      : {})
  };
}
