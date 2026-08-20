import type { ManorFertilizerId } from "@party-games/shared";

export interface ManorFertilizerDefinition {
  id: ManorFertilizerId;
  sourceId: 1 | 2 | 3;
  name: string;
  effectSeconds: number;
  coinPrice?: number;
}

export const MANOR_FERTILIZERS: readonly ManorFertilizerDefinition[] = [
  { id: "ordinary", sourceId: 1, name: "普通化肥", effectSeconds: 3_600, coinPrice: 400 },
  { id: "fast", sourceId: 2, name: "高速化肥", effectSeconds: 9_000 },
  { id: "instant", sourceId: 3, name: "极速化肥", effectSeconds: 19_800 }
];

export type ManorRewardItemDefinition =
  | { kind: "seed"; sourceId: number; name: string; quantity: number }
  | { kind: "fertilizer"; fertilizerId: ManorFertilizerId; sourceId: number; name: string; quantity: number }
  | { kind: "decoration"; sourceId: number; name: string; quantity: 1 };

export interface ManorLevelRewardDefinition {
  originalLevel: number;
  displayLevel: number;
  requiredExperience: number;
  item: ManorRewardItemDefinition;
}

const rewardItems: readonly ManorRewardItemDefinition[] = [
  seed(4, "玉米", 2),
  fertilizer("ordinary", 1, "普通化肥", 2),
  seed(6, "茄子", 2),
  seed(7, "番茄", 2),
  fertilizer("fast", 2, "高速化肥", 2),
  seed(9, "辣椒", 2),
  seed(10, "南瓜", 2),
  seed(11, "苹果", 2),
  seed(1, "草莓", 2),
  fertilizer("instant", 3, "极速化肥", 2),
  seed(15, "香蕉", 2),
  seed(18, "桃子", 2),
  seed(19, "橙子", 2),
  seed(13, "葡萄", 2),
  fertilizer("instant", 3, "极速化肥", 3),
  seed(26, "柚子", 2),
  seed(27, "菠萝", 2),
  fertilizer("instant", 3, "极速化肥", 5),
  seed(31, "葫芦", 2),
  decoration(253, "董衣草之恋背景"),
  decoration(255, "董衣草之恋红栏"),
  decoration(256, "董衣草之恋狗窝"),
  decoration(254, "董衣草之恋大屋"),
  fertilizer("instant", 3, "极速化肥", 10),
  seed(42, "柠檬", 2),
  seed(55, "枇杷", 2),
  seed(47, "甘蔗", 2),
  seed(50, "蘑菇", 2),
  seed(48, "杨梅", 2),
  seed(80, "月柿", 2)
];

export const MANOR_LEVEL_REWARDS: readonly ManorLevelRewardDefinition[] = rewardItems.map(
  (item, index) => {
    const originalLevel = index + 1;
    return {
      originalLevel,
      displayLevel: originalLevel + 1,
      requiredExperience: 100 * originalLevel * (originalLevel + 1),
      item
    };
  }
);

export const MANOR_STARTER_GIFT: readonly ManorRewardItemDefinition[] = [
  fertilizer("ordinary", 1, "普通化肥", 4),
  seed(7, "番茄", 2)
];

export function manorFertilizerById(id: ManorFertilizerId): ManorFertilizerDefinition {
  const fertilizerDefinition = MANOR_FERTILIZERS.find((candidate) => candidate.id === id);
  if (!fertilizerDefinition) throw new Error("化肥配置不存在");
  return fertilizerDefinition;
}

export function manorLevelReward(originalLevel: number): ManorLevelRewardDefinition {
  const reward = MANOR_LEVEL_REWARDS.find((candidate) => candidate.originalLevel === originalLevel);
  if (!reward) throw new Error("升级奖励配置不存在");
  return reward;
}

function seed(sourceId: number, name: string, quantity: number): ManorRewardItemDefinition {
  return { kind: "seed", sourceId, name, quantity };
}

function fertilizer(
  fertilizerId: ManorFertilizerId,
  sourceId: number,
  name: string,
  quantity: number
): ManorRewardItemDefinition {
  return { kind: "fertilizer", fertilizerId, sourceId, name, quantity };
}

function decoration(sourceId: number, name: string): ManorRewardItemDefinition {
  return { kind: "decoration", sourceId, name, quantity: 1 };
}
