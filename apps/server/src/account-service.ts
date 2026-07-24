import { randomInt, randomUUID } from "node:crypto";
import { gomokuLessons, gomokuPuzzles, restoreGomokuGame } from "@party-games/gomoku";
import type {
  AccountBootstrapRequest,
  AccountInviteView,
  AccountLoginRequest,
  AccountOverviewResponse,
  AccountRegisterRequest,
  AccountStatusResponse,
  AccountUserView,
  GomokuGameStatePayload,
  GomokuMatchDetailView,
  GomokuMatchSubmitRequest,
  GomokuMatchView,
  GomokuOverviewResponse,
  GomokuProgressSyncRequest,
  GomokuProgressView,
  GomokuSaveUpdateRequest,
  GomokuSaveView,
  PuzzleResultSubmitRequest,
  PuzzleResultView
} from "@party-games/shared";
import {
  createSessionToken,
  hashPassword,
  hashSecret,
  verifyPassword
} from "./auth.js";
import type {
  SqliteRoomRepository,
  StoredAccountUser,
  StoredGomokuMatch,
  StoredPuzzleResult
} from "./repository.js";

const ACCOUNT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GOMOKU_PROGRESS_IDS = new Set([
  ...gomokuPuzzles.map((puzzle) => `puzzle:${puzzle.id}`),
  ...gomokuLessons.flatMap((lesson) =>
    lesson.exercises.map((exercise) => `lesson:${exercise.id}`)
  )
]);

interface AuthenticatedAccount {
  token: string;
  user: AccountUserView;
}

export class AccountService {
  constructor(private readonly repository: SqliteRoomRepository) {}

  isInitialized(): boolean {
    return this.repository.hasAccountUsers();
  }

  status(token: string | undefined): AccountStatusResponse {
    const user = this.userForToken(token);
    return {
      initialized: this.isInitialized(),
      authenticated: Boolean(user),
      legacyAdminRequired: !this.isInitialized() && this.repository.hasAdminPassword(),
      ...(user ? { user } : {})
    };
  }

  bootstrap(input: AccountBootstrapRequest): AuthenticatedAccount {
    if (this.isInitialized()) throw new Error("平台管理员账号已经创建");
    const legacyPassword = this.repository.getAdminPassword();
    if (
      legacyPassword &&
      (!input.legacyAdminPassword || !verifyPassword(input.legacyAdminPassword, legacyPassword))
    ) {
      throw new Error("原管理员密码错误");
    }
    const user = this.newUser(input, "owner");
    const authenticated = this.newAuthenticatedAccount(user);
    try {
      if (
        !this.repository.createInitialAccountUser(
          {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            password: user.password
          },
          authenticated.session
        )
      ) {
        throw new Error("平台管理员账号已经创建");
      }
    } catch (error) {
      throw accountWriteError(error);
    }
    return { token: authenticated.token, user: accountView(user) };
  }

