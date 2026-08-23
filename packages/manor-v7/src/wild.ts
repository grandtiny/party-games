import type {
  ManorV7WildAnimalDefinition,
  ManorV7WildCrystalDefinition,
  ManorV7WildState
} from "./types.js";

export const MANOR_V7_WILD_STAY_SECONDS = 3_600;
export const MANOR_V7_WILD_REST_SECONDS = 300;
export const MANOR_V7_WILD_MAX_SLOTS = 3;
export const MANOR_V7_WILD_SLOT_PRICES = [150_000, 300_000, 600_000] as const;

export const MANOR_V7_WILD_ANIMALS: readonly ManorV7WildAnimalDefinition[] = [
  { id: 1, name: "野牛", blood: 50, adoptionPrice: 10_000, donationCoins: 17_959, moralRequirement: 0, maxReleases: 12, releaseMoral: 3, attackMoral: 1, finalAttackMoral: 3, crystalIds: [1] },
  { id: 2, name: "臭鼬", blood: 60, adoptionPrice: 11_000, donationCoins: 19_700, moralRequirement: 150, maxReleases: 12, releaseMoral: 4, attackMoral: 1, finalAttackMoral: 3, crystalIds: [1] },
  { id: 3, name: "狐狸", blood: 70, adoptionPrice: 12_000, donationCoins: 21_550, moralRequirement: 300, maxReleases: 12, releaseMoral: 5, attackMoral: 1, finalAttackMoral: 3, crystalIds: [2] },
  { id: 4, name: "野猪", blood: 80, adoptionPrice: 13_500, donationCoins: 24_200, moralRequirement: 450, maxReleases: 12, releaseMoral: 6, attackMoral: 1, finalAttackMoral: 3, crystalIds: [2] },
  { id: 19, name: "恐爪龙", blood: 230, adoptionPrice: 55_600, donationCoins: 99_800, moralRequirement: 2_700, maxReleases: 12, releaseMoral: 21, attackMoral: 1, finalAttackMoral: 3, crystalIds: [5, 6] }
];

export const MANOR_V7_WILD_CRYSTALS: readonly ManorV7WildCrystalDefinition[] = [
  "蓝水晶",
  "绿水晶",
  "紫水晶",
  "黄水晶",
  "红水晶",
  "青水晶",
  "粉水晶",
  "橙水晶",
  "白水晶",
  "黑水晶"
].map((name, index) => ({ id: index + 1, name, salePrice: 10 }));

export function manorV7WildAnimal(id: number): ManorV7WildAnimalDefinition {
  const animal = MANOR_V7_WILD_ANIMALS.find((item) => item.id === id);
  if (!animal) throw new Error("野生动物不存在");
  return animal;
}

export function manorV7WildCrystal(id: number): ManorV7WildCrystalDefinition {
  const crystal = MANOR_V7_WILD_CRYSTALS.find((item) => item.id === id);
  if (!crystal) throw new Error("水晶不存在");
  return crystal;
}

export function createManorV7WildState(): ManorV7WildState {
  return {
    moralExperience: 0,
    maxSlotId: 0,
    slots: [],
    incomingAnimals: [],
    crystalInventory: [],
    crystalDrops: [],
    nextIncomingSerial: 1,
    nextCrystalSerial: 1
  };
}
