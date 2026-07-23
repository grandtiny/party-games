# 房间页布局重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将血染钟楼房间页从"垂直长堆叠"重构为"底部 Tab 栏 + 圆桌缩小 + 阶段横幅"的紧凑布局，解决手机端需滚动 2.6 屏才能操作的问题。

**Architecture:** 根容器改为 `height:100dvh; overflow:hidden`（整页不滚动），拆为顶栏/主体（阶段横幅+圆桌+Tab内容区）/底部Tab栏三块。Tab 内容复用现有组件（只改挂载位置，不动 props/事件）。桌面端 ≥900px 改双栏。

**Tech Stack:** React 19 + TypeScript + CSS（theme.css 作用域 `.app-shell--clocktower`），Vite HMR 热更新。

## Global Constraints

- **作用域**：所有新样式以 `.app-shell--clocktower` 为前缀，集中在 `apps/web/src/games/clocktower/theme.css`，不污染平台层 `apps/web/src/styles.css`
- **零业务逻辑改动**：所有组件的 props/state/socket 事件不变，只调整渲染挂载位置
- **不触碰**：后端、德州扑克、`fonts.css`、平台层（除非血染作用域覆盖被压制）
- **测试方式**：Vite HMR 已在运行（5173+3000），每步改完刷新浏览器观察；类型检查 `tsc --noEmit`；有 8 人测试房间 `QBZDV5`（口令 dev-local，恢复码 946842）可观察各阶段
- **TypeScript 检查命令**：`D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`（在 `D:/PartyGame/party-games` 目录下）
- **commit 约定**：只在用户要求时提交。本计划每个 Task 末尾的 commit 步骤是建议，执行时若用户未要求则跳过

---

## File Structure

**新增文件：**
- `apps/web/src/games/clocktower/components/CtTabBar.tsx` — 底部 Tab 栏组件（阶段感知）
- `apps/web/src/games/clocktower/components/CtStageBar.tsx` — 统一阶段横幅组件
- `apps/web/src/games/clocktower/components/CtIdentityButton.tsx` — 顶栏身份入口按钮 + 浮层
- `apps/web/src/games/clocktower/tabs.ts` — Tab 配置定义（阶段→Tab 映射、显示条件）

**修改文件：**
- `apps/web/src/games/clocktower/components/ClocktowerDay.tsx` — 导出 `DayControlPanel`/`VotingPanel`/`GameOverPanel`/`PublicEventPanel`/`ChatPanel`/`DayHeader`（供 Tab 复用）
- `apps/web/src/games/clocktower/RoomPage.tsx` — 重写主结构为三区域骨架 + Tab 状态管理
- `apps/web/src/games/clocktower/components/ClocktowerTable.tsx` — 圆桌缩小模式（移除标题栏/候场条，加 mini 变体）
- `apps/web/src/games/clocktower/theme.css` — 新布局样式（`.ct-room-main`/`.ct-tabbar`/`.ct-stage-bar`/`.ct-table-mini`/桌面双栏）

---

## Task 1: 导出 ClocktowerDay 的内部子组件

**目的**：把 `ClocktowerDay.tsx` 里非导出的内部函数组件（`DayControlPanel`/`VotingPanel`/`GameOverPanel`/`PublicEventPanel`/`ChatPanel`/`DayHeader`）改为 `export`，供 Task 5 的 Tab 内容复用。不改任何逻辑，只加 export 关键字。

**Files:**
- Modify: `apps/web/src/games/clocktower/components/ClocktowerDay.tsx`

**Interfaces:**
- Produces: `DayHeader`/`DayControlPanel`/`VotingPanel`/`GameOverPanel`/`PublicEventPanel`/`ChatPanel` 均为具名导出，签名不变（参数解构类型不变）

- [ ] **Step 1: 给 6 个内部函数加 export 前缀**

逐个把 `function Xxx(` 改为 `export function Xxx(`。涉及行（当前文件）：
- `DayHeader`（约 99 行）
- `DayControlPanel`（约 122 行）
- `VotingPanel`（约 277 行）
- `GameOverPanel`（约 369 行）
- `PublicEventPanel`（约 501 行）
- `ChatPanel`（约 529 行）

注意：`ExecutionBlock`/`ControlProgress`/`ChatMessage`/`nightStepLabel`/`eventIcon`/`eventText`/`playerName`/`formatTime` 保持内部不导出（它们是上述组件的私有依赖）。

- [ ] **Step 2: 运行类型检查**

Run（在 `D:/PartyGame/party-games` 目录下）:
```bash
D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
```
Expected: 无输出（通过）。`ClocktowerDay` 仍正常导出，功能未变。

- [ ] **Step 3: 浏览器验证未破坏现状**

