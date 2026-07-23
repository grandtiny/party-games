import {
  Check,
  Coins,
  Copy,
  Crown,
  History,
  Medal,
  Play,
  RefreshCw,
  ShieldCheck,
  Trophy,
  TrendingUp,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Navigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  PokerActionRequest,
  PokerTablePlayerView,
  PokerTableView,
  PublicPlayerView,
  RoomView,
  ServerToClientEvents,
  SocketAck
} from "@party-games/shared";
import { AppShell } from "../../platform/AppShell";
import { getSession } from "../../session";

export function PokerRoomPage() {
  const params = useParams();
  const roomCode = (params.roomCode ?? "").toUpperCase();
  const session = useMemo(() => getSession(roomCode), [roomCode]);
  const [view, setView] = useState<RoomView>();
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
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

  const table = view?.room.pokerTable;
  const selfTablePlayer = table?.players.find((player) => player.playerId === view?.self.playerId);
  const legalActions = view?.self.poker?.legalActions;
  const suggestedBet = legalActions?.minAmount ?? 0;

  useEffect(() => {
    setBetAmount(suggestedBet);
  }, [table?.actionPlayerId, table?.handNumber, table?.street, suggestedBet]);

  if (!session) return <Navigate to="/poker" replace />;

  const send = (action: (callback: (ack: SocketAck) => void) => void) => {
    setActionError(undefined);
    action((ack) => {
      if (!ack.ok) setActionError(ack.error ?? "操作失败");
    });
  };

  const emitAction = (action: PokerActionRequest) =>
    send((callback) => socketRef.current?.emit("poker:act", action, callback));

  const selfPlayer = view?.room.players.find((player) => player.id === view.self.playerId);
  const canStart =
    view?.self.isOwner &&
    view.room.phase === "lobby" &&
    view.room.players.length >= 2 &&
    view.room.players.every((player) => player.seat !== null && player.ready);

  return (
    <AppShell
      scope="poker"
      title={`牌桌 ${roomCode}`}
      backTo="/poker"
      actions={<ConnectionStatus connected={connected} />}
    >
      {error ? <div className="notice notice--error">{error}</div> : null}
      {actionError ? <div className="notice notice--error">{actionError}</div> : null}

      {!view ? (
        <div className="loading-block">
          <RefreshCw className="spin" size={22} />
          正在同步牌桌
        </div>
      ) : (
        <div className="poker-room">
          <section className="room-summary poker-room-summary">
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
            <span className="phase-label">{pokerPhaseLabel(view)}</span>
          </section>

          <PokerConfigBar view={view} />

          {view.room.phase === "lobby" ? (
            <>
              <PokerLobbyTable
                players={view.room.players}
                selfPlayerId={view.self.playerId}
                ownerPlayerId={view.room.ownerPlayerId}
                onSetSeat={(seat) =>
                  send((callback) => socketRef.current?.emit("room:set-seat", seat, callback))
                }
              />
              <section className="session-strip">
                <ShieldCheck size={18} />
                <span>
                  身份恢复码 <strong>{session.recoveryCode}</strong>
                </span>
              </section>
              <div className="room-actions poker-lobby-actions">
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
                    <Play size={18} />
                    开始牌桌
                  </button>
                ) : null}
              </div>
            </>
          ) : table ? (
            <>
              <PokerTableStage
                table={table}
                roomPlayers={view.room.players}
                selfPlayerId={view.self.playerId}
              />
              <PokerHandSummary table={table} roomPlayers={view.room.players} />
              <PokerTournamentRanking table={table} />
              <PokerControls
                view={view}
                table={table}
                selfPlayer={selfTablePlayer}
                betAmount={betAmount}
                setBetAmount={setBetAmount}
                emitAction={emitAction}
                emitDeal={() =>
                  send((callback) => socketRef.current?.emit("poker:deal", callback))
                }
                emitRebuy={() =>
                  send((callback) => socketRef.current?.emit("poker:rebuy", callback))
                }
                emitCashOut={() =>
                  send((callback) => socketRef.current?.emit("poker:cash-out", callback))
                }
                emitBuyIn={() =>
                  send((callback) => socketRef.current?.emit("poker:buy-in", callback))
                }
                emitAdvanceBlinds={() =>
                  send((callback) => socketRef.current?.emit("poker:advance-blinds", callback))
                }
                emitRematch={() =>
                  send((callback) => socketRef.current?.emit("poker:rematch", callback))
                }
              />
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

function PokerConfigBar({ view }: { view: RoomView }) {
  const config = view.room.pokerConfig;
  if (!config) return null;
  return (
    <section className="poker-config-bar">
      <span>{config.mode === "tournament" ? "淘汰赛" : "积分桌"}</span>
      <strong>固定买入 500</strong>
      <span>
        盲注 {config.smallBlind}/{config.bigBlind}
      </span>
      {config.mode === "tournament" ? (
        <span>{config.blindStructure?.length ?? 0} 个级别</span>
      ) : null}
    </section>
  );
}

function PokerLobbyTable({
  players,
  selfPlayerId,
  ownerPlayerId,
  onSetSeat
}: {
  players: PublicPlayerView[];
  selfPlayerId: string;
  ownerPlayerId: string;
  onSetSeat: (seat: number | null) => void;
}) {
  const seats = Array.from({ length: Math.max(2, players.length) }, (_, index) => index + 1);
  const seatedPlayers = new Map(
    players.flatMap((player) => (player.seat === null ? [] : [[player.seat, player] as const]))
  );
  const selfSeatIndex = Math.max(0, players.find((player) => player.id === selfPlayerId)?.seat ?? 1) - 1;
  return (
    <section className="poker-lobby-table" aria-label="牌桌座位">
      <div className="poker-felt poker-felt--lobby">
        <div className="poker-felt__mark">
          <span>HOLD'EM</span>
          <small>{players.length}/9</small>
        </div>
        {seats.map((seat, index) => {
          const player = seatedPlayers.get(seat);
          const position = seatPosition(visualSeatIndex(index, seats.length, selfSeatIndex), seats.length);
          const isSelf = player?.id === selfPlayerId;
          return (
            <div className="poker-seat-position" style={position} key={seat}>
              <button
                className={`poker-lobby-seat ${isSelf ? "is-self" : ""}`}
                type="button"
                disabled={Boolean(player && !isSelf)}
                onClick={() => onSetSeat(isSelf ? null : seat)}
              >
                <span className="poker-avatar">
                  {player ? initials(player.nickname) : <UserRound size={18} />}
                </span>
                <strong>{player?.nickname ?? `座位 ${seat}`}</strong>
                <small>
                  {player
                    ? `${player.id === ownerPlayerId ? "房主 · " : ""}${player.ready ? "已准备" : "未准备"}`
                    : "空位"}
                </small>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PokerTableStage({
  table,
  roomPlayers,
  selfPlayerId
}: {
  table: PokerTableView;
  roomPlayers: PublicPlayerView[];
  selfPlayerId: string;
}) {
  const connectedById = new Map(roomPlayers.map((player) => [player.id, player.connected]));
  const selfIndex = Math.max(
    0,
    table.players.findIndex((player) => player.playerId === selfPlayerId)
  );
  return (
    <section className="poker-stage" aria-label="德州扑克牌桌">
      <div className="poker-felt poker-felt--game">
        <div className="poker-board">
          <div className="poker-pot">
            <Coins size={16} />
            <span>底池</span>
            <strong>{table.totalPot}</strong>
          </div>
          <div className="community-cards">
            {Array.from({ length: 5 }, (_, index) => (
              <PlayingCard code={table.board[index]} empty={!table.board[index]} key={index} />
            ))}
          </div>
          <div className="poker-board__meta">
            <span>第 {table.handNumber} 手</span>
            <span>{streetLabel(table.street)}</span>
          </div>
        </div>

        {table.players.map((player, index) => {
          const position = seatPosition(
            visualSeatIndex(index, table.players.length, selfIndex),
            table.players.length
          );
          const isSelf = player.playerId === selfPlayerId;
          const isAction = player.playerId === table.actionPlayerId;
          const isButton = player.playerId === table.buttonPlayerId;
          const isSmallBlind = player.playerId === table.smallBlindPlayerId;
          const isBigBlind = player.playerId === table.bigBlindPlayerId;
          return (
            <div className="poker-seat-position" style={position} key={player.playerId}>
              <div
                className={`poker-player-seat ${isSelf ? "is-self" : ""} ${isAction ? "is-action" : ""} ${!player.atTable ? "is-away" : ""}`}
              >
                {isButton || isSmallBlind || isBigBlind ? (
                  <div className="poker-position-badges" aria-label="牌桌位置">
                    {isButton ? (
                      <span className="poker-position-badge is-dealer" title="庄家">
                        D
                      </span>
                    ) : null}
                    {isSmallBlind ? (
                      <span className="poker-position-badge is-small-blind" title="小盲">
                        SB
                      </span>
                    ) : null}
                    {isBigBlind ? (
                      <span className="poker-position-badge is-big-blind" title="大盲">
                        BB
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="poker-player-seat__topline">
                  <span className={`presence-dot ${connectedById.get(player.playerId) ? "is-online" : ""}`} />
                  <strong>{player.nickname}</strong>
                </div>
                <div className="poker-player-seat__stack">
                  <Coins size={13} /> {player.stack + player.pendingAddOn}
                </div>
                {player.betThisStreet > 0 ? (
                  <span className="poker-player-seat__bet">下注 {player.betThisStreet}</span>
                ) : (
                  <span className="poker-player-seat__status">
                    {player.finishPlace ? `第 ${player.finishPlace} 名` : playerStatusLabel(player.status)}
                  </span>
                )}
                <MiniHand player={player} inHand={table.status === "in-hand"} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PokerTournamentRanking({ table }: { table: PokerTableView }) {
  if (table.mode !== "tournament") return null;
  const ranked = table.players
    .filter((player) => player.finishPlace !== undefined)
    .sort((left, right) => (left.finishPlace ?? 0) - (right.finishPlace ?? 0));
  if (!ranked.length) return null;
  return (
    <section className="poker-ranking" aria-label="淘汰赛排名">
      <div className="poker-ranking__heading">
        <Medal size={17} />
        <strong>{table.status === "complete" ? "最终排名" : "已淘汰玩家"}</strong>
      </div>
      <ol>
        {ranked.map((player) => (
          <li key={player.playerId}>
            <span>{player.finishPlace}</span>
            <strong>{player.nickname}</strong>
            <small>{player.finishPlace === 1 ? "冠军" : `第 ${player.finishPlace} 名`}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PokerHandSummary({
  table,
  roomPlayers
}: {
  table: PokerTableView;
  roomPlayers: PublicPlayerView[];
}) {
  if (table.handNumber === 0) return null;
  const playerNames = new Map(roomPlayers.map((player) => [player.id, player.nickname]));
  const settled = table.winners.length > 0;
  return (
    <section className="poker-hand-summary" aria-label="本手记录">
      <div className="poker-hand-summary__heading">
        <span>
          {settled ? <Trophy size={17} /> : <History size={17} />}
          <strong>第 {table.handNumber} 手</strong>
        </span>
        <small>{settled ? `已结算 · 总底池 ${table.totalPot}` : "行动记录"}</small>
      </div>

      {settled ? (
        <div className="poker-awards">
          {table.winners.map((winner, index) => (
            <div className="poker-award-row" key={`${winner.playerId}-${index}`}>
              <strong>{playerNames.get(winner.playerId) ?? "玩家"}</strong>
              <span>{winner.handRank ? "赢得" : "净赢"} {winner.amount}</span>
              <small>{winner.handRank ? handRankLabel(winner.handRank) : "无人跟注"}</small>
              {winner.hand?.length ? (
                <span className="poker-award-cards">
                  {winner.hand.map((card, cardIndex) => (
                    <AwardCard code={card} key={`${card}-${cardIndex}`} />
                  ))}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {table.actionHistory.length ? (
        <ol className="poker-action-history">
          {table.actionHistory.map((record, index) => (
            <li key={`${record.playerId}-${index}`}>
              <span>{streetLabel(record.street)}</span>
              <strong>{playerNames.get(record.playerId) ?? "玩家"}</strong>
              <span>{pokerActionLabel(record.action, record.amount)}</span>
              {record.allIn ? <em>全下</em> : null}
              <small>底池 {record.potAfter}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="poker-action-history__empty">等待首个玩家行动</p>
      )}
    </section>
  );
}

function MiniHand({ player, inHand }: { player: PokerTablePlayerView; inHand: boolean }) {
  if (!inHand || player.status === "WAITING" || player.status === "BUSTED") return null;
  return (
    <span className="mini-hand" aria-hidden="true">
      {player.hand ? (
        player.hand.map((card, index) => <PlayingCard code={card ?? undefined} compact key={index} />)
      ) : (
        <>
          <PlayingCard hidden compact />
          <PlayingCard hidden compact />
        </>
      )}
    </span>
  );
}

function PokerControls({
  view,
  table,
  selfPlayer,
  betAmount,
  setBetAmount,
  emitAction,
  emitDeal,
  emitRebuy,
  emitCashOut,
  emitBuyIn,
  emitAdvanceBlinds,
  emitRematch
}: {
  view: RoomView;
  table: PokerTableView;
  selfPlayer: PokerTablePlayerView | undefined;
  betAmount: number;
  setBetAmount: (amount: number) => void;
  emitAction: (action: PokerActionRequest) => void;
  emitDeal: () => void;
  emitRebuy: () => void;
  emitCashOut: () => void;
  emitBuyIn: () => void;
  emitAdvanceBlinds: () => void;
  emitRematch: () => void;
}) {
  if (!selfPlayer) return null;
  const legalActions = view.self.poker?.legalActions;
  const can = (action: PokerActionRequest["action"]) =>
    legalActions?.actions.includes(action) ?? false;
  const isActing = Boolean(legalActions);
  const callAmount = legalActions?.callAmount ?? 0;
  const aggressiveAction = legalActions?.aggressiveAction;
  const minAmount = legalActions?.minAmount ?? 0;
  const maxAmount = legalActions?.maxAmount ?? 0;
  const canRebuy =
    table.mode === "points" &&
    table.status === "waiting-hand" &&
    selfPlayer.atTable &&
    selfPlayer.stack + selfPlayer.pendingAddOn === 0;
  const canCashOut =
    table.mode === "points" &&
    table.status === "waiting-hand" &&
    selfPlayer.atTable &&
    selfPlayer.stack + selfPlayer.pendingAddOn > 0;
  const canBuyIn =
    table.mode === "points" && table.status === "waiting-hand" && !selfPlayer.atTable;
  const canAdvance =
    view.self.isOwner &&
    table.mode === "tournament" &&
    table.status === "waiting-hand" &&
    table.blindLevel < (view.room.pokerConfig?.blindStructure?.length ?? 1) - 1;
  const canDeal = table.players.filter(
    (player) => player.atTable && player.stack + player.pendingAddOn > 0
  ).length >= 2;

  return (
    <section className="poker-controls">
      <div className="poker-own-hand">
        <div>
          <span className="summary-label">你的手牌</span>
          <strong>{selfPlayer.nickname}</strong>
        </div>
        <div className="poker-own-hand__cards">
          {selfPlayer.atTable ? (
            (selfPlayer.hand ?? [undefined, undefined]).map((card, index) => (
              <PlayingCard
                code={card ?? undefined}
                hidden={!card && table.status === "in-hand"}
                key={index}
              />
            ))
          ) : (
            <span className="poker-no-hand">已离桌</span>
          )}
        </div>
        <div className="poker-own-hand__score">
          <span>筹码 {selfPlayer.stack + selfPlayer.pendingAddOn}</span>
          {selfPlayer.netPoints === undefined ? null : <strong>积分 {signed(selfPlayer.netPoints)}</strong>}
        </div>
      </div>

      {table.status === "complete" ? (
        <div className="poker-result-banner">
          <Crown size={22} />
          <strong>{table.players.find((player) => player.playerId === table.winnerPlayerId)?.nickname}</strong>
          <span>获胜</span>
        </div>
      ) : isActing ? (
        <div className="poker-action-bar">
          <button
            className="secondary-button poker-fold-button"
            type="button"
            disabled={!can("fold")}
            onClick={() => emitAction({ action: "fold" })}
          >
            弃牌
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!can(callAmount > 0 ? "call" : "check")}
            onClick={() => emitAction({ action: callAmount > 0 ? "call" : "check" })}
          >
            {callAmount > 0 ? `跟注 ${Math.min(callAmount, selfPlayer.stack)}` : "过牌"}
          </button>
          {aggressiveAction ? (
            <div className="poker-bet-control">
              <input
                type="number"
                min={minAmount}
                max={maxAmount}
                value={betAmount}
                onChange={(event) => setBetAmount(Number(event.target.value))}
                aria-label={aggressiveAction === "bet" ? "下注金额" : "加注至"}
              />
              <button
                className="primary-button"
                type="button"
                disabled={
                  !Number.isInteger(betAmount) ||
                  betAmount < minAmount ||
                  betAmount > maxAmount
                }
                onClick={() => emitAction({ action: aggressiveAction, amount: betAmount })}
              >
                {aggressiveAction === "bet" ? "下注" : "加注至"} {betAmount}
              </button>
              {maxAmount > minAmount ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => emitAction({ action: aggressiveAction, amount: maxAmount })}
                >
                  全下 {maxAmount}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="poker-no-raise">当前不能加注</div>
          )}
        </div>
      ) : (
        <div className="poker-waiting-state">
          {table.status === "waiting-hand"
            ? !selfPlayer.atTable
              ? "你已离桌，可以重新入座"
              : view.self.isOwner
                ? canDeal
                  ? "可以发下一手"
                  : "至少需要两名有筹码的在桌玩家"
                : "等待房主发牌"
            : `等待 ${table.players.find((player) => player.playerId === table.actionPlayerId)?.nickname ?? "玩家"} 行动`}
        </div>
      )}

      <div className="poker-table-commands">
        {view.self.isOwner && table.status === "waiting-hand" ? (
          <button
            className="primary-button primary-button--dark"
            type="button"
            disabled={!canDeal}
            onClick={emitDeal}
          >
            <Play size={18} />
            发下一手
          </button>
        ) : null}
        {canAdvance ? (
          <button className="secondary-button" type="button" onClick={emitAdvanceBlinds}>
            <TrendingUp size={18} />
            提升盲注
          </button>
        ) : null}
        {canRebuy ? (
          <button className="secondary-button" type="button" onClick={emitRebuy}>
            <Coins size={18} />
            重新买入 500
          </button>
        ) : null}
        {canCashOut ? (
          <button className="secondary-button" type="button" onClick={emitCashOut}>
            <Coins size={18} />
            离桌结算
          </button>
        ) : null}
        {canBuyIn ? (
          <button className="primary-button" type="button" onClick={emitBuyIn}>
            <Coins size={18} />
            重新入座 500
          </button>
        ) : null}
        {view.self.isOwner && table.status === "complete" ? (
          <button className="primary-button primary-button--dark" type="button" onClick={emitRematch}>
            <RefreshCw size={18} />
            重新开赛
          </button>
        ) : null}
      </div>
    </section>
  );
}

function PlayingCard({
  code,
  hidden = false,
  empty = false,
  compact = false
}: {
  code?: string | undefined;
  hidden?: boolean;
  empty?: boolean;
  compact?: boolean;
}) {
  if (empty) return <span className={`playing-card is-empty ${compact ? "is-compact" : ""}`} />;
  if (hidden || !code) {
    return <span className={`playing-card is-hidden ${compact ? "is-compact" : ""}`} />;
  }
  const suitCode = code.slice(-1).toLowerCase();
  const rank = code.slice(0, -1).replace("T", "10");
  const suit = suitCode === "h" ? "♥" : suitCode === "d" ? "♦" : suitCode === "c" ? "♣" : "♠";
  const red = suitCode === "h" || suitCode === "d";
  return (
    <span className={`playing-card ${red ? "is-red" : ""} ${compact ? "is-compact" : ""}`}>
      <strong>{rank}</strong>
      <span>{suit}</span>
    </span>
  );
}

function AwardCard({ code }: { code: string }) {
  const suitCode = code.slice(-1).toLowerCase();
  const rank = code.slice(0, -1).replace("T", "10");
  const suit =
    suitCode === "h" ? "♥" : suitCode === "d" ? "♦" : suitCode === "c" ? "♣" : "♠";
  const red = suitCode === "h" || suitCode === "d";
  return (
    <span className={`poker-award-card ${red ? "is-red" : ""}`}>
      {rank}
      {suit}
    </span>
  );
}

function seatPosition(index: number, count: number): CSSProperties {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    left: `${50 + Math.cos(angle) * 40}%`,
    top: `${50 + Math.sin(angle) * 37}%`
  };
}

function visualSeatIndex(index: number, count: number, selfIndex: number): number {
  return (index - selfIndex + Math.ceil(count / 2)) % count;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

function pokerPhaseLabel(view: RoomView): string {
  if (view.room.phase === "lobby") return "等待入座";
  if (view.room.phase === "game-over") return "对局结束";
  const table = view.room.pokerTable;
  if (!table || table.status === "waiting-hand") return "等待发牌";
  return streetLabel(table.street);
}

function streetLabel(street: PokerTableView["street"]): string {
  if (street === "PREFLOP") return "翻牌前";
  if (street === "FLOP") return "翻牌";
  if (street === "TURN") return "转牌";
  if (street === "RIVER") return "河牌";
  return "摊牌";
}

function playerStatusLabel(status: PokerTablePlayerView["status"]): string {
  if (status === "ACTIVE") return "行动中";
  if (status === "FOLDED") return "已弃牌";
  if (status === "ALL_IN") return "全下";
  if (status === "BUSTED") return "已出局";
  if (status === "SITTING_OUT") return "暂离";
  return "等待";
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function pokerActionLabel(
  action: PokerTableView["actionHistory"][number]["action"],
  amount?: number
): string {
  if (action === "fold") return "弃牌";
  if (action === "check") return "过牌";
  if (action === "call") return `跟注${amount === undefined ? "" : ` ${amount}`}`;
  if (action === "bet") return `下注${amount === undefined ? "" : ` ${amount}`}`;
  if (action === "raise") return `加注至${amount === undefined ? "" : ` ${amount}`}`;
  return `退回未跟注筹码${amount === undefined ? "" : ` ${amount}`}`;
}

function handRankLabel(rank: string): string {
  const labels: Array<[string, string]> = [
    ["Royal Flush", "皇家同花顺"],
    ["Straight Flush", "同花顺"],
    ["Four of a Kind", "四条"],
    ["Full House", "葫芦"],
    ["Flush", "同花"],
    ["Straight", "顺子"],
    ["Three of a Kind", "三条"],
    ["Two Pair", "两对"],
    ["Pair", "一对"],
    ["High Card", "高牌"]
  ];
  const matched = labels.find(([prefix]) => rank.startsWith(prefix));
  return matched ? `${matched[1]} · ${rank}` : rank;
}
