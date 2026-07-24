import type {
  AccountInviteView,
  AccountOverviewResponse,
  AccountStatusResponse,
  PuzzleGame
} from "@party-games/shared";
import {
  Check,
  Clipboard,
  Crown,
  History,
  KeyRound,
  LogIn,
  LogOut,
  Save,
  ShieldCheck,
  Trophy,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  bootstrapAccount,
  changeAccountPassword,
  createAccountInvite,
  getAccountInvites,
  getAccountOverview,
  loginAccount,
  logoutAccount,
  registerAccount,
  revokeAccountInvite,
  updateAccountProfile
} from "../api";
import { AppShell } from "./AppShell";
import { useAccount } from "./AccountContext";

type AuthMode = "login" | "register";
type AccountTab = "records" | "rankings" | "profile";

export function AccountPage() {
  const { status, loading, error, refresh } = useAccount();

  return (
    <AppShell scope="platform" title="账号与记录" backTo="/" hideAccountAction>
      {loading ? <div className="notice">正在读取账号…</div> : null}
      {error ? <div className="notice notice--error">{error}</div> : null}
      {!loading && status && !status.initialized ? (
        <BootstrapForm status={status} onAuthenticated={refresh} />
      ) : null}
      {!loading && status?.initialized && !status.authenticated ? (
        <AccountAccessForm onAuthenticated={refresh} />
      ) : null}
      {!loading && status?.authenticated && status.user ? (
        <AccountWorkspace status={status} onStatusChange={refresh} />
      ) : null}
    </AppShell>
  );
}