  register(input: AccountRegisterRequest): AuthenticatedAccount {
    if (!this.isInitialized()) throw new Error("请先创建平台管理员账号");
    if (this.repository.accountUsernameExists(input.username)) throw new Error("用户名已存在");
    const user = this.newUser(input, "member");
    const authenticated = this.newAuthenticatedAccount(user);
    try {
      this.repository.createInvitedAccountUser(
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          password: user.password
        },
        authenticated.session,
        hashSecret(input.inviteCode)
      );
    } catch (error) {
      throw accountWriteError(error);
    }
    return { token: authenticated.token, user: accountView(user) };
  }

  login(input: AccountLoginRequest): AuthenticatedAccount {
    const user = this.repository.findAccountUserByUsername(input.username);
    if (!user || !verifyPassword(input.password, user.password)) {
      throw new Error("用户名或密码错误");
    }
    const authenticated = this.newAuthenticatedAccount(user);
    this.repository.createAccountSession(user.id, authenticated.session);
    return { token: authenticated.token, user: accountView(user) };
  }

  logout(token: string | undefined): void {
    if (token) this.repository.deleteAccountSession(hashSecret(token));
  }

  userForToken(token: string | undefined): AccountUserView | undefined {
    if (!token) return undefined;
    const user = this.repository.findAccountUserBySession(hashSecret(token));
    return user ? accountView(user) : undefined;
  }

  requireUser(token: string | undefined): AccountUserView {
    const user = this.userForToken(token);
    if (!user) throw new Error("账号会话无效，请重新登录");
    return user;
  }

  requireOwner(token: string | undefined): AccountUserView {
    const user = this.requireUser(token);
    if (user.role !== "owner") throw new Error("仅管理员账号可执行此操作");
    return user;
  }

  updateProfile(token: string | undefined, displayName: string): AccountUserView {
    const user = this.requireUser(token);
    this.repository.updateAccountDisplayName(user.id, displayName);
    return { ...user, displayName };
  }

  changePassword(
    token: string | undefined,
    currentPassword: string,
    newPassword: string
  ): AuthenticatedAccount {
    const userView = this.requireUser(token);
    const user = this.repository.findAccountUserByUsername(userView.username);
    if (!user || !verifyPassword(currentPassword, user.password)) {
      throw new Error("当前密码错误");
    }
    const authenticated = this.newAuthenticatedAccount(user);
    this.repository.replaceAccountPassword(user.id, hashPassword(newPassword), authenticated.session);
    return { token: authenticated.token, user: accountView(user) };
  }

  createInvite(token: string | undefined, expiresInDays: number): AccountInviteView {
    const owner = this.requireOwner(token);
    const code = createInviteCode();
    const invite = this.repository.createAccountInvite({
      id: randomUUID(),
      codeHash: hashSecret(code),
      createdByUserId: owner.id,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    });
    return { ...invite, code };
  }

  listInvites(token: string | undefined): AccountInviteView[] {
    const owner = this.requireOwner(token);
    return this.repository.listAccountInvites(owner.id);
  }

  revokeInvite(token: string | undefined, inviteId: string): void {
    const owner = this.requireOwner(token);
    if (!this.repository.revokeAccountInvite(inviteId, owner.id)) {
      throw new Error("邀请码不存在、已使用或已撤销");
    }
  }

  submitPuzzleResult(
    token: string | undefined,
    input: PuzzleResultSubmitRequest
  ): PuzzleResultView {
    const user = this.requireUser(token);
    const result: StoredPuzzleResult = {
      id: randomUUID(),
      userId: user.id,
      displayName: user.displayName,
      game: input.game,
      difficulty: input.difficulty,
      outcome: input.outcome,
      elapsedSeconds: input.elapsedSeconds,
      mistakes: input.mistakes,
      hints: input.hints,
      createdAt: new Date().toISOString()
    };
    this.repository.addPuzzleResult(result);
    return puzzleResultView(result);
  }

  overview(token: string | undefined): AccountOverviewResponse {
    const user = this.requireUser(token);
    const grouped = new Map<string, StoredPuzzleResult[]>();
    for (const result of this.repository.listPuzzleLeaderboardBests()) {
      const key = `${result.game}:${result.difficulty}`;
      const values = grouped.get(key) ?? [];
      values.push(result);
      grouped.set(key, values);
    }
    return {
      totals: this.repository.getPuzzleTotals(user.id),
      personalBests: this.repository.listPersonalPuzzleBests(user.id).map((result) => ({
        game: result.game,
        difficulty: result.difficulty,
        elapsedSeconds: result.elapsedSeconds,
        achievedAt: result.createdAt
      })),
      recentResults: this.repository
        .listRecentPuzzleResults(user.id)
        .map(puzzleResultView),
      leaderboards: [...grouped.values()].map((results) => ({
        game: results[0]?.game ?? "minesweeper",
        difficulty: results[0]?.difficulty ?? "beginner",
        entries: results.map((result, index) => ({
          rank: index + 1,
          userId: result.userId,
          displayName: result.displayName,
          elapsedSeconds: result.elapsedSeconds,
          achievedAt: result.createdAt,
          isSelf: result.userId === user.id
        }))
      }))
    };
  }

  submitGomokuMatch(
    token: string | undefined,
    input: GomokuMatchSubmitRequest
  ): GomokuMatchView {
    const user = this.requireUser(token);
    const state = validateGomokuState(input.state, true);
    const result = state.result;
    if (!result) throw new Error("只记录已结束的五子棋对局");
    const outcome =
      state.mode === "local"
        ? "local"
        : result.outcome === "draw"
          ? "draw"
          : result.outcome === state.humanColor
            ? "win"
            : "loss";
    const match: StoredGomokuMatch = {
      id: randomUUID(),
      userId: user.id,
      gameId: state.id,
      ruleSet: state.ruleSet,
      mode: state.mode,
      ...(state.aiDifficulty ? { aiDifficulty: state.aiDifficulty } : {}),
      ...(state.humanColor ? { humanColor: state.humanColor } : {}),
      winner: result.outcome,
      outcome,
      resultReason: result.reason,
      elapsedSeconds: state.elapsedSeconds,
      moveCount: state.moves.length,
      assisted: state.usedUndo || state.usedHint || (state.setupMoveCount ?? 0) > 0,
      state,
      createdAt: new Date().toISOString()
    };
    if (!this.repository.addGomokuMatch(match)) {
      const existing = this.repository.findGomokuMatchByGameId(user.id, state.id);
      if (existing) return gomokuMatchView(existing);
      throw new Error("五子棋战绩写入失败");
    }
    return gomokuMatchView(match);
  }

  gomokuOverview(token: string | undefined): GomokuOverviewResponse {
    const user = this.requireUser(token);
    const save = this.repository.getGomokuSave(user.id);
    return {
      stats: this.repository.getGomokuStats(user.id),
      recentMatches: this.repository.listRecentGomokuMatches(user.id).map(gomokuMatchView),
      progress: this.repository.listGomokuProgress(user.id).map(gomokuProgressView),
      ...(save ? { save: gomokuSaveView(save) } : {})
    };
  }

  gomokuMatch(token: string | undefined, matchId: string): GomokuMatchDetailView {
    const user = this.requireUser(token);
    const match = this.repository.findGomokuMatch(user.id, matchId);
    if (!match) throw new Error("五子棋对局记录不存在");
    return { ...gomokuMatchView(match), state: match.state };
  }

  updateGomokuSave(
    token: string | undefined,
    input: GomokuSaveUpdateRequest
  ): GomokuSaveView {
    const user = this.requireUser(token);
    const state = validateGomokuState(input.state, false);
    return gomokuSaveView(this.repository.upsertGomokuSave(user.id, state));
  }

  syncGomokuProgress(
    token: string | undefined,
    input: GomokuProgressSyncRequest
  ): GomokuProgressView[] {
    const user = this.requireUser(token);
    for (const item of input.items) {
      if (!GOMOKU_PROGRESS_IDS.has(`${item.contentType}:${item.contentId}`)) {
        throw new Error("五子棋进度包含未知内容");
      }
    }
    return this.repository.upsertGomokuProgress(user.id, input.items).map(gomokuProgressView);
  }

  private newUser(
    input: { username: string; displayName: string; password: string },
    role: "owner" | "member"
  ): StoredAccountUser {
    return {
      id: randomUUID(),
      username: input.username,
      displayName: input.displayName,
      password: hashPassword(input.password),
      role,
      createdAt: new Date().toISOString()
    };
  }

  private newAuthenticatedAccount(user: StoredAccountUser): {
    token: string;
    session: { id: string; tokenHash: string; expiresAt: string };
  } {
    const token = createSessionToken();
    return {
      token,
      session: {
        id: randomUUID(),
        tokenHash: hashSecret(token),
        expiresAt: new Date(Date.now() + ACCOUNT_SESSION_LIFETIME_MS).toISOString()
      }
    };
  }
}

