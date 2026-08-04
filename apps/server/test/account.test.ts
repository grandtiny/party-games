import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createGomokuGame,
  gomokuLessons,
  gomokuPuzzles,
  playGomokuMove,
  resignGomokuGame,
  type GomokuGameState
} from "@party-games/gomoku";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const cleanupTasks: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanupTasks.splice(0).reverse()) await cleanup();
});

describe("platform accounts and puzzle records", () => {
  it("creates the first owner, registers members by one-time invite and ranks results", async () => {
    const { app } = await createTestApp();

    const initial = await app.inject({ method: "GET", url: "/api/account/status" });
    expect(initial.json()).toEqual({
      initialized: false,
      authenticated: false,
      legacyAdminRequired: false
    });

    const ownerSetup = await app.inject({
      method: "POST",
      url: "/api/account/bootstrap",
      payload: {
        username: "owner",
        displayName: "房主",
        password: "owner-password"
      }
    });
    expect(ownerSetup.statusCode).toBe(200);
    expect(ownerSetup.json()).toMatchObject({
      initialized: true,
      authenticated: true,
      user: { username: "owner", displayName: "房主", role: "owner" }
    });
    const ownerCookie = sessionCookie(ownerSetup.headers["set-cookie"]);

    const inviteResponse = await app.inject({
      method: "POST",
      url: "/api/account/invites",
      headers: { cookie: ownerCookie },
      payload: { expiresInDays: 7 }
    });
    expect(inviteResponse.statusCode).toBe(200);
    const inviteCode = String(inviteResponse.json().code);
    expect(inviteCode).toHaveLength(12);

    const memberSetup = await app.inject({
      method: "POST",
      url: "/api/account/register",
      payload: {
        username: "member",
        displayName: "朋友",
        password: "member-password",
        inviteCode
      }
    });
    expect(memberSetup.statusCode).toBe(200);
    expect(memberSetup.json()).toMatchObject({
      user: { username: "member", role: "member" }
    });
    const memberCookie = sessionCookie(memberSetup.headers["set-cookie"]);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/account/register",
          payload: {
            username: "second-member",
            displayName: "另一位朋友",
            password: "member-password",
            inviteCode
          }
        })
      ).statusCode
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/account/invites",
          headers: { cookie: memberCookie },
          payload: { expiresInDays: 7 }
        })
      ).statusCode
    ).toBe(403);

    await submitResult(app, ownerCookie, {
      game: "minesweeper",
      difficulty: "beginner",
      outcome: "win",
      elapsedSeconds: 38,
      mistakes: 0,
      hints: 0
    });
    await submitResult(app, ownerCookie, {
      game: "minesweeper",
      difficulty: "beginner",
      outcome: "win",
      elapsedSeconds: 30,
      mistakes: 0,
      hints: 0
    });
    await submitResult(app, memberCookie, {
      game: "minesweeper",
      difficulty: "beginner",
      outcome: "win",
      elapsedSeconds: 25,
      mistakes: 0,
      hints: 0
    });
    await submitResult(app, memberCookie, {
      game: "sudoku",
      difficulty: "easy",
      outcome: "win",
      elapsedSeconds: 180,
      mistakes: 2,
      hints: 1
    });

    const overview = await app.inject({
      method: "GET",
      url: "/api/account/overview",
      headers: { cookie: ownerCookie }
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({
      totals: { all: 2, minesweeper: 2, sudoku: 0, wins: 2 },
      personalBests: [
        { game: "minesweeper", difficulty: "beginner", elapsedSeconds: 30 }
      ]
    });
    const leaderboard = overview
      .json()
      .leaderboards.find(
        (value: { game: string; difficulty: string }) =>
          value.game === "minesweeper" && value.difficulty === "beginner"
      );
    expect(leaderboard.entries).toMatchObject([
      { rank: 1, displayName: "朋友", elapsedSeconds: 25, isSelf: false },
      { rank: 2, displayName: "房主", elapsedSeconds: 30, isSelf: true }
    ]);
    expect(
      (await app.inject({ method: "GET", url: "/api/account/overview" })).statusCode
    ).toBe(401);
  });

  it("requires the legacy admin password for owner claim and transfers settings access", async () => {
    const { app } = await createTestApp();
    const legacySetup = await app.inject({
      method: "POST",
      url: "/api/admin/setup",
      payload: { password: "legacy-password" }
    });
    const legacyCookie = sessionCookie(legacySetup.headers["set-cookie"]);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/account/bootstrap",
          payload: {
            username: "owner",
            displayName: "房主",
            password: "owner-password",
            legacyAdminPassword: "wrong-password"
          }
        })
      ).statusCode
    ).toBe(400);

    const ownerSetup = await app.inject({
      method: "POST",
      url: "/api/account/bootstrap",
      payload: {
        username: "owner",
        displayName: "房主",
        password: "owner-password",
        legacyAdminPassword: "legacy-password"
      }
    });
    const ownerCookie = sessionCookie(ownerSetup.headers["set-cookie"]);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/admin/config",
          headers: { cookie: legacyCookie }
        })
      ).statusCode
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/admin/config",
          headers: { cookie: ownerCookie }
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/admin/login",
          payload: { password: "legacy-password" }
        })
      ).statusCode
    ).toBe(401);
  });

  it("requires matching accounts to create, join and recover room identities", async () => {
    const context = await createTestApp();
    const { app, roomService } = context;
    const guestCreate = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { gameType: "clocktower", nickname: "游客", password: "room-pass" }
    });
    expect(guestCreate.statusCode).toBe(401);

    const ownerSetup = await app.inject({
      method: "POST",
      url: "/api/account/bootstrap",
      payload: {
        username: "owner",
        displayName: "房主",
        password: "owner-password"
      }
    });
    const ownerCookie = sessionCookie(ownerSetup.headers["set-cookie"]);
    const room = await app.inject({
      method: "POST",
      url: "/api/rooms",
      headers: { cookie: ownerCookie },
      payload: { gameType: "clocktower", nickname: "房主", password: "room-pass" }
    });
    expect(room.statusCode).toBe(200);
    const session = room.json();
    const accountUserId = ownerSetup.json().user.id;
    expect(
      roomService
        .getView(session.roomCode, session.playerId)
        .room.players.find((player) => player.id === session.playerId)
    ).toMatchObject({ accountUserId, nickname: "房主" });

    const guestJoin = await app.inject({
      method: "POST",
      url: "/api/rooms/join",
      payload: {
        roomCode: session.roomCode,
        nickname: "游客",
        password: "room-pass"
      }
    });
    expect(guestJoin.statusCode).toBe(401);

    const invite = await app.inject({
      method: "POST",
      url: "/api/account/invites",
      headers: { cookie: ownerCookie },
      payload: { expiresInDays: 1 }
    });
    const memberSetup = await app.inject({
      method: "POST",
      url: "/api/account/register",
      payload: {
        username: "member",
        displayName: "成员",
        password: "member-password",
        inviteCode: invite.json().code
      }
    });
    const memberCookie = sessionCookie(memberSetup.headers["set-cookie"]);
    const member = await app.inject({
      method: "POST",
      url: "/api/rooms/join",
      headers: { cookie: memberCookie },
      payload: {
        roomCode: session.roomCode,
        nickname: "成员",
        password: "room-pass"
      }
    });
    expect(member.statusCode).toBe(200);
    const memberSession = member.json();
    expect(
      roomService
        .getView(session.roomCode, memberSession.playerId)
        .room.players.find((player) => player.id === memberSession.playerId)
    ).toMatchObject({ accountUserId: memberSetup.json().user.id, nickname: "成员" });

    const guestRecover = await app.inject({
      method: "POST",
      url: "/api/rooms/recover",
      payload: {
        roomCode: session.roomCode,
        recoveryCode: memberSession.recoveryCode
      }
    });
    expect(guestRecover.statusCode).toBe(401);

    const wrongAccountRecover = await app.inject({
      method: "POST",
      url: "/api/rooms/recover",
      headers: { cookie: ownerCookie },
      payload: {
        roomCode: session.roomCode,
        recoveryCode: memberSession.recoveryCode
      }
    });
    expect(wrongAccountRecover.statusCode).toBe(400);
    expect(wrongAccountRecover.json().error).toContain("恢复码与当前账号不匹配");

    const recovered = await app.inject({
      method: "POST",
      url: "/api/rooms/recover",
      headers: { cookie: memberCookie },
      payload: {
        roomCode: session.roomCode,
        recoveryCode: memberSession.recoveryCode
      }
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toMatchObject({
      roomCode: session.roomCode,
      playerId: memberSession.playerId,
      recoveryCode: memberSession.recoveryCode
    });
  });

  it("validates, deduplicates and restores gomoku account data", async () => {
    const { app } = await createTestApp();
    const setup = await app.inject({
      method: "POST",
      url: "/api/account/bootstrap",
      payload: {
        username: "owner",
        displayName: "房主",
        password: "owner-password"
      }
    });
    const cookie = sessionCookie(setup.headers["set-cookie"]);
    let state = createGomokuGame({
      id: "gomoku-test-game",
      ruleSet: "renju",
      mode: "ai",
      aiDifficulty: "normal",
      humanColor: "black",
      startedAt: Date.now(),
      seed: 42
    });
    for (const point of [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    ]) {
      state = playRequired(state, point);
    }

    const saved = await app.inject({
      method: "PUT",
      url: "/api/account/gomoku/save",
      headers: { cookie },
      payload: { state }
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({ state: { id: "gomoku-test-game", moves: state.moves } });

    for (const point of [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 0 }
    ]) {
      state = playRequired(state, point);
    }
    state = { ...state, elapsedSeconds: 19 };
    const first = await app.inject({
      method: "POST",
      url: "/api/account/gomoku/matches",
      headers: { cookie },
      payload: { state }
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      gameId: "gomoku-test-game",
      outcome: "win",
      winner: "black",
      moveCount: 9,
      assisted: false
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/account/gomoku/matches",
      headers: { cookie },
      payload: { state }
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().id).toBe(first.json().id);

    const puzzle = gomokuPuzzles[0];
    const exercise = gomokuLessons[0]?.exercises[0];
    if (!puzzle || !exercise) throw new Error("gomoku content missing");
    const progress = await app.inject({
      method: "PUT",
      url: "/api/account/gomoku/progress",
      headers: { cookie },
      payload: {
        items: [
          {
            contentType: "puzzle",
            contentId: puzzle.id,
            stars: 2,
            bestMoves: 3,
            hintsUsed: 1
          },
          {
            contentType: "lesson",
            contentId: exercise.id,
            stars: 0,
            bestMoves: 0,
            hintsUsed: 0
          }
        ]
      }
    });
    expect(progress.statusCode).toBe(200);
    expect(progress.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contentType: "puzzle", contentId: puzzle.id, stars: 2 }),
        expect.objectContaining({ contentType: "lesson", contentId: exercise.id })
      ])
    );

    const overview = await app.inject({
      method: "GET",
      url: "/api/account/gomoku/overview",
      headers: { cookie }
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({
      stats: { total: 1, wins: 1, losses: 0, draws: 0, assisted: 0 },
      recentMatches: [{ gameId: "gomoku-test-game", outcome: "win" }],
      save: { state: { id: "gomoku-test-game" } }
    });
    const detail = await app.inject({
      method: "GET",
      url: `/api/account/gomoku/matches/${first.json().id}`,
      headers: { cookie }
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ state: { result: { outcome: "black", reason: "five" } } });

    const invalid = resignGomokuGame(
      createGomokuGame({
        id: "invalid-resign",
        ruleSet: "renju",
        mode: "ai",
        aiDifficulty: "easy",
        humanColor: "black",
        startedAt: Date.now(),
        seed: 7
      }),
      "white"
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/account/gomoku/matches",
          headers: { cookie },
          payload: { state: invalid }
        })
      ).statusCode
    ).toBe(400);
  });
});

function playRequired(
  state: GomokuGameState,
  point: { x: number; y: number }
): GomokuGameState {
  const result = playGomokuMove(state, point);
  if (!result.ok) throw new Error(`gomoku move failed: ${result.failure.reason}`);
  return result.state;
}

async function submitResult(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  cookie: string,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await app.inject({
    method: "POST",
    url: "/api/account/puzzle-results",
    headers: { cookie },
    payload
  });
  expect(response.statusCode).toBe(200);
}

async function createTestApp() {
  const directory = mkdtempSync(join(tmpdir(), "party-games-account-test-"));
  const context = await createApp({
    databasePath: join(directory, "test.sqlite"),
    logger: false,
    environment: {}
  });
  cleanupTasks.push(async () => {
    await context.app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return context;
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error("Session cookie missing");
  return value.split(";", 1)[0] ?? "";
}
