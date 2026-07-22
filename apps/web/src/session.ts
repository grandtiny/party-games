import type { RoomSessionResponse } from "@party-games/shared";

export interface StoredSession extends RoomSessionResponse {
  savedAt: string;
}

const ACTIVE_ROOM_KEY = "party-games:active-room";

export function saveSession(session: RoomSessionResponse): StoredSession {
  const stored: StoredSession = { ...session, savedAt: new Date().toISOString() };
  localStorage.setItem(sessionKey(session.roomCode), JSON.stringify(stored));
  localStorage.setItem(ACTIVE_ROOM_KEY, session.roomCode);
  return stored;
}

export function getSession(roomCode: string): StoredSession | undefined {
  const raw = localStorage.getItem(sessionKey(roomCode));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return undefined;
  }
}

export function getActiveSession(): StoredSession | undefined {
  const roomCode = localStorage.getItem(ACTIVE_ROOM_KEY);
  return roomCode ? getSession(roomCode) : undefined;
}

function sessionKey(roomCode: string): string {
  return `party-games:session:${roomCode.toUpperCase()}`;
}
