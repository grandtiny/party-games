import type { GameType, RoomPhase } from "@party-games/shared";
import type {
  FirstNightState,
  TroubleBrewingGameState,
  TroubleBrewingSetup
} from "@party-games/clocktower";

export interface InternalPlayer {
  id: string;
  nickname: string;
  seat: number | null;
  ready: boolean;
}

export interface InternalRoomState {
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
  };
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
