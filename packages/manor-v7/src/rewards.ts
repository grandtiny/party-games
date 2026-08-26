import type { ManorV7Area } from "./types.js";
import { MANOR_V7_CROPS, MANOR_V7_DECORATIONS, MANOR_V7_TOOLS } from "./catalog.js";

export type ManorV7RewardItem =
  | { kind: "seed"; sourceId: number; quantity: number }
  | { kind: "tool"; area: ManorV7Area; sourceId: number; quantity: number }
  | { kind: "decoration"; area: ManorV7Area; sourceId: number; quantity: 1 }
  | { kind: "coins"; quantity: number }
  | { kind: "experience"; area: ManorV7Area; quantity: number };

export interface ManorV7TutorialTaskDefinition {
  id: number;
  action: string;
  rewardCoins: number;
  rewardExperience: number;
}

export const MANOR_V7_TUTORIAL_TASKS: readonly ManorV7TutorialTaskDefinition[] = [
  { id: 0, action: "help", rewardCoins: 50, rewardExperience: 50 },
  { id: 1, action: "shourou", rewardCoins: 100, rewardExperience: 100 },
  { id: 2, action: "goumai", rewardCoins: 150, rewardExperience: 100 },
  { id: 3, action: "mucao1", rewardCoins: 200, rewardExperience: 100 },
  { id: 4, action: "shengchan1", rewardCoins: 250, rewardExperience: 100 },
  { id: 5, action: "shouhuo", rewardCoins: 300, rewardExperience: 100 },
  { id: 6, action: "maichu", rewardCoins: 350, rewardExperience: 100 },
  { id: 7, action: "mucao2", rewardCoins: 400, rewardExperience: 100 },
  { id: 8, action: "shengchan2", rewardCoins: 450, rewardExperience: 100 },
  { id: 9, action: "touqie", rewardCoins: 500, rewardExperience: 100 }
];

const levelRewardItems: readonly ManorV7RewardItem[] = [
  seed(4, 2),
  tool(1, 2),
  seed(6, 2),
  seed(7, 2),
  tool(2, 2),
  seed(9, 2),
  seed(10, 2),
  seed(11, 2),
  seed(1, 2),
  tool(3, 2),
  seed(15, 2),
  seed(18, 2),
  seed(19, 2),
  seed(13, 2),
  tool(3, 3),
  seed(26, 2),
  seed(27, 2),
  tool(3, 5),
  seed(31, 2),
  decoration(253),
  decoration(255),
  decoration(256),
  decoration(254),
  tool(3, 10),
  seed(42, 2),
  seed(55, 2),
  seed(47, 2),
  seed(50, 2),
  seed(48, 2),
  seed(80, 2)
];

export const MANOR_V7_MAX_LEVEL_REWARD = levelRewardItems.length;

export const MANOR_V7_VIP_RETURN_GIFT: {
  item: readonly ManorV7RewardItem[];
  vipItem: readonly ManorV7RewardItem[];
} = {
  item: [
    { kind: "coins", quantity: 1_000 },
    seed(1, 2),
    tool(1, 2)
  ],
  vipItem: [tool(2, 2), tool(3, 1)]
};

export interface ManorV7RedeemCodeDefinition {
  code: string;
  item: readonly ManorV7RewardItem[];
  vipItem: readonly ManorV7RewardItem[];
}

export const MANOR_V7_REDEEM_CODES: readonly ManorV7RedeemCodeDefinition[] = [
  {
    code: "MANOR2026",
    item: [{ kind: "coins", quantity: 5_000 }, seed(1, 5)],
    vipItem: [tool(1, 3)]
  },
  {
    code: "PASTURE2026",
    item: [{ kind: "coins", quantity: 5_000 }, pastureTool(1, 3)],
    vipItem: [pastureTool(2, 1)]
  }
];

export function manorV7LevelReward(level: number): ManorV7RewardItem {
  const reward = levelRewardItems[level - 1];
  if (!reward) throw new Error("升级奖励不存在");
  return reward;
}

export function manorV7TutorialTask(taskId: number): ManorV7TutorialTaskDefinition {
  const task = MANOR_V7_TUTORIAL_TASKS.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error("新手任务不存在");
  return task;
}

export function normalizeManorV7RedeemCode(code: string): string {
  return code.trim().toUpperCase();
}

export function manorV7RedeemCode(code: string): ManorV7RedeemCodeDefinition {
  const normalized = normalizeManorV7RedeemCode(code);
  const definition = MANOR_V7_REDEEM_CODES.find((candidate) => candidate.code === normalized);
  if (!definition) throw new Error("兑换码无效");
  return definition;
}

export function isManorV7RewardAvailable(reward: ManorV7RewardItem): boolean {
  switch (reward.kind) {
    case "seed": return MANOR_V7_CROPS.some((crop) => crop.id === reward.sourceId);
    case "tool": return MANOR_V7_TOOLS.some((toolDefinition) => (
      toolDefinition.area === reward.area && toolDefinition.id === reward.sourceId
    ));
    case "decoration": return MANOR_V7_DECORATIONS.some((item) => (
      item.area === reward.area && item.id === reward.sourceId && item.isRenderable
    ));
    case "coins":
    case "experience":
      return true;
  }
}

function seed(sourceId: number, quantity: number): ManorV7RewardItem {
  return { kind: "seed", sourceId, quantity };
}

function tool(sourceId: number, quantity: number): ManorV7RewardItem {
  return { kind: "tool", area: "farm", sourceId, quantity };
}

function pastureTool(sourceId: number, quantity: number): ManorV7RewardItem {
  return { kind: "tool", area: "pasture", sourceId, quantity };
}

function decoration(sourceId: number): ManorV7RewardItem {
  return { kind: "decoration", area: "farm", sourceId, quantity: 1 };
}
