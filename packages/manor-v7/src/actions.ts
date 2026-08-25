import {
  MANOR_V7_CROPS,
  manorV7Animal,
  manorV7Avatar,
  manorV7Board,
  manorV7Crop,
  manorV7Decoration,
  manorV7DecorationCoinPrice,
  manorV7Fish,
  manorV7LandUpgrade,
  manorV7PastureGuard,
  manorV7Tool,
  manorV7ToolCoinPrice,
  manorV7ToolByType
} from "./catalog.js";
import {
  MANOR_V7_GRASS_CAPACITY,
  MANOR_V7_DOG_FOOD_DAY_SECONDS,
  MANOR_V7_GUARD_INITIAL_WAGE_SECONDS,
  MANOR_V7_GRASS_PRICE,
  MANOR_V7_HOUSE_UPGRADES,
  MANOR_V7_FISH_POOL_CAPACITY,
  MANOR_V7_RECLAIM_RULES,
  MANOR_V7_RESEARCH_RULES,
  MANOR_V7_SEASONAL_ANIMAL_DROP_LIMIT,
  MANOR_V7_SEASONAL_ANIMAL_IDS,
  addManorV7Activity,
  drawManorV7Random,
  inventoryQuantity,
  manorV7DayKey,
  manorV7HouseCapacity,
  manorV7EffectiveYield,
  manorV7LevelForExperience,
  progressManorV7Task,
  setInventoryQuantity
} from "./state.js";
import { manorV7MaxProductionCount } from "./pasture-lifecycle.js";
import {
  MANOR_V7_DAILY_SIGN_IN_LIMIT,
  MANOR_V7_DAILY_SIGN_IN_REWARDS,
  MANOR_V7_SIGN_IN_ONLY_ANIMAL_IDS,
  manorV7StreakSignInReward,
  type ManorV7SignInRewardDefinition
} from "./sign-in.js";
import {
  MANOR_V7_MAX_LEVEL_REWARD,
  MANOR_V7_TUTORIAL_TASKS,
  MANOR_V7_VIP_RETURN_GIFT,
  isManorV7RewardAvailable,
  manorV7LevelReward,
  manorV7RedeemCode,
  manorV7TutorialTask,
  normalizeManorV7RedeemCode,
  type ManorV7RewardItem
} from "./rewards.js";
import {
  manorV7CropSaleQuote,
  manorV7EffectiveCropSeedPrice,
  manorV7PastureProductSaleQuote
} from "./seasonal.js";
import type { ManorV7Action, ManorV7AnimalHouse, ManorV7State } from "./types.js";
import {
  MANOR_V7_WILD_MAX_SLOTS,
  MANOR_V7_WILD_REST_SECONDS,
  MANOR_V7_WILD_SLOT_PRICES,
  manorV7WildAnimal,
  manorV7WildCrystal
} from "./wild.js";

export const MANOR_V7_HIDDEN_SEED_IDS = MANOR_V7_CROPS
  .filter((crop) => crop.isHidden)
  .map((crop) => crop.id);

const MANOR_V7_REUNION_DECORATION_IDS = [377, 378, 379, 380, 381, 382, 383, 384] as const;
const MANOR_V7_REUNION_DECORATION_SECONDS = 16_070_400;
const MANOR_V7_HALLOWEEN_FARM_DECORATION_IDS = [665, 666, 667, 668] as const;
const MANOR_V7_HALLOWEEN_PASTURE_DECORATION_ID = 135;

