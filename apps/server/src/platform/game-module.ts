import type { GameCommand, GameModule } from "@party-games/game-core";
import type {
  GameType,
  PublicPlayerView,
  RoomView
} from "@party-games/shared";
import type { InternalRoomState, RoomEvent } from "../domain.js";

export type GameRoomCommand = GameCommand;

export interface GameRoomCreateContext {
  seed: string;
  now: number;
}

export interface GameRoomHandleContext {
  now: number;
  voteIntervalMs: number;
}

export interface GameRoomProjectionContext {
  playerId: string;
}

export interface GameRoomTickContext {
  now: number;
}

export interface GameRoomProjection {
  room: Partial<Omit<RoomView["room"], "players">>;
  self: Partial<Omit<RoomView["self"], "playerId" | "isOwner">>;
  playerStates: Record<string, Partial<PublicPlayerView>>;
}

export interface GameRoomUpdate {
  changes: Partial<InternalRoomState>;
  eventPayload?: Record<string, unknown>;
  event?: RoomEvent;
  clearChatMessages?: boolean;
}

export interface ServerGameModule
  extends GameModule<
    InternalRoomState,
    GameRoomCommand,
    GameRoomCreateContext,
    GameRoomHandleContext,
    GameRoomProjectionContext,
    GameRoomProjection,
    GameRoomTickContext,
    GameRoomUpdate,
    GameType
  > {
  readonly minPlayers: number;
  readonly maxPlayers: number;
}
