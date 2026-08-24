export type ManorV7Area = "farm" | "pasture";
export type ManorV7AnimalHouse = "hutch" | "shed";
export type ManorV7LandTier = "normal" | "red" | "black";
export type ManorV7WeatherKind = "sunny" | "rainy";
export type ManorV7CropVisualState =
  | "seed"
  | "sprout"
  | "young"
  | "growing"
  | "mature"
  | "withered";
export type ManorV7AnimalVisualState =
  | "cub"
  | "young"
  | "production-ready"
  | "production-action"
  | "production-cooldown"
  | "harvestable";

export interface ManorV7CropDefinition {
  id: number;
  name: string;
  originalLevel: number;
  cropType: number;
  seedPrice: number;
  salePrice: number;
  baseYield: number;
  experience: number;
  growthSeconds: number;
  harvestCycles: number;
  landRequirement: number;
  isFlower: boolean;
  isHidden: boolean;
  isVip: boolean;
  stageSeconds: readonly number[];
}

export interface ManorV7AnimalDefinition {
  id: number;
  name: string;
  byproductName: string;
  house: ManorV7AnimalHouse;
  originalLevel: number;
  isVip: boolean;
  purchasePrice: number;
  productPrice: number;
  byproductPrice: number;
  animalHarvestExperience: number;
  byproductHarvestExperience: number;
  baseYield: number;
  consume: number;
  cubSeconds: number;
  maturitySeconds: number;
  productionSeconds: number;
  productionCycleSeconds: number;
  productionActionSeconds: number;
  productionCooldownSeconds: number;
  lifecycleSeconds: number;
}

export interface ManorV7ToolDefinition {
  area: ManorV7Area;
  id: number;
  name: string;
  itemType: number;
  coinPrice: number;
  premiumPrice: number;
  effectSeconds: number;
  isVip: boolean;
  available: boolean;
}

export interface ManorV7DecorationDefinition {
  area: ManorV7Area;
  id: number;
  name: string;
  setName: string;
  itemType: number;
  originalLevel: number;
  coinPrice: number;
  premiumPrice: number;
  experience: number;
  validSeconds: number;
}

export interface ManorV7DecorationOwnership {
  area: ManorV7Area;
  decorationId: number;
  validUntil: number;
}

export interface ManorV7LandUpgradeDefinition {
  landType: "standard" | "black";
  sourceId: number;
  level: number;
  coins: number;
  premium: number;
}

export interface ManorV7FishDefinition {
  id: number;
  name: string;
  cycleSeconds: readonly number[];
  experience: number;
  unlockCrystalType: number;
  unlockCrystalAmount: number;
  unlockCoins: number;
  matureHours: number;
  baseYield: number;
  poolSize: number;
  seedPrice: number;
  salePrice: number;
}

export interface ManorV7InventoryEntry {
  sourceId: number;
  quantity: number;
  locked?: boolean;
}

export interface ManorV7FlowerRequirement {
  cropId: number;
  quantity: number;
}

export interface ManorV7FlowerDefinition {
  id: number;
  name: string;
  description: string;
  requirements: readonly ManorV7FlowerRequirement[];
}

export interface ManorV7FlowerGift {
  id: number;
  flowerId: number;
  fromUserId: string;
  fromDisplayName: string;
  message: string;
  sentAt: number;
}

export interface ManorV7WeatherState {
  day: string;
  kind: ManorV7WeatherKind;
}

export interface ManorV7FarmLandState {
  id: number;
  unlocked: boolean;
  tier: ManorV7LandTier;
  cropId?: number;
  growthSeconds: number;
  harvests: number;
  watered: boolean;
  weeds: boolean;
  pests: boolean;
  stolen: number;
  thiefUserIds: string[];
  fertilizedSeconds: number;
  yieldPenaltyPercent: number;
}

export interface ManorV7PastureAnimalState {
  serial: number;
  animalId: number;
  growthSeconds: number;
  productionActive: boolean;
  productionProgressSeconds: number;
  productionCount: number;
  pendingProduct: number;
  stolenProduct: number;
  productThiefUserIds: string[];
}