打开 `http://localhost:5173/clocktower/room/QBZDV5`（用恢复码 946842 恢复），确认白天阶段页面与改造前一致（圆桌、白天裁定、聊天等都正常）。

---

## Task 2: 定义 Tab 配置（tabs.ts）

**目的**：集中定义"阶段→Tab 列表"的映射、Tab 元数据（id/标签/图标/默认激活），供 Task 4 的 CtTabBar 和 Task 5 的内容渲染共用。纯数据，无副作用。

**Files:**
- Create: `apps/web/src/games/clocktower/tabs.ts`

**Interfaces:**
- Consumes: `RoomView["room"]["phase"]`（来自 `@party-games/shared`）
- Produces:
  - `type CtTabId = "prepare" | "identity" | "action" | "grimoire" | "operate" | "vote" | "chat" | "events" | "review"`
  - `interface CtTabDef { id: CtTabId; label: string; icon: TabIcon }`
  - `function getTabsForPhase(phase: RoomView["room"]["phase"], hasPrivateGame: boolean, hasNightResult: boolean): CtTabDef[]` — 返回该阶段应显示的 Tab 列表
  - `function getDefaultTab(tabs: CtTabDef[]): CtTabId` — 返回列表的默认激活 Tab（第一个）

- [ ] **Step 1: 创建 tabs.ts**

```typescript
import type { ComponentType, SVGProps } from "react";
import {
  Check, Eye, Moon, BookOpen, Vote, MessageCircle, ScrollText, Trophy, Crosshair
} from "lucide-react";
import type { RoomView } from "@party-games/shared";

export type CtTabId =
  | "prepare" | "identity" | "action" | "grimoire"
  | "operate" | "vote" | "chat" | "events" | "review";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export interface CtTabDef {
  id: CtTabId;
  label: string;
  icon: LucideIcon;
}

// 全部 Tab 定义（按出现频率排序无所谓，下面 getTabsForPhase 决定顺序）
const ALL_TABS: Record<CtTabId, CtTabDef> = {
  prepare:  { id: "prepare",  label: "准备", icon: Check },
  identity: { id: "identity", label: "身份", icon: Eye },
  action:   { id: "action",   label: "行动", icon: Moon },
  grimoire: { id: "grimoire", label: "魔典", icon: BookOpen },
  operate:  { id: "operate",  label: "操作", icon: Crosshair },
  vote:     { id: "vote",     label: "投票", icon: Vote },
  chat:     { id: "chat",     label: "聊天", icon: MessageCircle },
  events:   { id: "events",   label: "事件", icon: ScrollText },
  review:   { id: "review",   label: "复盘", icon: Trophy }
};

/**
 * 根据阶段返回应显示的 Tab 列表（已按合理顺序排列）。
 * - hasPrivateGame: 玩家是否已有身份（决定 identity Tab 是否显示）
 * - hasNightResult: 夜间是否有魔典结果（仅邪恶阵营玩家首夜后为 true）
 */
export function getTabsForPhase(
  phase: RoomView["room"]["phase"],
  hasPrivateGame: boolean,
  hasNightResult: boolean
): CtTabDef[] {
  const pick = (...ids: CtTabId[]): CtTabDef[] =>
    ids.map((id) => ALL_TABS[id]);

  switch (phase) {
    case "lobby":
      return pick("prepare");
    case "role-reveal":
      return hasPrivateGame ? pick("identity") : pick("prepare");
    case "first-night":
    case "night": {
      const tabs = ["action"] as CtTabId[];
      if (hasNightResult) tabs.push("grimoire");
      tabs.push("chat");
      return pick(...tabs);
    }
    case "day":
      return pick("chat", "operate", "events");
    case "nominations":
      return pick("operate", "chat", "events");
    case "voting":
      return pick("vote", "chat");
    case "game-over":
      return pick("review", "chat");
    default:
      return pick("chat");
  }
}

/** 返回 Tab 列表的默认激活项（首个） */
export function getDefaultTab(tabs: CtTabDef[]): CtTabId {
  return tabs[0]?.id ?? "chat";
}
```

- [ ] **Step 2: 运行类型检查**

Run: `D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: 通过（lucide 图标导入需确认存在：`Check`/`Eye`/`Moon`/`BookOpen`/`Vote`/`MessageCircle`/`ScrollText`/`Trophy`/`Crosshair` 都是 lucide-react 已有的）。

---

## Task 3: 圆桌缩小模式（ClocktowerTable mini 变体）

**目的**：给 `ClocktowerTable` 加一个 `mini` prop，开启后移除标题栏、候场玩家条、强制 dense 座位，圆环自适应居中。供 Task 6 的新主结构使用。

**Files:**
- Modify: `apps/web/src/games/clocktower/components/ClocktowerTable.tsx`
- Modify: `apps/web/src/games/clocktower/theme.css`（加 `.ct-table-mini` 样式）

**Interfaces:**
- Consumes: `ClocktowerTableProps`（已有）
- Produces: `ClocktowerTable` 新增可选 prop `mini?: boolean`

- [ ] **Step 1: 给 ClocktowerTable 加 mini prop**

在 `ClocktowerTable.tsx` 的 `interface ClocktowerTableProps` 末尾加：
```typescript
  mini?: boolean;