export function applyManorV7Action(state: ManorV7State, action: ManorV7Action, now: number): void {
  switch (action.type) {
    case "buy-seed": {
      requirePositiveInteger(action.quantity);
      const crop = manorV7Crop(action.cropId);
      if (crop.isHidden) throw new Error("该种子只能通过活动获得");
      if (manorV7LevelForExperience(state.farmExperience) < crop.originalLevel) throw new Error(`${crop.name}需要农场达到 ${crop.originalLevel} 级`);
      if (crop.seedPrice <= 0 && !crop.isVip) throw new Error("该种子不是金币商店商品");
      charge(state, manorV7EffectiveCropSeedPrice(crop.id, crop.seedPrice) * action.quantity);
      setInventoryQuantity(state.farm.seedInventory, crop.id, inventoryQuantity(state.farm.seedInventory, crop.id) + action.quantity);
      addManorV7Activity(state, "farm", `购买了 ${action.quantity} 份${crop.name}种子`, now);
      break;
    }
    case "plant": {
      const land = ownedLand(state, action.landId);
      if (land.cropId) throw new Error("这块土地已有作物");
      const crop = manorV7Crop(action.cropId);
      if (manorV7LevelForExperience(state.farmExperience) < crop.originalLevel) throw new Error("农场等级不足");
      const tier = land.tier === "black" ? 2 : land.tier === "red" ? 1 : 0;
      if (crop.landRequirement > tier) throw new Error(`这块土地不能种植${crop.name}`);
      const quantity = inventoryQuantity(state.farm.seedInventory, crop.id);
      if (quantity < 1) throw new Error("种子库存不足");
      setInventoryQuantity(state.farm.seedInventory, crop.id, quantity - 1);
      Object.assign(land, {
        cropId: crop.id,
        growthSeconds: 0,
        harvests: 0,
        watered: state.farm.weather.kind === "rainy",
        weeds: false,
        pests: false,
        stolen: 0,
        thiefUserIds: [],
        fertilizedSeconds: 0,
        yieldPenaltyPercent: 0
      });
      state.farmExperience += 1;
      progressManorV7Task(state, "plant", 1);
      addManorV7Activity(state, "farm", `在第 ${land.id} 块土地种下了${crop.name}`, now);
      break;
    }
    case "water": {
      const land = cropLand(state, action.landId);
      if (land.watered) throw new Error("这块土地不需要浇水");
      land.watered = true;
      state.farmExperience += 2;
      progressManorV7Task(state, "water", 1);
      addManorV7Activity(state, "farm", `给第 ${land.id} 块土地浇了水`, now);
      break;
    }
    case "remove-weeds": {
      const land = cropLand(state, action.landId);
      if (!land.weeds) throw new Error("这块土地没有杂草");
      land.weeds = false;
      state.farmExperience += 2;
      progressManorV7Task(state, "care", 1);
      addManorV7Activity(state, "farm", `清除了第 ${land.id} 块土地的杂草`, now);
      break;
    }
    case "remove-pests": {
      const land = cropLand(state, action.landId);
      if (!land.pests) throw new Error("这块土地没有害虫");
      land.pests = false;
      state.farmExperience += 2;
      progressManorV7Task(state, "care", 1);
      addManorV7Activity(state, "farm", `清除了第 ${land.id} 块土地的害虫`, now);
      break;
    }
    case "buy-tool": {
      requirePositiveInteger(action.quantity);
      const tool = action.itemType === undefined
        ? manorV7Tool(action.area, action.toolId)
        : manorV7ToolByType(action.area, action.toolId, action.itemType);
      if (!tool.available) throw new Error("该工具当前不可购买");
      if (tool.coinPrice <= 0 && tool.premiumPrice <= 0) throw new Error("该工具没有有效价格");
      charge(state, manorV7ToolCoinPrice(tool) * action.quantity);
      const inventory = tool.area === "farm" && tool.itemType === 24
        ? state.farm.fishPool.toolInventory
        : tool.area === "farm" && tool.itemType === 3
          ? state.farm.toolInventory
          : tool.area === "pasture" && tool.itemType === 10
            ? state.pasture.weaponInventory
            : tool.area === "pasture" && [7, 12].includes(tool.itemType)
              ? state.pasture.toolInventory
              : null;
      if (!inventory) throw new Error("该工具需要使用专用购买入口");
      setInventoryQuantity(inventory, tool.id, inventoryQuantity(inventory, tool.id) + action.quantity);
      addManorV7Activity(state, action.area, `购买了 ${action.quantity} 个${tool.name}`, now);
      break;
    }
    case "buy-farm-dog": {
      const dog = manorV7ToolByType("farm", action.dogId, 4);
      if (state.farm.dog.ownedIds.includes(dog.id)) throw new Error("已经拥有这只看门动物");
      charge(state, manorV7ToolCoinPrice(dog));
      state.farm.dog.ownedIds.push(dog.id);
      state.farm.dog.ownedIds.sort((left, right) => left - right);
      state.farm.dog.activeId = dog.id;
      addManorV7Activity(state, "farm", `购买并启用了${dog.name}`, now);
      break;
    }
    case "buy-dog-food": {
      const foodId = action.days === 7 ? 9002 : 9001;
      const food = manorV7ToolByType("farm", foodId, 909090);
      charge(state, manorV7ToolCoinPrice(food));
      state.farm.dog.feedSeconds += action.days * MANOR_V7_DOG_FOOD_DAY_SECONDS;
      addManorV7Activity(state, "farm", `补充了 ${action.days} 天狗粮`, now);
      break;
    }
    case "set-active-dog": {
      if (action.dogId !== null && !state.farm.dog.ownedIds.includes(action.dogId)) {
        throw new Error("尚未拥有这只看门动物");
      }
      state.farm.dog.activeId = action.dogId;
      addManorV7Activity(state, "farm", action.dogId === null ? "收起了看门动物" : "更换了看门动物", now);
      break;
    }
    case "process-manure-fertilizer": {
      const manure = inventoryQuantity(state.pasture.materialInventory, 1506);
      const roses = inventoryQuantity(state.farm.produceInventory, 41);
      if (manure < 5) throw new Error(`还差 ${5 - manure} 个牧场便便`);
      if (roses < 5) throw new Error(`还差 ${5 - roses} 朵红玫瑰`);
      if (state.coins < 1_000) throw new Error(`还差 ${1_000 - state.coins} 个金币`);
      state.coins -= 1_000;
      setInventoryQuantity(state.pasture.materialInventory, 1506, manure - 5);
      setInventoryQuantity(state.farm.produceInventory, 41, roses - 5);
      setInventoryQuantity(
        state.farm.toolInventory,
        3,
        inventoryQuantity(state.farm.toolInventory, 3) + 1
      );
      addManorV7Activity(state, "farm", "加工坊制作了 1 袋极速化肥", now);
      break;
    }
    case "delete-received-flowers": {
      if (action.giftIds.length === 0) throw new Error("花束记录不存在");
      const giftIds = new Set(action.giftIds);
      const remaining = state.receivedFlowers.filter((gift) => !giftIds.has(gift.id));
      if (remaining.length === state.receivedFlowers.length) throw new Error("花束记录不存在");
      state.receivedFlowers = remaining;
      break;
    }
    case "block-friend": {
      if (state.friendFilterUserIds.includes(action.userId)) throw new Error("该好友已经在拦截名单中");
      state.friendFilterUserIds.push(action.userId);
      state.friendFilterUserIds.sort();
      addManorV7Activity(state, "farm", "更新了好友拦截名单", now);
      break;
    }
    case "unblock-friend": {
      if (!state.friendFilterUserIds.includes(action.userId)) throw new Error("该好友不在拦截名单中");
      state.friendFilterUserIds = state.friendFilterUserIds.filter((userId) => userId !== action.userId);
      addManorV7Activity(state, "farm", "更新了好友拦截名单", now);
      break;
    }
    case "fertilize": {
      const land = cropLand(state, action.landId);
      const tool = action.toolId === 4 ? null : manorV7ToolByType("farm", action.toolId, 3);
      const effectSeconds = tool?.effectSeconds ?? 3_600;
      if (effectSeconds <= 0) throw new Error("该道具不是化肥");
      const key = toolInventoryKey("farm", action.toolId);
      const quantity = inventoryQuantity(state.farm.toolInventory, key);
      if (quantity < 1) throw new Error("化肥库存不足");
      const crop = manorV7Crop(land.cropId!);
      land.growthSeconds = Math.min(crop.growthSeconds, land.growthSeconds + effectSeconds);
      land.fertilizedSeconds += effectSeconds;
      setInventoryQuantity(state.farm.toolInventory, key, quantity - 1);
      addManorV7Activity(state, "farm", `对第 ${land.id} 块土地使用了${tool?.name ?? "好友化肥"}`, now);
      break;
    }
    case "harvest": {
      const land = cropLand(state, action.landId);
      const crop = manorV7Crop(land.cropId!);
      if (land.harvests >= crop.harvestCycles || land.growthSeconds < crop.growthSeconds) throw new Error("作物尚未成熟");
      const yieldAmount = Math.max(1, manorV7EffectiveYield(land) - land.stolen);
      setInventoryQuantity(state.farm.produceInventory, crop.id, inventoryQuantity(state.farm.produceInventory, crop.id) + yieldAmount);
      state.farmExperience += crop.experience;
      land.harvests += 1;
      land.stolen = 0;
      land.thiefUserIds = [];
      if (land.harvests < crop.harvestCycles) {
        land.growthSeconds = crop.stageSeconds[3] ?? crop.growthSeconds * 0.75;
        land.watered = false;
        land.weeds = false;
        land.pests = false;
        land.yieldPenaltyPercent = 0;
      }
      progressManorV7Task(state, "harvest", 1);
      addManorV7Activity(state, "farm", `收获了 ${yieldAmount} 份${crop.name}`, now);
      break;
    }
    case "clear-land": {
      const land = cropLand(state, action.landId);
      const crop = manorV7Crop(land.cropId!);
      if (land.harvests < crop.harvestCycles) throw new Error("作物还没有结束全部收获季");
      state.farmExperience += 3;
      const hiddenSeeds = MANOR_V7_CROPS.filter((candidate) => candidate.isHidden);
      if (hiddenSeeds.length > 0 && drawManorV7Random(state) < 1 / 50) {
        const hiddenSeed = hiddenSeeds[Math.floor(drawManorV7Random(state) * hiddenSeeds.length)]!;
        const quantity = drawManorV7Random(state) < 0.5 ? 1 : 2;
        setInventoryQuantity(
          state.farm.seedInventory,
          hiddenSeed.id,
          inventoryQuantity(state.farm.seedInventory, hiddenSeed.id) + quantity
        );
        addManorV7Activity(state, "farm", `翻地时发现了 ${quantity} 颗${hiddenSeed.name}种子`, now);
      }
      delete land.cropId;
      Object.assign(land, { growthSeconds: 0, harvests: 0, watered: false, weeds: false, pests: false, stolen: 0, thiefUserIds: [], fertilizedSeconds: 0, yieldPenaltyPercent: 0 });
      addManorV7Activity(state, "farm", `清理了第 ${land.id} 块土地`, now);
      break;
    }
    case "sell-produce": {
      requirePositiveInteger(action.quantity);
      const crop = manorV7Crop(action.cropId);
      const entry = state.farm.produceInventory.find((item) => item.sourceId === crop.id);
      const quantity = entry?.quantity ?? 0;
      if (quantity < action.quantity) throw new Error("农产品库存不足");
      if (entry?.locked) throw new Error("锁定的农产品不能出售");
      setInventoryQuantity(state.farm.produceInventory, crop.id, quantity - action.quantity);
      const quote = manorV7CropSaleQuote(crop.id, crop.salePrice, action.quantity);
      state.coins += quote.revenue;
      progressManorV7Task(state, "sell", action.quantity);
      addManorV7Activity(
        state,
        "farm",
        `出售了 ${action.quantity} 份${crop.name}${quote.multiplier > 1 ? "，获得情人节 9 倍收益" : ""}`,
        now
      );
      break;
    }
    case "sell-seed": {
      requirePositiveInteger(action.quantity);
      const crop = manorV7Crop(action.cropId);
      const available = inventoryQuantity(state.farm.seedInventory, crop.id);
      if (available < action.quantity) throw new Error("种子库存不足");
      const revenue = Math.ceil(crop.seedPrice / 2) * action.quantity;
      setInventoryQuantity(state.farm.seedInventory, crop.id, available - action.quantity);
      state.coins += revenue;
      addManorV7Activity(state, "farm", `出售了 ${action.quantity} 份${crop.name}种子，获得 ${revenue} 金币`, now);
      break;
    }
    case "sell-selected-seeds": {
      const cropIds = [...new Set(action.cropIds)];
      if (!cropIds.length) throw new Error("没有选择要出售的种子");
      let revenue = 0;
      let quantity = 0;
      for (const cropId of cropIds) {
        const crop = manorV7Crop(cropId);
        const available = inventoryQuantity(state.farm.seedInventory, crop.id);
        revenue += Math.ceil(crop.seedPrice / 2) * available;
        quantity += available;
        setInventoryQuantity(state.farm.seedInventory, crop.id, 0);
      }
      if (!quantity) throw new Error("所选种子没有库存");
      state.coins += revenue;
      addManorV7Activity(state, "farm", `批量出售了 ${quantity} 份种子，获得 ${revenue} 金币`, now);
      break;
    }
    case "sell-all-produce": {
      const sellable = state.farm.produceInventory.filter((entry) => !entry.locked);
      if (!sellable.length) throw new Error("仓库没有可出售的果实");
      const quotes = sellable.map((entry) => {
        const crop = manorV7Crop(entry.sourceId);
        return manorV7CropSaleQuote(crop.id, crop.salePrice, entry.quantity);
      });
      const revenue = quotes.reduce((total, quote) => total + quote.revenue, 0);
      const quantity = sellable.reduce((total, entry) => total + entry.quantity, 0);
      state.farm.produceInventory = state.farm.produceInventory.filter((entry) => entry.locked);
      state.coins += revenue;
      progressManorV7Task(state, "sell", quantity);
      const lovesdayBonus = quotes.some((quote) => quote.multiplier > 1) ? "，含情人节 9 倍收益" : "";
      addManorV7Activity(state, "farm", `卖出全部 ${quantity} 份果实，获得 ${revenue} 金币${lovesdayBonus}`, now);
      break;
    }
    case "set-produce-lock": {
      manorV7Crop(action.cropId);
      const entry = state.farm.produceInventory.find((item) => item.sourceId === action.cropId);
      if (!entry) throw new Error("农产品库存不存在");
      entry.locked = action.locked;
      addManorV7Activity(state, "farm", `${action.locked ? "锁定" : "解锁"}了仓库中的农产品`, now);
      break;
    }
    case "unlock-fish": {
      const fish = manorV7Fish(action.fishId);
      if (fish.isHidden) throw new Error("该鱼种只能通过活动获得");
      if (state.farm.fishPool.unlockedFishIds.includes(fish.id)) throw new Error("该鱼种已经解锁");
      if (state.coins < fish.unlockCoins) throw new Error("金币不足");
      if (fish.unlockCrystalType > 0 && fish.unlockCrystalAmount > 0) {
        manorV7WildCrystal(fish.unlockCrystalType);
        const crystals = inventoryQuantity(state.pasture.wild.crystalInventory, fish.unlockCrystalType);
        if (crystals < fish.unlockCrystalAmount) throw new Error("水晶库存不足");
      }
      charge(state, fish.unlockCoins);
      if (fish.unlockCrystalType > 0 && fish.unlockCrystalAmount > 0) {
        setInventoryQuantity(
          state.pasture.wild.crystalInventory,
          fish.unlockCrystalType,
          inventoryQuantity(state.pasture.wild.crystalInventory, fish.unlockCrystalType) - fish.unlockCrystalAmount
        );
      }
      state.farm.fishPool.unlockedFishIds.push(fish.id);
      state.farm.fishPool.unlockedFishIds.sort((left, right) => left - right);
      addManorV7Activity(state, "farm", `解锁了鱼种${fish.name}`, now);
      break;
    }
    case "register-fish-pool": {
      if (state.farm.fishPool.opened) throw new Error("鱼塘已经开通");
      state.farm.fishPool.opened = true;
      addManorV7Activity(state, "farm", "开通了鱼塘", now);
      break;
    }
    case "set-fish-lock": {
      manorV7Fish(action.fishId);
      const entry = state.farm.fishPool.produceInventory.find((item) => item.sourceId === action.fishId);
      if (!entry) throw new Error("鱼仓库存不存在");
      entry.locked = action.locked;
      addManorV7Activity(state, "farm", `${action.locked ? "锁定" : "解锁"}了鱼仓中的成鱼`, now);
      break;
    }
    case "fertilize-fish": {
      const fishState = state.farm.fishPool.fish.find((item) => item.serial === action.serial);
      if (!fishState) throw new Error("鱼不存在");
      const tool = manorV7ToolByType("farm", action.toolId, 24);
      const available = inventoryQuantity(state.farm.fishPool.toolInventory, tool.id);
      if (available < 1) throw new Error("鱼食库存不足");
      const fish = manorV7Fish(fishState.fishId);
      const maturity = fish.cycleSeconds.at(-1) ?? fish.matureHours * 3_600;
      const stage = manorV7FishStage(fish.id, fishState.growthSeconds);
      if (stage >= fish.cycleSeconds.length) throw new Error("鱼已经成熟，不需要再喂食");
      if (fishState.fedStage === stage + 1) throw new Error("当前生长阶段已经使用过鱼食");
      setInventoryQuantity(state.farm.fishPool.toolInventory, tool.id, available - 1);
      fishState.fedStage = stage + 1;
      fishState.growthSeconds = Math.min(maturity, fishState.growthSeconds + tool.effectSeconds);
      addManorV7Activity(state, "farm", `给${fish.name}使用了${tool.name}`, now);
      break;
    }
    case "buy-fish-seed": {
      requirePositiveInteger(action.quantity);
      const fish = manorV7Fish(action.fishId);
      if (fish.isHidden) throw new Error("该鱼苗只能通过活动获得");
      if (!state.farm.fishPool.unlockedFishIds.includes(fish.id)) throw new Error("请先解锁该鱼种");
      charge(state, fish.seedPrice * action.quantity);
      setInventoryQuantity(
        state.farm.fishPool.seedInventory,
        fish.id,
        inventoryQuantity(state.farm.fishPool.seedInventory, fish.id) + action.quantity
      );
      addManorV7Activity(state, "farm", `购买了 ${action.quantity} 条${fish.name}鱼苗`, now);
      break;
    }
    case "plant-fish": {
      const fish = manorV7Fish(action.fishId);
      if (!state.farm.fishPool.unlockedFishIds.includes(fish.id)) throw new Error("请先解锁该鱼种");
      const seedQuantity = inventoryQuantity(state.farm.fishPool.seedInventory, fish.id);
      if (seedQuantity < 1) throw new Error("鱼苗库存不足");
      const occupied = state.farm.fishPool.fish.reduce(
        (total, item) => total + manorV7Fish(item.fishId).poolSize,
        0
      );
      if (occupied + fish.poolSize > MANOR_V7_FISH_POOL_CAPACITY) throw new Error("鱼塘空间不足");
      setInventoryQuantity(state.farm.fishPool.seedInventory, fish.id, seedQuantity - 1);
      state.farm.fishPool.fish.push({
        serial: state.farm.fishPool.nextFishSerial,
        fishId: fish.id,
        growthSeconds: 0,
        stolen: 0,
        thiefUserIds: [],
        fedStage: 0
      });
      state.farm.fishPool.nextFishSerial += 1;
      addManorV7Activity(state, "farm", `放养了${fish.name}`, now);
      break;
    }
    case "harvest-fish": {
      const index = state.farm.fishPool.fish.findIndex((fish) => fish.serial === action.serial);
      const fishState = state.farm.fishPool.fish[index];
      if (!fishState) throw new Error("鱼不存在");
      const fish = manorV7Fish(fishState.fishId);
      const maturity = fish.cycleSeconds.at(-1) ?? fish.matureHours * 3_600;
      if (fishState.growthSeconds < maturity) throw new Error("鱼还没有成熟");
      state.farm.fishPool.fish.splice(index, 1);
      setInventoryQuantity(
        state.farm.fishPool.produceInventory,
        fish.id,
        inventoryQuantity(state.farm.fishPool.produceInventory, fish.id) + Math.max(1, fish.baseYield - fishState.stolen)
      );
      state.farmExperience += fish.experience;
      addManorV7Activity(state, "farm", `收获了 ${Math.max(1, fish.baseYield - fishState.stolen)} 条${fish.name}`, now);
      break;
    }
    case "sell-fish": {
      requirePositiveInteger(action.quantity);
      const fish = manorV7Fish(action.fishId);
      const available = inventoryQuantity(state.farm.fishPool.produceInventory, fish.id);
      if (available < action.quantity) throw new Error("鱼类库存不足");
      if (state.farm.fishPool.produceInventory.find((entry) => entry.sourceId === fish.id)?.locked) {
        throw new Error("锁定的成鱼不能出售");
      }
      setInventoryQuantity(state.farm.fishPool.produceInventory, fish.id, available - action.quantity);
      state.coins += fish.salePrice * action.quantity;
      addManorV7Activity(state, "farm", `出售了 ${action.quantity} 条${fish.name}`, now);
      break;
    }
    case "reclaim-land": {
      const unlocked = state.farm.lands.filter((land) => land.unlocked).length;
      const next = state.farm.lands.find((land) => !land.unlocked);
      const rule = MANOR_V7_RECLAIM_RULES.find((item) => item.unlocked === unlocked);
      if (!next || !rule || next.id !== action.landId) throw new Error("只能按顺序开垦下一块土地");
      if (manorV7LevelForExperience(state.farmExperience) < rule.level) throw new Error(`开垦需要农场达到 ${rule.level} 级`);
      charge(state, rule.coins);
      next.unlocked = true;
      addManorV7Activity(state, "farm", `开垦了第 ${next.id} 块土地`, now);
      break;
    }
    case "upgrade-land": {
      const land = ownedLand(state, action.landId);
      if (land.cropId) throw new Error("请先清空土地再升级");
      if (action.tier === "red" && land.tier !== "normal") throw new Error("只有普通土地可以升级为红土地");
      if (action.tier === "black" && land.tier !== "red") throw new Error("只有红土地可以升级为黑土地");
      const upgradedCount = action.tier === "red"
        ? state.farm.lands.filter((item) => item.tier !== "normal").length
        : state.farm.lands.filter((item) => item.tier === "black").length;
      const rule = manorV7LandUpgrade(action.tier, upgradedCount);
      if (manorV7LevelForExperience(state.farmExperience) < rule.level) throw new Error(`升级需要农场达到 ${rule.level} 级`);
      charge(state, rule.coins);
      land.tier = action.tier;
      addManorV7Activity(state, "farm", `第 ${land.id} 块土地升级为${action.tier === "red" ? "红土地" : "黑土地"}`, now);
      break;
    }
    case "buy-animal": {
      requirePositiveInteger(action.quantity);
      const animal = manorV7Animal(action.animalId);
      if (animal.isHidden) throw new Error("该动物只能通过活动获得");
      if (MANOR_V7_SIGN_IN_ONLY_ANIMAL_IDS.includes(
        animal.id as (typeof MANOR_V7_SIGN_IN_ONLY_ANIMAL_IDS)[number]
      )) throw new Error("该动物只能通过签到奖励获得");
      if (MANOR_V7_RESEARCH_RULES[animal.house].some((rule) => rule.animalId === animal.id)) {
        throw new Error("该动物只能通过科研获得");
      }
      const level = manorV7LevelForExperience(state.pastureExperience);
      if (level < animal.originalLevel) throw new Error(`${animal.name}需要牧场达到 ${animal.originalLevel} 级`);
      const houseLevel = animal.house === "hutch" ? state.pasture.hutchLevel : state.pasture.shedLevel;
      const occupied = state.pasture.animals.filter((item) => manorV7Animal(item.animalId).house === animal.house).length;
      if (occupied + action.quantity > manorV7HouseCapacity(animal.house, houseLevel)) throw new Error(`${animal.house === "hutch" ? "窝" : "棚"}的空位不足`);
      charge(state, animal.purchasePrice * action.quantity);
      for (let index = 0; index < action.quantity; index += 1) {
        state.pasture.animals.push({ serial: state.pasture.nextAnimalSerial, animalId: animal.id, growthSeconds: 0, productionActive: false, productionProgressSeconds: 0, productionCount: 0, pendingProduct: 0, stolenProduct: 0, productThiefUserIds: [] });
        state.pasture.nextAnimalSerial += 1;
      }
      state.pastureExperience += action.quantity * 5;
      addManorV7Activity(state, "pasture", `购买了 ${action.quantity} 只${animal.name}`, now);
      break;
    }
    case "raise-animal-from-inventory": {
      requirePositiveInteger(action.quantity);
      const animal = manorV7Animal(action.animalId);
      const available = inventoryQuantity(state.pasture.cubInventory, animal.id);
      if (available < action.quantity) throw new Error("动物幼仔库存不足");
      const houseLevel = animal.house === "hutch" ? state.pasture.hutchLevel : state.pasture.shedLevel;
      const occupied = state.pasture.animals.filter((item) => manorV7Animal(item.animalId).house === animal.house).length;
      if (occupied + action.quantity > manorV7HouseCapacity(animal.house, houseLevel)) {
        throw new Error(`${animal.house === "hutch" ? "窝" : "棚"}的空位不足`);
      }
      setInventoryQuantity(state.pasture.cubInventory, animal.id, available - action.quantity);
      for (let index = 0; index < action.quantity; index += 1) {
        state.pasture.animals.push({ serial: state.pasture.nextAnimalSerial, animalId: animal.id, growthSeconds: 0, productionActive: false, productionProgressSeconds: 0, productionCount: 0, pendingProduct: 0, stolenProduct: 0, productThiefUserIds: [] });
        state.pasture.nextAnimalSerial += 1;
      }
      state.pastureExperience += action.quantity * 5;
      addManorV7Activity(state, "pasture", `从物品包放养了 ${action.quantity} 只${animal.name}`, now);
      break;
    }
    case "use-pasture-can": {
      const animalState = state.pasture.animals.find((item) => item.serial === action.serial);
      if (!animalState) throw new Error("动物不存在");
      const animal = manorV7Animal(animalState.animalId);
      if (animalState.growthSeconds >= animal.maturitySeconds || animalState.productionActive) {
        throw new Error("当前状态不能使用罐头");
      }
      const tool = manorV7ToolByType("pasture", action.toolId, 7);
      if (tool.itemType !== 7 || tool.effectSeconds <= 0) throw new Error("该道具不是罐头");
      const available = inventoryQuantity(state.pasture.toolInventory, tool.id);
      if (available < 1) throw new Error("罐头库存不足");
      setInventoryQuantity(state.pasture.toolInventory, tool.id, available - 1);
      animalState.growthSeconds = Math.min(animal.maturitySeconds, animalState.growthSeconds + tool.effectSeconds);
      addManorV7Activity(state, "pasture", `给${animal.name}使用了${tool.name}`, now);
      break;
    }
    case "buy-grass": {
      requirePositiveInteger(action.quantity);
      const quantity = Math.min(action.quantity, Math.floor(MANOR_V7_GRASS_CAPACITY - state.pasture.grass));
      if (quantity < 1) throw new Error("饲料机已经加满");
      charge(state, quantity * MANOR_V7_GRASS_PRICE);
      state.pasture.grass += quantity;
      addManorV7Activity(state, "pasture", `添加了 ${quantity} 份牧草`, now);
      break;
    }
    case "buy-grass-to-inventory": {
      requirePositiveInteger(action.quantity);
      charge(state, action.quantity * MANOR_V7_GRASS_PRICE);
      const available = inventoryQuantity(state.farm.produceInventory, 40);
      setInventoryQuantity(state.farm.produceInventory, 40, available + action.quantity);
      addManorV7Activity(state, "pasture", `购买了 ${action.quantity} 份牧草并放入背包`, now);
      break;
    }
    case "feed-grass-from-inventory": {
      requirePositiveInteger(action.quantity);
      const available = inventoryQuantity(state.farm.produceInventory, 40);
      const quantity = Math.min(action.quantity, available, Math.floor(MANOR_V7_GRASS_CAPACITY - state.pasture.grass));
      if (available < 1) throw new Error("背包中没有牧草，请先在农场收获牧草或到商店购买");
      if (quantity < 1) throw new Error("饲料机已经加满");
      setInventoryQuantity(state.farm.produceInventory, 40, available - quantity);
      state.pasture.grass += quantity;
      addManorV7Activity(state, "pasture", `从背包添加了 ${quantity} 份牧草`, now);
      break;
    }
    case "buy-pasture-guard": {
      const definition = manorV7PastureGuard(action.guardId);
      if (state.pasture.guards.some((guard) => guard.id === definition.id)) {
        throw new Error("已经拥有该看守员");
      }
      charge(state, manorV7ToolCoinPrice(definition));
      for (const guard of state.pasture.guards) guard.active = false;
      state.pasture.guards.push({
        id: definition.id,
        remainingSeconds: MANOR_V7_GUARD_INITIAL_WAGE_SECONDS,
        active: true
      });
      state.pasture.guards.sort((left, right) => left.id - right.id);
      addManorV7Activity(state, "pasture", `雇用了看守员${definition.name}`, now);
      break;
    }
    case "set-pasture-guard-active": {
      const guard = state.pasture.guards.find((item) => item.id === action.guardId);
      if (!guard) throw new Error("尚未雇用该看守员");
      if (action.active && guard.remainingSeconds <= 0) throw new Error("看守员工资已经到期");
      for (const item of state.pasture.guards) item.active = action.active && item.id === guard.id;
      addManorV7Activity(state, "pasture", `${action.active ? "启用" : "隐藏"}了看守员`, now);
      break;
    }
    case "pay-pasture-guard": {
      requirePositiveInteger(action.days);
      const guard = state.pasture.guards.find((item) => item.id === action.guardId);
      if (!guard) throw new Error("尚未雇用该看守员");
      const salary = action.days >= 7
        ? manorV7ToolByType("pasture", 102, 5)
        : manorV7ToolByType("pasture", 101, 5);
      const salaryUnits = action.days >= 7 ? Math.ceil(action.days / 7) : action.days;
      charge(state, manorV7ToolCoinPrice(salary) * salaryUnits);
      guard.remainingSeconds += salary.effectSeconds * salaryUnits;
      addManorV7Activity(state, "pasture", `为看守员续了 ${action.days} 天工资`, now);
      break;
    }
    case "claim-daily-package": {
      const day = manorV7DayKey(now);
      if (state.rewardClaims.dailyPackageDay === day) throw new Error("今日礼包已经领取");
      state.rewardClaims.dailyPackageDay = day;
      state.coins += 300;
      for (const toolId of [1, 2, 3, 7]) {
        setInventoryQuantity(
          state.farm.toolInventory,
          toolId,
          inventoryQuantity(state.farm.toolInventory, toolId) + 1
        );
      }
      for (const toolId of [1, 2, 3]) {
        setInventoryQuantity(
          state.pasture.toolInventory,
          toolId,
          inventoryQuantity(state.pasture.toolInventory, toolId) + 1
        );
      }
      setInventoryQuantity(
        state.farm.produceInventory,
        40,
        inventoryQuantity(state.farm.produceInventory, 40) + 100
      );
      state.farm.dog.feedSeconds += MANOR_V7_DOG_FOOD_DAY_SECONDS;
      const activeGuard = state.pasture.guards.find((guard) => guard.active);
      if (activeGuard) activeGuard.remainingSeconds += MANOR_V7_DOG_FOOD_DAY_SECONDS;
      addManorV7Activity(state, "farm", "领取了 7 级年费 VIP 每日礼包和 300 金币", now);
      break;
    }
    case "record-sign-in-visit": {
      recordSignInVisit(state, now);
      break;
    }
    case "claim-sign-in": {
      const day = manorV7DayKey(now);
      recordSignInVisit(state, now);
      if (state.rewardClaims.signInRewardDay !== day) {
        state.rewardClaims.signInRewardDay = null;
        state.rewardClaims.signInRewardId = null;
        state.rewardClaims.signInRewardIds = [];
      }
      if (state.rewardClaims.signInRewardIds.length >= MANOR_V7_DAILY_SIGN_IN_LIMIT) {
        throw new Error("今日签到翻牌次数已经用完");
      }
      const available = MANOR_V7_DAILY_SIGN_IN_REWARDS.filter(
        (reward) => !state.rewardClaims.signInRewardIds.includes(reward.id)
      );
      const reward = available[Math.floor(drawManorV7Random(state) * available.length)] ?? available[0];
      if (!reward) throw new Error("签到奖励生成失败");
      awardSignInReward(state, reward);
      state.rewardClaims.signInRewardDay = day;
      state.rewardClaims.signInRewardId = reward.id;
      state.rewardClaims.signInRewardIds.push(reward.id);
      addManorV7Activity(state, "pasture", `完成每日签到：${reward.name}`, now);
      break;
    }
    case "claim-sign-in-streak-reward": {
      recordSignInVisit(state, now);
      const reward = manorV7StreakSignInReward(action.days);
      const milestone = reward.days;
      if (!milestone || state.rewardClaims.signInStreak < milestone) {
        throw new Error("连续登录天数不足");
      }
      const currentMilestone = state.rewardClaims.signInStreak >= 7
        ? 7
        : state.rewardClaims.signInStreak;
      if (milestone !== currentMilestone) throw new Error("当前没有该连续登录奖励");
      if (state.rewardClaims.signInStreakRewardDays.includes(milestone)) {
        throw new Error("连续登录奖励已经领取");
      }
      awardSignInReward(state, reward);
      state.rewardClaims.signInStreakRewardDays.push(milestone);
      state.rewardClaims.signInStreakRewardDays.sort((left, right) => left - right);
      addManorV7Activity(state, "pasture", `领取连续登录 ${milestone} 天奖励：${reward.name}`, now);
      break;
    }
    case "accept-tutorial-task": {
      if (state.tutorialTask.taskId >= MANOR_V7_TUTORIAL_TASKS.length) {
        throw new Error("新手任务已经全部完成");
      }
      state.tutorialTask.accepted = true;
      break;
    }
    case "complete-tutorial-task": {
      if (!state.tutorialTask.accepted) throw new Error("请先接受当前新手任务");
      const task = manorV7TutorialTask(state.tutorialTask.taskId);
      state.coins += task.rewardCoins;
      state.pastureExperience += task.rewardExperience;
      state.tutorialTask.taskId += 1;
      state.tutorialTask.accepted = state.tutorialTask.taskId < MANOR_V7_TUTORIAL_TASKS.length;
      addManorV7Activity(
        state,
        "pasture",
        `完成新手任务，获得 ${task.rewardExperience} 经验和 ${task.rewardCoins} 金币`,
        now
      );
      break;
    }
    case "claim-level-rewards": {
      const actualLevel = manorV7LevelForExperience(
        action.area === "farm" ? state.farmExperience : state.pastureExperience
      );
      const throughLevel = Math.min(action.throughLevel, MANOR_V7_MAX_LEVEL_REWARD);
      if (throughLevel < 1 || throughLevel > actualLevel) throw new Error("尚未达到该奖励等级");
      const claimedThrough = state.levelRewardClaims[action.area];
      if (throughLevel <= claimedThrough) throw new Error("升级奖励已经领取");
      for (let level = claimedThrough + 1; level <= throughLevel; level += 1) {
        const reward = manorV7LevelReward(level);
        if (isManorV7RewardAvailable(reward)) awardManorV7Reward(state, reward);
      }
      state.levelRewardClaims[action.area] = throughLevel;
      addManorV7Activity(state, action.area, `领取了 ${claimedThrough + 1}-${throughLevel} 级升级奖励`, now);
      break;
    }
    case "show-research-guide": {
      if (state.researchGuideSeen) throw new Error("科研引导已经展示");
      state.researchGuideSeen = true;
      break;
    }
    case "clear-activities": {
      state.activities = [];
      break;
    }
    case "claim-vip-return-gift": {
      if (state.rewardClaims.vipReturnGiftClaimed) throw new Error("VIP 回归礼包已经领取");
      for (const reward of [...MANOR_V7_VIP_RETURN_GIFT.item, ...MANOR_V7_VIP_RETURN_GIFT.vipItem]) {
        if (isManorV7RewardAvailable(reward)) awardManorV7Reward(state, reward);
      }
      state.rewardClaims.vipReturnGiftClaimed = true;
      addManorV7Activity(state, "farm", "领取了 VIP 回归礼包", now);
      break;
    }
    case "generate-seasonal-animal-drop": {
      if (state.seasonal.animalDrops.length >= MANOR_V7_SEASONAL_ANIMAL_DROP_LIMIT) break;
      const animalId = MANOR_V7_SEASONAL_ANIMAL_IDS[
        Math.floor(drawManorV7Random(state) * MANOR_V7_SEASONAL_ANIMAL_IDS.length)
      ] ?? MANOR_V7_SEASONAL_ANIMAL_IDS[0];
      state.seasonal.animalDrops.push({
        serial: state.seasonal.nextAnimalDropSerial,
        animalId,
        createdAt: now
      });
      state.seasonal.nextAnimalDropSerial += 1;
      addManorV7Activity(state, "pasture", `发现了一只等待好友领养的${manorV7Animal(animalId).name}`, now);
      break;
    }
    case "claim-halloween-candy-seeds": {
      if (state.seasonal.candySeedsClaimed) throw new Error("糖果种子已经领取");
      state.seasonal.candySeedsClaimed = true;
      setInventoryQuantity(
        state.farm.seedInventory,
        167,
        inventoryQuantity(state.farm.seedInventory, 167) + 3
      );
      addManorV7Activity(state, "farm", "领取了 3 个糖果种子", now);
      break;
    }
    case "claim-cookie-sprites": {
      if (state.seasonal.cookieSpritesClaimed) throw new Error("饼干精灵已经领取");
      state.seasonal.cookieSpritesClaimed = true;
      setInventoryQuantity(
        state.pasture.cubInventory,
        1037,
        inventoryQuantity(state.pasture.cubInventory, 1037) + 3
      );
      addManorV7Activity(state, "pasture", "领取了 3 只饼干精灵", now);
      break;
    }
    case "exchange-halloween-candy-pumpkin": {
      if (state.seasonal.halloweenCandies < 5) throw new Error("兑换万圣南瓜种子需要 5 个好友投放的糖果");
      state.seasonal.halloweenCandies -= 5;
      setInventoryQuantity(
        state.farm.seedInventory,
        164,
        inventoryQuantity(state.farm.seedInventory, 164) + 1
      );
      addManorV7Activity(state, "farm", "用 5 个糖果兑换了 1 个万圣南瓜种子", now);
      break;
    }
    case "exchange-halloween-cookie-baby": {
      if (state.seasonal.halloweenCookies < 5) throw new Error("兑换万圣宝宝需要 5 个好友投放的饼干");
      state.seasonal.halloweenCookies -= 5;
      setInventoryQuantity(
        state.pasture.cubInventory,
        1537,
        inventoryQuantity(state.pasture.cubInventory, 1537) + 1
      );
      addManorV7Activity(state, "pasture", "用 5 个饼干兑换了 1 只万圣宝宝", now);
      break;
    }
    case "exchange-halloween-carnival-gift": {
      if (state.seasonal.halloweenCarnivalGiftClaimed) throw new Error("万圣狂欢礼包已经兑换");
      if (state.seasonal.halloweenCandies < 55 || state.seasonal.halloweenCookies < 55) {
        throw new Error("兑换万圣狂欢礼包需要 55 个糖果和 55 个饼干");
      }
      state.seasonal.halloweenCandies -= 55;
      state.seasonal.halloweenCookies -= 55;
      state.seasonal.halloweenCarnivalGiftClaimed = true;
      state.coins += 20_000;
      setInventoryQuantity(
        state.pasture.cubInventory,
        1038,
        inventoryQuantity(state.pasture.cubInventory, 1038) + 1
      );
      setInventoryQuantity(
        state.farm.seedInventory,
        166,
        inventoryQuantity(state.farm.seedInventory, 166) + 1
      );
      for (const decorationId of MANOR_V7_HALLOWEEN_FARM_DECORATION_IDS) {
        grantTimedDecoration(state, "farm", decorationId, now);
      }
      grantTimedDecoration(state, "pasture", MANOR_V7_HALLOWEEN_PASTURE_DECORATION_ID, now);
      addManorV7Activity(state, "farm", "兑换了万圣狂欢礼包", now);
      break;
    }
    case "claim-spring-festival-gift": {
      const day = manorV7DayKey(now);
      if (state.seasonal.springFestivalClaimDay === day) throw new Error("今日春节礼包已经领取");
      state.seasonal.springFestivalClaimDay = day;
      setInventoryQuantity(
        state.farm.seedInventory,
        367,
        inventoryQuantity(state.farm.seedInventory, 367) + 4
      );
      setInventoryQuantity(
        state.pasture.cubInventory,
        1546,
        inventoryQuantity(state.pasture.cubInventory, 1546) + 4
      );
      addManorV7Activity(state, "pasture", "领取了春节 VIP 礼包：4 个金条树种子和 4 只金兔子", now);
      break;
    }
    case "claim-reunion-fish-gift": {
      if (state.seasonal.reunionFishGiftClaimed) throw new Error("团圆鱼礼包已经领取");
      const materials = inventoryQuantity(state.farm.produceInventory, 450);
      if (materials < 1_999) throw new Error("领取团圆鱼礼包需要 1999 个火舞草产物");
      state.seasonal.reunionFishGiftClaimed = true;
      setInventoryQuantity(state.farm.produceInventory, 450, materials - 1_999);
      state.coins += 99_999;
      setInventoryQuantity(
        state.farm.seedInventory,
        448,
        inventoryQuantity(state.farm.seedInventory, 448) + 5
      );
      setInventoryQuantity(
        state.farm.fishPool.seedInventory,
        15,
        inventoryQuantity(state.farm.fishPool.seedInventory, 15) + 2
      );
      if (!state.farm.fishPool.unlockedFishIds.includes(15)) {
        state.farm.fishPool.unlockedFishIds.push(15);
        state.farm.fishPool.unlockedFishIds.sort((left, right) => left - right);
      }
      for (const decorationId of MANOR_V7_REUNION_DECORATION_IDS) {
        const ownership = decorationOwnership(state, "farm", decorationId);
        const extension = MANOR_V7_REUNION_DECORATION_SECONDS * 1_000;
        if (ownership) {
          if (ownership.validUntil !== 0) ownership.validUntil = Math.max(now, ownership.validUntil) + extension;
        } else {
          state.decorationOwnerships.push({ area: "farm", decorationId, validUntil: now + extension });
        }
        addOwnedDecorationId(state, decorationId);
      }
      addManorV7Activity(state, "farm", "兑换了团圆鱼典礼礼包", now);
      break;
    }
    case "redeem-code": {
      const code = normalizeManorV7RedeemCode(action.code);
      const definition = manorV7RedeemCode(code);
      if (state.redeemedCodes.includes(code)) throw new Error("该兑换码已经使用");
      for (const reward of [...definition.item, ...definition.vipItem]) awardManorV7Reward(state, reward);
      state.redeemedCodes.push(code);
      state.redeemedCodes.sort();
      addManorV7Activity(state, "farm", `使用兑换码 ${code} 领取了奖励`, now);
      break;
    }
    case "start-production": {
      const animal = startManorV7Production(state, action.serial);
      addManorV7Activity(state, "pasture", `把${animal.name}送去生产`, now);
      break;
    }
    case "collect-product": {
      collectProduct(state, action.serial, now);
      break;
    }
    case "collect-products": {
      const targets = state.pasture.animals.filter((animal) =>
        animal.pendingProduct > 0 && (action.animalId === undefined || animal.animalId === action.animalId)
      );
      if (!targets.length) throw new Error("没有可收取的副产品");
      for (const target of targets) collectProduct(state, target.serial, now);
      break;
    }
    case "harvest-animals": {
      const targets = action.serial === undefined
        ? state.pasture.animals.filter((animal) => {
          const definition = manorV7Animal(animal.animalId);
          return !animal.productionActive && animal.productionCount >= manorV7MaxProductionCount(definition);
        })
        : state.pasture.animals.filter((animal) => animal.serial === action.serial);
      if (!targets.length) throw new Error("没有可收获的成年动物");
      if (action.serial === undefined && state.pasture.animals.some((animal) => animal.pendingProduct > 0)) {
        throw new Error("请先收获副产品");
      }
      for (const target of targets) {
        const animal = manorV7Animal(target.animalId);
        if (target.productionActive || target.productionCount < manorV7MaxProductionCount(animal)) {
          throw new Error("生产次数尚未完成，还不能收获动物");
        }
        if (target.pendingProduct > 0) throw new Error(`请先收获副产品“${animal.byproductName}”`);
      }
      for (const target of targets) {
        const animal = manorV7Animal(target.animalId);
        const index = state.pasture.animals.findIndex((item) => item.serial === target.serial);
        state.pasture.animals.splice(index, 1);
        setInventoryQuantity(
          state.pasture.harvestedAnimalInventory,
          animal.id,
          inventoryQuantity(state.pasture.harvestedAnimalInventory, animal.id) + 1
        );
        state.pastureExperience += animal.animalHarvestExperience;
        addManorV7Activity(state, "pasture", `收获了成年${animal.name}`, now);
      }
      break;
    }
    case "sell-animal": {
      const index = state.pasture.animals.findIndex((item) => item.serial === action.serial);
      const animalState = state.pasture.animals[index];
      if (!animalState) throw new Error("动物不存在");
      const animal = manorV7Animal(animalState.animalId);
      const price = animalState.growthSeconds >= animal.maturitySeconds ? animal.productPrice : Math.floor(animal.purchasePrice * 0.6);
      state.pasture.animals.splice(index, 1);
      state.coins += price;
      state.pastureExperience += animal.animalHarvestExperience;
      addManorV7Activity(state, "pasture", `出售了${animal.name}`, now);
      break;
    }
    case "donate-animal": {
      const index = state.pasture.animals.findIndex((item) => item.serial === action.serial);
      const animalState = state.pasture.animals[index];
      if (!animalState) throw new Error("动物不存在");
      const animal = manorV7Animal(animalState.animalId);
      const reward = Math.floor(animal.purchasePrice / 2);
      state.pasture.animals.splice(index, 1);
      state.coins += reward;
      addManorV7Activity(state, "pasture", `爱心捐赠了${animal.name}，获得 ${reward} 金币`, now);
      break;
    }
    case "sell-cub": {
      requirePositiveInteger(action.quantity);
      const animal = manorV7Animal(action.animalId);
      const available = inventoryQuantity(state.pasture.cubInventory, animal.id);
      if (available < action.quantity) throw new Error("动物幼崽库存不足");
      const revenue = Math.floor(animal.purchasePrice / 2) * action.quantity;
      setInventoryQuantity(state.pasture.cubInventory, animal.id, available - action.quantity);
      state.coins += revenue;
      addManorV7Activity(state, "pasture", `出售了 ${action.quantity} 只${animal.name}幼崽`, now);
      break;
    }
    case "sell-all-cubs": {
      if (!state.pasture.cubInventory.length) throw new Error("没有可出售的动物幼崽");
      const revenue = state.pasture.cubInventory.reduce((sum, entry) => (
        sum + Math.floor(manorV7Animal(entry.sourceId).purchasePrice / 2) * entry.quantity
      ), 0);
      const quantity = state.pasture.cubInventory.reduce((sum, entry) => sum + entry.quantity, 0);
      state.pasture.cubInventory = [];
      state.coins += revenue;
      addManorV7Activity(state, "pasture", `出售了全部 ${quantity} 只动物幼崽`, now);
      break;
    }
    case "sell-animal-product": {
      requirePositiveInteger(action.quantity);
      const animal = manorV7Animal(action.animalId);
      const quantity = inventoryQuantity(state.pasture.productInventory, animal.id);
      if (quantity < action.quantity) throw new Error("副产品库存不足");
      setInventoryQuantity(state.pasture.productInventory, animal.id, quantity - action.quantity);
      const quote = manorV7PastureProductSaleQuote(animal.id, animal.byproductPrice, action.quantity);
      state.coins += quote.revenue;
      addManorV7Activity(
        state,
        "pasture",
        `出售了 ${action.quantity} 份${animal.byproductName}${quote.multiplier > 1 ? "，获得情人节 9 倍收益" : ""}`,
        now
      );
      break;
    }
    case "sell-harvested-animal": {
      requirePositiveInteger(action.quantity);
      const animal = manorV7Animal(action.animalId);
      const quantity = inventoryQuantity(state.pasture.harvestedAnimalInventory, animal.id);
      if (quantity < action.quantity) throw new Error("成年动物库存不足");
      setInventoryQuantity(state.pasture.harvestedAnimalInventory, animal.id, quantity - action.quantity);
      state.coins += animal.productPrice * action.quantity;
      addManorV7Activity(state, "pasture", `出售了 ${action.quantity} 只成年${animal.name}`, now);
      break;
    }
    case "sell-all-pasture-products": {
      if (!state.pasture.productInventory.length && !state.pasture.harvestedAnimalInventory.length) {
        throw new Error("仓库没有可出售的产品或动物");
      }
      const productQuotes = state.pasture.productInventory.map((entry) => {
        const animal = manorV7Animal(entry.sourceId);
        return manorV7PastureProductSaleQuote(animal.id, animal.byproductPrice, entry.quantity);
      });
      const productRevenue = productQuotes.reduce((total, quote) => total + quote.revenue, 0);
      const animalRevenue = state.pasture.harvestedAnimalInventory.reduce((total, entry) => (
        total + manorV7Animal(entry.sourceId).productPrice * entry.quantity
      ), 0);
      const quantity = [...state.pasture.productInventory, ...state.pasture.harvestedAnimalInventory]
        .reduce((total, entry) => total + entry.quantity, 0);
      const revenue = productRevenue + animalRevenue;
      state.pasture.productInventory = [];
      state.pasture.harvestedAnimalInventory = [];
      state.coins += revenue;
      const lovesdayBonus = productQuotes.some((quote) => quote.multiplier > 1) ? "，含情人节 9 倍收益" : "";
      addManorV7Activity(state, "pasture", `卖出全部 ${quantity} 份产品和动物，获得 ${revenue} 金币${lovesdayBonus}`, now);
      break;
    }
    case "collect-manure": {
      if (state.pasture.manure < 1) throw new Error("没有可清理的便便");
      const quantity = 1;
      const rewarded = Math.min(quantity, state.farm.manureCollection.remaining);
      state.pasture.manure -= quantity;
      state.farm.manureCollection.remaining -= rewarded;
      if (rewarded > 0) setInventoryQuantity(
        state.pasture.materialInventory,
        1506,
        inventoryQuantity(state.pasture.materialInventory, 1506) + rewarded
      );
      state.pastureExperience += rewarded;
      addManorV7Activity(
        state,
        "pasture",
        rewarded > 0
          ? `清理了 ${quantity} 份便便，仓库增加 ${rewarded} 份便便`
          : `清理了 ${quantity} 份便便，今日收集数量已达上限`,
        now
      );
      break;
    }
    case "upgrade-house": {
      upgradeHouse(state, action.house, now);
      break;
    }
    case "start-research": {
      const rule = MANOR_V7_RESEARCH_RULES[action.house].find((item) => item.animalId === action.animalId);
      if (!rule) throw new Error("科研动物与建筑不匹配");
      const slot = state.pasture.research[action.house];
      if (slot.animalId !== null) throw new Error("该建筑已有进行中的科研");
      charge(state, rule.coins);
      slot.animalId = rule.animalId;
      slot.remainingSeconds = rule.seconds;
      addManorV7Activity(state, "pasture", `开始研究${manorV7Animal(rule.animalId).name}`, now);
      break;
    }
    case "collect-research": {
      const slot = state.pasture.research[action.house];
      if (slot.animalId === null) throw new Error("没有可领取的科研成果");
      if (slot.remainingSeconds > 0) throw new Error("科研尚未完成");
      const animalId = slot.animalId;
      const quantity = drawManorV7Random(state) < 0.6 ? 2 : 1;
      setInventoryQuantity(
        state.pasture.cubInventory,
        animalId,
        inventoryQuantity(state.pasture.cubInventory, animalId) + quantity
      );
      slot.animalId = null;
      slot.remainingSeconds = 0;
      addManorV7Activity(state, "pasture", `领取了 ${quantity} 只${manorV7Animal(animalId).name}幼崽`, now);
      break;
    }
    case "use-research-hourglass": {
      const slot = state.pasture.research[action.house];
      if (slot.animalId === null || slot.remainingSeconds <= 0) throw new Error("当前没有可加速的科研");
      const tool = manorV7ToolByType("pasture", action.toolId, 12);
      const available = inventoryQuantity(state.pasture.toolInventory, tool.id);
      if (available < 1) throw new Error("沙漏已经用完");
      setInventoryQuantity(state.pasture.toolInventory, tool.id, available - 1);
      slot.remainingSeconds = Math.max(0, slot.remainingSeconds - tool.effectSeconds);
      addManorV7Activity(state, "pasture", `使用${tool.name}加速科研`, now);
      break;
    }
    case "special-feed": {
      if (state.pasture.specialFeed.remaining < 1) throw new Error("今天的特殊喂养次数已经用完");
      const animalState = state.pasture.animals.find((item) => item.serial === action.serial);
      if (!animalState) throw new Error("动物不存在");
      const cropId = manorV7SpecialFeedCropId(animalState.animalId);
      const available = inventoryQuantity(state.farm.produceInventory, cropId);
      if (available < 1) throw new Error("特殊作物库存不足");
      setInventoryQuantity(state.farm.produceInventory, cropId, available - 1);
      animalState.growthSeconds = Math.min(manorV7Animal(animalState.animalId).lifecycleSeconds, animalState.growthSeconds + 300);
      state.pasture.specialFeed.remaining -= 1;
      addManorV7Activity(state, "pasture", `给${manorV7Animal(animalState.animalId).name}喂了特殊作物`, now);
      break;
    }
    case "clear-mosquito": {
      if (!state.pasture.mosquitoes.sourceUserIds.length) throw new Error("牧场没有蚊子");
      state.pasture.mosquitoes.sourceUserIds.shift();
      state.pastureExperience += 3;
      addManorV7Activity(state, "pasture", "拍掉了牧场里的蚊子", now);
      break;
    }
    case "catch-own-mouse": {
      if (!state.pasture.mousePresent) throw new Error("牧场没有老鼠");
      state.pasture.mousePresent = false;
      const reward = 50 + Math.floor(drawManorV7Random(state) * 51);
      state.coins += reward;
      addManorV7Activity(state, "pasture", `抓到老鼠，获得 ${reward} 金币`, now);
      break;
    }
    case "set-parade": {
      if (action.info.length > 512 || action.patternId < 0) throw new Error("欢迎队形参数无效");
      state.pasture.parade.info = action.info;
      state.pasture.parade.patternId = action.patternId;
      state.pasture.parade.version += 1;
      addManorV7Activity(state, "pasture", "更新了牧场欢迎队形", now);
      break;
    }
    case "buy-decoration": {
      const decoration = manorV7Decoration(action.area, action.decorationId);
      if (!decoration.isRenderable) throw new Error("该装扮素材不完整，暂不可使用");
      if (decoration.isHidden) throw new Error("该装扮只能通过活动或奖励获得");
      if (manorV7LevelForExperience(action.area === "farm" ? state.farmExperience : state.pastureExperience) < decoration.originalLevel) throw new Error("等级不足");
      const existing = decorationOwnership(state, action.area, decoration.id);
      if (existing && (existing.validUntil === 0 || existing.validUntil > now)) throw new Error("已经拥有该装扮");
      charge(state, manorV7DecorationCoinPrice(decoration));
      const validUntil = now + decoration.validSeconds * 1_000;
      if (existing) existing.validUntil = validUntil;
      else state.decorationOwnerships.push({ area: action.area, decorationId: decoration.id, validUntil });
      addOwnedDecorationId(state, decoration.id);
      if (action.area === "farm") state.farmExperience += decoration.experience;
      else state.pastureExperience += decoration.experience;
      addManorV7Activity(state, action.area, `购买了装扮“${decoration.name}”`, now);
      break;
    }
    case "renew-decoration": {
      const decoration = manorV7Decoration(action.area, action.decorationId);
      if (!decoration.isRenderable) throw new Error("该装扮素材不完整，暂不可使用");
      const ownership = decorationOwnership(state, action.area, decoration.id);
      if (!ownership) throw new Error("尚未拥有该装扮");
      if (ownership.validUntil === 0) throw new Error("永久装扮无需续期");
      charge(state, manorV7DecorationCoinPrice(decoration));
      ownership.validUntil = Math.max(now, ownership.validUntil) + decoration.validSeconds * 1_000;
      addOwnedDecorationId(state, decoration.id);
      addManorV7Activity(state, action.area, `续期了装扮“${decoration.name}”`, now);
      break;
    }
    case "equip-decoration": {
      const decoration = manorV7Decoration(action.area, action.decorationId);
      if (!decoration.isRenderable) throw new Error("该装扮素材不完整，暂不可使用");
      const ownership = decorationOwnership(state, action.area, decoration.id);
      if (!ownership || ownership.validUntil !== 0 && ownership.validUntil <= now) throw new Error("尚未拥有或装扮已过期");
      const selected = action.area === "farm" ? state.farm.selectedDecorationIds : state.pasture.selectedDecorationIds;
      const sameType = selected.findIndex((id) => {
        if (action.area === "pasture" && id === 105) return decoration.itemType === 101;
        try { return manorV7Decoration(action.area, id).itemType === decoration.itemType; } catch { return false; }
      });
      if (sameType >= 0) selected[sameType] = decoration.id;
      else selected.push(decoration.id);
      addManorV7Activity(state, action.area, `换上了装扮“${decoration.name}”`, now);
      break;
    }
    case "set-board": {
      if (action.boardId !== null) manorV7Board(action.boardId);
      state.farm.selectedBoardId = action.boardId;
      addManorV7Activity(
        state,
        "farm",
        action.boardId === null ? "收起了告示牌" : `换上了 ${action.boardId} 号告示牌`,
        now
      );
      break;
    }
    case "set-avatar": {
      if (action.avatarId !== null) manorV7Avatar(action.avatarId);
      state.farm.selectedAvatarId = action.avatarId;
      addManorV7Activity(
        state,
        "farm",
        action.avatarId === null ? "取消了农场形象" : `换上了 ${action.avatarId} 号农场形象`,
        now
      );
      break;
    }
    case "open-wild-slot": {
      if (action.slotId !== state.pasture.wild.maxSlotId + 1 || action.slotId >= MANOR_V7_WILD_MAX_SLOTS) {
        throw new Error("请从左至右逐个开启野生动物槽位");
      }
      charge(state, MANOR_V7_WILD_SLOT_PRICES[action.slotId] ?? 0);
      state.pasture.wild.maxSlotId = action.slotId;
      addManorV7Activity(state, "pasture", `开启了第 ${action.slotId + 1} 个野生动物槽位`, now);
      break;
    }
    case "adopt-wild-animal": {
      const definition = manorV7WildAnimal(action.animalType);
      const wild = state.pasture.wild;
      if (action.slotId < 0 || action.slotId > wild.maxSlotId || action.slotId >= MANOR_V7_WILD_MAX_SLOTS) {
        throw new Error("野生动物槽位尚未开启");
      }
      if (wild.slots.some((slot) => slot.slotId === action.slotId)) throw new Error("该槽位已有野生动物");
      if (wild.moralExperience < definition.moralRequirement) throw new Error("人品值不足，暂不能领养该动物");
      charge(state, definition.adoptionPrice);
      wild.slots.push({
        slotId: action.slotId,
        animalType: definition.id,
        status: 1,
        currentBlood: definition.blood,
        remainingReleases: definition.maxReleases,
        income: definition.adoptionPrice,
        targetUserId: null,
        targetDisplayName: null,
        targetArea: null,
        releasedAt: null,
        returnAt: null,
        restUntil: null
      });
      wild.slots.sort((left, right) => left.slotId - right.slotId);
      addManorV7Activity(state, "pasture", `领养了野生动物${definition.name}`, now);
      break;
    }
    case "claim-wild-return": {
      const slot = wildSlot(state, action.slotId);
      if (slot.status !== 3) throw new Error("野生动物尚未返回");
      const definition = manorV7WildAnimal(slot.animalType);
      const rewardCoins = Math.max(100, Math.floor(definition.adoptionPrice * 0.05));
      const crystalId = definition.crystalIds[
        Math.floor(drawManorV7Random(state) * definition.crystalIds.length)
      ] ?? definition.crystalIds[0];
      state.coins += rewardCoins;
      slot.income += rewardCoins;
      if (crystalId !== undefined) {
        manorV7WildCrystal(crystalId);
        setInventoryQuantity(
          state.pasture.wild.crystalInventory,
          crystalId,
          inventoryQuantity(state.pasture.wild.crystalInventory, crystalId) + 1
        );
      }
      slot.status = slot.remainingReleases > 0 ? 4 : 5;
      slot.restUntil = slot.status === 4 ? now + MANOR_V7_WILD_REST_SECONDS * 1_000 : null;
      addManorV7Activity(state, "pasture", `${definition.name}放养归来，带回 ${rewardCoins} 金币`, now);
      break;
    }
    case "donate-wild-animal": {
      const slot = wildSlot(state, action.slotId);
      if (slot.status !== 5 || slot.remainingReleases !== 0) throw new Error("该野生动物还不能捐赠");
      const definition = manorV7WildAnimal(slot.animalType);
      state.coins += definition.donationCoins;
      state.pasture.wild.slots = state.pasture.wild.slots.filter((item) => item.slotId !== action.slotId);
      addManorV7Activity(state, "pasture", `捐赠了${definition.name}，获得 ${definition.donationCoins} 金币`, now);
      break;
    }
    case "attack-wild-animal": {
      attackIncomingWildAnimal(
        state,
        action.serial,
        action.attackType,
        action.weaponId,
        action.attackerDisplayName ?? "本场主人",
        now,
        action.attackerUserId ?? "self"
      );
      break;
    }
    case "sell-wild-crystal": {
      requirePositiveInteger(action.quantity);
      const crystal = manorV7WildCrystal(action.crystalId);
      const inventory = state.pasture.wild.crystalInventory;
      const current = inventoryQuantity(inventory, crystal.id);
      if (current < action.quantity) throw new Error("水晶库存不足");
      setInventoryQuantity(inventory, crystal.id, current - action.quantity);
      const income = crystal.salePrice * action.quantity;
      state.coins += income;
      addManorV7Activity(state, "pasture", `出售了 ${action.quantity} 颗${crystal.name}，获得 ${income} 金币`, now);
      break;
    }
    case "pickup-wild-crystal": {
      const index = state.pasture.wild.crystalDrops.findIndex((drop) => drop.serial === action.serial);
      const drop = state.pasture.wild.crystalDrops[index];
      if (!drop) throw new Error("水晶已经被捡走了");
      manorV7WildCrystal(drop.crystalId);
      state.pasture.wild.crystalDrops.splice(index, 1);
      setInventoryQuantity(
        state.pasture.wild.crystalInventory,
        drop.crystalId,
        inventoryQuantity(state.pasture.wild.crystalInventory, drop.crystalId) + drop.quantity
      );
      addManorV7Activity(state, "pasture", `捡到了 ${drop.quantity} 颗${manorV7WildCrystal(drop.crystalId).name}`, now);
      break;
    }
  }
}

