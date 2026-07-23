import { z } from "zod";

export const GameTypeSchema = z.enum(["clocktower", "poker"]);
export type GameType = z.infer<typeof GameTypeSchema>;

export const RoomPhaseSchema = z.enum([
  "lobby",
  "role-reveal",
  "first-night",
  "day",
  "nominations",
  "voting",
  "night",
  "game-over"
]);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

export const CreateRoomRequestSchema = z.object({
  gameType: GameTypeSchema,
  nickname: z.string().trim().min(1).max(20),
  password: z.string().min(4).max(64)
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const JoinRoomRequestSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6),
  nickname: z.string().trim().min(1).max(20),
  password: z.string().min(4).max(64)
});
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;

export const RecoverRoomRequestSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6),
  recoveryCode: z.string().trim().length(6)
});
export type RecoverRoomRequest = z.infer<typeof RecoverRoomRequestSchema>;

export const RulesQuestionRequestSchema = z.object({
  question: z.string().trim().min(2).max(300)
});
export type RulesQuestionRequest = z.infer<typeof RulesQuestionRequestSchema>;

const AdminPasswordSchema = z.string().min(8).max(128);

export const AdminSetupRequestSchema = z.object({
  password: AdminPasswordSchema
});
export type AdminSetupRequest = z.infer<typeof AdminSetupRequestSchema>;

export const AdminLoginRequestSchema = z.object({
  password: AdminPasswordSchema
});
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;

export const AdminPasswordChangeRequestSchema = z.object({
  currentPassword: AdminPasswordSchema,
  newPassword: AdminPasswordSchema
});
export type AdminPasswordChangeRequest = z.infer<typeof AdminPasswordChangeRequestSchema>;

export const AdminLlmConfigUpdateRequestSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.union([z.string().trim().url().max(2048), z.literal("")]),
  model: z.string().trim().max(200),
  apiKey: z.string().trim().max(4096).optional(),
  clearApiKey: z.boolean().optional(),
  timeoutMs: z.number().int().min(1000).max(60_000)
});
export type AdminLlmConfigUpdateRequest = z.infer<typeof AdminLlmConfigUpdateRequestSchema>;

export interface AdminAuthStatusResponse {
  initialized: boolean;
  authenticated: boolean;
}

export interface AdminLlmConfigView {
  enabled: boolean;
  endpoint: string;
  model: string;
  timeoutMs: number;
  hasApiKey: boolean;
  ready: boolean;
  source: "saved" | "environment" | "none";
}

export interface AdminConfigResponse {
  databaseSchemaVersion: number;
  rulesRateLimitPerMinute: number;
  llm: AdminLlmConfigView;
}

