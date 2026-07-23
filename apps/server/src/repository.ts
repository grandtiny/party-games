import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { GameType } from "@party-games/shared";
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
  }
];

export interface StoredChatMessage {
  id: string;
  senderPlayerId: string;
  recipientPlayerId?: string;
  content: string;
  createdAt: string;
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

  listRoomCodes(): string[] {
    return (
      this.#database.prepare("SELECT code FROM rooms ORDER BY created_at").all() as Array<{
        code: string;
      }>
    ).map((row) => row.code);
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