export function startManorV7Production(
  state: ManorV7State,
  serial: number
): ReturnType<typeof manorV7Animal> {
  const animalState = state.pasture.animals.find((item) => item.serial === serial);
  if (!animalState) throw new Error("动物不存在");
  const animal = manorV7Animal(animalState.animalId);
  if (animalState.growthSeconds < animal.maturitySeconds) throw new Error("动物尚未成熟，不能生产");
  if (animalState.productionActive) throw new Error("动物正在生产或冷却中");
  if (animalState.productionCount >= manorV7MaxProductionCount(animal)) throw new Error("生产次数已经完成，请收获动物");
  if (animalState.pendingProduct > 0) throw new Error(`请先收取副产品“${animal.byproductName}”`);
  if (state.pasture.grass <= 0) throw new Error("饲料机没有牧草，动物不能生产");
  animalState.productionActive = true;
  animalState.productionProgressSeconds = 0;
  return animal;
}

export function attackIncomingWildAnimal(
  state: ManorV7State,
  serial: number,
  attackType: string,
  weaponId: number,
  attackerDisplayName: string,
  now: number,
  attackerUserId = "self",
  rewardState: ManorV7State = state,
  dropState: ManorV7State = rewardState
): { successful: boolean; damage: number; moral: number; result: 1 | 2 | 3; crystalId?: number } {
  const animal = state.pasture.wild.incomingAnimals.find((item) => item.serial === serial);
  if (!animal) throw new Error("野生动物不存在或已经离开");
  if (animal.status === 6 || animal.blood <= 0) throw new Error("野生动物已经昏迷");
  if (animal.ownerUserId === attackerUserId) throw new Error("自己的动物不能驱赶");
  const repeated = animal.attacks.some((attack) =>
    attack.attackerUserId === attackerUserId && attack.attackType === attackType && attack.weaponId === weaponId
  );
  if (repeated) throw new Error("对同一只野生动物不能重复使用相同驱赶方式");
  if (attackType === "Gun") {
    manorV7ToolByType("pasture", weaponId, 10);
    const available = inventoryQuantity(rewardState.pasture.weaponInventory, weaponId);
    if (available < 1) throw new Error("武器库存不足");
    setInventoryQuantity(rewardState.pasture.weaponInventory, weaponId, available - 1);
  }
  const definition = manorV7WildAnimal(animal.animalType);
  const damage = wildAttackDamage(attackType, weaponId);
  const successful = attackType === "Gun" || drawManorV7Random(state) < 0.71;
  let result: 1 | 2 | 3 = 3;
  let moral = 0;
  let crystalId: number | undefined;
  if (successful) {
    animal.blood = Math.max(0, animal.blood - damage);
    result = animal.blood === 0 ? 2 : 1;
    animal.status = animal.blood === 0 ? 6 : 2;
    moral = animal.blood === 0 ? definition.finalAttackMoral : definition.attackMoral;
    rewardState.pasture.wild.moralExperience += moral;
    crystalId = definition.crystalIds[
      Math.floor(drawManorV7Random(state) * definition.crystalIds.length)
    ] ?? definition.crystalIds[0];
    if (crystalId !== undefined) {
      dropState.pasture.wild.crystalDrops.push({
        serial: dropState.pasture.wild.nextCrystalSerial,
        crystalId,
        quantity: 1,
        createdAt: now
      });
      dropState.pasture.wild.nextCrystalSerial += 1;
    }
  }
  animal.attacks.push({ attackerUserId, attackerDisplayName, attackType, weaponId, successful, damage: successful ? damage : 0 });
  addManorV7Activity(
    state,
    "pasture",
    successful ? `${attackerDisplayName}驱赶${definition.name}，造成 ${damage} 点伤害` : `${attackerDisplayName}驱赶${definition.name}失败`,
    now
  );
  return { successful, damage: successful ? damage : 0, moral, result, ...(crystalId === undefined ? {} : { crystalId }) };
}

