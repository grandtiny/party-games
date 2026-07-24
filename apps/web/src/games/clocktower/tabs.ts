import type { ComponentType, SVGProps } from "react";
import {
  Check,
  Eye,
  Moon,
  BookOpen,
  Vote,
  MessageCircle,
  ScrollText,
  Trophy,
  Crosshair
} from "lucide-react";
import type { RoomView } from "@party-games/shared";

export type CtTabId =
  | "prepare"
  | "identity"
  | "action"
  | "grimoire"
  | "operate"
  | "vote"
  | "chat"
  | "events"
  | "review";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export interface CtTabDef {
  id: CtTabId;
  label: string;
  icon: LucideIcon;
}

// 全部 Tab 定义
const ALL_TABS: Record<CtTabId, CtTabDef> = {
  prepare: { id: "prepare", label: "准备", icon: Check },
  identity: { id: "identity", label: "身份", icon: Eye },
  action: { id: "action", label: "行动", icon: Moon },
  grimoire: { id: "grimoire", label: "魔典", icon: BookOpen },
  operate: { id: "operate", label: "操作", icon: Crosshair },
  vote: { id: "vote", label: "投票", icon: Vote },
  chat: { id: "chat", label: "聊天", icon: MessageCircle },
  events: { id: "events", label: "事件", icon: ScrollText },
  review: { id: "review", label: "复盘", icon: Trophy }
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
  const pick = (...ids: CtTabId[]): CtTabDef[] => ids.map((id) => ALL_TABS[id]);

  switch (phase) {
    case "lobby":
      return pick("prepare");
    case "role-reveal":
      return hasPrivateGame ? pick("identity") : pick("prepare");
    case "first-night":
    case "night": {
      const tabs: CtTabId[] = ["action"];
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
