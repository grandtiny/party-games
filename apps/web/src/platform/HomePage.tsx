import {
  ArrowRight,
  Bomb,
  Bot,
  ChevronRight,
  CircleDot,
  Clock3,
  FlaskConical,
  Grid3X3,
  Settings as SettingsIcon,
  Spade,
  Sparkles,
  UserRound,
  UsersRound,
  Wheat
} from "lucide-react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPlatformStatus } from "../api";
import { getActiveSession } from "../session";
import { AppShell } from "./AppShell";

interface GameEntry {
  accent: string;
  description: string;
  disabled?: boolean;
  icon: LucideIcon;
  id: string;
  note: string;
  tags: string[];
  title: string;
  to: string;
  tint: string;
}

interface GameSection {
  description: string;
  icon: LucideIcon;
  id: "social" | "persistent" | "solo";
  kicker: string;
  title: string;
  games: GameEntry[];
}

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
  const sections: GameSection[] = [
    {
      id: "social",
      icon: UsersRound,
      kicker: "多人桌台",
      title: "拉人开局",
      description: "适合线下面对面或远程连线，一台设备发起，其他人加入。",
      games: [
        {
          id: "clocktower",
          title: "血染钟楼",
          description: "暗流涌动 · 自动说书人",
          note: "5-15 人阵营推理",
          tags: ["多人", "推理", "房间制"],
          to: "/clocktower",
          icon: Clock3,
          accent: "#b4232d",
          tint: "#fff4f4"
        },
        {
          id: "poker",
          title: "德州扑克",
          description: pokerEnabled ? "淘汰赛 · 积分桌" : "入口未启用",
          note: pokerEnabled ? "桌局与 AI 补位" : "服务端开关关闭",
          tags: pokerEnabled ? ["多人", "牌局", "筹码"] : ["开发中"],
          to: "/poker",
          icon: Spade,
          disabled: !pokerEnabled,
          accent: "#16734a",
          tint: "#f0f8f4"
        },
        {
          id: "turtle-soup",
          title: "海龟汤",
          description: "多人提问 · 模型裁判",
          note: "共用汤面逐步逼近真相",
          tags: ["多人", "问答", "AI"],
          to: "/turtle-soup",
          icon: FlaskConical,
          accent: "#355f63",
          tint: "#f0f7f6"
        }
      ]
    },
    {
      id: "persistent",
      icon: Wheat,
      kicker: "长期经营",
      title: "回来收成",
      description: "使用现有账号保存庄园进度，作物会按现实时间持续成长。",
      games: [
        {
          id: "manor",
          title: "怀旧庄园",
          description: "经典农牧场 · 好友互动",
          note: "实时成长与账号存档",
          tags: ["账号存档", "经营", "长期成长"],
          to: "/manor",
          icon: Wheat,
          accent: "#3f7049",
          tint: "#eef6e9"
        }
      ]
    },
    {
      id: "solo",
      icon: UserRound,
      kicker: "单人挑战",
      title: "自己练一局",
      description: "不等人，直接进入可反复玩的棋盘、题库和经典益智游戏。",
      games: [
        {
          id: "gomoku",
          title: "五子棋",
          description: "禁手规则 · 单人 AI",
          note: "残局、教学和逐手复盘",
          tags: ["单人", "AI", "复盘"],
          to: "/gomoku",
          icon: CircleDot,
          accent: "#7a4b21",
          tint: "#f8f2ea"
        },
        {
          id: "minesweeper",
          title: "扫雷",
          description: "经典模式 · 首击安全",
          note: "桌面经典节奏",
          tags: ["单人", "计时", "经典"],
          to: "/minesweeper",
          icon: Bomb,
          accent: "#b45309",
          tint: "#fff7ed"
        },
        {
          id: "sudoku",
          title: "数独",
          description: "四档难度 · 候选笔记",
          note: "从轻松到专家题",
          tags: ["单人", "逻辑", "笔记"],
          to: "/sudoku",
          icon: Grid3X3,
          accent: "#315aa6",
          tint: "#f1f5ff"
        }
      ]
    }
  ];

  return (
    <AppShell
      scope="home"
      actions={
        <Link className="icon-button" to="/settings" aria-label="系统设置" title="系统设置">
          <SettingsIcon size={19} />
        </Link>
      }
    >
      <section className="home-intro">
        <div>
          <p className="eyebrow">PARTY GAMES</p>
          <h1>
            今晚<span className="home-intro__mark">玩什么</span>
          </h1>
          <p className="home-intro__copy">多人桌台、长期经营和单人挑战分区进入，临场选游戏更快。</p>
        </div>
        <div className="home-intro__summary" aria-label="大厅概览">
          <span>
            <UsersRound size={16} />
            多人 3
          </span>
          <span>
            <UserRound size={16} />
            单人 3
          </span>
          <span>
            <Wheat size={16} />
            经营 1
          </span>
          <span>
            <Sparkles size={16} />
            私人局
          </span>
        </div>
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

      <div className="home-catalog">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          const [featuredGame, ...laneGames] = section.games;
          return (
            <section
              className={`game-section game-section--${section.id}`}
              aria-labelledby={`home-${section.id}-title`}
              key={section.id}
            >
              <div className="game-section__heading">
                <span className="game-section__icon" aria-hidden="true">
                  <SectionIcon size={22} strokeWidth={1.9} />
                </span>
                <div>
                  <p className="eyebrow">{section.kicker}</p>
                  <h2 id={`home-${section.id}-title`}>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
              </div>
              <div className={`game-section__body ${laneGames.length ? "" : "is-single"}`}>
                {featuredGame ? <GameCard game={featuredGame} variant="featured" /> : null}
                {laneGames.length ? (
                  <div className="game-lane">
                    {laneGames.map((game) => (
                      <GameCard game={game} key={game.id} variant="compact" />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}

function GameCard({ game, variant }: { game: GameEntry; variant: "featured" | "compact" }) {
  const Icon = game.icon;
  const cardStyle = {
    "--game-card-accent": game.accent,
    "--game-card-tint": game.tint
  } as CSSProperties;
  const content = (
    <>
      <span className="game-card__header">
        <span className="game-card__icon" aria-hidden="true">
          <Icon size={30} strokeWidth={1.85} />
        </span>
        <span className="game-card__note">{game.note}</span>
      </span>
      <span className="game-card__body">
        <strong>{game.title}</strong>
        <small>{game.description}</small>
      </span>
      <span className="game-card__footer">
        <span className="game-card__tags">
          {game.tags.map((tag) => (
            <span className="game-card__tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>
        <span className="game-card__go" aria-hidden="true">
          {game.disabled ? <Bot size={17} /> : <ChevronRight size={18} />}
        </span>
      </span>
    </>
  );

  if (game.disabled) {
    return (
      <div
        className={`game-card game-card--${game.id} game-card--${variant} is-disabled`}
        style={cardStyle}
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      className={`game-card game-card--${game.id} game-card--${variant}`}
      style={cardStyle}
      to={game.to}
      aria-label={`进入${game.title}`}
    >
      {content}
    </Link>
  );
}
