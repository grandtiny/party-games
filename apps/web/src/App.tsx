import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Moon,
  RefreshCw,
  ShieldCheck,
  Spade,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ClocktowerNightActionView,
  ClocktowerNightResultView,
  RoomView,
  ServerToClientEvents,
  SocketAck
} from "@party-games/shared";
import { createRoom, joinRoom, recoverRoom } from "./api";
import { AppShell } from "./components/AppShell";
import { ClocktowerDay } from "./components/ClocktowerDay";
import { ClocktowerReferenceButton } from "./components/ClocktowerReferenceDialog";
import { ClocktowerTable } from "./components/ClocktowerTable";
import { getActiveSession, getSession, saveSession, type StoredSession } from "./session";

function HomePage() {
  const active = getActiveSession();
  return (
    <AppShell variant="home">
      <div className="home">
        <header className="home__hero">
          <span className="home__kicker">PARTY GAMES</span>
          <h1 className="home__title">今晚，玩点什么</h1>
          <p className="home__subtitle">为聚会而生的私人桌游空间</p>
        </header>

        {active ? (
          <Link className="home__resume" to={`/clocktower/room/${active.roomCode}`}>
            <span className="home__resume-text">
              <strong>继续房间 {active.roomCode}</strong>
              <small>恢复当前设备上的玩家会话</small>
            </span>
            <ArrowRight size={18} />
          </Link>
        ) : null}

        <section className="home__grid" aria-label="游戏入口">
          <Link className="home__card home__card--clocktower" to="/clocktower">
            <span className="home__card-icon">
              <Clock3 size={30} strokeWidth={1.6} />
            </span>
            <span className="home__card-body">
              <strong>血染钟楼</strong>
              <small>暗流涌动 · 自动说书人</small>
            </span>
            <span className="home__card-cta">
              进入
              <ArrowRight size={16} />
            </span>
          </Link>

          <div className="home__card home__card--poker" aria-disabled="true">
            <span className="home__card-icon">
              <Spade size={30} strokeWidth={1.6} />
            </span>
            <span className="home__card-body">
              <strong>德州扑克</strong>
              <small>入口已预留</small>
            </span>
            <span className="home__card-tag">敬请期待</span>
          </div>
        </section>

        <footer className="home__foot">
          <span>本地部署 · 数据自托管</span>
        </footer>
      </div>
    </AppShell>
  );
}

type EntryMode = "create" | "join" | "recover";

function ClocktowerEntryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<EntryMode>("create");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const session =
        mode === "create"
          ? await createRoom({ gameType: "clocktower", nickname, password })
          : mode === "join"
            ? await joinRoom({ roomCode, nickname, password })
            : await recoverRoom({ roomCode, recoveryCode });
      saveSession(session);
      navigate(`/clocktower/room/${session.roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="血染钟楼" backTo="/" actions={<ClocktowerReferenceButton />}>
      <section className="entry-layout">
        <div className="entry-hero">
          <div className="entry-hero__logo" aria-hidden="true" />
          <div>
            <p className="eyebrow">TROUBLE BREWING</p>
            <h1>暗流涌动</h1>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="进入方式">
          {([
            ["create", "创建"],
            ["join", "加入"],
            ["recover", "恢复"]
          ] as const).map(([value, label]) => (
            <button
              type="button"
              className={mode === value ? "is-active" : ""}
              onClick={() => setMode(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="entry-form" onSubmit={submit}>
          {mode !== "create" ? (
            <label>
              房间码
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                required
              />
            </label>
          ) : null}

          {mode !== "recover" ? (
            <label>
              玩家昵称
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={20}
                autoComplete="nickname"
                required
              />
            </label>
          ) : null}

          {mode === "recover" ? (
            <label>
              六位恢复码
              <input
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={6}
                required
              />
            </label>
          ) : (
            <label>
              房间口令
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={4}
                maxLength={64}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                required
              />
            </label>
          )}

          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={18} /> : mode === "recover" ? <KeyRound size={18} /> : <LogIn size={18} />}
            {mode === "create" ? "创建房间" : mode === "join" ? "加入房间" : "恢复身份"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}

function ClocktowerRoomPage() {
  const params = useParams();
  const roomCode = (params.roomCode ?? "").toUpperCase();
  const session = useMemo(() => getSession(roomCode), [roomCode]);
  const [view, setView] = useState<RoomView>();
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [roleVisible, setRoleVisible] = useState(false);
  const [connected, setConnected] = useState(false);
  const [nightSelection, setNightSelection] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());

  // Socket is created inside the effect (not useMemo) so that every mount owns a
  // fresh connection that is fully torn down on unmount. Under <StrictMode> React
  // mounts→unmounts→remounts in dev: a useMemo socket would be reused across that
  // cycle, leaving it disconnected with stale listeners. Keeping the lifecycle in
  // an effect guarantees a clean connect/disconnect pair each time.
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | undefined>(undefined);
  const sessionToken = session?.sessionToken;

  useEffect(() => {
    if (!sessionToken) return;
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      auth: { roomCode, sessionToken }
    });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("room:view", setView);
    socket.on("room:error", setError);
    socket.on("connect_error", (cause) => setError(cause.message));
    setConnected(socket.connected);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = undefined;
    };
  }, [roomCode, sessionToken]);

  useEffect(() => {
    const hide = () => setRoleVisible(false);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  const nightStepId = view?.self.privateGame?.nightAction?.stepId;
  useEffect(() => {
    setNightSelection([]);
  }, [nightStepId]);

  useEffect(() => {
    if (view?.room.phase !== "voting") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [view?.room.phase]);

  if (!session) return <Navigate to="/clocktower" replace />;

  const send = (action: (callback: (ack: SocketAck) => void) => void) => {
    setActionError(undefined);
    action((ack) => {
      if (!ack.ok) setActionError(ack.error ?? "操作失败");
    });
  };

  const selfPlayer = view?.room.players.find((player) => player.id === view.self.playerId);
  const canStart =
    view?.self.isOwner &&
    view.room.phase === "lobby" &&
    view.room.players.length >= 5 &&
    view.room.players.every((player) => player.seat !== null && player.ready);

  return (
    <AppShell
      title={`房间 ${roomCode}`}
      backTo="/clocktower"
      actions={
        <>
          <ClocktowerReferenceButton />
          <ConnectionStatus connected={connected} />
        </>
      }
    >
      {error ? <div className="notice notice--error">{error}</div> : null}
      {actionError ? <div className="notice notice--error">{actionError}</div> : null}

      {!view ? (
        <div className="loading-block">
          <RefreshCw className="spin" size={22} />
          正在同步房间
        </div>
      ) : (
        <div className="room-layout">
          <section className="room-summary">
            <div>
              <span className="summary-label">房间码</span>
              <strong>{view.room.code}</strong>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="复制房间码"
              onClick={() => navigator.clipboard.writeText(view.room.code)}
            >
              <Copy size={18} />
            </button>
            <div className="summary-spacer" />
            <span className="phase-label">
              {phaseLabel(view.room.phase, view.room.dayNumber)}
            </span>
          </section>

          {view.self.privateGame ? (
            <RoleReveal
              view={view.self.privateGame}
              visible={roleVisible}
              confirmed={Boolean(selfPlayer?.roleConfirmed)}
              canConfirm={view.room.phase === "role-reveal"}
              onPointerDown={() => setRoleVisible(true)}
              onPointerEnd={() => setRoleVisible(false)}
              onConfirm={() =>
                send((callback) => socketRef.current?.emit("clocktower:confirm-role", callback))
              }
            />
          ) : null}

          <ClocktowerTable
            view={view}
            onSetSeat={(seat) =>
              send((callback) => socketRef.current?.emit("room:set-seat", seat, callback))
            }
          />

          {view.room.phase === "first-night" || view.room.phase === "night" ? (
            <NightPanel
              action={view.self.privateGame?.nightAction}
              firstNight={view.room.phase === "first-night"}
              nightNumber={view.room.dayNumber ?? 1}
              selectedPlayerIds={nightSelection}
              onTogglePlayer={(playerId) => {
                const action = view.self.privateGame?.nightAction;
                if (!action || action.kind === "acknowledge") return;
                setNightSelection((current) => {
                  if (current.includes(playerId)) {
                    return current.filter((candidate) => candidate !== playerId);
                  }
                  if (action.kind === "select-one") return [playerId];
                  return current.length >= 2 ? [current[1] as string, playerId] : [...current, playerId];
                });
              }}
              onSubmit={() =>
                send((callback) =>
                  socketRef.current?.emit("clocktower:night-select", nightSelection, callback)
                )
              }
              onAcknowledge={() =>
                send((callback) => socketRef.current?.emit("clocktower:night-ack", callback))
              }
            />
          ) : null}

          {view.room.clocktowerDay ? (
            <ClocktowerDay
              view={view}
              now={now}
              onRequestNominations={() =>
                send((callback) => socketRef.current?.emit("clocktower:request-nominations", callback))
              }
              onNominate={(targetPlayerId) =>
                send((callback) => socketRef.current?.emit("clocktower:nominate", targetPlayerId, callback))
              }
              onRequestClose={() =>
                send((callback) => socketRef.current?.emit("clocktower:request-close-nominations", callback))
              }
              onSetVote={(voting) =>
                send((callback) => socketRef.current?.emit("clocktower:set-vote", voting, callback))
              }
              onSlayerClaim={(targetPlayerId) =>
                send((callback) => socketRef.current?.emit("clocktower:slayer-claim", targetPlayerId, callback))
              }
              onSendChat={(message) =>
                send((callback) => socketRef.current?.emit("chat:send", message, callback))
              }
            />
          ) : null}

          <section className="session-strip">
            <ShieldCheck size={18} />
            <span>
              身份恢复码 <strong>{session.recoveryCode}</strong>
            </span>
          </section>

          {view.room.phase === "lobby" ? (
            <div className="room-actions">
              <button
                className={selfPlayer?.ready ? "secondary-button" : "primary-button"}
                type="button"
                disabled={selfPlayer?.seat === null}
                onClick={() =>
                  send((callback) =>
                    socketRef.current?.emit("room:set-ready", !selfPlayer?.ready, callback)
                  )
                }
              >
                <Check size={18} />
                {selfPlayer?.ready ? "取消准备" : "准备"}
              </button>
              {view.self.isOwner ? (
                <button
                  className="primary-button primary-button--dark"
                  type="button"
                  disabled={!canStart}
                  onClick={() => send((callback) => socketRef.current?.emit("room:start", callback))}
                >
                  <Clock3 size={18} />
                  开始配角
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span className={`connection-state ${connected ? "is-online" : ""}`}>
      <span />
      {connected ? "在线" : "重连中"}
    </span>
  );
}

function RoleReveal({
  view,
  visible,
  confirmed,
  canConfirm,
  onPointerDown,
  onPointerEnd,
  onConfirm
}: {
  view: NonNullable<RoomView["self"]["privateGame"]>;
  visible: boolean;
  confirmed: boolean;
  canConfirm: boolean;
  onPointerDown: () => void;
  onPointerEnd: () => void;
  onConfirm: () => void;
}) {
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onPointerDown();
  };

  return (
    <section className={`role-reveal ${visible ? "is-visible" : ""}`}>
      <button
        className="role-reveal__identity"
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
      >
        {visible ? <EyeOff size={21} /> : <Eye size={21} />}
        {visible ? (
          <span className="role-content">
            <small>{view.role.englishName}</small>
            <strong>{view.role.name}</strong>
            <em>{view.role.team === "good" ? "善良阵营" : "邪恶阵营"}</em>
            <p>{view.role.ability}</p>
          </span>
        ) : (
          <span>
            <strong>按住查看身份</strong>
            <small>松开立即隐藏</small>
          </span>
        )}
      </button>
      {canConfirm ? (
        <button
          className="role-reveal__confirm"
          type="button"
          disabled={confirmed}
          onClick={onConfirm}
        >
          <Check size={18} />
          {confirmed ? "身份已确认" : "确认身份"}
        </button>
      ) : null}
    </section>
  );
}

function NightPanel({
  action,
  firstNight,
  nightNumber,
  selectedPlayerIds,
  onTogglePlayer,
  onSubmit,
  onAcknowledge
}: {
  action: ClocktowerNightActionView | undefined;
  firstNight: boolean;
  nightNumber: number;
  selectedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  onSubmit: () => void;
  onAcknowledge: () => void;
}) {
  if (!action) {
    return (
      <section className="night-panel night-panel--waiting">
        <Moon size={28} />
        <div>
          <span className="summary-label">{firstNight ? "FIRST NIGHT" : `NIGHT ${nightNumber}`}</span>
          <h2>夜晚进行中</h2>
          <p>保持安静，等待系统唤醒。</p>
        </div>
      </section>
    );
  }

  const requiredCount = action.kind === "select-two" ? 2 : 1;
  return (
    <section className="night-panel night-panel--active">
      <div className="night-panel__heading">
        <Moon size={24} />
        <div>
          <span className="summary-label">PRIVATE ACTION</span>
          <h2>{action.title}</h2>
        </div>
      </div>
      <p className="night-instruction">{action.instruction}</p>

      {action.result ? <NightResult result={action.result} /> : null}

      {action.kind !== "acknowledge" ? (
        <div className="night-options">
          {action.options?.map((option) => (
            <button
              type="button"
              className={selectedPlayerIds.includes(option.playerId) ? "is-selected" : ""}
              onClick={() => onTogglePlayer(option.playerId)}
              key={option.playerId}
            >
              <span>{option.seat}</span>
              <span className="night-option-name">
                {option.nickname}
                {!option.alive ? <small>死亡</small> : null}
              </span>
              {selectedPlayerIds.includes(option.playerId) ? <Check size={17} /> : null}
            </button>
          ))}
        </div>
      ) : null}

      <button
        className="primary-button primary-button--night"
        type="button"
        disabled={
          action.kind !== "acknowledge" && selectedPlayerIds.length !== requiredCount
        }
        onClick={action.kind === "acknowledge" ? onAcknowledge : onSubmit}
      >
        <Check size={18} />
        {action.kind === "acknowledge" ? "确认" : "提交选择"}
      </button>
    </section>
  );
}

function NightResult({ result }: { result: ClocktowerNightResultView }) {
  if (result.kind === "number") {
    return <div className="night-result night-result--number">{result.value}</div>;
  }
  if (result.kind === "role") {
    return (
      <div className="night-result night-result--role">
        <small>{result.role.englishName}</small>
        <strong>{result.role.name}</strong>
      </div>
    );
  }
  if (result.kind === "yes-no") {
    return (
      <div className={`night-result night-result--answer ${result.value ? "is-yes" : "is-no"}`}>
        {result.value ? "是" : "否"}
      </div>
    );
  }
  if (result.kind === "no-outsiders") {
    return <div className="night-result">场上没有外来者</div>;
  }
  if (result.kind === "role-pair") {
    return (
      <div className="night-result">
        <strong>{result.role.name}</strong>
        <div className="result-player-pair">
          {result.players.map((player) => (
            <span key={player.playerId}>
              {player.seat}. {player.nickname}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (result.kind === "evil-team") {
    return (
      <div className="night-result night-result--team">
        <ResultGroup label="恶魔" players={result.demonPlayers} />
        <ResultGroup label="爪牙" players={result.minionPlayers} />
        {result.bluffs.length > 0 ? (
          <div>
            <small>不在场角色</small>
            <div className="bluff-list">
              {result.bluffs.map((role) => (
                <span key={role.id}>{role.name}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grimoire-list">
      {result.players.map((player) => (
        <div className={player.alive ? "" : "is-dead"} key={player.playerId}>
          <span className="seat-number">{player.seat}</span>
          <span>
            <strong>{player.nickname}</strong>
            <small>
              {player.role.name}
              {player.shownRole ? `，以为自己是${player.shownRole.name}` : ""}
            </small>
          </span>
          <span className="marker-list">
            {!player.alive ? <em>死亡</em> : null}
            {player.redHerring ? <em>红鲱鱼</em> : null}
            {player.poisoned ? <em>中毒</em> : null}
            {player.protected ? <em>保护</em> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function ResultGroup({
  label,
  players
}: {
  label: string;
  players: Array<{ playerId: string; nickname: string; seat: number }>;
}) {
  return (
    <div>
      <small>{label}</small>
      <div className="result-player-pair">
        {players.map((player) => (
          <span key={player.playerId}>
            {player.seat}. {player.nickname}
          </span>
        ))}
      </div>
    </div>
  );
}

function phaseLabel(phase: RoomView["room"]["phase"], dayNumber?: number): string {
  if (phase === "lobby") return "等待开始";
  if (phase === "role-reveal") return "确认身份";
  if (phase === "first-night") return "首夜";
  if (phase === "day") return `第 ${dayNumber ?? 1} 天 · 讨论`;
  if (phase === "nominations") return `第 ${dayNumber ?? 1} 天 · 提名`;
  if (phase === "voting") return `第 ${dayNumber ?? 1} 天 · 投票`;
  if (phase === "night") return `第 ${dayNumber ?? 1} 夜`;
  return "游戏结束";
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/clocktower" element={<ClocktowerEntryPage />} />
      <Route path="/clocktower/room/:roomCode" element={<ClocktowerRoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