function wildSlot(state: ManorV7State, slotId: number) {
  const slot = state.pasture.wild.slots.find((item) => item.slotId === slotId);
  if (!slot) throw new Error("野生动物槽位为空");
  return slot;
}

export function wildAttackDamage(attackType: string, weaponId: number): number {
  if (attackType === "Gun") {
    const weaponDamage: Record<number, number> = { 1: 12, 2: 19, 3: 26, 4: 6, 5: 8, 6: 10, 7: 35 };
    return weaponDamage[weaponId] ?? 5;
  }
  if (attackType === "Dog") return 8;
  if (attackType === "Hunter") return 10;
  return 5;
}

function recordSignInVisit(state: ManorV7State, now: number): void {
  const day = manorV7DayKey(now);
  if (state.rewardClaims.signInDay === day) return;
  const yesterday = manorV7DayKey(now - 24 * 60 * 60 * 1_000);
  const continued = state.rewardClaims.signInDay === yesterday;
  state.rewardClaims.signInStreak = continued
    ? Math.max(1, state.rewardClaims.signInStreak) + 1
    : 1;
  if (!continued) state.rewardClaims.signInStreakRewardDays = [];
  state.rewardClaims.signInDay = day;
}

function awardSignInReward(state: ManorV7State, reward: ManorV7SignInRewardDefinition): void {
  if (reward.kind === "coins") {
    state.coins += reward.quantity;
    return;
  }
  const inventory = reward.kind === "grass"
    ? state.farm.produceInventory
    : reward.kind === "animal"
      ? state.pasture.cubInventory
      : reward.kind === "crystal"
        ? state.pasture.wild.crystalInventory
        : state.pasture.toolInventory;
  if (reward.kind === "animal") manorV7Animal(reward.sourceId);
  if (reward.kind === "crystal") manorV7WildCrystal(reward.sourceId);
  if (reward.kind === "pasture-tool") {
    const tool = manorV7Tool("pasture", reward.sourceId);
    if (tool.itemType !== 7) throw new Error("签到牧场道具配置无效");
  }
  setInventoryQuantity(
    inventory,
    reward.sourceId,
    inventoryQuantity(inventory, reward.sourceId) + reward.quantity
  );
}

