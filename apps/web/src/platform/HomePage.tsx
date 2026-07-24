import {
  ArrowRight,
  Bomb,
  Clock3,
  FlaskConical,
  Grid3X3,
  Settings as SettingsIcon,
  Spade
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPlatformStatus } from "../api";
import { getActiveSession } from "../session";
import { AppShell } from "./AppShell";

export function HomePage() {
  const active = getActiveSession();
  const [pokerEnabled, setPokerEnabled] = useState(false);

  useEffect(() => {
    void getPlatformStatus()
      .then((status) => setPokerEnabled(status.enabledGames.includes("poker")))
      .catch(() => setPokerEnabled(false));
  }, []);

  const activePath =
    active?.gameType === "poker"
      ? "poker"
      : active?.gameType === "turtle-soup"
        ? "turtle-soup"
        : "clocktower";
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
        <Link className="resume-row" to={`/${activePath}/room/${active.roomCode}`}>
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
        {pokerEnabled ? (
          <Link className="game-card game-card--poker" to="/poker">
            <Spade size={34} strokeWidth={1.8} />
            <span>
              <strong>德州扑克</strong>
              <small>淘汰赛 · 积分桌</small>
            </span>
            <ArrowRight size={20} />
          </Link>
        ) : (
          <div className="game-card game-card--poker" aria-disabled="true">
            <Spade size={34} strokeWidth={1.8} />
            <span>
              <strong>德州扑克</strong>
              <small>入口未启用</small>
            </span>
            <span className="status-label">开发中</span>
          </div>
        )}
        <Link className="game-card game-card--minesweeper" to="/minesweeper">
          <Bomb size={34} strokeWidth={1.8} />
          <span>
            <strong>扫雷</strong>
            <small>经典模式 · 首击安全</small>
          </span>
          <ArrowRight size={20} />
        </Link>
        <Link className="game-card game-card--turtle-soup" to="/turtle-soup">
          <FlaskConical size={34} strokeWidth={1.8} />
          <span>
            <strong>海龟汤</strong>
            <small>多人提问 · 提示词测试</small>
          </span>
          <ArrowRight size={20} />
        </Link>
        <Link className="game-card game-card--sudoku" to="/sudoku">
          <Grid3X3 size={34} strokeWidth={1.8} />
          <span>
            <strong>数独</strong>
            <small>四档难度 · 候选笔记</small>
          </span>
          <ArrowRight size={20} />
        </Link>
      </section>
    </AppShell>
  );
}