export interface ManorV7PastureGuardState {
  id: number;
  remainingSeconds: number;
  active: boolean;
}

export interface ManorV7ResearchSlotState {
  animalId: number | null;
  remainingSeconds: number;
}

export interface ManorV7DogState {
  ownedIds: number[];
  activeId: number | null;
  feedSeconds: number;
}

export interface ManorV7ParadeState {
  info: string;
  patternId: number;
  version: number;
}

export type ManorV7WildAnimalStatus = 1 | 2 | 3 | 4 | 5 | 6;

export interface ManorV7WildAnimalDefinition {
  id: number;
  name: string;
  blood: number;
  adoptionPrice: number;
  donationCoins: number;
  moralRequirement: number;
  maxReleases: number;
  releaseMoral: number;
  attackMoral: number;
  finalAttackMoral: number;
  crystalIds: readonly number[];
}

export interface ManorV7WildCrystalDefinition {
  id: number;
  name: string;
  salePrice: number;
}

export interface ManorV7WildSlotState {
  slotId: number;
  animalType: number;
  status: ManorV7WildAnimalStatus;
  currentBlood: number;
  remainingReleases: number;
  income: number;
  targetUserId: string | null;
  targetDisplayName: string | null;
  targetArea: ManorV7Area | null;
  releasedAt: number | null;
  returnAt: number | null;
  restUntil: number | null;
}

export interface ManorV7WildAttackState {
  attackerUserId: string;
  attackerDisplayName: string;
  attackType: string;
  weaponId: number;
  successful: boolean;
  damage: number;
}

export interface ManorV7IncomingWildAnimalState {
  serial: number;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerSlotId: number;
  animalType: number;
  area: ManorV7Area;
  blood: number;
  status: 2 | 6;
  arrivedAt: number;
  returnAt: number;
  attacks: ManorV7WildAttackState[];
}

export interface ManorV7WildCrystalDropState {
  serial: number;
  crystalId: number;
  quantity: number;
  createdAt: number;
}

export interface ManorV7WildState {
  moralExperience: number;
  maxSlotId: number;
  slots: ManorV7WildSlotState[];
  incomingAnimals: ManorV7IncomingWildAnimalState[];
  crystalInventory: ManorV7InventoryEntry[];
  crystalDrops: ManorV7WildCrystalDropState[];
  nextIncomingSerial: number;
  nextCrystalSerial: number;
}

export interface ManorV7FishState {
  serial: number;
  fishId: number;
  growthSeconds: number;
  stolen: number;
  thiefUserIds: string[];
  fedStage: number;
}

export interface ManorV7Activity {
  id: number;
  area: ManorV7Area;
  message: string;
  createdAt: number;
}

