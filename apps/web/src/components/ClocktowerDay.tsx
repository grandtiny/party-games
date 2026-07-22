import {
  Check,
  CircleDot,
  Crosshair,
  Hand,
  MessageCircle,
  Moon,
  Send,
  Skull,
  Sun,
  Target,
  Trophy,
  Users,
  Vote,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import type {
  ChatMessageView,
  DayPublicEventView,
  RoomView
} from "@party-games/shared";

type PlayerView = RoomView["room"]["players"][number];

interface ClocktowerDayProps {
  view: RoomView;
  now: number;
  onRequestNominations: () => void;
  onNominate: (targetPlayerId: string) => void;
  onRequestClose: () => void;
  onSetVote: (voting: boolean) => void;
  onSlayerClaim: (targetPlayerId: string) => void;
  onSendChat: (message: { recipientPlayerId?: string; content: string }) => void;
}

export function ClocktowerDay({
  view,
  now,
  onRequestNominations,
  onNominate,
  onRequestClose,
  onSetVote,
  onSlayerClaim,
  onSendChat
}: ClocktowerDayProps) {
  const day = view.room.clocktowerDay;
  if (!day) return null;

  const playerById = new Map(view.room.players.map((player) => [player.id, player]));
  const alivePlayers = view.room.players.filter((player) => player.alive !== false);
  const majority = Math.floor(alivePlayers.length / 2) + 1;
  const chatWritable = ["day", "nominations", "voting"].includes(view.room.phase);

  return (
    <>
      {view.room.phase === "game-over" ? (
        <GameOverPanel winner={day.winner} reason={day.endReason} />
      ) : view.room.phase !== "night" ? (
        <>
          <DayHeader
            dayNumber={view.room.dayNumber ?? 1}
            phase={view.room.phase}
            aliveCount={alivePlayers.length}
          />
          <DayControlPanel
            view={view}
            now={now}
            alivePlayers={alivePlayers}
            majority={majority}
            playerById={playerById}
            onRequestNominations={onRequestNominations}
            onNominate={onNominate}
            onRequestClose={onRequestClose}
            onSetVote={onSetVote}
            onSlayerClaim={onSlayerClaim}
          />
        </>
      ) : null}

      <PublicEventPanel events={day.publicEvents} playerById={playerById} />
      <ChatPanel
        messages={view.chatMessages}
        players={view.room.players}
        selfPlayerId={view.self.playerId}
        writable={chatWritable}
        onSend={onSendChat}
      />
    </>
  );
}

function DayHeader({
  dayNumber,
  phase,
  aliveCount
}: {
  dayNumber: number;
  phase: RoomView["room"]["phase"];
  aliveCount: number;
}) {
  const title =
    phase === "voting" ? "顺时针投票" : phase === "nominations" ? "提名阶段" : "自由讨论";
  return (
    <section className="day-banner">
      <Sun size={24} />
      <div>
        <span className="summary-label">DAY {dayNumber}</span>
        <h2>{title}</h2>
      </div>
      <strong>{aliveCount} 人存活</strong>
    </section>
  );
}

function DayControlPanel({
  view,
  now,
  alivePlayers,
  majority,
  playerById,
  onRequestNominations,
  onNominate,
  onRequestClose,
  onSetVote,
  onSlayerClaim
}: {
  view: RoomView;
  now: number;
  alivePlayers: PlayerView[];
  majority: number;
  playerById: Map<string, PlayerView>;
  onRequestNominations: () => void;
  onNominate: (targetPlayerId: string) => void;
  onRequestClose: () => void;
  onSetVote: (voting: boolean) => void;
  onSlayerClaim: (targetPlayerId: string) => void;
}) {
  const day = view.room.clocktowerDay;
  const actions = view.self.dayActions;
  const [nomineeId, setNomineeId] = useState("");
  const [slayerTargetId, setSlayerTargetId] = useState("");
  if (!day || !actions) return null;

  const nominationRequested = day.nominationRequestPlayerIds.includes(view.self.playerId);
  const closeRequested = day.closeRequestPlayerIds.includes(view.self.playerId);

  return (
    <section className="panel day-control-panel">
      <div className="panel-heading">
        <div>
          <span className="summary-label">PUBLIC TABLE</span>
          <h2>白天裁定</h2>
        </div>
        <span className="player-count">
          <Users size={16} /> 多数 {majority} 票
        </span>
      </div>

      {day.stage === "discussion" ? (
        <div className="day-control-block">
          <ControlProgress
            icon={<Vote size={19} />}
            title="进入提名"
            current={day.nominationRequestPlayerIds.length}
            required={majority}
          />
          <button
            className={nominationRequested ? "secondary-button" : "primary-button"}
            type="button"
            disabled={!actions.canRequestNominations}
            onClick={onRequestNominations}
          >
            {nominationRequested ? <Check size={18} /> : <Vote size={18} />}
            {nominationRequested ? "已申请进入提名" : "申请进入提名"}
          </button>
        </div>
      ) : null}

      {day.stage === "nominations" ? (
        <div className="day-control-block">
          <ExecutionBlock day={day} playerById={playerById} />
          <ActionPicker
            label="提名玩家"
            value={nomineeId}
            onChange={setNomineeId}
            players={alivePlayers}
            disabled={!actions.canNominate}
            buttonLabel={
              day.nominatorsUsedPlayerIds.includes(view.self.playerId) ? "今天已提名" : "确认提名"
            }
            icon={<Target size={18} />}
            onSubmit={() => {
              if (!nomineeId) return;
              onNominate(nomineeId);
              setNomineeId("");
            }}
          />
          <ControlProgress
            icon={<CircleDot size={19} />}
            title="结束提名"
            current={day.closeRequestPlayerIds.length}
            required={majority}
          />
          <button
            className={closeRequested ? "secondary-button" : "primary-button primary-button--dark"}
            type="button"
            disabled={!actions.canRequestClose}
            onClick={onRequestClose}
          >
            {closeRequested ? <Check size={18} /> : <CircleDot size={18} />}
            {closeRequested ? "已申请结束提名" : "申请结束提名"}
          </button>
        </div>
      ) : null}

      {day.stage === "voting" && day.currentVote ? (
        <VotingPanel
          view={view}
          now={now}
          playerById={playerById}
          onSetVote={onSetVote}
        />
      ) : null}

      {(day.stage === "discussion" || day.stage === "nominations") ? (
        <div className="slayer-control">
          <div className="slayer-control__heading">
            <Crosshair size={19} />
            <span>
              <strong>公开发动猎手能力</strong>
              <small>任何玩家都可以声明，系统仅按真实隐藏状态结算</small>
            </span>
          </div>
          <ActionPicker
            label="选择目标"
            value={slayerTargetId}
            onChange={setSlayerTargetId}
            players={alivePlayers}
            disabled={!actions.canSlayerClaim}
            buttonLabel={
              day.slayerClaimUsedPlayerIds.includes(view.self.playerId) ? "今天已声明" : "公开声明"
            }
            icon={<Crosshair size={18} />}
            danger
            onSubmit={() => {
              if (!slayerTargetId) return;
              onSlayerClaim(slayerTargetId);
              setSlayerTargetId("");
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

function ExecutionBlock({
  day,
  playerById
}: {
  day: NonNullable<RoomView["room"]["clocktowerDay"]>;
  playerById: Map<string, PlayerView>;
}) {
  const names = day.blockNomineePlayerIds.map((playerId) => playerName(playerById, playerId));
  return (
    <div className="execution-block">
      <span className="summary-label">当前处决台</span>
      {day.blockVoteCount === 0 ? (
        <strong>尚无人达到过半票</strong>
      ) : (
        <strong>
          {day.blockVoteCount} 票 · {names.length === 1 ? names[0] : `${names.join("、")} 平票`}
        </strong>
      )}
    </div>
  );
}

function ActionPicker({
  label,
  value,
  onChange,
  players,
  disabled,
  buttonLabel,
  icon,
  danger = false,
  onSubmit
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  players: PlayerView[];
  disabled: boolean;
  buttonLabel: string;
  icon: React.ReactNode;
  danger?: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="action-picker">
      <label>
        <span>{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          <option value="">请选择</option>
          {players.map((player) => (
            <option value={player.id} key={player.id}>
              {player.seat ?? "?"}. {player.nickname}
            </option>
          ))}
        </select>
      </label>
      <button
        className={danger ? "danger-button" : "primary-button"}
        type="button"
        disabled={disabled || !value}
        onClick={onSubmit}
      >
        {icon}
        {buttonLabel}
      </button>
    </div>
  );
}

function ControlProgress({
  icon,
  title,
  current,
  required
}: {
  icon: React.ReactNode;
  title: string;
  current: number;
  required: number;
}) {
  return (
    <div className="control-progress">
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{current} / {required} 人已申请</small>
      </span>
      <div aria-hidden="true">
        <span style={{ width: `${Math.min(100, (current / required) * 100)}%` }} />
      </div>
    </div>
  );
}

function VotingPanel({
  view,
  now,
  playerById,
  onSetVote
}: {
  view: RoomView;
  now: number;
  playerById: Map<string, PlayerView>;
  onSetVote: (voting: boolean) => void;
}) {
  const vote = view.room.clocktowerDay?.currentVote;
  const actions = view.self.dayActions;
  if (!vote || !actions) return null;

  const remainingSeconds = Math.max(0, vote.nextLockAt - now) / 1000;
  const currentVoter = vote.currentVoterPlayerId
    ? playerById.get(vote.currentVoterPlayerId)
    : undefined;
  const liveYesCount = vote.lockedYesPlayerIds.length + vote.raisedPlayerIds.length;
  const selfLockedYes = vote.lockedYesPlayerIds.includes(view.self.playerId);
  const selfLockedNo = vote.lockedNoPlayerIds.includes(view.self.playerId);

  return (
    <div className="voting-panel">
      <div className="vote-heading">
        <span>
          <small>提名</small>
          <strong>{playerName(playerById, vote.nominatorPlayerId)}</strong>
        </span>
        <Target size={20} />
        <span>
          <small>被提名</small>
          <strong>{playerName(playerById, vote.nomineePlayerId)}</strong>
        </span>
      </div>

      <div className="vote-status">
        <span>
          <small>当前玩家</small>
          <strong>{currentVoter ? `${currentVoter.seat ?? "?"}. ${currentVoter.nickname}` : "结算中"}</strong>
        </span>
        <span className="vote-countdown" aria-label={`距离锁票 ${remainingSeconds.toFixed(1)} 秒`}>
          {remainingSeconds.toFixed(1)}s
        </span>
        <span>
          <small>当前举票</small>
          <strong>{liveYesCount} 票</strong>
        </span>
      </div>

      <div className="vote-order" aria-label="顺时针投票顺序">
        {vote.order.map((playerId, index) => {
          const player = playerById.get(playerId);
          const status = vote.lockedYesPlayerIds.includes(playerId)
            ? "yes"
            : vote.lockedNoPlayerIds.includes(playerId)
              ? "no"
              : vote.currentVoterPlayerId === playerId
                ? "current"
                : vote.raisedPlayerIds.includes(playerId)
                  ? "raised"
                  : "pending";
          return (
            <div className={`vote-seat vote-seat--${status}`} key={playerId}>
              <span>{player?.seat ?? index + 1}</span>
              <small>{player?.nickname ?? "未知"}</small>
              {status === "yes" || status === "raised" ? <Hand size={15} /> : status === "no" ? <X size={15} /> : null}
            </div>
          );
        })}
      </div>

      <button
        className={actions.currentVoteIntent ? "vote-button is-raised" : "vote-button"}
        type="button"
        disabled={!actions.canSetVoteIntent}
        onClick={() => onSetVote(!actions.currentVoteIntent)}
      >
        {actions.currentVoteIntent ? <X size={20} /> : <Hand size={20} />}
        {actions.currentVoteIntent
          ? "撤下手"
          : selfLockedYes
            ? "已计为赞成"
            : selfLockedNo
              ? "已计为反对"
              : "举手投票"}
      </button>
    </div>
  );
}

function GameOverPanel({
  winner,
  reason
}: {
  winner: "good" | "evil" | undefined;
  reason: string | undefined;
}) {
  return (
    <section className={`game-over-panel game-over-panel--${winner ?? "unknown"}`}>
      <Trophy size={34} />
      <span className="summary-label">GAME OVER</span>
      <h2>{winner === "good" ? "善良阵营获胜" : winner === "evil" ? "邪恶阵营获胜" : "游戏结束"}</h2>
      <p>{reason ?? "胜负已经结算"}</p>
    </section>
  );
}

function PublicEventPanel({
  events,
  playerById
}: {
  events: DayPublicEventView[];
  playerById: Map<string, PlayerView>;
}) {
  if (events.length === 0) return null;
  return (
    <section className="panel event-panel">
      <div className="panel-heading">
        <div>
          <span className="summary-label">PUBLIC LOG</span>
          <h2>公共记录</h2>
        </div>
      </div>
      <div className="event-list">
        {events.map((event, index) => (
          <div className="event-row" key={`${event.kind}-${index}`}>
            <span className="event-icon">{eventIcon(event)}</span>
            <span>{eventText(event, playerById)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChatPanel({
  messages,
  players,
  selfPlayerId,
  writable,
  onSend
}: {
  messages: ChatMessageView[];
  players: PlayerView[];
  selfPlayerId: string;
  writable: boolean;
  onSend: (message: { recipientPlayerId?: string; content: string }) => void;
}) {
  const otherPlayers = players.filter((player) => player.id !== selfPlayerId);
  const [mode, setMode] = useState<"public" | "private">("public");
  const [privatePlayerId, setPrivatePlayerId] = useState(otherPlayers[0]?.id ?? "");
  const [content, setContent] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!privatePlayerId && otherPlayers[0]) setPrivatePlayerId(otherPlayers[0].id);
  }, [otherPlayers, privatePlayerId]);

  const visibleMessages = useMemo(() => {
    if (mode === "public") return messages.filter((message) => !message.recipientPlayerId);
    return messages.filter(
      (message) =>
        message.recipientPlayerId &&
        ((message.senderPlayerId === selfPlayerId && message.recipientPlayerId === privatePlayerId) ||
          (message.senderPlayerId === privatePlayerId && message.recipientPlayerId === selfPlayerId))
    );
  }, [messages, mode, privatePlayerId, selfPlayerId]);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [visibleMessages.length, mode, privatePlayerId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !writable || (mode === "private" && !privatePlayerId)) return;
    onSend({
      ...(mode === "private" ? { recipientPlayerId: privatePlayerId } : {}),
      content: trimmed
    });
    setContent("");
  };

  return (
    <section className="panel chat-panel">
      <div className="panel-heading chat-panel__heading">
        <div>
          <span className="summary-label">MESSAGES</span>
          <h2>聊天</h2>
        </div>
        {!writable ? <span className="chat-locked"><Moon size={14} /> 已锁定</span> : null}
      </div>
      <div className="chat-tabs" role="tablist" aria-label="聊天频道">
        <button className={mode === "public" ? "is-active" : ""} type="button" onClick={() => setMode("public")}>
          <MessageCircle size={17} /> 公屏
        </button>
        <button
          className={mode === "private" ? "is-active" : ""}
          type="button"
          disabled={otherPlayers.length === 0}
          onClick={() => setMode("private")}
        >
          <Users size={17} /> 私聊
        </button>
      </div>

      {mode === "private" ? (
        <label className="chat-recipient">
          <span>私聊对象</span>
          <select value={privatePlayerId} onChange={(event) => setPrivatePlayerId(event.target.value)}>
            {otherPlayers.map((player) => (
              <option value={player.id} key={player.id}>
                {player.seat ?? "?"}. {player.nickname}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="chat-feed" ref={feedRef} aria-live="polite">
        {visibleMessages.length === 0 ? (
          <div className="chat-empty">暂无消息</div>
        ) : (
          visibleMessages.map((message) => (
            <ChatMessage
              message={message}
              players={players}
              selfPlayerId={selfPlayerId}
              key={message.id}
            />
          ))
        )}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={500}
          disabled={!writable}
          placeholder={writable ? (mode === "public" ? "发送到公屏" : "发送私聊") : "当前阶段不能发送消息"}
          aria-label="消息内容"
        />
        <button className="icon-button" type="submit" disabled={!writable || !content.trim()} aria-label="发送消息">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}

function ChatMessage({
  message,
  players,
  selfPlayerId
}: {
  message: ChatMessageView;
  players: PlayerView[];
  selfPlayerId: string;
}) {
  const own = message.senderPlayerId === selfPlayerId;
  const sender = players.find((player) => player.id === message.senderPlayerId);
  return (
    <div className={`chat-message ${own ? "is-own" : ""}`}>
      <span className="chat-message__meta">
        {own ? "我" : sender ? `${sender.seat ?? "?"}. ${sender.nickname}` : "未知玩家"}
        <time>{formatTime(message.createdAt)}</time>
      </span>
      <p>{message.content}</p>
    </div>
  );
}

function eventIcon(event: DayPublicEventView) {
  if (event.kind === "night-deaths") return <Moon size={17} />;
  if (event.kind === "nomination") return <Target size={17} />;
  if (event.kind === "vote-completed") return <Vote size={17} />;
  if (event.kind === "slayer-claim") return <Crosshair size={17} />;
  if (event.kind === "execution") return <Skull size={17} />;
  if (event.kind === "game-over") return <Trophy size={17} />;
  return <CircleDot size={17} />;
}

function eventText(event: DayPublicEventView, playerById: Map<string, PlayerView>): string {
  if (event.kind === "night-deaths") {
    return event.playerIds.length === 0
      ? "昨夜无人死亡"
      : `昨夜死亡：${event.playerIds.map((playerId) => playerName(playerById, playerId)).join("、")}`;
  }
  if (event.kind === "nominations-opened") return "多数玩家同意，提名阶段开始";
  if (event.kind === "nomination") {
    return `${playerName(playerById, event.nominatorPlayerId)} 提名了 ${playerName(playerById, event.nomineePlayerId)}`;
  }
  if (event.kind === "vote-completed") {
    return `${playerName(playerById, event.nomineePlayerId)} 获得 ${event.votes} 票`;
  }
  if (event.kind === "slayer-claim") {
    return `${playerName(playerById, event.playerId)} 对 ${playerName(playerById, event.targetPlayerId)} 发动猎手声明，${event.targetDied ? "目标死亡" : "没有事情发生"}`;
  }
  if (event.kind === "execution") {
    if (!event.playerId) return "今天无人被处决";
    const reason = event.reason === "virgin" ? "贞洁者能力" : "投票";
    return `${playerName(playerById, event.playerId)} 因${reason}被处决`;
  }
  return `${event.winner === "good" ? "善良" : "邪恶"}阵营获胜：${event.reason}`;
}

function playerName(playerById: Map<string, PlayerView>, playerId: string): string {
  const player = playerById.get(playerId);
  return player ? `${player.seat ?? "?"}. ${player.nickname}` : "未知玩家";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
