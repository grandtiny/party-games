export type RoleType = "townsfolk" | "outsider" | "minion" | "demon";
export type Alignment = "good" | "evil";

export type RoleTag =
  | "first-night-info"
  | "recurring-info"
  | "death-info"
  | "confirmation"
  | "protection"
  | "execution-risk"
  | "misinformation"
  | "demon-safety"
  | "setup";

export interface RoleDefinition {
  id: string;
  name: string;
  englishName: string;
  type: RoleType;
  alignment: Alignment;
  ability: string;
  tags: RoleTag[];
}

const roles = [
  {
    id: "washerwoman",
    name: "洗衣妇",
    englishName: "Washerwoman",
    type: "townsfolk",
    alignment: "good",
    ability: "开局时，你得知两名玩家中有一名是某个镇民角色。",
    tags: ["first-night-info"]
  },
  {
    id: "librarian",
    name: "图书管理员",
    englishName: "Librarian",
    type: "townsfolk",
    alignment: "good",
    ability: "开局时，你得知两名玩家中有一名是某个外来者，或者得知场上没有外来者。",
    tags: ["first-night-info"]
  },
  {
    id: "investigator",
    name: "调查员",
    englishName: "Investigator",
    type: "townsfolk",
    alignment: "good",
    ability: "开局时，你得知两名玩家中有一名是某个爪牙角色。",
    tags: ["first-night-info"]
  },
  {
    id: "chef",
    name: "厨师",
    englishName: "Chef",
    type: "townsfolk",
    alignment: "good",
    ability: "开局时，你得知相邻邪恶玩家共有多少对。",
    tags: ["first-night-info"]
  },
  {
    id: "empath",
    name: "共情者",
    englishName: "Empath",
    type: "townsfolk",
    alignment: "good",
    ability: "每个夜晚，你得知两名存活邻座中有多少名邪恶玩家。",
    tags: ["recurring-info"]
  },
  {
    id: "fortuneteller",
    name: "占卜师",
    englishName: "Fortune Teller",
    type: "townsfolk",
    alignment: "good",
    ability: "每个夜晚选择两名玩家，得知其中是否有恶魔；另有一名善良玩家会对你登记为恶魔。",
    tags: ["recurring-info"]
  },
  {
    id: "undertaker",
    name: "送葬者",
    englishName: "Undertaker",
    type: "townsfolk",
    alignment: "good",
    ability: "除首夜外，每个夜晚得知当天被处决玩家的角色。",
    tags: ["recurring-info", "death-info"]
  },
  {
    id: "monk",
    name: "僧侣",
    englishName: "Monk",
    type: "townsfolk",
    alignment: "good",
    ability: "除首夜外，每个夜晚选择另一名玩家，使其当晚免受恶魔伤害。",
    tags: ["protection"]
  },
  {
    id: "ravenkeeper",
    name: "守鸦人",
    englishName: "Ravenkeeper",
    type: "townsfolk",
    alignment: "good",
    ability: "如果你在夜晚死亡，选择一名玩家并得知其角色。",
    tags: ["death-info"]
  },
  {
    id: "virgin",
    name: "贞洁者",
    englishName: "Virgin",
    type: "townsfolk",
    alignment: "good",
    ability: "第一次被提名时，如果提名者是镇民，该玩家立即被处决。",
    tags: ["confirmation"]
  },
  {
    id: "slayer",
    name: "猎手",
    englishName: "Slayer",
    type: "townsfolk",
    alignment: "good",
    ability: "每局一次，白天公开选择一名玩家；如果其是恶魔，该玩家死亡。",
    tags: ["confirmation"]
  },
  {
    id: "soldier",
    name: "士兵",
    englishName: "Soldier",
    type: "townsfolk",
    alignment: "good",
    ability: "你免受恶魔伤害。",
    tags: ["protection"]
  },
  {
    id: "mayor",
    name: "镇长",
    englishName: "Mayor",
    type: "townsfolk",
    alignment: "good",
    ability: "只有三人存活且当天无人被处决时，你的阵营获胜；你在夜晚将要死亡时，可能改由另一名玩家死亡。",
    tags: ["protection", "confirmation"]
  },
  {
    id: "butler",
    name: "管家",
    englishName: "Butler",
    type: "outsider",
    alignment: "good",
    ability: "每个夜晚选择另一名玩家；次日只有该玩家投票时你才能投票。",
    tags: []
  },
  {
    id: "drunk",
    name: "酒鬼",
    englishName: "Drunk",
    type: "outsider",
    alignment: "good",
    ability: "你不知道自己是酒鬼。你以为自己是一个镇民角色，但实际上不是。",
    tags: ["misinformation"]
  },
  {
    id: "recluse",
    name: "隐士",
    englishName: "Recluse",
    type: "outsider",
    alignment: "good",
    ability: "你可能登记为邪恶、爪牙或恶魔，即使已经死亡。",
    tags: ["misinformation"]
  },
  {
    id: "saint",
    name: "圣徒",
    englishName: "Saint",
    type: "outsider",
    alignment: "good",
    ability: "如果你死于处决，你的阵营落败。",
    tags: ["execution-risk"]
  },
  {
    id: "poisoner",
    name: "投毒者",
    englishName: "Poisoner",
    type: "minion",
    alignment: "evil",
    ability: "每个夜晚选择一名玩家，使其在当晚和次日中毒。",
    tags: ["misinformation"]
  },
  {
    id: "spy",
    name: "间谍",
    englishName: "Spy",
    type: "minion",
    alignment: "evil",
    ability: "每个夜晚查看魔典；你可能登记为善良、镇民或外来者，即使已经死亡。",
    tags: ["misinformation"]
  },
  {
    id: "scarletwoman",
    name: "猩红女郎",
    englishName: "Scarlet Woman",
    type: "minion",
    alignment: "evil",
    ability: "恶魔死亡前若至少有五名玩家存活，你变成恶魔。",
    tags: ["demon-safety"]
  },
  {
    id: "baron",
    name: "男爵",
    englishName: "Baron",
    type: "minion",
    alignment: "evil",
    ability: "场上额外增加两名外来者，并减少两名镇民。",
    tags: ["setup"]
  },
  {
    id: "imp",
    name: "小恶魔",
    englishName: "Imp",
    type: "demon",
    alignment: "evil",
    ability: "除首夜外，每个夜晚选择一名玩家使其死亡；如果以此杀死自己，一名存活爪牙变成小恶魔。",
    tags: []
  }
] as const satisfies readonly RoleDefinition[];

export type RoleId = (typeof roles)[number]["id"];

export const TROUBLE_BREWING_ROLES: readonly RoleDefinition[] = roles;

export const ROLE_BY_ID = new Map<RoleId, RoleDefinition>(
  roles.map((role) => [role.id, role])
);

export const TOWNSFOLK_IDS = roles
  .filter((role) => role.type === "townsfolk")
  .map((role) => role.id) as RoleId[];
export const OUTSIDER_IDS = roles
  .filter((role) => role.type === "outsider")
  .map((role) => role.id) as RoleId[];
export const MINION_IDS = roles
  .filter((role) => role.type === "minion")
  .map((role) => role.id) as RoleId[];
export const GOOD_ROLE_IDS = roles
  .filter((role) => role.alignment === "good")
  .map((role) => role.id) as RoleId[];