function awardManorV7Reward(state: ManorV7State, reward: ManorV7RewardItem): void {
  switch (reward.kind) {
    case "coins":
      state.coins += reward.quantity;
      return;
    case "experience":
      if (reward.area === "farm") state.farmExperience += reward.quantity;
      else state.pastureExperience += reward.quantity;
      return;
    case "seed":
      setInventoryQuantity(
        state.farm.seedInventory,
        reward.sourceId,
        inventoryQuantity(state.farm.seedInventory, reward.sourceId) + reward.quantity
      );
      return;
    case "tool": {
      const inventory = reward.area === "farm" ? state.farm.toolInventory : state.pasture.toolInventory;
      setInventoryQuantity(
        inventory,
        reward.sourceId,
        inventoryQuantity(inventory, reward.sourceId) + reward.quantity
      );
      return;
    }
    case "decoration": {
      const decoration = manorV7Decoration(reward.area, reward.sourceId);
      if (!decoration.isRenderable) throw new Error("奖励装扮素材不完整");
      const ownership = decorationOwnership(state, reward.area, reward.sourceId);
      if (ownership) ownership.validUntil = 0;
      else state.decorationOwnerships.push({ area: reward.area, decorationId: reward.sourceId, validUntil: 0 });
      addOwnedDecorationId(state, reward.sourceId);
      return;
    }
  }
}

