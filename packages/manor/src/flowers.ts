import type { ManorFlowerId } from "@party-games/shared";

export interface ManorFlowerRequirement {
  sourceId: number;
  quantity: number;
}

export interface ManorFlowerDefinition {
  id: ManorFlowerId;
  name: string;
  description: string;
  requirements: readonly ManorFlowerRequirement[];
  assetUrl: string;
}

const FLOWER_ASSET_ROOT = "/assets/manor/classic/flowers";

export const MANOR_FLOWERS: readonly ManorFlowerDefinition[] = [
  flower(1, "最爱纯真", "隐藏在心中的爱，纯洁的祝福。", [[105, 33]]),
  flower(2, "星语心愿", "纯洁的爱，祝福心爱的你幸福快乐！", [[103, 10], [105, 50]]),
  flower(3, "幻紫爱恋", "等待属于心中纯洁的爱恋。", [[101, 30], [102, 30]]),
  flower(4, "衣心莲语", "期待对你的爱，至死不渝。", [[101, 50], [102, 10]]),
  flower(5, "灿烂微笑", "有毅力、不怕艰难，喜欢追求丰富的人生。", [[104, 20]]),
  flower(6, "守望天使", "静静地，等待属于自己的爱情。", [[101, 50]]),
  flower(7, "稀世爱恋", "美好的幸福向你飞来。", [[108, 40], [109, 10]]),
  flower(8, "蝶儿翩翩", "爱上你，无怨无悔。", [[109, 50]]),
  flower(9, "鸣响幸福", "幸福再次来临。", [[108, 50]]),
  flower(10, "相濡以沫", "对待爱情不离不弃。", [[107, 30]]),
  flower(11, "真爱永存", "和你的爱永不磨灭。", [[106, 10]]),
  flower(12, "完美恋人", "热情真爱，I Love You！", [[41, 3]]),
  flower(13, "缘定三生", "执子之手，与子偕老。", [[41, 33]]),
  flower(14, "真爱久久", "我们的爱长长久久，直到永远。", [[41, 99]])
];

export function manorFlowerById(id: ManorFlowerId): ManorFlowerDefinition {
  const definition = MANOR_FLOWERS.find((candidate) => candidate.id === id);
  if (!definition) throw new Error("花束不存在");
  return definition;
}

function flower(
  id: ManorFlowerId,
  name: string,
  description: string,
  requirements: ReadonlyArray<readonly [sourceId: number, quantity: number]>
): ManorFlowerDefinition {
  return {
    id,
    name,
    description,
    requirements: requirements.map(([sourceId, quantity]) => ({ sourceId, quantity })),
    assetUrl: `${FLOWER_ASSET_ROOT}/${id}.gif`
  };
}