function BootstrapForm({
  status,
  onAuthenticated
}: {
  status: AccountStatusResponse;
  onAuthenticated: () => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [legacyAdminPassword, setLegacyAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await bootstrapAccount({
        username,
        displayName,
        password,
        ...(status.legacyAdminRequired ? { legacyAdminPassword } : {})
      });
      await onAuthenticated();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-access">
      <div className="account-access__heading">
        <ShieldCheck size={32} />
        <div>
          <p className="eyebrow">OWNER ACCOUNT</p>
          <h1>创建管理员账号</h1>
        </div>
      </div>
      <form className="settings-form" onSubmit={submit}>
        <div className="account-field-grid">
          <label>
            用户名
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              minLength={3}
              maxLength={24}
              autoComplete="username"
              required
            />
          </label>
          <label>
            显示名
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={20}
              autoComplete="nickname"
              required
            />
          </label>
        </div>
        {status.legacyAdminRequired ? (
          <label>
            原管理员密码
            <input
              type="password"
              value={legacyAdminPassword}
              onChange={(event) => setLegacyAdminPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="current-password"
              required
            />
          </label>
        ) : null}
        <div className="account-field-grid">
          <label>
            账号密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            确认密码
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={busy}>
          <Crown size={18} />
          {busy ? "创建中…" : "创建并登录"}
        </button>
      </form>
    </section>
  );
}

function AccountAccessForm({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === "login") await loginAccount({ username, password });
      else await registerAccount({ username, displayName, password, inviteCode });
      await onAuthenticated();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-access">
      <div className="account-access__heading">
        {mode === "login" ? <LogIn size={32} /> : <UserPlus size={32} />}
        <div>
          <p className="eyebrow">PLAYER ACCOUNT</p>
          <h1>{mode === "login" ? "账号登录" : "邀请码注册"}</h1>
        </div>
      </div>
      <div className="segmented account-auth-switch" role="tablist" aria-label="账号操作">
        <button
          type="button"
          className={mode === "login" ? "is-active" : ""}
          onClick={() => setMode("login")}
        >
          登录
        </button>
        <button
          type="button"
          className={mode === "register" ? "is-active" : ""}
          onClick={() => setMode("register")}
        >
          注册
        </button>
      </div>
      <form className="settings-form" onSubmit={submit}>
        <label>
          用户名
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            minLength={3}
            maxLength={24}
            autoComplete="username"
            required
          />
        </label>
        {mode === "register" ? (
          <label>
            显示名
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={20}
              autoComplete="nickname"
              required
            />
          </label>
        ) : null}
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
        {mode === "register" ? (
          <label>
            邀请码
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              minLength={12}
              maxLength={12}
              autoComplete="off"
              required
            />
          </label>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={busy}>
          {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
          {busy ? "处理中…" : mode === "login" ? "登录" : "创建账号"}
        </button>
      </form>
    </section>
  );
}

function AccountWorkspace({
  status,
  onStatusChange
}: {
  status: AccountStatusResponse;
  onStatusChange: () => Promise<void>;
}) {
  const user = status.user;
  const [tab, setTab] = useState<AccountTab>("records");
  const [overview, setOverview] = useState<AccountOverviewResponse>();
  const [invites, setInvites] = useState<AccountInviteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextOverview, nextInvites] = await Promise.all([
        getAccountOverview(),
        user?.role === "owner" ? getAccountInvites() : Promise.resolve([])
      ]);
      setOverview(nextOverview);
      setInvites(nextInvites);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const logout = async () => {
    await logoutAccount();
    await onStatusChange();
  };

  return (
    <div className="account-workspace">
      <section className="account-identity">
        <div className="account-avatar">{user?.displayName.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="eyebrow">{user?.role === "owner" ? "OWNER" : "MEMBER"}</p>
          <h1>{user?.displayName}</h1>
          <span>@{user?.username}</span>
        </div>
        <button className="icon-button" type="button" onClick={logout} title="退出账号">
          <LogOut size={19} />
        </button>
      </section>

      <div className="segmented account-tabs" role="tablist" aria-label="账号视图">
        {([
          ["records", "记录"],
          ["rankings", "排行"],
          ["profile", "账号"]
        ] as const).map(([value, label]) => (
          <button
            type="button"
            className={tab === value ? "is-active" : ""}
            onClick={() => setTab(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="notice">正在读取记录…</div> : null}
      {error ? <div className="notice notice--error">{error}</div> : null}
      {!loading && overview && tab === "records" ? <RecordsView overview={overview} /> : null}
      {!loading && overview && tab === "rankings" ? (
        <RankingsView overview={overview} />
      ) : null}
      {!loading && user && tab === "profile" ? (
        <ProfileView
          displayName={user.displayName}
          isOwner={user.role === "owner"}
          invites={invites}
          onStatusChange={onStatusChange}
          onInvitesChange={setInvites}
        />
      ) : null}
    </div>
  );
}

function RecordsView({ overview }: { overview: AccountOverviewResponse }) {
  return (
    <div className="account-panel-stack">
      <section className="account-summary" aria-label="对局统计">
        <AccountMetric label="总场次" value={overview.totals.all} />
        <AccountMetric label="扫雷" value={overview.totals.minesweeper} />
        <AccountMetric label="数独" value={overview.totals.sudoku} />
        <AccountMetric label="完成" value={overview.totals.wins} />
      </section>

      <section className="account-section">
        <div className="account-section__heading">
          <Trophy size={21} />
          <h2>个人最佳</h2>
        </div>
        {overview.personalBests.length > 0 ? (
          <div className="account-best-grid">
            {overview.personalBests.map((best) => (
              <div className="account-best" key={`${best.game}-${best.difficulty}`}>
                <span>{gameLabel(best.game)} · {difficultyLabel(best.game, best.difficulty)}</span>
                <strong>{formatTime(best.elapsedSeconds)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="account-empty">暂无完成记录</p>
        )}
      </section>

      <section className="account-section">
        <div className="account-section__heading">
          <History size={21} />
          <h2>最近对局</h2>
        </div>
        {overview.recentResults.length > 0 ? (
          <div className="account-result-list">
            {overview.recentResults.map((result) => (
              <div className="account-result-row" key={result.id}>
                <span>
                  <strong>{gameLabel(result.game)}</strong>
                  <small>
                    {difficultyLabel(result.game, result.difficulty)} · {formatDate(result.createdAt)}
                  </small>
                </span>
                <span className={result.outcome === "win" ? "is-win" : "is-loss"}>
                  {result.outcome === "win" ? formatTime(result.elapsedSeconds) : "未完成"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="account-empty">暂无对局记录</p>
        )}
      </section>
    </div>
  );
}

function AccountMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RankingsView({ overview }: { overview: AccountOverviewResponse }) {
  return (
    <div className="account-panel-stack">
      {overview.leaderboards.length > 0 ? (
        overview.leaderboards.map((board) => (
          <section className="account-section" key={`${board.game}-${board.difficulty}`}>
            <div className="account-section__heading">
              <UsersRound size={21} />
              <h2>{gameLabel(board.game)} · {difficultyLabel(board.game, board.difficulty)}</h2>
            </div>
            <div className="account-ranking-list">
              {board.entries.map((entry) => (
                <div className={entry.isSelf ? "is-self" : ""} key={entry.userId}>
                  <strong>{entry.rank}</strong>
                  <span>{entry.displayName}</span>
                  <time>{formatTime(entry.elapsedSeconds)}</time>
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="account-empty">暂无排行榜成绩</p>
      )}
    </div>
  );
}

function ProfileView({
  displayName,
  isOwner,
  invites,
  onStatusChange,
  onInvitesChange
}: {
  displayName: string;
  isOwner: boolean;
  invites: AccountInviteView[];
  onStatusChange: () => Promise<void>;
  onInvitesChange: (invites: AccountInviteView[]) => void;
}) {
  return (
    <div className="account-panel-stack">
      <ProfileForm displayName={displayName} onStatusChange={onStatusChange} />
      <PasswordForm onStatusChange={onStatusChange} />
      {isOwner ? (
        <InviteManager invites={invites} onInvitesChange={onInvitesChange} />
      ) : null}
    </div>
  );
}

function ProfileForm({
  displayName,
  onStatusChange
}: {
  displayName: string;
  onStatusChange: () => Promise<void>;
}) {
  const [value, setValue] = useState(displayName);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(undefined);
    setError(undefined);
    try {
      await updateAccountProfile({ displayName: value });
      await onStatusChange();
      setMessage("显示名已更新");
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <section className="account-section">
      <div className="account-section__heading">
        <Save size={21} />
        <h2>个人资料</h2>
      </div>
      <form className="settings-form settings-form--wide" onSubmit={submit}>
        <label>
          显示名
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={20}
            required
          />
        </label>
        {message ? <div className="notice notice--success">{message}</div> : null}
        {error ? <div className="notice notice--error">{error}</div> : null}
        <div className="settings-actions">
          <button className="secondary-button" type="submit">
            <Save size={18} /> 保存
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm({ onStatusChange }: { onStatusChange: () => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("两次输入的新密码不一致");
      return;
    }
    setMessage(undefined);
    setError(undefined);
    try {
      await changeAccountPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      await onStatusChange();
      setMessage("密码已更新");
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <section className="account-section">
      <div className="account-section__heading">
        <KeyRound size={21} />
        <h2>修改密码</h2>
      </div>
      <form className="settings-form settings-form--wide" onSubmit={submit}>
        <label>
          当前密码
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete="current-password"
            required
          />
        </label>
        <div className="account-field-grid">
          <label>
            新密码
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            确认新密码
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
        </div>
        {message ? <div className="notice notice--success">{message}</div> : null}
        {error ? <div className="notice notice--error">{error}</div> : null}
        <div className="settings-actions">
          <button className="secondary-button" type="submit">
            <KeyRound size={18} /> 更新密码
          </button>
        </div>
      </form>
    </section>
  );
}

function InviteManager({
  invites,
  onInvitesChange
}: {
  invites: AccountInviteView[];
  onInvitesChange: (invites: AccountInviteView[]) => void;
}) {
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [newInvite, setNewInvite] = useState<AccountInviteView>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const create = async () => {
    setMessage(undefined);
    setError(undefined);
    try {
      const invite = await createAccountInvite({ expiresInDays });
      setNewInvite(invite);
      onInvitesChange(await getAccountInvites());
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  const copy = async () => {
    if (!newInvite?.code) return;
    await navigator.clipboard.writeText(newInvite.code);
    setMessage("邀请码已复制");
  };

  const revoke = async (inviteId: string) => {
    setMessage(undefined);
    setError(undefined);
    try {
      await revokeAccountInvite(inviteId);
      onInvitesChange(await getAccountInvites());
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <section className="account-section">
      <div className="account-section__heading">
        <UserPlus size={21} />
        <h2>邀请码</h2>
      </div>
      <div className="invite-create-row">
        <select
          value={expiresInDays}
          onChange={(event) => setExpiresInDays(Number(event.target.value))}
          aria-label="邀请码有效期"
        >
          <option value={1}>1 天</option>
          <option value={7}>7 天</option>
          <option value={30}>30 天</option>
        </select>
        <button className="secondary-button" type="button" onClick={create}>
          <UserPlus size={18} /> 生成邀请码
        </button>
      </div>
      {newInvite?.code ? (
        <div className="invite-code">
          <code>{newInvite.code}</code>
          <button className="icon-button" type="button" onClick={copy} title="复制邀请码">
            <Clipboard size={18} />
          </button>
        </div>
      ) : null}
      {message ? <div className="notice notice--success">{message}</div> : null}
      {error ? <div className="notice notice--error">{error}</div> : null}
      <div className="invite-list">
        {invites.map((invite) => {
          const state = inviteState(invite);
          return (
            <div key={invite.id}>
              <span>
                {state.icon}
                <small>{state.label} · {formatDate(invite.createdAt)}</small>
              </span>
              {state.revocable ? (
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => revoke(invite.id)}
                  title="撤销邀请码"
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function inviteState(invite: AccountInviteView): {
  label: string;
  icon: ReactNode;
  revocable: boolean;
} {
  if (invite.usedAt) {
    return {
      label: `已由 ${invite.usedByDisplayName ?? "成员"} 使用`,
      icon: <Check size={17} />,
      revocable: false
    };
  }
  if (invite.revokedAt) return { label: "已撤销", icon: <X size={17} />, revocable: false };
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    return { label: "已过期", icon: <X size={17} />, revocable: false };
  }
  return {
    label: `有效至 ${formatDate(invite.expiresAt)}`,
    icon: <Check size={17} />,
    revocable: true
  };
}

function gameLabel(game: PuzzleGame): string {
  return game === "minesweeper" ? "扫雷" : "数独";
}

function difficultyLabel(game: PuzzleGame, difficulty: string): string {
  const labels: Record<string, string> =
    game === "minesweeper"
      ? { beginner: "初级", intermediate: "中级", expert: "高级" }
      : { easy: "简单", medium: "普通", hard: "困难", expert: "专家" };
  return labels[difficulty] ?? difficulty;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "操作失败";
}
