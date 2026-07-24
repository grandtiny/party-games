import { Moon, Sun, Target, Trophy, Users, Vote } from "lucide-react";
import type { RoomView } from "@party-games/shared";
import type { CtTabId } from "../tabs";

interface CtStageBarProps {
  view: RoomView;
  onJumpTab?: (tabId: CtTabId) => void;
}

export function CtStageBar({ view, onJumpTab }: CtStageBarProps) {
  const phase = view.room.phase;
  const day = view.room.dayNumber ?? 1;
  const aliveCount = view.room.players.filter((p) => p.alive !== false).length;
  const ctDay = view.room.clocktowerDay;

  let icon = <Moon size={20} />;
  let title = "等待开始";
  let sub = "";
  let jumpTarget: CtTabId | null = null;

  if (phase === "lobby") {
    icon = <Users size={20} />;
    title = "准备阶段";
    sub = `${view.room.players.length} 人加入`;
  } else if (phase === "role-reveal") {
    icon = <Target size={20} />;
    title = "确认身份";
  } else if (phase === "first-night" || phase === "night") {
    icon = <Moon size={20} />;
    title = phase === "first-night" ? "首夜 · 保持安静" : `第 ${day} 夜 · 保持安静`;
  } else if (phase === "day") {
    icon = <Sun size={20} />;
    title = `第 ${day} 天 · 讨论`;
    sub = `${aliveCount} 人存活`;
    jumpTarget = "operate";
  } else if (phase === "nominations") {
    icon = <Vote size={20} />;
    title = `第 ${day} 天 · 提名`;
    sub = ctDay ? `${ctDay.blockNomineePlayerIds.length} 人被提名` : "";
    jumpTarget = "operate";
  } else if (phase === "voting") {
    icon = <Vote size={20} />;
    title = `第 ${day} 天 · 投票`;
    jumpTarget = "vote";
  } else if (phase === "game-over") {
    icon = <Trophy size={20} />;
    title = "游戏结束";
    jumpTarget = "review";
  }

  return (
    <div className="ct-stage-bar">
      <span className="ct-stage-bar__icon">{icon}</span>
      <span className="ct-stage-bar__title">{title}</span>
      {sub ? <span className="ct-stage-bar__sub">{sub}</span> : null}
      {jumpTarget && onJumpTab ? (
        <button
          type="button"
          className="ct-stage-bar__jump"
          onClick={() => onJumpTab(jumpTarget)}
          aria-label="跳转到操作"
        >
          查看 ▸
        </button>
      ) : null}
    </div>
  );
}