```

在函数签名解构里加 `mini = false`：
```typescript
export function ClocktowerTable({
  view,
  onSetSeat,
  selectedNightPlayerIds,
  onToggleNightPlayer,
  onNominate,
  onSlayerClaim,
  mini = false
}: ClocktowerTableProps) {
```

- [ ] **Step 2: mini 模式下移除标题栏和候场条**

找到 `<section className="panel clocktower-table">`，改为：
```tsx
<section className={`panel clocktower-table${mini ? " ct-table-mini" : ""}`}>
```

标题栏 `<div className="panel-heading">...</div>` 整块用 `{!mini && (...)}` 包裹。

候场玩家区 `{waitingPlayers.length > 0 ? (...) : null}` 改为 `{!mini && waitingPlayers.length > 0 ? (...) : null}`。

- [ ] **Step 3: mini 模式强制 dense 座位**

找到 `<div className={`clocktower-table__stage ${seatCount > 10 ? "is-dense" : ""}`}>`，改为：
```tsx
<div className={`clocktower-table__stage ${mini || seatCount > 10 ? "is-dense" : ""}`}>
```

- [ ] **Step 4: mini 模式下候场玩家数移到 prepare Tab（本 Task 仅圆桌，Tab 在 Task 5）**

本步暂不处理候场玩家迁移（那是 RoomPage 的事），只确保圆桌 mini 时不显示候场条即可（Step 2 已完成）。

- [ ] **Step 5: 在 theme.css 加 ct-table-mini 样式**

在 theme.css 的"圆桌/座位/头像"区块末尾加：
```css
/* —— 圆桌缩小版（mini 模式）：移除标题栏后自适应居中 —— */
.app-shell--clocktower .ct-table-mini {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.app-shell--clocktower .ct-table-mini .clocktower-table__stage {
  flex: 1;
  width: min(100%, 100%);
  aspect-ratio: auto;
  min-height: 0;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-shell--clocktower .ct-table-mini .clocktower-table__ring {
  width: min(100%, 100%);
  aspect-ratio: 1;
  max-height: 100%;
  height: auto;
}

.app-shell--clocktower .ct-table-mini .table-player-actions {
  flex: none;
  margin-top: 8px;
}
```

- [ ] **Step 6: 运行类型检查**

Run: `D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: 通过。

- [ ] **Step 7: 浏览器验证 mini 不破坏默认模式**

现有 RoomPage 仍用默认模式（无 mini prop），打开房间页确认圆桌正常。mini 模式要等 Task 6 接入后才在浏览器可见。

---

## Task 4: CtStageBar 阶段横幅组件

**目的**：新建统一的阶段横幅，吸收 day-banner/night-heading/phase-label 的信息，单行展示阶段名+关键计数+快捷跳转。

**Files:**
- Create: `apps/web/src/games/clocktower/components/CtStageBar.tsx`
- Modify: `apps/web/src/games/clocktower/theme.css`（加 `.ct-stage-bar` 样式）

**Interfaces:**
- Consumes: `RoomView`（来自 shared）
- Produces: `CtStageBar` 组件，props: `{ view: RoomView; onJumpTab?: (tabId: CtTabId) => void }`

- [ ] **Step 1: 创建 CtStageBar.tsx**

```tsx
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

  // 决定图标、标题、副信息、快捷跳转目标
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
```

- [ ] **Step 2: 在 theme.css 加 ct-stage-bar 样式**

在 theme.css 顶栏区块后加：
```css
/* ============================================================
   阶段横幅（统一单行）
   ============================================================ */
.app-shell--clocktower .ct-stage-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ct-gold-deep);
  background: linear-gradient(180deg, var(--ct-panel-dark) 0%, var(--ct-panel-dark-deep) 100%);
  color: var(--ct-parchment-aged);
  font-family: "EB Garamond", "Noto Serif SC", serif;
  flex: none;
}

.app-shell--clocktower .ct-stage-bar__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: var(--ct-gold-bright);
  filter: drop-shadow(0 0 6px rgb(201 168 76 / 50%));
}

.app-shell--clocktower .ct-stage-bar__title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: linear-gradient(180deg, var(--ct-gold-bright) 0%, var(--ct-gold) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.app-shell--clocktower .ct-stage-bar__sub {
  color: var(--ct-parchment-deep);
  font-size: 12px;
  font-weight: 500;
}

.app-shell--clocktower .ct-stage-bar__jump {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--ct-gold-deep);
  border-radius: 4px;
  background: rgb(201 168 76 / 10%);
  color: var(--ct-gold-bright);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.app-shell--clocktower .ct-stage-bar__jump:hover {
  background: rgb(201 168 76 / 20%);
  box-shadow: 0 0 10px rgb(201 168 76 / 35%);
}
```

- [ ] **Step 3: 运行类型检查**

Run: `D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: 通过。

---

## Task 5: CtTabBar 底部 Tab 栏组件

**目的**：新建底部固定 Tab 栏，根据 `getTabsForPhase` 渲染 Tab 按钮，支持激活态高亮、未读红点、点击切换。

**Files:**
- Create: `apps/web/src/games/clocktower/components/CtTabBar.tsx`
- Modify: `apps/web/src/games/clocktower/theme.css`（加 `.ct-tabbar` 样式）

**Interfaces:**
- Consumes: `CtTabDef`/`CtTabId`（来自 `tabs.ts`）
- Produces: `CtTabBar` 组件，props:
  ```typescript
  interface CtTabBarProps {
    tabs: CtTabDef[];
    activeTab: CtTabId;
    onSelect: (tabId: CtTabId) => void;
    unread?: Partial<Record<CtTabId, boolean>>;  // 哪些 Tab 有未读/待办红点
  }
  ```

- [ ] **Step 1: 创建 CtTabBar.tsx**

```tsx
import type { CtTabDef, CtTabId } from "../tabs";

interface CtTabBarProps {
  tabs: CtTabDef[];
  activeTab: CtTabId;
  onSelect: (tabId: CtTabId) => void;
  unread?: Partial<Record<CtTabId, boolean>>;
}

export function CtTabBar({ tabs, activeTab, onSelect, unread = {} }: CtTabBarProps) {
  return (
    <nav className="ct-tabbar" role="tablist" aria-label="游戏操作区">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        const hasUnread = unread[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ct-tabbar__btn${isActive ? " is-active" : ""}`}
            onClick={() => onSelect(tab.id)}
          >
            <span className="ct-tabbar__icon">
              <Icon size={20} />
              {hasUnread ? <span className="ct-tabbar__dot" aria-hidden="true" /> : null}
            </span>
            <span className="ct-tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 在 theme.css 加 ct-tabbar 样式**

```css
/* ============================================================
   底部 Tab 栏（固定，阶段感知）
   ============================================================ */
.app-shell--clocktower .ct-tabbar {
  display: flex;
  flex: none;
  gap: 2px;
  padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--ct-gold-deep);
  background: linear-gradient(180deg, var(--ct-panel-dark-deep) 0%, #0b0710 100%);
  box-shadow: 0 -2px 14px rgb(0 0 0 / 50%), inset 0 1px 0 rgb(201 168 76 / 18%);
}

.app-shell--clocktower .ct-tabbar__btn {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 48px;
  padding: 6px 2px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ct-parchment-deep);
  font-family: "EB Garamond", "Noto Serif SC", serif;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.app-shell--clocktower .ct-tabbar__btn.is-active {
  background: linear-gradient(180deg, rgb(201 168 76 / 18%) 0%, rgb(201 168 76 / 6%) 100%);
  color: var(--ct-gold-bright);
  box-shadow: inset 0 1px 0 rgb(201 168 76 / 25%), inset 0 -2px var(--ct-gold);
}

.app-shell--clocktower .ct-tabbar__icon {
  position: relative;
  display: grid;
  place-items: center;
}

.app-shell--clocktower .ct-tabbar__label {
  letter-spacing: 0.04em;
}

/* 未读/待办红点 */
.app-shell--clocktower .ct-tabbar__dot {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ct-blood);
  box-shadow: 0 0 6px var(--ct-blood-glow);
}
```

- [ ] **Step 3: 运行类型检查**

Run: `D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: 通过。

---

## Task 6: CtIdentityButton 顶栏身份入口 + 浮层

**目的**：把身份卡收进顶栏，按住查看（保留私密性），替代原来垂直堆叠的大身份卡。

**Files:**
- Create: `apps/web/src/games/clocktower/components/CtIdentityButton.tsx`
- Modify: `apps/web/src/games/clocktower/theme.css`（加 `.ct-identity-btn`/`.ct-identity-popover` 样式）

**Interfaces:**
- Consumes: `RoomView["self"]["privateGame"]`（非空时的角色信息）
- Produces: `CtIdentityButton` 组件，props:
  ```typescript
  interface CtIdentityButtonProps {
    privateGame: NonNullable<RoomView["self"]["privateGame"]>;
  }
  ```

- [ ] **Step 1: 创建 CtIdentityButton.tsx**

```tsx
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { RoomView } from "@party-games/shared";

interface CtIdentityButtonProps {
  privateGame: NonNullable<RoomView["self"]["privateGame"]>;
}

export function CtIdentityButton({ privateGame }: CtIdentityButtonProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="ct-identity-btn-wrap">
      <button
        type="button"
        className="icon-button ct-identity-btn"
        aria-label="按住查看身份"
        onPointerDown={() => setVisible(true)}
        onPointerUp={() => setVisible(false)}
        onPointerLeave={() => setVisible(false)}
        onPointerCancel={() => setVisible(false)}
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      {visible ? (
        <div className="ct-identity-popover" role="tooltip">
          <small>{privateGame.role.englishName}</small>
          <strong>{privateGame.role.name}</strong>
          <em>{privateGame.role.team === "good" ? "善良阵营" : "邪恶阵营"}</em>
          <p>{privateGame.role.ability}</p>
        </div>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 2: 在 theme.css 加身份按钮+浮层样式**

```css
/* —— 顶栏身份入口按钮 —— */
.app-shell--clocktower .ct-identity-btn-wrap {
  position: relative;
}

.app-shell--clocktower .ct-identity-btn {
  /* 复用 .icon-button 基础样式，这里只覆盖焦点态 */
}

.app-shell--clocktower .ct-identity-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 30;
  display: grid;
  gap: 4px;
  width: min(280px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid var(--ct-gold);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 0%, rgb(201 168 76 / 12%) 0%, transparent 60%),
    linear-gradient(180deg, var(--ct-panel-dark) 0%, var(--ct-panel-dark-deep) 100%);
  color: var(--ct-parchment-aged);
  box-shadow: 0 12px 40px rgb(0 0 0 / 70%), 0 0 0 1px rgb(201 168 76 / 20%);
  text-align: center;
}

.app-shell--clocktower .ct-identity-popover small {
  color: var(--ct-gold);
  font-family: "EB Garamond", serif;
  letter-spacing: 0.1em;
}

.app-shell--clocktower .ct-identity-popover strong {
  font-size: 22px;
  font-family: "EB Garamond", "Noto Serif SC", serif;
  color: var(--ct-gold-bright);
  text-shadow: 0 0 12px rgb(201 168 76 / 45%);
}

.app-shell--clocktower .ct-identity-popover em {
  color: var(--ct-gold);
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
}

.app-shell--clocktower .ct-identity-popover p {
  margin: 4px 0 0;
  color: var(--ct-parchment-deep);
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] **Step 3: 运行类型检查**

Run: `D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: 通过。

---

## Task 7: 重写 RoomPage 主结构（三区域骨架 + Tab 状态）

**目的**：这是核心 Task。把 RoomPage 从垂直堆叠改为：根容器 100dvh 不滚动 → 顶栏(含身份按钮) → 主体(阶段横幅+圆桌mini+Tab内容区) → 底部Tab栏。所有原组件按 Tab 配置挂载。

**Files:**
- Modify: `apps/web/src/games/clocktower/RoomPage.tsx`（大改）
- Modify: `apps/web/src/games/clocktower/theme.css`（加 `.ct-room-main`/`.ct-tab-panel`/根容器 100dvh 样式）

**Interfaces:**
- Consumes: Task 1-6 产出的所有组件（`CtStageBar`/`CtTabBar`/`CtIdentityButton`/`ClocktowerTable mini`/导出的 Day 子组件/`tabs.ts`）
- Produces: 改造后的 `ClocktowerRoomPage`

- [ ] **Step 1: 在 RoomPage 顶部新增 imports**

在现有 import 块后加：
```typescript
import { CtStageBar } from "./components/CtStageBar";
import { CtTabBar } from "./components/CtTabBar";
import { CtIdentityButton } from "./components/CtIdentityButton";
import {
  DayControlPanel, VotingPanel, GameOverPanel, PublicEventPanel, ChatPanel
} from "./components/ClocktowerDay";
import { getTabsForPhase, getDefaultTab, type CtTabId } from "./tabs";
```

- [ ] **Step 2: 添加 Tab 状态 + 阶段切换重置逻辑**

在 `ClocktowerRoomPage` 内现有 useState 附近加：
```typescript
const tabs = getTabsForPhase(
  view?.room.phase ?? "lobby",
  Boolean(view?.self.privateGame),
  Boolean(view?.self.privateGame?.nightAction?.result)
);
const [activeTab, setActiveTab] = useState<CtTabId>(getDefaultTab(tabs));
const prevPhaseRef = useRef<string | undefined>(undefined);
const phase = view?.room.phase;
useEffect(() => {
  if (phase && phase !== prevPhaseRef.current) {
    prevPhaseRef.current = phase;
    setActiveTab(getDefaultTab(getTabsForPhase(phase, Boolean(view?.self.privateGame), false)));
  }
}, [phase, view?.self.privateGame]);
```
（确保 `useRef`/`useEffect` 已在 import 中）

- [ ] **Step 3: 计算 unread（聊天新消息红点）**

聊天红点：当有 chatMessages 且当前不在 chat Tab 时。简化实现——记录上次看到的消息数：
```typescript
const [seenChatCount, setSeenChatCount] = useState(0);
const chatMsgCount = view?.chatMessages.length ?? 0;
useEffect(() => {
  if (activeTab === "chat") setSeenChatCount(chatMsgCount);
}, [activeTab, chatMsgCount]);
const unread: Partial<Record<CtTabId, boolean>> = {
  chat: chatMsgCount > seenChatCount && activeTab !== "chat",
  operate: Boolean(view?.self.dayActions?.canNominate) && activeTab !== "operate",
  action: Boolean(view?.self.privateGame?.nightAction) && activeTab !== "action",
  vote: phase === "voting" && activeTab !== "vote"
};
```

- [ ] **Step 4: 重写 AppShell 的 actions（加身份按钮）**

把原 `<ClocktowerReferenceButton /> <ConnectionStatus .../>` 改为：
```tsx
actions={
  <>
    <ClocktowerReferenceButton />
    {view?.self.privateGame ? <CtIdentityButton privateGame={view.self.privateGame} /> : null}
    <ConnectionStatus connected={connected} />
  </>
}
```

- [ ] **Step 5: 重写 main 内容区为三区域结构**

替换原来的 `{!view ? <loading> : <div className="room-layout">...}` 整块为：

```tsx
{!view ? (
  <div className="loading-block">
    <RefreshCw className="spin" size={22} />
    正在同步房间
  </div>
) : (
  <div className="ct-room-main">
    <CtStageBar view={view} onJumpTab={setActiveTab} />

    <div className="ct-table-mini-wrap">
      <ClocktowerTable
        view={view}
        mini
        onSetSeat={(seat) => send((cb) => socketRef.current?.emit("room:set-seat", seat, cb))}
        selectedNightPlayerIds={nightSelection}
        onToggleNightPlayer={(playerId) => { /* 原逻辑搬过来 */ }}
        onNominate={(target) => send((cb) => socketRef.current?.emit("clocktower:nominate", target, cb))}
        onSlayerClaim={(target) => send((cb) => socketRef.current?.emit("clocktower:slayer-claim", target, cb))}
      />
    </div>

    <div className="ct-tab-panel">
      {/* 按 activeTab 渲染对应组件 */}
      {activeTab === "prepare" && phase === "lobby" ? (
        <LobbyActions /* 见 Step 6 */ />
      ) : null}
      {activeTab === "identity" && view.self.privateGame ? (
        <RoleReveal /* 原组件，见 Step 7 */ />
      ) : null}
      {activeTab === "action" ? (
        <NightPanel /* 原组件 */ />
      ) : null}
      {activeTab === "chat" ? (
        <ChatPanel
          messages={view.chatMessages}
          players={view.room.players}
          selfPlayerId={view.self.playerId}
          writable={["day","nominations","voting"].includes(phase ?? "")}
          onSend={(m) => send((cb) => socketRef.current?.emit("chat:send", m, cb))}
        />
      ) : null}
      {activeTab === "events" ? (
        <PublicEventPanel events={view.room.clocktowerDay?.publicEvents ?? []} playerById={playerById} />
      ) : null}
      {/* operate/vote/review/grimoire 见 Step 8 */}
    </div>

    <CtTabBar tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} unread={unread} />
  </div>
)}
```

注意：原 `room-layout`/`session-strip`/`room-summary`/`day-banner`/`night-panel` 直接渲染全部删除，改为 Tab 内容。

- [ ] **Step 6: 抽取 LobbyActions（准备/开始按钮 + 候场玩家）**

在 RoomPage.tsx 文件内新增组件（mini 模式候场玩家移到这里）：
```tsx
function LobbyActions({ view, selfPlayer, canStart, onReady, onStart }: {
  view: RoomView;
  selfPlayer: PlayerView | undefined;
  canStart: boolean;
  onReady: () => void;
  onStart: () => void;
}) {
  const waitingPlayers = view.room.players.filter((p) => p.seat === null);
  return (
    <div className="ct-tab-content lobby-actions">
      {waitingPlayers.length > 0 ? (
        <div className="waiting-players">
          <span className="waiting-players__label">候场玩家</span>
          <div>{waitingPlayers.map((p) => <span key={p.id}>{p.nickname}</span>)}</div>
        </div>
      ) : null}
      <div className="room-actions">
        <button className={selfPlayer?.ready ? "secondary-button" : "primary-button"} onClick={onReady}>
          {selfPlayer?.ready ? "取消准备" : "准备"}
        </button>
        {view.self.isOwner ? (
          <button className="primary-button primary-button--dark" disabled={!canStart} onClick={onStart}>
            开始配角
          </button>
        ) : null}
      </div>
    </div>
  );
}
```
（`PlayerView` 类型从 shared 引入：`type PlayerView = RoomView["room"]["players"][number]`）

- [ ] **Step 7: identity Tab 渲染 RoleReveal + 恢复码**

identity Tab 内容：
```tsx
{activeTab === "identity" && view.self.privateGame ? (
  <div className="ct-tab-content">
    <RoleReveal view={view.self.privateGame} visible={roleVisible} confirmed={...} canConfirm={phase === "role-reveal"} onPointerDown={() => setRoleVisible(true)} onPointerEnd={() => setRoleVisible(false)} onConfirm={...} />
    <div className="session-strip">
      <ShieldCheck size={18} />
      <span>身份恢复码 <strong>{session.recoveryCode}</strong></span>
    </div>
  </div>
) : null}
```

- [ ] **Step 8: operate/vote/review Tab 渲染**

operate Tab（白天裁定）需把 `DayControlPanel`/`ExecutionBlock` 所需的 props 传齐。由于 `DayControlPanel` 需要 `view`/`now`/`majority`/`playerById` + 4 个回调，直接调用：
```tsx
{activeTab === "operate" ? (
  <DayControlPanel view={view} now={now} majority={Math.floor(view.room.players.filter(p=>p.alive!==false).length/2)+1} playerById={playerById} onRequestNominations={...} onRequestClose={...} onSetVote={...} />
) : null}
```

vote Tab：
```tsx
{activeTab === "vote" && view.room.clocktowerDay?.currentVote ? (
  <VotingPanel view={view} now={now} playerById={playerById} onSetVote={(v)=>send((cb)=>socketRef.current?.emit("clocktower:set-vote",v,cb))} />
) : null}
```

review Tab（game-over 复盘）：
```tsx
{activeTab === "review" ? (
  <GameOverPanel view={view} playerById={playerById} onRematch={()=>send((cb)=>socketRef.current?.emit("clocktower:rematch",cb))} />
) : null}
```

grimoire Tab（邪恶阵营魔典）：
```tsx
{activeTab === "grimoire" && view.self.privateGame?.nightAction?.result ? (
  <div className="ct-tab-content grimoire-tab">
    {/* 复用 NightResult 的 grimoire 渲染；由于 NightResult 是内部函数，Task 1 未导出它。
        临时方案：把 nightAction.result 的 evil-team/grimoire 用简单列表渲染。
        若需要完整 NightResult，在 Task 1 补充导出 NightResult。 */}
  </div>
) : null}
```
**注意**：`NightResult` 在 Task 1 未列入导出清单。grimoire Tab 内容可在 Task 8 细化，或本 Task 先留空（仅邪恶玩家首夜会用，优先级低）。

action Tab：复用现有 `NightPanel` 内部函数（在 RoomPage 里）：
```tsx
{activeTab === "action" && (phase === "first-night" || phase === "night") ? (
  <NightPanel action={view.self.privateGame?.nightAction} firstNight={phase==="first-night"} nightNumber={view.room.dayNumber ?? 1} selectedPlayerIds={nightSelection} onSubmit={...} onAcknowledge={...} />
) : null}
```

- [ ] **Step 9: 在 theme.css 加核心布局样式**

这是让整页不滚动的关键。在 theme.css 根容器 `.app-shell--clocktower` 规则后加：
```css
/* ============================================================
   房间页三区域骨架（整页不滚动）
   ============================================================ */
.app-shell--clocktower .ct-room-main {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 56px);  /* 减去顶栏高度 */
  overflow: hidden;
}

.app-shell--clocktower .ct-table-mini-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
  overflow: hidden;
}

.app-shell--clocktower .ct-tab-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
}

