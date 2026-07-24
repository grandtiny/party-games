import { Armchair, Clock3, Crosshair, Crown, Skull, Target, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import type { RoomView } from "@party-games/shared";

interface ClocktowerTableProps {
  view: RoomView;
  onSetSeat: (seat: number | null) => void;
  selectedNightPlayerIds: string[];
  onToggleNightPlayer: (playerId: string) => void;
  onNominate: (playerId: string) => void;
  onSlayerClaim: (playerId: string) => void;
  mini?: boolean;
}

export function ClocktowerTable({
  view,
  onSetSeat,
  selectedNightPlayerIds,
  onToggleNightPlayer,
  onNominate,
  onSlayerClaim,
  mini = false
}: ClocktowerTableProps) {
  const players = view.room.players;
  const seatCount = Math.max(1, players.length);
  const currentVote = view.room.clocktowerDay?.currentVote;
  const playerBySeat = new Map(
    players.flatMap((player) => (player.seat === null ? [] : [[player.seat, player] as const]))
  );
  const waitingPlayers = players.filter((player) => player.seat === null);
  const seatedCount = players.length - waitingPlayers.length;
  const lobby = view.room.phase === "lobby";
  const nightAction = view.self.privateGame?.nightAction;
  const nightOptionIds = new Set(nightAction?.options?.map((option) => option.playerId) ?? []);
  const dayActions = view.self.dayActions;
  const canTargetByDay = Boolean(dayActions?.canNominate || dayActions?.canSlayerClaim);
  const [focusedPlayerId, setFocusedPlayerId] = useState<string>();
  const focusedPlayer = players.find((player) => player.id === focusedPlayerId);

  useEffect(() => {
    setFocusedPlayerId(undefined);
  }, [view.room.phase, nightAction?.stepId]);

  return (
    <section className={`panel clocktower-table${mini ? " ct-table-mini" : ""}`}>
      {!mini ? (
        <div className="panel-heading">
          <div>
            <span className="summary-label">TOWN SQUARE</span>
            <h2>圆桌座位</h2>
          </div>
          <span className="table-count">{seatedCount}/{players.length} 入座</span>
        </div>
      ) : null}

      <div className={`clocktower-table__stage ${mini || seatCount > 10 ? "is-dense" : ""}`}>
        <div className="clocktower-table__ring">
          <div className="clocktower-table__magic-circle" aria-hidden="true" />
          <div className="clocktower-table__center">
            <Clock3 size={24} />
            <strong>暗流涌动</strong>
            <small>{tablePhaseLabel(view.room.phase, view.room.dayNumber)}</small>
          </div>

          {Array.from({ length: seatCount }, (_, index) => index + 1).map((seat) => {
            const player = playerBySeat.get(seat);
            const angle = -Math.PI / 2 + ((seat - 1) / seatCount) * Math.PI * 2;
            const position = {
              "--seat-x": `${50 + Math.cos(angle) * 50}%`,
              "--seat-y": `${50 + Math.sin(angle) * 50}%`
            } as CSSProperties;
            const isSelf = player?.id === view.self.playerId;
            const voteState = player ? currentVoteState(currentVote, player.id) : undefined;
            const nightSelectable = Boolean(player && nightOptionIds.has(player.id));
            const daySelectable = Boolean(
              player && player.alive !== false && canTargetByDay && !nightAction
            );
            const selected = Boolean(
              player &&
                (selectedNightPlayerIds.includes(player.id) || focusedPlayerId === player.id)
            );
            const interactive =
              (lobby && (!player || isSelf)) || nightSelectable || daySelectable;

            return (
              <button
                className={[
                  "clocktower-seat",
                  player ? "is-occupied" : "is-empty",
                  isSelf ? "is-self" : "",
                  player?.alive === false ? "is-dead" : "",
                  player?.id === currentVote?.nomineePlayerId ? "is-nominee" : "",
                  nightSelectable || daySelectable ? "is-selectable" : "",
                  selected ? "is-selected" : "",
                  voteState ? `is-vote-${voteState}` : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                style={position}
                disabled={!interactive}
                aria-label={
                  player
                    ? isSelf && lobby
                      ? `离开${seat}号座位`
                      : `${seat}号座位，${player.nickname}`
                    : `入座${seat}号座位`
                }
                onClick={() => {
                  if (lobby) {
                    onSetSeat(player ? null : seat);
                  } else if (player && nightSelectable) {
                    onToggleNightPlayer(player.id);
                  } else if (player && daySelectable) {
                    setFocusedPlayerId(player.id);
                  }
                }}
                key={seat}
              >
                <span className={`player-avatar avatar-tone-${player ? avatarTone(player.id) : 0}`}>
                  {player ? <span>{avatarInitial(player.nickname)}</span> : <Armchair size={20} />}
                  <span className="player-avatar__seat">{seat}</span>
                  {player?.id === view.room.ownerPlayerId ? (
                    <span className="player-avatar__owner" title="房主">
                      <Crown size={12} />
                    </span>
                  ) : null}
                  {player ? (
                    <span
                      className={`player-avatar__presence ${player.connected ? "is-online" : ""}`}
                      title={player.connected ? "在线" : "离线"}
                    />
                  ) : null}
                  {player?.alive === false ? (
                    <span className="player-avatar__death">
                      <Skull size={18} />
                    </span>
                  ) : null}
                </span>
                <span className="clocktower-seat__name" title={player?.nickname}>
                  {player?.nickname ?? "空位"}
                </span>
                {player ? (
                  <span className="clocktower-seat__status">
                    {player.alive === false
                      ? player.ghostVoteAvailable
                        ? "死亡 · 有票"
                        : "死亡 · 已投"
                      : lobby
                        ? player.ready
                          ? "已准备"
                          : isSelf
                            ? "点击离座"
                            : "未准备"
                        : selected
                          ? "已选择"
                          : nightSelectable || daySelectable
                            ? "可操作"
                            : voteStateLabel(voteState)}
                  </span>
                ) : (
                  <span className="clocktower-seat__status">入座</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {focusedPlayer && canTargetByDay ? (
        <div className="table-player-actions">
          <span className={`waiting-avatar avatar-tone-${avatarTone(focusedPlayer.id)}`}>
            {avatarInitial(focusedPlayer.nickname)}
          </span>
          <span>
            <strong>{focusedPlayer.seat}. {focusedPlayer.nickname}</strong>
            <small>公开操作</small>
          </span>
          <div>
            {dayActions?.canNominate ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  onNominate(focusedPlayer.id);
                  setFocusedPlayerId(undefined);
                }}
              >
                <Target size={17} /> 提名
              </button>
            ) : null}
            {dayActions?.canSlayerClaim ? (
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  onSlayerClaim(focusedPlayer.id);
                  setFocusedPlayerId(undefined);
                }}
              >
                <Crosshair size={17} /> 猎手声明
              </button>
            ) : null}
            <button
              className="icon-button"
              type="button"
              aria-label="取消选择"
              onClick={() => setFocusedPlayerId(undefined)}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ) : null}

      {!mini && waitingPlayers.length > 0 ? (
        <div className="waiting-players">
          <span className="waiting-players__label">候场</span>
          <div>
            {waitingPlayers.map((player) => (
              <span className={player.id === view.self.playerId ? "is-self" : ""} key={player.id}>
                <span className={`waiting-avatar avatar-tone-${avatarTone(player.id)}`}>
                  {avatarInitial(player.nickname)}
                </span>
                {player.nickname}
                {player.id === view.self.playerId ? <small>我</small> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function currentVoteState(
  vote: NonNullable<NonNullable<RoomView["room"]["clocktowerDay"]>["currentVote"]> | undefined,
  playerId: string
) {
  if (!vote) return undefined;
  if (vote.lockedYesPlayerIds.includes(playerId)) return "yes";
  if (vote.lockedNoPlayerIds.includes(playerId)) return "no";
  if (vote.currentVoterPlayerId === playerId) return "current";
  if (vote.raisedPlayerIds.includes(playerId)) return "raised";
  return undefined;
}

function voteStateLabel(state: ReturnType<typeof currentVoteState>): string {
  if (state === "current") return "正在锁票";
  if (state === "raised") return "已举手";
  if (state === "yes") return "赞成";
  if (state === "no") return "反对";
  return "存活";
}

function avatarInitial(nickname: string): string {
  return Array.from(nickname.trim())[0]?.toUpperCase() ?? "?";
}

function avatarTone(playerId: string): number {
  let hash = 0;
  for (const character of playerId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (hash % 6) + 1;
}

function tablePhaseLabel(phase: RoomView["room"]["phase"], dayNumber: number | undefined) {
  if (phase === "lobby") return "准备阶段";
  if (phase === "role-reveal") return "确认身份";
  if (phase === "first-night") return "首夜";
  if (phase === "night") return `第 ${dayNumber ?? 1} 夜`;
  if (phase === "day") return `第 ${dayNumber ?? 1} 天`;
  if (phase === "nominations") return "提名阶段";
  if (phase === "voting") return "顺时针投票";
  return "游戏结束";
}
