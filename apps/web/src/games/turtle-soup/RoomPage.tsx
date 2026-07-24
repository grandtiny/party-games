import {
  Check,
  Copy,
  FlaskConical,
  KeyRound,
  Lightbulb,
  RefreshCw,
  Send,
  Trophy,
  UsersRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  RoomView,
  ServerToClientEvents,
  SocketAck,
  TurtleSoupAnswerView,
  TurtleSoupLogEntryView
} from "@party-games/shared";
import { AppShell } from "../../platform/AppShell";
import { getSession } from "../../session";

type InputMode = "ask" | "guess";

export function TurtleSoupRoomPage() {
  const params = useParams();
  const roomCode = (params.roomCode ?? "").toUpperCase();
  const session = useMemo(() => getSession(roomCode), [roomCode]);
  const [view, setView] = useState<RoomView>();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [mode, setMode] = useState<InputMode>("ask");
  const [draft, setDraft] = useState("");
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

  if (!session) return <Navigate to="/turtle-soup" replace />;

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
    view.room.players.length >= 1 &&
    view.room.players.every((player) => player.seat !== null && player.ready);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    if (mode === "ask") {
      send((callback) => socketRef.current?.emit("turtle-soup:ask", content, callback));
    } else {
      send((callback) => socketRef.current?.emit("turtle-soup:guess", content, callback));
    }
  };

  return (
    <AppShell
      scope="turtle-soup"
      title={`海龟汤 ${roomCode}`}
      backTo="/turtle-soup"
      actions={<ConnectionStatus connected={connected} />}
    >
      {error ? <div className="notice notice--error">{error}</div> : null}
      {actionError ? <div className="notice notice--error">{actionError}</div> : null}

      {!view ? (
        <div className="loading-block">
          <RefreshCw className="spin" size={22} />
          正在同步房间
        </div>
      ) : (
        <div className="turtle-room">
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
              {view.room.phase === "lobby"
                ? "等待开始"
                : view.room.phase === "game-over"
                  ? "汤底揭晓"
                  : "提问中"}
            </span>
          </section>

          {view.room.phase === "lobby" ? (
            <>
              <LobbyPanel
                view={view}
                onSetSeat={(seat) =>
                  send((callback) => socketRef.current?.emit("room:set-seat", seat, callback))
                }
              />
              <section className="session-strip">
                <KeyRound size={18} />
                <span>
                  身份恢复码 <strong>{session.recoveryCode}</strong>
                </span>
              </section>
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
                    <FlaskConical size={18} />
                    开始汤局
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {view.room.turtleSoup ? (
            <>
              <SoupPanel view={view} />
              {view.room.phase !== "game-over" ? (
                <form className="turtle-composer" onSubmit={submit}>
                  <div className="segmented turtle-mode-switch" role="tablist" aria-label="输入模式">
                    <button
                      type="button"
                      className={mode === "ask" ? "is-active" : ""}
                      onClick={() => setMode("ask")}
                    >
                      提问
                    </button>
                    <button
                      type="button"
                      className={mode === "guess" ? "is-active" : ""}
                      onClick={() => setMode("guess")}
                    >
                      猜汤底
                    </button>
                  </div>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={mode === "ask" ? 180 : 500}
                    placeholder={mode === "ask" ? "只能问可用是/不是回答的问题" : "提交完整推理"}
                    required
                  />
                  <div className="turtle-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!view.self.turtleSoup?.canRequestHint}
                      onClick={() =>
                        send((callback) => socketRef.current?.emit("turtle-soup:hint", callback))
                      }
                    >
                      <Lightbulb size={18} />
                      要提示
                    </button>
                    <button className="primary-button" type="submit">
                      <Send size={18} />
                      {mode === "ask" ? "发送提问" : "提交推理"}
                    </button>
                  </div>
                </form>
              ) : view.self.isOwner ? (
                <button
                  className="primary-button rematch-button"
                  type="button"
                  onClick={() =>
                    send((callback) => socketRef.current?.emit("turtle-soup:rematch", callback))
                  }
                >
                  <RefreshCw size={18} />
                  再来一局
                </button>
              ) : null}
            </>
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

function LobbyPanel({
  view,
  onSetSeat
}: {
  view: RoomView;
  onSetSeat: (seat: number | null) => void;
}) {
  const selfId = view.self.playerId;
  return (
    <section className="panel turtle-lobby">
      <div className="panel-heading">
        <span>
          <UsersRound size={18} />
          玩家
        </span>
        <span className="player-count">{view.room.players.length}/15</span>
      </div>
      <div className="turtle-seat-list">
        {view.room.players.map((player, index) => (
          <div className={player.id === selfId ? "is-self" : ""} key={player.id}>
            <span className="seat-number">{player.seat ?? "-"}</span>
            <span>
              <strong>{player.nickname}</strong>
              <small>{player.ready ? "已准备" : "未准备"}</small>
            </span>
            <button
              className="secondary-button"
              type="button"
              disabled={player.id !== selfId}
              onClick={() => onSetSeat(player.seat === null ? index + 1 : null)}
            >
              {player.seat === null ? "入座" : "离座"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function SoupPanel({ view }: { view: RoomView }) {
  const soup = view.room.turtleSoup;
  if (!soup) return null;
  const solved = soup.status === "solved";
  return (
    <>
      <section className="turtle-surface">
        <div className="turtle-surface__heading">
          <FlaskConical size={24} />
          <div>
            <p className="eyebrow">SOUP SURFACE</p>
            <h1>{soup.title}</h1>
          </div>
        </div>
        <p>{soup.surface}</p>
        <div className="turtle-stats">
          <span>{soup.source === "model" ? "AI生成" : "本地降级"}</span>
          <span>{soup.judgeSource === "model" ? "AI裁判" : "本地裁判"}</span>
          <span>提问 {soup.questionCount}</span>
          <span>
            提示 {soup.hintsUsed}/{soup.maxHints}
          </span>
          <span>
            要点 {soup.keyPoints.filter((point) => point.found).length}/{soup.keyPoints.length}
          </span>
        </div>
      </section>

      <section className="panel turtle-progress">
        <div className="panel-heading">
          <span>真相要点</span>
          {solved ? <Trophy size={18} /> : null}
        </div>
        <div className="turtle-keypoints">
          {soup.keyPoints.map((keyPoint, index) => (
            <div className={keyPoint.found ? "is-found" : ""} key={keyPoint.id}>
              <span>{index + 1}</span>
              <p>{keyPoint.text ?? "未揭晓"}</p>
            </div>
          ))}
        </div>
        {soup.answer ? (
          <div className="turtle-answer">
            <strong>汤底</strong>
            <p>{soup.answer}</p>
          </div>
        ) : null}
      </section>

      <section className="panel turtle-log-panel">
        <div className="panel-heading">
          <span>记录</span>
        </div>
        <div className="turtle-log">
          {soup.log.map((entry) => (
            <LogEntry entry={entry} view={view} key={entry.id} />
          ))}
        </div>
      </section>
    </>
  );
}

function LogEntry({ entry, view }: { entry: TurtleSoupLogEntryView; view: RoomView }) {
  const playerName =
    "actorPlayerId" in entry
      ? (view.room.players.find((player) => player.id === entry.actorPlayerId)?.nickname ?? "玩家")
      : "系统";
  if (entry.kind === "system") {
    return (
      <div className="turtle-log-entry turtle-log-entry--system">
        <small>系统</small>
        <p>{entry.content}</p>
      </div>
    );
  }
  if (entry.kind === "question") {
    return (
      <div className="turtle-log-entry">
        <small>{playerName} 提问</small>
        <p>{entry.content}</p>
        <strong className={`turtle-answer-chip turtle-answer-chip--${entry.answer}`}>
          {answerLabel(entry.answer)}
        </strong>
        {entry.note ? <em>{entry.note}</em> : null}
      </div>
    );
  }
  if (entry.kind === "guess") {
    return (
      <div className="turtle-log-entry turtle-log-entry--guess">
        <small>{playerName} 猜汤底</small>
        <p>{entry.content}</p>
        <em>
          命中 {entry.matchedKeyPointIds.length} 个要点
          {entry.wrong ? "，存在错误方向" : ""}
          {entry.comment ? ` · ${entry.comment}` : ""}
        </em>
      </div>
    );
  }
  return (
    <div className="turtle-log-entry turtle-log-entry--hint">
      <small>{playerName} 请求提示</small>
      <p>{entry.content}</p>
    </div>
  );
}

function answerLabel(answer: TurtleSoupAnswerView): string {
  if (answer === "yes") return "是";
  if (answer === "no") return "不是";
  if (answer === "partial") return "是也不是";
  return "无关";
}