.app-shell--clocktower .ct-tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 桌面双栏（≥900px）：圆桌左、Tab 右 */
@media (min-width: 900px) {
  .app-shell--clocktower .ct-room-main {
    flex-direction: row;
  }
  .app-shell--clocktower .ct-table-mini-wrap {
    flex: 1;
    padding: 16px;
  }
  .app-shell--clocktower .ct-tab-panel {
    flex: none;
    width: 460px;
    border-left: 1px solid var(--ct-gold-deep);
  }
}
```

注意：原 `.page` 的 padding（28px 18px 56px）会让 100dvh 计算溢出。需要在血染作用域内覆盖 `.page` 的 padding 和 height：
```css
.app-shell--clocktower .page {
  padding: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.app-shell--clocktower .topbar {
  flex: none;
}
```
（但 `.topbar` 是 sticky 定位，需改为 flex 项。若 sticky 冲突，移除该作用域内的 sticky）

- [ ] **Step 10: 运行类型检查**

Run: `D:/PartyGame/.node24/node.exe D:/PartyGame/party-games/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: 通过。可能有未使用变量警告（如旧的 room-summary 相关），清理掉。

- [ ] **Step 11: 浏览器全面验证各阶段**

用测试房间 QBZDV5（恢复码 946842）：
1. 大厅阶段：Tab 栏只显示「准备」，圆桌缩小，候场玩家在准备 Tab
2. 让 bot 推进到首夜：Tab 显示「行动」「聊天」，身份按钮在顶栏
3. 推进到白天：Tab 显示「聊天」「操作」「事件」，阶段横幅显示存活数
4. 提名/投票阶段：Tab 动态变化
5. 手机视口（375×812）和桌面视口（1440×900）都验证布局
6. 确认整页不滚动，只有 Tab 内容区滚动

---

## Task 8: 收尾——清理旧样式 + grimoire Tab 内容

**目的**：清理 RoomPage 重构后不再使用的旧 CSS 规则（room-summary/session-strip 垂直堆叠相关），补全 grimoire Tab。

**Files:**
- Modify: `apps/web/src/games/clocktower/theme.css`（清理无用规则）
- Modify: `apps/web/src/games/clocktower/RoomPage.tsx`（补 grimoire Tab）

- [ ] **Step 1: 在 Task 1 补充导出 NightResult**

回 ClocktowerDay.tsx 给 `NightResult` 加 export（约 413 行 `function NightResult(` → `export function NightResult(`）。

- [ ] **Step 2: grimoire Tab 渲染 NightResult**

RoomPage 的 grimoire Tab 改为：
```tsx
{activeTab === "grimoire" && view.self.privateGame?.nightAction?.result ? (
  <div className="ct-tab-content">
    <NightResult result={view.self.privateGame.nightAction.result} />
  </div>
) : null}
```
并在 import 加 `NightResult`。

- [ ] **Step 3: 清理 theme.css 中不再使用的旧布局规则**

移除或注释（保留以备回滚）：
- `.ct-divider` 相关（不再有垂直分割）
- RoomPage 不再用 `.room-layout`/`.room-summary` 的垂直堆叠样式（但 EntryPage 还用 `.ct-divider`，所以 `.ct-divider` 规则保留）

实际上 `.ct-divider` 仍被 EntryPage 使用，保留。RoomPage 的旧区块样式（如 `.room-layout`）来自平台层 styles.css，不用动血染 theme.css。

- [ ] **Step 4: 运行类型检查 + 浏览器最终验证**

Run typecheck，确认通过。
浏览器验证：邪恶阵营玩家首夜魔典 Tab 正常显示；各阶段切换流畅；手机/桌面布局都正常。

---

## Self-Review（计划自审）

**1. Spec 覆盖检查**：
- 第1节骨架（100dvh不滚动/三区域）→ Task 7 Step 9 ✅
- 第2节底部Tab（阶段配置/默认/未读）→ Task 2 + Task 5 + Task 7 Step 2-3 ✅
- 第3节顶栏身份按钮+恢复码→身份Tab → Task 6 + Task 7 Step 4,7 ✅
- 第4节圆桌缩小（移除标题栏/候场条/强制dense/自适应）→ Task 3 ✅
- 第5节阶段横幅（合并day-banner/快捷跳转）→ Task 4 ✅
- 第6节桌面双栏900px → Task 7 Step 9 的 @media ✅

**2. 占位符扫描**：无 TBD/TODO。Task 7 Step 8 的 grimoire 有"临时方案"说明，已在 Task 8 补全导出 NightResult 并完善。✅

**3. 类型一致性**：
- `CtTabId` 在 tabs.ts 定义，CtTabBar/CtStageBar/RoomPage 全部从此导入 ✅
- `getTabsForPhase` 签名三参数一致 ✅
- 各导出组件名（DayControlPanel 等）与 Task 1 的 export 一致 ✅

**潜在风险（已在 Task 内标注）**：
- Task 7 Step 9：`.topbar` 的 sticky 定位可能和 flex 100dvh 冲突，需实测调整
- Task 7 Step 8：grimoire 的 NightResult 导出延后到 Task 8，Task 7 先留空避免阻塞

---

## Execution Handoff

计划已完成并保存到 `docs/superpowers/plans/2026-07-23-room-layout-redesign.md`。
