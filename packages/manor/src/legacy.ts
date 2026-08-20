import type {
  ManorActivityKind,
  ManorActivityView,
  ManorDogId,
  ManorWeatherView
} from "@party-games/shared";

export interface ManorActivityState extends ManorActivityView {}

export interface ManorDailyState {
  day: string;
  farmPranksUsed: number;
  pastureMosquitoesReleased: number;
  specialFeedsReceived: number;
}

export interface ManorDogDefinition {
  id: ManorDogId;
  name: string;
  price: number;
  catchChance: number;
  assetUrl: string;
}

export const MANOR_ACTIVITY_LIMIT = 50;
export const MANOR_FARM_PRANK_LIMIT = 50;
export const MANOR_PASTURE_MOSQUITO_LIMIT = 25;
export const MANOR_SPECIAL_FEED_LIMIT = 30;
export const MANOR_DOG_FOOD_OPTIONS = [
  { days: 1 as const, coinPrice: 200 },
  { days: 7 as const, coinPrice: 1_000 }
] as const;
export const MANOR_DOGS: readonly ManorDogDefinition[] = [
  {
    id: 1,
    name: "狗",
    price: 1_000,
    catchChance: 0.1,
    assetUrl: "/assets/manor/classic/legacy/dog-1.png"
  },
  {
    id: 3,
    name: "苏格兰牧羊犬",
    price: 5_000,
    catchChance: 0.3,
    assetUrl: "/assets/manor/classic/legacy/dog-3.png"
  }
];

export function createManorDailyState(now: number): ManorDailyState {
  return {
    day: manorDayKey(now),
    farmPranksUsed: 0,
    pastureMosquitoesReleased: 0,
    specialFeedsReceived: 0
  };
}

export function refreshManorDailyState(state: ManorDailyState, now: number): ManorDailyState {
  return state.day === manorDayKey(now) ? { ...state } : createManorDailyState(now);
}

export function manorDayKey(now: number): string {
  return new Date(now + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

export function manorWeatherAt(now: number): ManorWeatherView {
  const chinaTime = new Date(now + 8 * 60 * 60 * 1_000);
  return chinaTime.getUTCDay() === 4
    ? {
        id: "rainy",
        label: "雨天",
        assetUrl: "/assets/manor/classic/legacy/rainy.png"
      }
    : {
        id: "sunny",
        label: "晴天",
        assetUrl: "/assets/manor/classic/sunny.png"
      };
}

export function appendManorActivity(
  activities: ManorActivityState[],
  kind: ManorActivityKind,
  actorName: string,
  message: string,
  createdAt: number
): ManorActivityState[] {
  const nextId = (activities[0]?.id ?? 0) + 1;
  return [
    { id: nextId, kind, actorName, message, createdAt },
    ...activities
  ].slice(0, MANOR_ACTIVITY_LIMIT);
}

export function cloneManorActivities(activities: ManorActivityState[]): ManorActivityState[] {
  return activities.map((activity) => ({ ...activity }));
}

export function validateManorActivities(activities: ManorActivityState[]): void {
  if (!Array.isArray(activities) || activities.length > MANOR_ACTIVITY_LIMIT) {
    throw new Error("庄园动态记录无效");
  }
  const ids = new Set<number>();
  const kinds = new Set<ManorActivityKind>([
    "care",
    "steal",
    "prank",
    "dog",
    "pasture-help",
    "pasture-steal",
    "pasture-clean"
  ]);
  for (const activity of activities) {
    if (
      !Number.isInteger(activity.id) ||
      activity.id < 1 ||
      ids.has(activity.id) ||
      !kinds.has(activity.kind) ||
      typeof activity.actorName !== "string" ||
      activity.actorName.length < 1 ||
      activity.actorName.length > 64 ||
      typeof activity.message !== "string" ||
      activity.message.length < 1 ||
      activity.message.length > 160 ||
      !Number.isInteger(activity.createdAt) ||
      activity.createdAt < 0
    ) {
      throw new Error("庄园动态记录无效");
    }
    ids.add(activity.id);
  }
}

export function validateManorDailyState(state: ManorDailyState): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.day)) throw new Error("庄园每日计数日期无效");
  for (const [label, value, maximum] of [
    ["农场使坏次数", state.farmPranksUsed, MANOR_FARM_PRANK_LIMIT],
    ["牧场放蚊次数", state.pastureMosquitoesReleased, MANOR_PASTURE_MOSQUITO_LIMIT],
    ["牧场胡萝卜喂养次数", state.specialFeedsReceived, MANOR_SPECIAL_FEED_LIMIT]
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > maximum) throw new Error(`${label}无效`);
  }
}

export function manorDogById(id: ManorDogId): ManorDogDefinition {
  const dog = MANOR_DOGS.find((candidate) => candidate.id === id);
  if (!dog) throw new Error("看门狗不存在");
  return dog;
}
