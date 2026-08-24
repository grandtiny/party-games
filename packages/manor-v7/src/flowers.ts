import type { ManorV7FlowerDefinition } from "./types.js";

export const MANOR_V7_FLOWERS: readonly ManorV7FlowerDefinition[] = [
  { id: 1, name: "最爱纯真", description: "隐藏在心中的爱，纯洁的祝福。", requirements: [{ cropId: 105, quantity: 33 }] },
  { id: 2, name: "星语心愿", description: "纯洁的爱，祝福心爱的你幸福快乐！", requirements: [{ cropId: 103, quantity: 10 }, { cropId: 105, quantity: 50 }] },
  { id: 3, name: "幻紫爱恋", description: "等待属于心中纯洁的爱恋。", requirements: [{ cropId: 101, quantity: 30 }, { cropId: 102, quantity: 30 }] },
  { id: 4, name: "衣心莲语", description: "期待对你的爱，至死不渝。", requirements: [{ cropId: 101, quantity: 50 }, { cropId: 102, quantity: 10 }] },
  { id: 5, name: "灿烂微笑", description: "有毅力、不怕艰难，喜欢追求丰富的人生。", requirements: [{ cropId: 104, quantity: 20 }] },
  { id: 6, name: "守望天使", description: "静静地，等待属于自己的爱情。", requirements: [{ cropId: 101, quantity: 50 }] },
  { id: 7, name: "稀世爱恋", description: "美好的幸福向你飞来。", requirements: [{ cropId: 108, quantity: 40 }, { cropId: 109, quantity: 10 }] },
  { id: 8, name: "蝶儿翩翩", description: "爱上你，无怨无悔。", requirements: [{ cropId: 109, quantity: 50 }] },
  { id: 9, name: "鸣响幸福", description: "幸福再次来临。", requirements: [{ cropId: 108, quantity: 50 }] },
  { id: 10, name: "相濡以沫", description: "对待爱情不离不弃。", requirements: [{ cropId: 107, quantity: 30 }] },
  { id: 11, name: "真爱永存", description: "和你的爱永不磨灭。", requirements: [{ cropId: 106, quantity: 10 }] },
  { id: 12, name: "完美恋人", description: "热情真爱，I Love You！", requirements: [{ cropId: 41, quantity: 3 }] },
  { id: 13, name: "缘定三生", description: "执子之手，与子偕老。", requirements: [{ cropId: 41, quantity: 33 }] },
  { id: 14, name: "真爱久久", description: "我们的爱长长久久，直到永远。", requirements: [{ cropId: 41, quantity: 99 }] }
] as const;

export function manorV7Flower(id: number): ManorV7FlowerDefinition {
  const flower = MANOR_V7_FLOWERS.find((item) => item.id === id);
  if (!flower) throw new Error("花束编号无效");
  return flower;
}