function grantTimedDecoration(
  state: ManorV7State,
  area: "farm" | "pasture",
  decorationId: number,
  now: number
): void {
  const definition = manorV7Decoration(area, decorationId);
  if (!definition.isRenderable) throw new Error("奖励装扮素材不完整");
  const extension = definition.validSeconds * 1_000;
  const ownership = decorationOwnership(state, area, decorationId);
  if (ownership) {
    if (ownership.validUntil !== 0) ownership.validUntil = Math.max(now, ownership.validUntil) + extension;
  } else {
    state.decorationOwnerships.push({ area, decorationId, validUntil: now + extension });
  }
  addOwnedDecorationId(state, decorationId);
}

function decorationOwnership(state: ManorV7State, area: "farm" | "pasture", decorationId: number) {
  return state.decorationOwnerships.find((ownership) => (
    ownership.area === area && ownership.decorationId === decorationId
  ));
}

function addOwnedDecorationId(state: ManorV7State, decorationId: number): void {
  if (!state.ownedDecorationIds.includes(decorationId)) state.ownedDecorationIds.push(decorationId);
  state.ownedDecorationIds.sort((left, right) => left - right);
}

function upgradeHouse(state: ManorV7State, house: ManorV7AnimalHouse, now: number): void {
  const current = house === "hutch" ? state.pasture.hutchLevel : state.pasture.shedLevel;
  const upgrade = MANOR_V7_HOUSE_UPGRADES[house].find((item) => item.level === current + 1);
  if (!upgrade) throw new Error("该建筑已经达到当前接入的最高等级");
  if (manorV7LevelForExperience(state.pastureExperience) < upgrade.requiredLevel) throw new Error(`升级需要牧场达到 ${upgrade.requiredLevel} 级`);
  charge(state, upgrade.coins);
  if (house === "hutch") state.pasture.hutchLevel = upgrade.level;
  else state.pasture.shedLevel = upgrade.level;
  progressManorV7Task(state, "house", 1);
  addManorV7Activity(state, "pasture", `${house === "hutch" ? "窝" : "棚"}升级到 ${upgrade.level} 级`, now);
}

