import { restoreGomokuGame, type GomokuGameState } from "@party-games/gomoku";
import type { GomokuProgressItem, GomokuProgressView } from "@party-games/shared";

const ACTIVE_GAME_KEY = "party-games:gomoku:active";
const ACTIVE_GAME_UPDATED_KEY = "party-games:gomoku:active-updated";
const SETTINGS_KEY = "party-games:gomoku:settings";
const PROGRESS_KEY = "party-games:gomoku:progress";
const MATCHES_KEY = "party-games:gomoku:matches";

export interface GomokuLocalSettings {
  confirmMoves: boolean;
  showForbidden: boolean;
  sound: boolean;
}

export interface GomokuPuzzleProgress {
  stars: number;
  bestMoves: number;
  hintsUsed: number;
}

export interface GomokuLocalProgress {
  puzzles: Record<string, GomokuPuzzleProgress>;
  lessons: Record<string, true>;
}

export interface GomokuGameSnapshot {
  state: GomokuGameState;
  updatedAt: string;
}

export interface GomokuLocalMatch {
  state: GomokuGameState;
  completedAt: string;
  synced: boolean;
}

export const defaultGomokuSettings: GomokuLocalSettings = {
  confirmMoves: false,
  showForbidden: true,
  sound: true
};

export function loadGomokuGame(): GomokuGameState | undefined {
  return loadGomokuGameSnapshot()?.state;
}

export function loadGomokuGameSnapshot(): GomokuGameSnapshot | undefined {
  const raw = window.localStorage.getItem(ACTIVE_GAME_KEY);
  if (!raw) return undefined;
  try {
    const state = restoreGomokuGame(JSON.parse(raw));
    return {
      state,
      updatedAt:
        window.localStorage.getItem(ACTIVE_GAME_UPDATED_KEY) ??
        new Date(state.startedAt + state.elapsedSeconds * 1000).toISOString()
    };
  } catch {
    return undefined;
  }
}

export function saveGomokuGame(state: GomokuGameState, updatedAt = new Date().toISOString()): void {
  window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(state));
  window.localStorage.setItem(ACTIVE_GAME_UPDATED_KEY, updatedAt);
}

export function loadGomokuSettings(): GomokuLocalSettings {
  try {
    const value = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<
      GomokuLocalSettings
    > | null;
    return value ? { ...defaultGomokuSettings, ...value } : defaultGomokuSettings;
  } catch {
    return defaultGomokuSettings;
  }
}

export function saveGomokuSettings(settings: GomokuLocalSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadGomokuProgress(): GomokuLocalProgress {
  try {
    const value = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "null") as
      | Partial<GomokuLocalProgress>
      | null;
    return {
      puzzles: value?.puzzles ?? {},
      lessons: value?.lessons ?? {}
    };
  } catch {
    return { puzzles: {}, lessons: {} };
  }
}

export function saveGomokuProgress(progress: GomokuLocalProgress): void {
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function mergeGomokuProgress(
  local: GomokuLocalProgress,
  remote: readonly GomokuProgressView[]
): GomokuLocalProgress {
  const next: GomokuLocalProgress = {
    puzzles: { ...local.puzzles },
    lessons: { ...local.lessons }
  };
  for (const item of remote) {
    if (item.contentType === "lesson") {
      next.lessons[item.contentId] = true;
      continue;
    }
    const previous = next.puzzles[item.contentId];
    next.puzzles[item.contentId] = {
      stars: Math.max(previous?.stars ?? 0, item.stars),
      bestMoves: bestPositive(previous?.bestMoves, item.bestMoves),
      hintsUsed: Math.min(previous?.hintsUsed ?? Number.MAX_SAFE_INTEGER, item.hintsUsed)
    };
  }
  return next;
}

export function gomokuProgressItems(progress: GomokuLocalProgress): GomokuProgressItem[] {
  return [
    ...Object.entries(progress.puzzles).map(([contentId, value]) => ({
      contentType: "puzzle" as const,
      contentId,
      stars: value.stars,
      bestMoves: value.bestMoves,
      hintsUsed: value.hintsUsed
    })),
    ...Object.keys(progress.lessons).map((contentId) => ({
      contentType: "lesson" as const,
      contentId,
      stars: 0,
      bestMoves: 0,
      hintsUsed: 0
    }))
  ];
}

export function loadGomokuLocalMatches(): GomokuLocalMatch[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MATCHES_KEY) ?? "[]") as unknown[];
    return raw.flatMap((value) => {
      if (!isRecord(value)) return [];
      try {
        const state = restoreGomokuGame(value.state);
        if (!state.result) return [];
        return [
          {
            state,
            completedAt:
              typeof value.completedAt === "string"
                ? value.completedAt
                : new Date().toISOString(),
            synced: Boolean(value.synced)
          }
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function addGomokuLocalMatch(state: GomokuGameState): void {
  if (!state.result) return;
  const matches = loadGomokuLocalMatches();
  if (matches.some((match) => match.state.id === state.id)) return;
  window.localStorage.setItem(
    MATCHES_KEY,
    JSON.stringify([
      { state, completedAt: new Date().toISOString(), synced: false },
      ...matches
    ].slice(0, 50))
  );
}

export function markGomokuLocalMatchSynced(gameId: string): void {
  const matches = loadGomokuLocalMatches();
  const next = matches.map((match) =>
    match.state.id === gameId ? { ...match, synced: true } : match
  );
  window.localStorage.setItem(MATCHES_KEY, JSON.stringify(next));
}

export function createGomokuClientId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Plain HTTP contexts can expose crypto partially or not at all.
  }
  return `gomoku-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGomokuSeed(): number {
  try {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
    }
  } catch {
    // This seed is only used to vary AI choices, not for security.
  }
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

function bestPositive(left: number | undefined, right: number): number {
  if (!left) return right;
  if (!right) return left;
  return Math.min(left, right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