function accountView(user: StoredAccountUser): AccountUserView {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt
  };
}

function puzzleResultView(result: StoredPuzzleResult): PuzzleResultView {
  return {
    id: result.id,
    game: result.game,
    difficulty: result.difficulty,
    outcome: result.outcome,
    elapsedSeconds: result.elapsedSeconds,
    mistakes: result.mistakes,
    hints: result.hints,
    createdAt: result.createdAt
  };
}

function gomokuMatchView(match: StoredGomokuMatch): GomokuMatchView {
  return {
    id: match.id,
    gameId: match.gameId,
    ruleSet: match.ruleSet,
    mode: match.mode,
    ...(match.aiDifficulty ? { aiDifficulty: match.aiDifficulty } : {}),
    ...(match.humanColor ? { humanColor: match.humanColor } : {}),
    winner: match.winner,
    outcome: match.outcome,
    resultReason: match.resultReason,
    elapsedSeconds: match.elapsedSeconds,
    moveCount: match.moveCount,
    assisted: match.assisted,
    createdAt: match.createdAt
  };
}

function gomokuProgressView(
  progress: ReturnType<SqliteRoomRepository["listGomokuProgress"]>[number]
): GomokuProgressView {
  return progress;
}

function gomokuSaveView(
  save: NonNullable<ReturnType<SqliteRoomRepository["getGomokuSave"]>>
): GomokuSaveView {
  return save;
}

function validateGomokuState(
  state: GomokuGameStatePayload,
  requireFinished: boolean
): GomokuGameStatePayload {
  let replay;
  try {
    replay = restoreGomokuGame(state);
  } catch {
    throw new Error("五子棋棋谱无法通过规则校验");
  }
  if (
    replay.currentPlayer !== state.currentPlayer ||
    JSON.stringify(replay.moves) !== JSON.stringify(state.moves)
  ) {
    throw new Error("五子棋棋局状态与棋谱不一致");
  }

  if (!state.result) {
    if (requireFinished) throw new Error("只记录已结束的五子棋对局");
    return state;
  }
  if (JSON.stringify(replay.result) !== JSON.stringify(state.result)) {
    throw new Error("五子棋结算结果与棋谱不一致");
  }
  return state;
}

function createInviteCode(): string {
  return Array.from(
    { length: 12 },
    () => INVITE_ALPHABET[randomInt(0, INVITE_ALPHABET.length)]
  ).join("");
}

function accountWriteError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "账号写入失败";
  if (message.includes("users.username")) return new Error("用户名已存在");
  return error instanceof Error ? error : new Error(message);
}
