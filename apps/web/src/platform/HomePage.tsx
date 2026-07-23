import {
  ArrowRight,
  Clock3,
  Settings as SettingsIcon,
  Spade
} from "lucide-react";
import { Link } from "react-router-dom";
import { getActiveSession } from "../session";
import { AppShell } from "./AppShell";

export function HomePage() {
  const active = getActiveSession();
  return (
    <AppShell
      actions={
        <Link className="icon-button" to="/settings" aria-label="系统设置" title="系统设置">
          <SettingsIcon size={19} />
        </Link>
      }
    >
      <section className="home-intro">
        <p className="eyebrow">PRIVATE GAME TABLE</p>
        <h1>今晚玩什么</h1>
      </section>

      {active ? (
        <Link className="resume-row" to={`/clocktower/room/${active.roomCode}`}>
          <span>
            <strong>继续房间 {active.roomCode}</strong>
            <small>恢复当前设备上的玩家会话</small>
          </span>
          <ArrowRight size={20} />
        </Link>
      ) : null}

      <section className="game-grid" aria-label="游戏入口">
        <Link className="game-card game-card--clocktower" to="/clocktower">
          <Clock3 size={34} strokeWidth={1.8} />
          <span>
            <strong>血染钟楼</strong>
            <small>暗流涌动 · 自动说书人</small>
          </span>
          <ArrowRight size={20} />
        </Link>
        <div className="game-card game-card--poker" aria-disabled="true">
          <Spade size={34} strokeWidth={1.8} />
          <span>
            <strong>德州扑克</strong>
            <small>入口已预留</small>
          </span>
          <span className="status-label">开发中</span>
        </div>
      </section>
    </AppShell>
  );
}
