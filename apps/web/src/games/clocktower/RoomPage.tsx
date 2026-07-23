import {
  Check,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Moon,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ClocktowerNightActionView,
  ClocktowerNightResultView,
  RoomView,
  ServerToClientEvents,
  SocketAck
} from "@party-games/shared";
import { getSession } from "../../session";
import { AppShell } from "../../platform/AppShell";
import { ClocktowerDay } from "./components/ClocktowerDay";
import { ClocktowerReferenceButton } from "./components/ClocktowerReferenceDialog";
import { ClocktowerTable } from "./components/ClocktowerTable";

/** 哥特分割印章：取代卡片之间的留白 */
function CtDivider() {
  return (
    <div className="ct-divider" aria-hidden="true">
      <span />
    </div>
  );
}

export function ClocktowerRoomPage() {
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
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | undefined>(
    undefined
  );
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
      scope="clocktower"
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
            <>
              <CtDivider />
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
            </>
          ) : null}

          <CtDivider />
          <ClocktowerTable
            view={view}
            onSetSeat={(seat) =>
              send((callback) => socketRef.current?.emit("room:set-seat", seat, callback))
            }
            selectedNightPlayerIds={nightSelection}
            onToggleNightPlayer={(playerId) => {
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
            onNominate={(targetPlayerId) =>
              send((callback) =>
                socketRef.current?.emit("clocktower:nominate", targetPlayerId, callback)
              )
            }
            onSlayerClaim={(targetPlayerId) =>
              send((callback) =>
                socketRef.current?.emit("clocktower:slayer-claim", targetPlayerId, callback)
              )
            }
          />

          {view.room.phase === "first-night" || view.room.phase === "night" ? (
            <>
              <CtDivider />
              <NightPanel
                action={view.self.privateGame?.nightAction}
                firstNight={view.room.phase === "first-night"}
                nightNumber={view.room.dayNumber ?? 1}
                selectedPlayerIds={nightSelection}
                onSubmit={() =>
                  send((callback) =>
                    socketRef.current?.emit("clocktower:night-select", nightSelection, callback)
                  )
                }
                onAcknowledge={() =>
                  send((callback) => socketRef.current?.emit("clocktower:night-ack", callback))
                }
              />
            </>
          ) : null}

          {view.room.clocktowerDay ? (
            <>
              <CtDivider />
              <ClocktowerDay
              view={view}
              now={now}
              onRequestNominations={() =>
                send((callback) =>
                  socketRef.current?.emit("clocktower:request-nominations", callback)
                )
              }
              onRequestClose={() =>
                send((callback) =>
                  socketRef.current?.emit("clocktower:request-close-nominations", callback)
                )
              }
              onSetVote={(voting) =>
                send((callback) =>
                  socketRef.current?.emit("clocktower:set-vote", voting, callback)
                )
              }
              onSendChat={(message) =>
                send((callback) => socketRef.current?.emit("chat:send", message, callback))
              }
              onRematch={() =>
                send((callback) => socketRef.current?.emit("clocktower:rematch", callback))
              }
            />
            </>
          ) : null}

          <CtDivider />
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
                  onClick={() =>
                    send((callback) => socketRef.current?.emit("room:start", callback))
                  }
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
  onSubmit,
  onAcknowledge
}: {
  action: ClocktowerNightActionView | undefined;
  firstNight: boolean;
  nightNumber: number;
  selectedPlayerIds: string[];
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
        <div className="night-selection-summary">
          <span>{selectedPlayerIds.length}/{requiredCount}</span>
          <div>
            {selectedPlayerIds.map((playerId) => {
              const player = action.options?.find((option) => option.playerId === playerId);
              return player ? <strong key={playerId}>{player.seat}. {player.nickname}</strong> : null;
            })}
          </div>
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