export interface AdminLlmTestResponse {
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface RulesAnswerResponse {
  answer: string;
  source: "local" | "model";
  matchedRoleIds: string[];
  matchedRuleSectionIds: string[];
}

export interface RoomSessionResponse {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  recoveryCode: string;
}

export interface PublicPlayerView {
  id: string;
  nickname: string;
  seat: number | null;
  ready: boolean;
  connected: boolean;
  roleConfirmed?: boolean;
  alive?: boolean;
  ghostVoteAvailable?: boolean;
}

export interface ClocktowerRoleView {
  id: string;
  name: string;
  englishName: string;
  team: "good" | "evil";
  type: "townsfolk" | "outsider" | "minion" | "demon";
  ability: string;
}

export interface ClocktowerPrivateView {
  role: ClocktowerRoleView;
  alignment: "good" | "evil";
  evilTeam?: Array<{ playerId: string; nickname: string; roleName: string }>;
  demonBluffs?: ClocktowerRoleView[];
  nightAction?: ClocktowerNightActionView;
}

export interface NightPlayerView {
  playerId: string;
  nickname: string;
  seat: number;
  alive: boolean;
}

export type ClocktowerNightResultView =
  | { kind: "number"; value: number }
  | { kind: "role"; role: ClocktowerRoleView }
  | { kind: "role-pair"; role: ClocktowerRoleView; players: NightPlayerView[] }
  | { kind: "no-outsiders" }
  | { kind: "yes-no"; value: boolean }
  | {
      kind: "evil-team";
      demonPlayers: NightPlayerView[];
      minionPlayers: NightPlayerView[];
      bluffs: ClocktowerRoleView[];
    }
  | {
      kind: "grimoire";
      players: Array<
        NightPlayerView & {
          role: ClocktowerRoleView;
          shownRole?: ClocktowerRoleView;
          alive: boolean;
          redHerring: boolean;
          poisoned: boolean;
          protected: boolean;
        }
      >;
    };

export interface ClocktowerNightActionView {
  stepId: string;
  title: string;
  instruction: string;
  kind: "acknowledge" | "select-one" | "select-two";
  options?: NightPlayerView[];
  result?: ClocktowerNightResultView;
}

export type DayPublicEventView =
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
  | { kind: "game-over"; winner: "good" | "evil"; reason: string };

export interface ClocktowerTimelineEntryView {
  id: string;
  dayNumber: number;
  event: DayPublicEventView;
}

export interface ClocktowerReviewPlayerView {
  playerId: string;
  nickname: string;
  seat: number;
  initialRole: ClocktowerRoleView;
  shownRole?: ClocktowerRoleView;
  finalRole: ClocktowerRoleView;
  alignment: "good" | "evil";
  alive: boolean;
}

export interface ClocktowerNightHistoryEntryView {
  id: string;
  nightNumber: number;
  stepId: string;
  actorPlayerId: string;
  action: "acknowledge" | "select";
  selectedPlayerIds: string[];
  resultText?: string;
}

export interface ClocktowerReviewView {
  winner: "good" | "evil";
  reason: string;
  seedCommitment: string;
  players: ClocktowerReviewPlayerView[];
  timeline: ClocktowerTimelineEntryView[];
  nightHistory: ClocktowerNightHistoryEntryView[];
}

export interface ClocktowerDayView {
  stage: "discussion" | "nominations" | "voting" | "complete";
  nominationRequestPlayerIds: string[];
  closeRequestPlayerIds: string[];
  nominatorsUsedPlayerIds: string[];
  nomineesUsedPlayerIds: string[];
  slayerClaimUsedPlayerIds: string[];
  blockVoteCount: number;
  blockNomineePlayerIds: string[];
  currentVote?: {
    nominatorPlayerId: string;
    nomineePlayerId: string;
    order: string[];
    cursorIndex: number;
    currentVoterPlayerId?: string;
    nextLockAt: number;
    raisedPlayerIds: string[];
    lockedYesPlayerIds: string[];
    lockedNoPlayerIds: string[];
  };
  publicEvents: DayPublicEventView[];
  winner?: "good" | "evil";
  endReason?: string;
}

export interface DayActionPermissions {
  canRequestNominations: boolean;
  canNominate: boolean;
  canRequestClose: boolean;
  canSetVoteIntent: boolean;
  currentVoteIntent: boolean;
  canSlayerClaim: boolean;
}

export interface ChatMessageView {
  id: string;
  senderPlayerId: string;
  recipientPlayerId?: string;
  content: string;
  createdAt: string;
}

export interface RoomView {
  room: {
    code: string;
    gameType: GameType;
    phase: RoomPhase;
    ownerPlayerId: string;
    version: number;
    seedCommitment?: string;
    dayNumber?: number;
    clocktowerDay?: ClocktowerDayView;
    clocktowerReview?: ClocktowerReviewView;
    players: PublicPlayerView[];
  };
  self: {
    playerId: string;
    isOwner: boolean;
    privateGame?: ClocktowerPrivateView;
    dayActions?: DayActionPermissions;
  };
  chatMessages: ChatMessageView[];
}

export interface SocketAck {
  ok: boolean;
  error?: string;
}

export interface ClientToServerEvents {
  "room:set-ready": (ready: boolean, callback: (ack: SocketAck) => void) => void;
  "room:set-seat": (seat: number | null, callback: (ack: SocketAck) => void) => void;
  "room:start": (callback: (ack: SocketAck) => void) => void;
  "clocktower:rematch": (callback: (ack: SocketAck) => void) => void;
  "clocktower:confirm-role": (callback: (ack: SocketAck) => void) => void;
  "clocktower:night-select": (
    playerIds: string[],
    callback: (ack: SocketAck) => void
  ) => void;
  "clocktower:night-ack": (callback: (ack: SocketAck) => void) => void;
  "clocktower:request-nominations": (callback: (ack: SocketAck) => void) => void;
  "clocktower:nominate": (
    targetPlayerId: string,
    callback: (ack: SocketAck) => void
  ) => void;
  "clocktower:request-close-nominations": (callback: (ack: SocketAck) => void) => void;
  "clocktower:set-vote": (voting: boolean, callback: (ack: SocketAck) => void) => void;
  "clocktower:slayer-claim": (
    targetPlayerId: string,
    callback: (ack: SocketAck) => void
  ) => void;
  "chat:send": (
    message: { recipientPlayerId?: string; content: string },
    callback: (ack: SocketAck) => void
  ) => void;
}

export interface ServerToClientEvents {
  "room:view": (view: RoomView) => void;
  "room:error": (message: string) => void;
}

export interface SocketData {
  roomCode: string;
  playerId: string;
}