export interface ManorV7TaskState {
  key: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface ManorV7State {
  schemaVersion: 1;
  revision: number;
  coins: number;
  farmExperience: number;
  pastureExperience: number;
  farm: {
    lands: ManorV7FarmLandState[];
    seedInventory: ManorV7InventoryEntry[];
    produceInventory: ManorV7InventoryEntry[];
    toolInventory: ManorV7InventoryEntry[];
    badActions: { day: string | null; remaining: number };
    manureCollection: { day: string | null; remaining: number };
    dog: ManorV7DogState;
    weather: ManorV7WeatherState;
    fishPool: {
      opened: boolean;
      nextFishSerial: number;
      unlockedFishIds: number[];
      fish: ManorV7FishState[];
      seedInventory: ManorV7InventoryEntry[];
      produceInventory: ManorV7InventoryEntry[];
      toolInventory: ManorV7InventoryEntry[];
    };
    eventProgressSeconds: number;
    selectedDecorationIds: number[];
    selectedBoardId: number | null;
    selectedAvatarId: number | null;
  };
  pasture: {
    grass: number;
    hutchLevel: number;
    shedLevel: number;
    nextAnimalSerial: number;
    animals: ManorV7PastureAnimalState[];
    cubInventory: ManorV7InventoryEntry[];
    materialInventory: ManorV7InventoryEntry[];
    toolInventory: ManorV7InventoryEntry[];
    weaponInventory: ManorV7InventoryEntry[];
    productInventory: ManorV7InventoryEntry[];
    harvestedAnimalInventory: ManorV7InventoryEntry[];
    guards: ManorV7PastureGuardState[];
    research: { hutch: ManorV7ResearchSlotState; shed: ManorV7ResearchSlotState };
    specialFeed: { day: string | null; remaining: number };
    mosquitoActions: { day: string | null; remaining: number };
    mosquitoes: { sourceUserIds: string[] };
    mousePresent: boolean;
    parade: ManorV7ParadeState;
    manure: number;
    selectedDecorationIds: number[];
    wild: ManorV7WildState;
  };
  ownedDecorationIds: number[];
  decorationOwnerships: ManorV7DecorationOwnership[];
  rewardClaims: {
    dailyPackageDay: string | null;
    signInDay: string | null;
    signInRewardDay: string | null;
    signInRewardId: number | null;
    signInRewardIds: number[];
    signInStreak: number;
    signInStreakRewardDays: number[];
    vipReturnGiftClaimed: boolean;
  };
  researchGuideSeen: boolean;
  tutorialTask: { taskId: number; accepted: boolean };
  levelRewardClaims: { farm: number; pasture: number };
  redeemedCodes: string[];
  friendFilterUserIds: string[];
  receivedFlowers: ManorV7FlowerGift[];
  nextFlowerGiftId: number;
  tasks: ManorV7TaskState[];
  activities: ManorV7Activity[];
  nextActivityId: number;
  randomState: number;
  updatedAt: number;
}

export type ManorV7Action =
  | { type: "buy-seed"; cropId: number; quantity: number }
  | { type: "plant"; landId: number; cropId: number }
  | { type: "water"; landId: number }
  | { type: "remove-weeds"; landId: number }
  | { type: "remove-pests"; landId: number }
  | { type: "fertilize"; landId: number; toolId: number }
  | { type: "harvest"; landId: number }
  | { type: "clear-land"; landId: number }
  | { type: "reclaim-land"; landId: number }
  | { type: "upgrade-land"; landId: number; tier: Exclude<ManorV7LandTier, "normal"> }
  | { type: "sell-produce"; cropId: number; quantity: number }
  | { type: "sell-seed"; cropId: number; quantity: number }
  | { type: "sell-selected-seeds"; cropIds: number[] }
  | { type: "sell-all-produce" }
  | { type: "set-produce-lock"; cropId: number; locked: boolean }
  | { type: "unlock-fish"; fishId: number }
  | { type: "register-fish-pool" }
  | { type: "set-fish-lock"; fishId: number; locked: boolean }
  | { type: "fertilize-fish"; serial: number; toolId: number }
  | { type: "buy-fish-seed"; fishId: number; quantity: number }
  | { type: "plant-fish"; fishId: number }
  | { type: "harvest-fish"; serial: number }
  | { type: "sell-fish"; fishId: number; quantity: number }
  | { type: "buy-tool"; area: ManorV7Area; toolId: number; quantity: number; itemType?: number; useVip?: boolean }
  | { type: "buy-farm-dog"; dogId: number }
  | { type: "buy-dog-food"; days: 1 | 7 }
  | { type: "set-active-dog"; dogId: number | null }
  | { type: "process-manure-fertilizer" }
  | { type: "block-friend"; userId: string }
  | { type: "unblock-friend"; userId: string }
  | { type: "buy-animal"; animalId: number; quantity: number }
  | { type: "raise-animal-from-inventory"; animalId: number; quantity: number }
  | { type: "use-pasture-can"; serial: number; toolId: number }
  | { type: "buy-grass"; quantity: number }
  | { type: "buy-grass-to-inventory"; quantity: number }
  | { type: "feed-grass-from-inventory"; quantity: number }
  | { type: "buy-pasture-guard"; guardId: number }
  | { type: "set-pasture-guard-active"; guardId: number; active: boolean }
  | { type: "pay-pasture-guard"; guardId: number; days: number }
  | { type: "claim-daily-package" }
  | { type: "record-sign-in-visit" }
  | { type: "claim-sign-in" }
  | { type: "claim-sign-in-streak-reward"; days: number }
  | { type: "accept-tutorial-task" }
  | { type: "complete-tutorial-task" }
  | { type: "claim-level-rewards"; area: ManorV7Area; throughLevel: number }
  | { type: "show-research-guide" }
  | { type: "clear-activities" }
  | { type: "claim-vip-return-gift" }
  | { type: "redeem-code"; code: string }
  | { type: "start-production"; serial: number }
  | { type: "collect-product"; serial: number }
  | { type: "collect-products"; animalId?: number }
  | { type: "harvest-animals"; serial?: number }
  | { type: "sell-animal"; serial: number }
  | { type: "donate-animal"; serial: number }
  | { type: "sell-cub"; animalId: number; quantity: number }
  | { type: "sell-all-cubs" }
  | { type: "sell-animal-product"; animalId: number; quantity: number }
  | { type: "sell-harvested-animal"; animalId: number; quantity: number }
  | { type: "sell-all-pasture-products" }
  | { type: "collect-manure" }
  | { type: "upgrade-house"; house: ManorV7AnimalHouse }
  | { type: "start-research"; house: ManorV7AnimalHouse; animalId: number }
  | { type: "collect-research"; house: ManorV7AnimalHouse }
  | { type: "use-research-hourglass"; house: ManorV7AnimalHouse; toolId: number }
  | { type: "special-feed"; serial: number }
  | { type: "clear-mosquito" }
  | { type: "catch-own-mouse" }
  | { type: "set-parade"; info: string; patternId: number }
  | { type: "buy-decoration"; area: ManorV7Area; decorationId: number; useVip?: boolean }
  | { type: "renew-decoration"; area: ManorV7Area; decorationId: number; useVip?: boolean }
  | { type: "equip-decoration"; area: ManorV7Area; decorationId: number }
  | { type: "set-board"; boardId: number | null }
  | { type: "set-avatar"; avatarId: number | null }
  | { type: "open-wild-slot"; slotId: number }
  | { type: "adopt-wild-animal"; slotId: number; animalType: number }
  | { type: "claim-wild-return"; slotId: number }
  | { type: "donate-wild-animal"; slotId: number }
  | { type: "attack-wild-animal"; serial: number; attackType: string; weaponId: number }
  | { type: "pickup-wild-crystal"; serial: number };

export type ManorV7FriendAction =
  | { type: "water"; landId: number }
  | { type: "remove-weeds"; landId: number }
  | { type: "remove-pests"; landId: number }
  | { type: "steal-crop"; landId: number }
  | { type: "add-weeds"; landId: number }
  | { type: "add-pests"; landId: number }
  | { type: "steal-fish"; serial: number }
  | { type: "fertilize-fish"; serial: number; toolId?: number }
  | { type: "special-feed"; serial: number }
  | { type: "clean-manure"; quantity: number }
  | { type: "buy-grass-for-friend"; quantity: number }
  | { type: "add-mosquito"; quantity: number }
  | { type: "remove-mosquito" }
  | { type: "catch-mouse" }
  | { type: "send-flower"; flowerId: number; message: string }
  | { type: "start-production"; serial: number }
  | { type: "steal-product"; serial: number }
  | { type: "release-wild-animal"; slotId: number; animalType: number; area: ManorV7Area }
  | { type: "attack-wild-animal"; serial: number; attackType: string; weaponId: number }
  | { type: "pickup-wild-crystal"; serial: number };

export interface ManorV7FriendTransitionResult {
  visitor: ManorV7State;
  owner: ManorV7State;
  message: string;
}

export interface ManorV7FriendActionResult {
  visitor: ManorV7View;
  owner: ManorV7View;
  message: string;
}

export interface ManorV7LandView extends ManorV7FarmLandState {
  crop?: ManorV7CropDefinition;
  visualState: ManorV7CropVisualState | "empty" | "locked";
  remainingSeconds: number;
  harvestable: boolean;
  effectiveYield: number;
}

export interface ManorV7AnimalView extends ManorV7PastureAnimalState {
  animal: ManorV7AnimalDefinition;
  visualState: ManorV7AnimalVisualState;
  remainingSeconds: number;
  collectable: boolean;
  hungry: boolean;
}

export interface ManorV7TaskView extends ManorV7TaskState {
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
}

export interface ManorV7View {
  version: "7.0 Beta1 Build 20120209.1000";
  owner: { userId: string; displayName: string };
  revision: number;
  coins: number;
  farmLevel: number;
  farmExperience: number;
  farmNextLevelExperience: number;
  pastureLevel: number;
  pastureExperience: number;
  pastureNextLevelExperience: number;
  farm: {
    lands: ManorV7LandView[];
    seedInventory: ManorV7InventoryEntry[];
    produceInventory: ManorV7InventoryEntry[];
    toolInventory: ManorV7InventoryEntry[];
    badActions: ManorV7State["farm"]["badActions"];
    manureCollection: ManorV7State["farm"]["manureCollection"];
    dog: ManorV7DogState;
    weather: ManorV7WeatherState;
    fishPool: {
      opened: boolean;
      capacity: number;
      nextFishSerial: number;
      unlockedFishIds: number[];
      fish: ManorV7FishState[];
      seedInventory: ManorV7InventoryEntry[];
      produceInventory: ManorV7InventoryEntry[];
      toolInventory: ManorV7InventoryEntry[];
    };
    selectedDecorationIds: number[];
    selectedBoardId: number | null;
    selectedAvatarId: number | null;
  };
  pasture: {
    grass: number;
    hutchLevel: number;
    shedLevel: number;
    hutchCapacity: number;
    shedCapacity: number;
    animals: ManorV7AnimalView[];
    cubInventory: ManorV7InventoryEntry[];
    materialInventory: ManorV7InventoryEntry[];
    toolInventory: ManorV7InventoryEntry[];
    weaponInventory: ManorV7InventoryEntry[];
    productInventory: ManorV7InventoryEntry[];
    harvestedAnimalInventory: ManorV7InventoryEntry[];
    guards: ManorV7PastureGuardState[];
    research: ManorV7State["pasture"]["research"];
    specialFeed: ManorV7State["pasture"]["specialFeed"];
    mosquitoActions: ManorV7State["pasture"]["mosquitoActions"];
    mosquitoes: ManorV7State["pasture"]["mosquitoes"];
    mousePresent: boolean;
    parade: ManorV7ParadeState;
    manure: number;
    selectedDecorationIds: number[];
    wild: ManorV7WildState;
  };
  ownedDecorationIds: number[];
  decorationOwnerships: ManorV7DecorationOwnership[];
  rewardClaims: ManorV7State["rewardClaims"];
  researchGuideSeen: boolean;
  tutorialTask: ManorV7State["tutorialTask"];
  levelRewardClaims: ManorV7State["levelRewardClaims"];
  redeemedCodes: string[];
  friendFilterUserIds: string[];
  receivedFlowers: ManorV7FlowerGift[];
  tasks: ManorV7TaskView[];
  activities: ManorV7Activity[];
  catalogs: {
    crops: readonly ManorV7CropDefinition[];
    animals: readonly ManorV7AnimalDefinition[];
    tools: readonly ManorV7ToolDefinition[];
    decorations: readonly ManorV7DecorationDefinition[];
    fish: readonly ManorV7FishDefinition[];
    wildAnimals: readonly ManorV7WildAnimalDefinition[];
    wildCrystals: readonly ManorV7WildCrystalDefinition[];
    flowers: readonly ManorV7FlowerDefinition[];
  };
  serverTime: number;
}

export interface ManorV7FriendSummary {
  userId: string;
  displayName: string;
  farmLevel: number;
  pastureLevel: number;
  coins: number;
  isCurrentUser: boolean;
}

export interface ManorV7SocialView {
  friends: ManorV7FriendSummary[];
  farmRanking: ManorV7FriendSummary[];
  pastureRanking: ManorV7FriendSummary[];
}
