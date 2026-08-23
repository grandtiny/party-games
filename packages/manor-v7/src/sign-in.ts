interface ManorV7SignInRewardBase {
  id: number;
  name: string;
  quantity: number;
  days?: number;
}

export type ManorV7SignInRewardDefinition = ManorV7SignInRewardBase & (
  | { kind: "coins" }
  | { kind: "animal"; sourceId: number }
  | { kind: "crystal"; sourceId: number }
  | { kind: "pasture-tool"; sourceId: number }
  | { kind: "grass"; sourceId: 40 }
);

export const MANOR_V7_DAILY_SIGN_IN_LIMIT = 2;
export const MANOR_V7_SIGN_IN_ONLY_ANIMAL_IDS = [1055, 1056] as const;

export const MANOR_V7_DAILY_SIGN_IN_REWARDS = [
  { id: 1, name: "金币 100", kind: "coins", quantity: 100 },
  { id: 2, name: "金币 500", kind: "coins", quantity: 500 },
  { id: 3, name: "白鸽 1 只", kind: "animal", quantity: 1, sourceId: 1050 },
  { id: 4, name: "春燕 1 只", kind: "animal", quantity: 1, sourceId: 1054 },
  { id: 5, name: "短尾猫 1 只", kind: "animal", quantity: 1, sourceId: 1540 },
  { id: 6, name: "呼呼牛 1 头", kind: "animal", quantity: 1, sourceId: 1561 },
  { id: 7, name: "叻叻兔 1 只", kind: "animal", quantity: 1, sourceId: 1060 },
  { id: 8, name: "哧哧鸡 1 只", kind: "animal", quantity: 1, sourceId: 1062 },
  { id: 9, name: "红水晶 1 个", kind: "crystal", quantity: 1, sourceId: 5 },
  { id: 10, name: "橙水晶 1 个", kind: "crystal", quantity: 1, sourceId: 8 },
  { id: 11, name: "蓝水晶 1 个", kind: "crystal", quantity: 1, sourceId: 1 },
  { id: 12, name: "绿水晶 1 个", kind: "crystal", quantity: 1, sourceId: 2 },
  { id: 13, name: "辣辣狗 1 只", kind: "animal", quantity: 1, sourceId: 1551 },
  { id: 14, name: "橙橙猴 1 只", kind: "animal", quantity: 1, sourceId: 1055 },
  { id: 18, name: "雅利鸭 1 只", kind: "animal", quantity: 1, sourceId: 1056 },
  { id: 19, name: "咩咩羊 1 头", kind: "animal", quantity: 1, sourceId: 1560 },
  { id: 20, name: "普通罐头 1 罐", kind: "pasture-tool", quantity: 1, sourceId: 1 },
  { id: 21, name: "高速罐头 1 罐", kind: "pasture-tool", quantity: 1, sourceId: 2 },
  { id: 22, name: "极速罐头 1 罐", kind: "pasture-tool", quantity: 1, sourceId: 3 }
] as const satisfies readonly ManorV7SignInRewardDefinition[];

export const MANOR_V7_STREAK_SIGN_IN_REWARDS = [
  { id: 15, name: "牧草 100 个", kind: "grass", quantity: 100, sourceId: 40, days: 3 },
  { id: 16, name: "丝光鸡 1 只", kind: "animal", quantity: 1, sourceId: 1047, days: 5 },
  { id: 17, name: "千年龟 1 只", kind: "animal", quantity: 1, sourceId: 1035, days: 7 }
] as const satisfies readonly ManorV7SignInRewardDefinition[];

export function manorV7DailySignInReward(id: number): ManorV7SignInRewardDefinition {
  const reward = MANOR_V7_DAILY_SIGN_IN_REWARDS.find((item) => item.id === id);
  if (!reward) throw new Error("每日签到奖励不存在");
  return reward;
}

export function manorV7StreakSignInReward(days: number): ManorV7SignInRewardDefinition {
  const milestone = days >= 7 ? 7 : days;
  const reward = MANOR_V7_STREAK_SIGN_IN_REWARDS.find((item) => item.days === milestone);
  if (!reward) throw new Error("当前没有连续登录额外奖励");
  return reward;
}