function ownedLand(state: ManorV7State, landId: number) {
  const land = state.farm.lands.find((item) => item.id === landId);
  if (!land?.unlocked) throw new Error("土地尚未开垦");
  return land;
}

function cropLand(state: ManorV7State, landId: number) {
  const land = ownedLand(state, landId);
  if (!land.cropId) throw new Error("这块土地没有作物");
  return land;
}

function collectProduct(state: ManorV7State, serial: number, now: number): void {
  const animalState = state.pasture.animals.find((item) => item.serial === serial);
  if (!animalState || animalState.pendingProduct < 1) throw new Error("该动物没有可收取的副产品");
  const animal = manorV7Animal(animalState.animalId);
  const quantity = Math.max(1, animalState.pendingProduct - animalState.stolenProduct);
  setInventoryQuantity(
    state.pasture.productInventory,
    animal.id,
    inventoryQuantity(state.pasture.productInventory, animal.id) + quantity
  );
  animalState.pendingProduct = 0;
  animalState.stolenProduct = 0;
  animalState.productThiefUserIds = [];
  state.pastureExperience += animal.byproductHarvestExperience;
  progressManorV7Task(state, "product", 1);
  addManorV7Activity(state, "pasture", `收取了 ${quantity} 份${animal.byproductName}`, now);
}

function charge(state: ManorV7State, amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("交易金额无效");
  if (state.coins < amount) throw new Error("金币不足");
  state.coins -= amount;
}

function requirePositiveInteger(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 1_000) throw new Error("数量无效");
}

export function manorV7FishStage(fishId: number, growthSeconds: number): number {
  const fish = manorV7Fish(fishId);
  const stage = fish.cycleSeconds.findIndex((threshold) => growthSeconds < threshold);
  return stage === -1 ? fish.cycleSeconds.length : stage;
}

export function manorV7SpecialFeedCropId(animalId: number): number {
  if (animalId === 1002) return 3;
  if (animalId === 1503) return 18;
  if (animalId === 1008) return 72;
  throw new Error("只能给兔子、猴子或松鼠使用特殊作物");
}

function toolInventoryKey(area: "farm" | "pasture", id: number): number {
  return area === "farm" ? id : 100_000 + id;
}
