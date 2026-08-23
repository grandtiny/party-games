import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { ManorV7State } from "@party-games/manor-v7";
import type {
  GameType,
  GomokuAiDifficultyValue,
  GomokuGameStatePayload,
  GomokuMatchModeValue,
  GomokuRuleSetValue,
  GomokuStoneValue,
  RoomPhase
} from "@party-games/shared";
import {
  migrateInternalRoomState,
  type InternalRoomState,
  type NewSession,
  type RoomEvent
} from "./domain.js";

interface RoomRow {
  id: string;
  code: string;
  game_type: GameType;
  password_salt: string;
  password_hash: string;
  state_json: string;
  version: number;
}

interface SessionRow {
  player_id: string;
  room_id: string;
}

const DATABASE_MIGRATIONS: ReadonlyArray<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        game_type TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        state_json TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS room_events (
        room_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        actor_player_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (room_id, sequence),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS player_sessions (
        player_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        recovery_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (room_id, recovery_hash),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_player_sessions_room
        ON player_sessions(room_id);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_player_id TEXT NOT NULL,
        recipient_player_id TEXT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
        ON chat_messages(room_id, created_at);
    `
  },
  {
    version: 2,
    sql: `
      CREATE INDEX IF NOT EXISTS idx_room_events_room_type
        ON room_events(room_id, event_type);
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS admin_credentials (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        display_name TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_account_sessions_user
        ON account_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_account_sessions_expires
        ON account_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS account_invites (
        id TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        created_by_user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_by_user_id TEXT,
        used_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_account_invites_creator
        ON account_invites(created_by_user_id, created_at);

      CREATE TABLE IF NOT EXISTS puzzle_results (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        game TEXT NOT NULL CHECK (game IN ('minesweeper', 'sudoku')),
        difficulty TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss')),
        elapsed_seconds INTEGER NOT NULL,
        mistakes INTEGER NOT NULL DEFAULT 0,
        hints INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_puzzle_results_user_created
        ON puzzle_results(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_puzzle_results_ranking
        ON puzzle_results(game, difficulty, outcome, elapsed_seconds);
    `
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS gomoku_matches (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        rule_set TEXT NOT NULL CHECK (rule_set IN ('freestyle', 'renju')),
        mode TEXT NOT NULL CHECK (mode IN ('ai', 'local')),
        ai_difficulty TEXT CHECK (ai_difficulty IN ('easy', 'normal', 'hard')),
        human_color TEXT CHECK (human_color IN ('black', 'white')),
        winner TEXT NOT NULL CHECK (winner IN ('black', 'white', 'draw')),
        outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw', 'local')),
        result_reason TEXT NOT NULL CHECK (result_reason IN ('five', 'board-full', 'resign')),
        elapsed_seconds INTEGER NOT NULL,
        move_count INTEGER NOT NULL,
        assisted INTEGER NOT NULL CHECK (assisted IN (0, 1)),
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, game_id)
      );

      CREATE INDEX IF NOT EXISTS idx_gomoku_matches_user_created
        ON gomoku_matches(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS gomoku_progress (
        user_id TEXT NOT NULL,
        content_type TEXT NOT NULL CHECK (content_type IN ('puzzle', 'lesson')),
        content_id TEXT NOT NULL,
        stars INTEGER NOT NULL DEFAULT 0,
        best_moves INTEGER NOT NULL DEFAULT 0,
        hints_used INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, content_type, content_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS gomoku_saves (
        user_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS manor_farms (
        user_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 7,
    sql: `
      CREATE TABLE IF NOT EXISTS manor_guestbook_messages (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        sender_user_id TEXT NOT NULL,
        reply_to_id TEXT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to_id) REFERENCES manor_guestbook_messages(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_manor_guestbook_owner_created
        ON manor_guestbook_messages(owner_user_id, created_at DESC, id DESC);
    `
  },
  {
    version: 8,
    sql: `
      CREATE TABLE IF NOT EXISTS manor_v7_states (
        user_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 9,
    sql: `
      DROP TABLE IF EXISTS manor_farms;
    `
  }
];

export interface StoredChatMessage {
  id: string;
  senderPlayerId: string;
  recipientPlayerId?: string;
  content: string;
  createdAt: string;
}

export interface StoredAccountUser {
  id: string;
  username: string;
  displayName: string;
  password: { salt: string; hash: string };
  role: "owner" | "member";
  createdAt: string;
}

export interface StoredAccountInvite {
  id: string;
  expiresAt: string;
  createdAt: string;
  usedByDisplayName?: string;
  usedAt?: string;
  revokedAt?: string;
}

export interface StoredPuzzleResult {
  id: string;
  userId: string;
  displayName: string;
  game: "minesweeper" | "sudoku";
  difficulty: string;
  outcome: "win" | "loss";
  elapsedSeconds: number;
  mistakes: number;
  hints: number;
  createdAt: string;
}

export interface StoredGomokuMatch {
  id: string;
  userId: string;
  gameId: string;
  ruleSet: GomokuRuleSetValue;
  mode: GomokuMatchModeValue;
  aiDifficulty?: GomokuAiDifficultyValue;
  humanColor?: GomokuStoneValue;
  winner: "black" | "white" | "draw";
  outcome: "win" | "loss" | "draw" | "local";
  resultReason: "five" | "board-full" | "resign";
  elapsedSeconds: number;
  moveCount: number;
  assisted: boolean;
  state: GomokuGameStatePayload;
  createdAt: string;
}

export interface StoredGomokuProgress {
  contentType: "puzzle" | "lesson";
  contentId: string;
  stars: number;
  bestMoves: number;
  hintsUsed: number;
  completedAt: string;
  updatedAt: string;
}

export interface StoredGomokuSave {
  state: GomokuGameStatePayload;
  updatedAt: string;
}

export interface StoredManorAccount {
  id: string;
  displayName: string;
}

export interface StoredManorGuestbookMessage {
  id: string;
  senderUserId: string;
  senderDisplayName: string;
  content: string;
  createdAt: string;
  replyTo?: {
    id: string;
    senderDisplayName: string;
    content: string;
  };
}

export class SqliteRoomRepository {
  readonly #database: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.#database = new DatabaseSync(databasePath);
    this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    this.#applyMigrations();
    this.cleanupExpiredChats();
  }

  roomCodeExists(code: string): boolean {
    const row = this.#database
      .prepare("SELECT 1 AS found FROM rooms WHERE code = ?")
      .get(code) as { found: number } | undefined;
    return row?.found === 1;
  }

  createRoom(
    state: InternalRoomState,
    password: { salt: string; hash: string },
    session: NewSession,
    event: RoomEvent
  ): void {
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO rooms (
            id, code, game_type, password_salt, password_hash,
            state_json, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          state.id,
          state.code,
          state.gameType,
          password.salt,
          password.hash,
          JSON.stringify(state),
          state.version,
          state.createdAt,
          state.updatedAt
        );
      this.#insertSession(state.id, session, now);
      this.#insertEvent(state.id, state.version, event, now);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  getRoom(code: string): InternalRoomState | undefined {
    const row = this.#database
      .prepare("SELECT state_json FROM rooms WHERE code = ?")
      .get(code) as { state_json: string } | undefined;
    return row ? migrateInternalRoomState(JSON.parse(row.state_json)) : undefined;
  }

  listRoomCodes(phase?: RoomPhase): string[] {
    const rows = phase
      ? this.#database
          .prepare(
            "SELECT code FROM rooms WHERE json_extract(state_json, '$.phase') = ? ORDER BY created_at"
          )
          .all(phase)
      : this.#database.prepare("SELECT code FROM rooms ORDER BY created_at").all();
    return (rows as Array<{ code: string }>).map((row) => row.code);
  }

  getPassword(code: string): { salt: string; hash: string } | undefined {
    const row = this.#database
      .prepare("SELECT password_salt, password_hash FROM rooms WHERE code = ?")
      .get(code) as Pick<RoomRow, "password_salt" | "password_hash"> | undefined;
    return row ? { salt: row.password_salt, hash: row.password_hash } : undefined;
  }

  commit(
    previousVersion: number,
    nextState: InternalRoomState,
    event: RoomEvent,
    options?: { newSession?: NewSession; clearChatMessages?: boolean }
  ): void {
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database
        .prepare(`
          UPDATE rooms
          SET state_json = ?, version = ?, updated_at = ?
          WHERE id = ? AND version = ?
        `)
        .run(
          JSON.stringify(nextState),
          nextState.version,
          nextState.updatedAt,
          nextState.id,
          previousVersion
        );

      if (Number(result.changes) !== 1) {
        throw new Error("Room state changed concurrently");
      }

      if (options?.newSession) {
        this.#insertSession(nextState.id, options.newSession, now);
      }
      if (options?.clearChatMessages) {
        this.#database.prepare("DELETE FROM chat_messages WHERE room_id = ?").run(nextState.id);
      }
      this.#insertEvent(nextState.id, nextState.version, event, now);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  findSessionByToken(tokenHash: string): SessionRow | undefined {
    return this.#database
      .prepare("SELECT player_id, room_id FROM player_sessions WHERE token_hash = ?")
      .get(tokenHash) as SessionRow | undefined;
  }

  findSessionByRecovery(code: string, recoveryHash: string): SessionRow | undefined {
    return this.#database
      .prepare(`
        SELECT sessions.player_id, sessions.room_id
        FROM player_sessions sessions
        JOIN rooms ON rooms.id = sessions.room_id
        WHERE rooms.code = ? AND sessions.recovery_hash = ?
      `)
      .get(code, recoveryHash) as SessionRow | undefined;
  }

  rotateSessionToken(playerId: string, tokenHash: string): void {
    const result = this.#database
      .prepare(`
        UPDATE player_sessions
        SET token_hash = ?, updated_at = ?
        WHERE player_id = ?
      `)
      .run(tokenHash, new Date().toISOString(), playerId);
    if (Number(result.changes) !== 1) {
      throw new Error("Player session was not found");
    }
  }

  addChatMessage(
    roomId: string,
    message: {
      id: string;
      senderPlayerId: string;
      recipientPlayerId?: string;
      content: string;
      createdAt: string;
    }
  ): void {
    this.cleanupExpiredChats();
    this.#database
      .prepare(`
        INSERT INTO chat_messages (
          id, room_id, sender_player_id, recipient_player_id, content, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        message.id,
        roomId,
        message.senderPlayerId,
        message.recipientPlayerId ?? null,
        message.content,
        message.createdAt
      );
  }

  getVisibleChatMessages(roomId: string, playerId: string): StoredChatMessage[] {
    const rows = this.#database
      .prepare(`
        SELECT * FROM (
          SELECT
            id,
            sender_player_id,
            recipient_player_id,
            content,
            created_at
          FROM chat_messages
          WHERE room_id = ?
            AND (
              recipient_player_id IS NULL
              OR sender_player_id = ?
              OR recipient_player_id = ?
            )
          ORDER BY created_at DESC
          LIMIT 100
        )
        ORDER BY created_at ASC
      `)
      .all(roomId, playerId, playerId) as Array<{
      id: string;
      sender_player_id: string;
      recipient_player_id: string | null;
      content: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      senderPlayerId: row.sender_player_id,
      ...(row.recipient_player_id ? { recipientPlayerId: row.recipient_player_id } : {}),
      content: row.content,
      createdAt: row.created_at
    }));
  }

  cleanupExpiredChats(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    this.#database.prepare("DELETE FROM chat_messages WHERE created_at < ?").run(cutoff);
  }

  hasAccountUsers(): boolean {
    const row = this.#database
      .prepare("SELECT 1 AS found FROM users LIMIT 1")
      .get() as { found: number } | undefined;
    return row?.found === 1;
  }

  accountUsernameExists(username: string): boolean {
    const row = this.#database
      .prepare("SELECT 1 AS found FROM users WHERE username = ? COLLATE NOCASE")
      .get(username) as { found: number } | undefined;
    return row?.found === 1;
  }

  createInitialAccountUser(
    user: {
      id: string;
      username: string;
      displayName: string;
      password: { salt: string; hash: string };
    },
    session: { id: string; tokenHash: string; expiresAt: string }
  ): boolean {
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.#database
        .prepare("SELECT 1 AS found FROM users LIMIT 1")
        .get() as { found: number } | undefined;
      if (existing) {
        this.#database.exec("ROLLBACK");
        return false;
      }
      this.#insertAccountUser({ ...user, role: "owner" }, now);
      this.#insertAccountSession(user.id, session, now);
      this.#database.exec("COMMIT");
      return true;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  createInvitedAccountUser(
    user: {
      id: string;
      username: string;
      displayName: string;
      password: { salt: string; hash: string };
    },
    session: { id: string; tokenHash: string; expiresAt: string },
    inviteCodeHash: string
  ): void {
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const invite = this.#database
        .prepare(`
          SELECT id, expires_at, used_at, revoked_at
          FROM account_invites
          WHERE code_hash = ?
        `)
        .get(inviteCodeHash) as
        | {
            id: string;
            expires_at: string;
            used_at: string | null;
            revoked_at: string | null;
          }
        | undefined;
      if (!invite) throw new Error("邀请码无效");
      if (invite.revoked_at) throw new Error("邀请码已撤销");
      if (invite.used_at) throw new Error("邀请码已使用");
      if (invite.expires_at <= now) throw new Error("邀请码已过期");

      this.#insertAccountUser({ ...user, role: "member" }, now);
      this.#insertAccountSession(user.id, session, now);
      this.#database
        .prepare(`
          UPDATE account_invites
          SET used_by_user_id = ?, used_at = ?
          WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL
        `)
        .run(user.id, now, invite.id);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  findAccountUserByUsername(username: string): StoredAccountUser | undefined {
    const row = this.#database
      .prepare(`
        SELECT
          id, username, display_name, password_salt, password_hash, role, created_at
        FROM users
        WHERE username = ? COLLATE NOCASE
      `)
      .get(username) as
      | {
          id: string;
          username: string;
          display_name: string;
          password_salt: string;
          password_hash: string;
          role: "owner" | "member";
          created_at: string;
        }
      | undefined;
    return row ? this.#mapAccountUser(row) : undefined;
  }

  findAccountUserBySession(tokenHash: string): StoredAccountUser | undefined {
    const now = new Date().toISOString();
    this.#database.prepare("DELETE FROM account_sessions WHERE expires_at <= ?").run(now);
    const row = this.#database
      .prepare(`
        SELECT
          users.id,
          users.username,
          users.display_name,
          users.password_salt,
          users.password_hash,
          users.role,
          users.created_at
        FROM account_sessions
        JOIN users ON users.id = account_sessions.user_id
        WHERE account_sessions.token_hash = ? AND account_sessions.expires_at > ?
      `)
      .get(tokenHash, now) as
      | {
          id: string;
          username: string;
          display_name: string;
          password_salt: string;
          password_hash: string;
          role: "owner" | "member";
          created_at: string;
        }
      | undefined;
    return row ? this.#mapAccountUser(row) : undefined;
  }

  createAccountSession(
    userId: string,
    session: { id: string; tokenHash: string; expiresAt: string }
  ): void {
    this.#insertAccountSession(userId, session, new Date().toISOString());
  }

  deleteAccountSession(tokenHash: string): void {
    this.#database.prepare("DELETE FROM account_sessions WHERE token_hash = ?").run(tokenHash);
  }

  updateAccountDisplayName(userId: string, displayName: string): void {
    const result = this.#database
      .prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?")
      .run(displayName, new Date().toISOString(), userId);
    if (Number(result.changes) !== 1) throw new Error("账号不存在");
  }

  replaceAccountPassword(
    userId: string,
    password: { salt: string; hash: string },
    session: { id: string; tokenHash: string; expiresAt: string }
  ): void {
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database
        .prepare(`
          UPDATE users
          SET password_salt = ?, password_hash = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(password.salt, password.hash, now, userId);
      if (Number(result.changes) !== 1) throw new Error("账号不存在");
      this.#database.prepare("DELETE FROM account_sessions WHERE user_id = ?").run(userId);
      this.#insertAccountSession(userId, session, now);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  createAccountInvite(invite: {
    id: string;
    codeHash: string;
    createdByUserId: string;
    expiresAt: string;
  }): StoredAccountInvite {
    const createdAt = new Date().toISOString();
    this.#database
      .prepare(`
        INSERT INTO account_invites (
          id, code_hash, created_by_user_id, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        invite.id,
        invite.codeHash,
        invite.createdByUserId,
        invite.expiresAt,
        createdAt
      );
    return { id: invite.id, expiresAt: invite.expiresAt, createdAt };
  }

  listAccountInvites(createdByUserId: string): StoredAccountInvite[] {
    const rows = this.#database
      .prepare(`
        SELECT
          invites.id,
          invites.expires_at,
          invites.created_at,
          invites.used_at,
          invites.revoked_at,
          users.display_name AS used_by_display_name
        FROM account_invites invites
        LEFT JOIN users ON users.id = invites.used_by_user_id
        WHERE invites.created_by_user_id = ?
        ORDER BY invites.created_at DESC
        LIMIT 50
      `)
      .all(createdByUserId) as Array<{
      id: string;
      expires_at: string;
      created_at: string;
      used_at: string | null;
      revoked_at: string | null;
      used_by_display_name: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      ...(row.used_by_display_name ? { usedByDisplayName: row.used_by_display_name } : {}),
      ...(row.used_at ? { usedAt: row.used_at } : {}),
      ...(row.revoked_at ? { revokedAt: row.revoked_at } : {})
    }));
  }

  revokeAccountInvite(inviteId: string, createdByUserId: string): boolean {
    const result = this.#database
      .prepare(`
        UPDATE account_invites
        SET revoked_at = ?
        WHERE id = ? AND created_by_user_id = ? AND used_at IS NULL AND revoked_at IS NULL
      `)
      .run(new Date().toISOString(), inviteId, createdByUserId);
    return Number(result.changes) === 1;
  }

  addPuzzleResult(result: Omit<StoredPuzzleResult, "displayName">): void {
    this.#database
      .prepare(`
        INSERT INTO puzzle_results (
          id, user_id, game, difficulty, outcome,
          elapsed_seconds, mistakes, hints, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        result.id,
        result.userId,
        result.game,
        result.difficulty,
        result.outcome,
        result.elapsedSeconds,
        result.mistakes,
        result.hints,
        result.createdAt
      );
  }

  getPuzzleTotals(userId: string): {
    all: number;
    minesweeper: number;
    sudoku: number;
    wins: number;
  } {
    const row = this.#database
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN game = 'minesweeper' THEN 1 ELSE 0 END) AS minesweeper,
          SUM(CASE WHEN game = 'sudoku' THEN 1 ELSE 0 END) AS sudoku,
          SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins
        FROM puzzle_results
        WHERE user_id = ?
      `)
      .get(userId) as {
      total: number;
      minesweeper: number | null;
      sudoku: number | null;
      wins: number | null;
    };
    return {
      all: row.total,
      minesweeper: row.minesweeper ?? 0,
      sudoku: row.sudoku ?? 0,
      wins: row.wins ?? 0
    };
  }

  listRecentPuzzleResults(userId: string, limit = 30): StoredPuzzleResult[] {
    const rows = this.#database
      .prepare(`
        SELECT
          results.id,
          results.user_id,
          users.display_name,
          results.game,
          results.difficulty,
          results.outcome,
          results.elapsed_seconds,
          results.mistakes,
          results.hints,
          results.created_at
        FROM puzzle_results results
        JOIN users ON users.id = results.user_id
        WHERE results.user_id = ?
        ORDER BY results.created_at DESC
        LIMIT ?
      `)
      .all(userId, limit);
    return this.#mapPuzzleResults(rows);
  }

  listPersonalPuzzleBests(userId: string): StoredPuzzleResult[] {
    const rows = this.#database
      .prepare(`
        SELECT * FROM (
          SELECT
            results.id,
            results.user_id,
            users.display_name,
            results.game,
            results.difficulty,
            results.outcome,
            results.elapsed_seconds,
            results.mistakes,
            results.hints,
            results.created_at,
            ROW_NUMBER() OVER (
              PARTITION BY results.game, results.difficulty
              ORDER BY results.elapsed_seconds ASC, results.created_at ASC
            ) AS result_rank
          FROM puzzle_results results
          JOIN users ON users.id = results.user_id
          WHERE results.user_id = ? AND results.outcome = 'win'
        )
        WHERE result_rank = 1
        ORDER BY game, difficulty
      `)
      .all(userId);
    return this.#mapPuzzleResults(rows);
  }

  listPuzzleLeaderboardBests(): StoredPuzzleResult[] {
    const rows = this.#database
      .prepare(`
        SELECT * FROM (
          SELECT
            results.id,
            results.user_id,
            users.display_name,
            results.game,
            results.difficulty,
            results.outcome,
            results.elapsed_seconds,
            results.mistakes,
            results.hints,
            results.created_at,
            ROW_NUMBER() OVER (
              PARTITION BY results.user_id, results.game, results.difficulty
              ORDER BY results.elapsed_seconds ASC, results.created_at ASC
            ) AS personal_rank
          FROM puzzle_results results
          JOIN users ON users.id = results.user_id
          WHERE results.outcome = 'win'
        )
        WHERE personal_rank = 1
        ORDER BY game, difficulty, elapsed_seconds, created_at
      `)
      .all();
    return this.#mapPuzzleResults(rows);
  }

  addGomokuMatch(match: StoredGomokuMatch): boolean {
    const result = this.#database
      .prepare(`
        INSERT INTO gomoku_matches (
          id, user_id, game_id, rule_set, mode, ai_difficulty, human_color,
          winner, outcome, result_reason, elapsed_seconds, move_count,
          assisted, state_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, game_id) DO NOTHING
      `)
      .run(
        match.id,
        match.userId,
        match.gameId,
        match.ruleSet,
        match.mode,
        match.aiDifficulty ?? null,
        match.humanColor ?? null,
        match.winner,
        match.outcome,
        match.resultReason,
        match.elapsedSeconds,
        match.moveCount,
        match.assisted ? 1 : 0,
        JSON.stringify(match.state),
        match.createdAt
      );
    return Number(result.changes) === 1;
  }

  findGomokuMatchByGameId(userId: string, gameId: string): StoredGomokuMatch | undefined {
    const row = this.#database
      .prepare("SELECT * FROM gomoku_matches WHERE user_id = ? AND game_id = ?")
      .get(userId, gameId);
    return row ? this.#mapGomokuMatch(row) : undefined;
  }

  findGomokuMatch(userId: string, matchId: string): StoredGomokuMatch | undefined {
    const row = this.#database
      .prepare("SELECT * FROM gomoku_matches WHERE user_id = ? AND id = ?")
      .get(userId, matchId);
    return row ? this.#mapGomokuMatch(row) : undefined;
  }

  listRecentGomokuMatches(userId: string, limit = 30): StoredGomokuMatch[] {
    const rows = this.#database
      .prepare(`
        SELECT *
        FROM gomoku_matches
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(userId, limit);
    return rows.map((row) => this.#mapGomokuMatch(row));
  }

  getGomokuStats(userId: string): {
    total: number;
    wins: number;
    losses: number;
    draws: number;
    assisted: number;
    byDifficulty: Array<{
      difficulty: GomokuAiDifficultyValue;
      total: number;
      wins: number;
      losses: number;
      draws: number;
    }>;
  } {
    const total = this.#database
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) AS losses,
          SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws,
          SUM(CASE WHEN assisted = 1 THEN 1 ELSE 0 END) AS assisted
        FROM gomoku_matches
        WHERE user_id = ? AND mode = 'ai'
      `)
      .get(userId) as {
      total: number;
      wins: number | null;
      losses: number | null;
      draws: number | null;
      assisted: number | null;
    };
    const rows = this.#database
      .prepare(`
        SELECT
          ai_difficulty,
          COUNT(*) AS total,
          SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) AS losses,
          SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws
        FROM gomoku_matches
        WHERE user_id = ? AND mode = 'ai' AND ai_difficulty IS NOT NULL
        GROUP BY ai_difficulty
        ORDER BY CASE ai_difficulty WHEN 'easy' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END
      `)
      .all(userId) as Array<{
      ai_difficulty: GomokuAiDifficultyValue;
      total: number;
      wins: number | null;
      losses: number | null;
      draws: number | null;
    }>;
    return {
      total: total.total,
      wins: total.wins ?? 0,
      losses: total.losses ?? 0,
      draws: total.draws ?? 0,
      assisted: total.assisted ?? 0,
      byDifficulty: rows.map((row) => ({
        difficulty: row.ai_difficulty,
        total: row.total,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        draws: row.draws ?? 0
      }))
    };
  }

  upsertGomokuProgress(
    userId: string,
    items: ReadonlyArray<Omit<StoredGomokuProgress, "completedAt" | "updatedAt">>
  ): StoredGomokuProgress[] {
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const statement = this.#database.prepare(`
        INSERT INTO gomoku_progress (
          user_id, content_type, content_id, stars, best_moves, hints_used,
          completed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, content_type, content_id) DO UPDATE SET
          stars = MAX(gomoku_progress.stars, excluded.stars),
          best_moves = CASE
            WHEN gomoku_progress.best_moves = 0 THEN excluded.best_moves
            WHEN excluded.best_moves = 0 THEN gomoku_progress.best_moves
            ELSE MIN(gomoku_progress.best_moves, excluded.best_moves)
          END,
          hints_used = MIN(gomoku_progress.hints_used, excluded.hints_used),
          updated_at = excluded.updated_at
      `);
      for (const item of items) {
        statement.run(
          userId,
          item.contentType,
          item.contentId,
          item.stars,
          item.bestMoves,
          item.hintsUsed,
          now,
          now
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.listGomokuProgress(userId);
  }

  listGomokuProgress(userId: string): StoredGomokuProgress[] {
    const rows = this.#database
      .prepare(`
        SELECT content_type, content_id, stars, best_moves, hints_used, completed_at, updated_at
        FROM gomoku_progress
        WHERE user_id = ?
        ORDER BY content_type, content_id
      `)
      .all(userId) as Array<{
      content_type: "puzzle" | "lesson";
      content_id: string;
      stars: number;
      best_moves: number;
      hints_used: number;
      completed_at: string;
      updated_at: string;
    }>;
    return rows.map((row) => ({
      contentType: row.content_type,
      contentId: row.content_id,
      stars: row.stars,
      bestMoves: row.best_moves,
      hintsUsed: row.hints_used,
      completedAt: row.completed_at,
      updatedAt: row.updated_at
    }));
  }

  upsertGomokuSave(userId: string, state: GomokuGameStatePayload): StoredGomokuSave {
    const updatedAt = new Date().toISOString();
    this.#database
      .prepare(`
        INSERT INTO gomoku_saves (user_id, game_id, state_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          game_id = excluded.game_id,
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `)
      .run(userId, state.id, JSON.stringify(state), updatedAt);
    return { state, updatedAt };
  }

  getGomokuSave(userId: string): StoredGomokuSave | undefined {
    const row = this.#database
      .prepare("SELECT state_json, updated_at FROM gomoku_saves WHERE user_id = ?")
      .get(userId) as { state_json: string; updated_at: string } | undefined;
    return row
      ? {
          state: JSON.parse(row.state_json) as GomokuGameStatePayload,
          updatedAt: row.updated_at
        }
      : undefined;
  }

  getManorV7State(userId: string): ManorV7State | undefined {
    const row = this.#database
      .prepare("SELECT state_json FROM manor_v7_states WHERE user_id = ?")
      .get(userId) as { state_json: string } | undefined;
    return row ? JSON.parse(row.state_json) as ManorV7State : undefined;
  }

  ensureManorV7State(userId: string, state: ManorV7State): ManorV7State {
    const timestamp = new Date(state.updatedAt).toISOString();
    this.#database
      .prepare(`
        INSERT OR IGNORE INTO manor_v7_states (
          user_id, revision, state_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(userId, state.revision, JSON.stringify(state), timestamp, timestamp);
    const stored = this.getManorV7State(userId);
    if (!stored) throw new Error("V7 庄园存档创建失败");
    return stored;
  }

  updateManorV7State(userId: string, expectedRevision: number, state: ManorV7State): void {
    const result = this.#database
      .prepare(`
        UPDATE manor_v7_states
        SET revision = ?, state_json = ?, updated_at = ?
        WHERE user_id = ? AND revision = ?
      `)
      .run(
        state.revision,
        JSON.stringify(state),
        new Date(state.updatedAt).toISOString(),
        userId,
        expectedRevision
      );
    if (result.changes !== 1) throw new Error("V7 庄园状态已更新，请刷新后重试");
  }

  updateManorV7StatesAtomically(
    updates: Array<{ userId: string; expectedRevision: number; state: ManorV7State }>
  ): void {
    if (new Set(updates.map((update) => update.userId)).size !== updates.length) {
      throw new Error("V7 庄园事务包含重复账号");
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const statement = this.#database.prepare(`
        UPDATE manor_v7_states
        SET revision = ?, state_json = ?, updated_at = ?
        WHERE user_id = ? AND revision = ?
      `);
      for (const update of updates) {
        const result = statement.run(
          update.state.revision,
          JSON.stringify(update.state),
          new Date(update.state.updatedAt).toISOString(),
          update.userId,
          update.expectedRevision
        );
        if (result.changes !== 1) throw new Error("V7 庄园状态已更新，请刷新后重试");
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  listManorAccounts(): StoredManorAccount[] {
    const rows = this.#database
      .prepare("SELECT id, display_name FROM users ORDER BY display_name COLLATE NOCASE, id")
      .all() as Array<{ id: string; display_name: string }>;
    return rows.map((row) => ({ id: row.id, displayName: row.display_name }));
  }

  findManorAccount(userId: string): StoredManorAccount | undefined {
    const row = this.#database
      .prepare("SELECT id, display_name FROM users WHERE id = ?")
      .get(userId) as { id: string; display_name: string } | undefined;
    return row ? { id: row.id, displayName: row.display_name } : undefined;
  }

  listManorGuestbook(ownerUserId: string, limit = 50): StoredManorGuestbookMessage[] {
    const rows = this.#database
      .prepare(`
        SELECT
          message.id,
          message.sender_user_id,
          sender.display_name AS sender_display_name,
          message.content,
          message.created_at,
          reply.id AS reply_id,
          reply_sender.display_name AS reply_sender_display_name,
          reply.content AS reply_content
        FROM manor_guestbook_messages AS message
        JOIN users AS sender ON sender.id = message.sender_user_id
        LEFT JOIN manor_guestbook_messages AS reply ON reply.id = message.reply_to_id
        LEFT JOIN users AS reply_sender ON reply_sender.id = reply.sender_user_id
        WHERE message.owner_user_id = ?
        ORDER BY message.created_at DESC, message.id DESC
        LIMIT ?
      `)
      .all(ownerUserId, limit) as Array<{
        id: string;
        sender_user_id: string;
        sender_display_name: string;
        content: string;
        created_at: string;
        reply_id: string | null;
        reply_sender_display_name: string | null;
        reply_content: string | null;
      }>;
    return rows.map((row) => ({
      id: row.id,
      senderUserId: row.sender_user_id,
      senderDisplayName: row.sender_display_name,
      content: row.content,
      createdAt: row.created_at,
      ...(row.reply_id && row.reply_sender_display_name !== null && row.reply_content !== null
        ? {
            replyTo: {
              id: row.reply_id,
              senderDisplayName: row.reply_sender_display_name,
              content: row.reply_content
            }
          }
        : {})
    }));
  }

  createManorGuestbookMessage(
    ownerUserId: string,
    senderUserId: string,
    content: string,
    replyToId: string | undefined,
    createdAt: string
  ): void {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (replyToId) {
        const reply = this.#database
          .prepare("SELECT 1 AS found FROM manor_guestbook_messages WHERE id = ? AND owner_user_id = ?")
          .get(replyToId, ownerUserId) as { found: number } | undefined;
        if (!reply) throw new Error("回复的留言不存在或不属于当前留言板");
      }
      this.#database
        .prepare(`
          INSERT INTO manor_guestbook_messages (
            id, owner_user_id, sender_user_id, reply_to_id, content, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(randomUUID(), ownerUserId, senderUserId, replyToId ?? null, content, createdAt);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  clearManorGuestbook(ownerUserId: string): number {
    return Number(
      this.#database
        .prepare("DELETE FROM manor_guestbook_messages WHERE owner_user_id = ?")
        .run(ownerUserId).changes
    );
  }

  hasAdminPassword(): boolean {
    const row = this.#database
      .prepare("SELECT 1 AS found FROM admin_credentials WHERE id = 1")
      .get() as { found: number } | undefined;
    return row?.found === 1;
  }

  initializeAdminPassword(password: { salt: string; hash: string }): boolean {
    const now = new Date().toISOString();
    const result = this.#database
      .prepare(`
        INSERT INTO admin_credentials (
          id, password_salt, password_hash, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `)
      .run(password.salt, password.hash, now, now);
    return Number(result.changes) === 1;
  }

  getAdminPassword(): { salt: string; hash: string } | undefined {
    const row = this.#database
      .prepare(`
        SELECT password_salt, password_hash
        FROM admin_credentials
        WHERE id = 1
      `)
      .get() as { password_salt: string; password_hash: string } | undefined;
    return row ? { salt: row.password_salt, hash: row.password_hash } : undefined;
  }

  updateAdminPassword(password: { salt: string; hash: string }): void {
    const result = this.#database
      .prepare(`
        UPDATE admin_credentials
        SET password_salt = ?, password_hash = ?, updated_at = ?
        WHERE id = 1
      `)
      .run(password.salt, password.hash, new Date().toISOString());
    if (Number(result.changes) !== 1) throw new Error("管理员密码尚未初始化");
  }

  getSetting(key: string): string | undefined {
    const row = this.#database
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.#database
      .prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `)
      .run(key, value, new Date().toISOString());
  }

  deleteSetting(key: string): void {
    this.#database.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
  }

  getSchemaVersion(): number {
    const row = this.#database
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null };
    return row.version ?? 0;
  }

  close(): void {
    this.#database.close();
  }

  #applyMigrations(): void {
    const appliedRows = this.#database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    const applied = new Set(appliedRows.map((row) => row.version));
    const latestSupportedVersion = DATABASE_MIGRATIONS.at(-1)?.version ?? 0;
    const newerVersion = appliedRows.find((row) => row.version > latestSupportedVersion);
    if (newerVersion) {
      throw new Error(
        `Database schema version ${newerVersion.version} is newer than supported ${latestSupportedVersion}`
      );
    }

    for (const migration of DATABASE_MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      this.#database.exec("BEGIN IMMEDIATE");
      try {
        this.#database.exec(migration.sql);
        this.#database
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(migration.version, new Date().toISOString());
        this.#database.exec("COMMIT");
      } catch (error) {
        this.#database.exec("ROLLBACK");
        throw error;
      }
    }
  }

  #insertAccountUser(
    user: {
      id: string;
      username: string;
      displayName: string;
      password: { salt: string; hash: string };
      role: "owner" | "member";
    },
    now: string
  ): void {
    this.#database
      .prepare(`
        INSERT INTO users (
          id, username, display_name, password_salt, password_hash, role, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        user.id,
        user.username,
        user.displayName,
        user.password.salt,
        user.password.hash,
        user.role,
        now,
        now
      );
  }

  #insertAccountSession(
    userId: string,
    session: { id: string; tokenHash: string; expiresAt: string },
    now: string
  ): void {
    this.#database
      .prepare(`
        INSERT INTO account_sessions (
          id, user_id, token_hash, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(session.id, userId, session.tokenHash, session.expiresAt, now);
  }

  #mapAccountUser(row: {
    id: string;
    username: string;
    display_name: string;
    password_salt: string;
    password_hash: string;
    role: "owner" | "member";
    created_at: string;
  }): StoredAccountUser {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      password: { salt: row.password_salt, hash: row.password_hash },
      role: row.role,
      createdAt: row.created_at
    };
  }

  #mapPuzzleResults(rows: unknown[]): StoredPuzzleResult[] {
    return (
      rows as Array<{
        id: string;
        user_id: string;
        display_name: string;
        game: "minesweeper" | "sudoku";
        difficulty: string;
        outcome: "win" | "loss";
        elapsed_seconds: number;
        mistakes: number;
        hints: number;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      game: row.game,
      difficulty: row.difficulty,
      outcome: row.outcome,
      elapsedSeconds: row.elapsed_seconds,
      mistakes: row.mistakes,
      hints: row.hints,
      createdAt: row.created_at
    }));
  }

  #mapGomokuMatch(row: unknown): StoredGomokuMatch {
    const value = row as {
      id: string;
      user_id: string;
      game_id: string;
      rule_set: GomokuRuleSetValue;
      mode: GomokuMatchModeValue;
      ai_difficulty: GomokuAiDifficultyValue | null;
      human_color: GomokuStoneValue | null;
      winner: "black" | "white" | "draw";
      outcome: "win" | "loss" | "draw" | "local";
      result_reason: "five" | "board-full" | "resign";
      elapsed_seconds: number;
      move_count: number;
      assisted: number;
      state_json: string;
      created_at: string;
    };
    return {
      id: value.id,
      userId: value.user_id,
      gameId: value.game_id,
      ruleSet: value.rule_set,
      mode: value.mode,
      ...(value.ai_difficulty ? { aiDifficulty: value.ai_difficulty } : {}),
      ...(value.human_color ? { humanColor: value.human_color } : {}),
      winner: value.winner,
      outcome: value.outcome,
      resultReason: value.result_reason,
      elapsedSeconds: value.elapsed_seconds,
      moveCount: value.move_count,
      assisted: value.assisted === 1,
      state: JSON.parse(value.state_json) as GomokuGameStatePayload,
      createdAt: value.created_at
    };
  }

  #insertSession(roomId: string, session: NewSession, now: string): void {
    this.#database
      .prepare(`
        INSERT INTO player_sessions (
          player_id, room_id, token_hash, recovery_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        session.playerId,
        roomId,
        session.tokenHash,
        session.recoveryHash,
        now,
        now
      );
  }

  #insertEvent(roomId: string, sequence: number, event: RoomEvent, now: string): void {
    this.#database
      .prepare(`
        INSERT INTO room_events (
          room_id, sequence, event_type, actor_player_id, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        roomId,
        sequence,
        event.type,
        event.actorPlayerId,
        JSON.stringify(event.payload),
        now
      );
  }
}
