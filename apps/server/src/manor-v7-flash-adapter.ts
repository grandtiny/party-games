import {
  MANOR_V7_BOARD_IDS,
  MANOR_V7_DAILY_SIGN_IN_LIMIT,
  MANOR_V7_SIGN_IN_ONLY_ANIMAL_IDS,
  MANOR_V7_GRASS_PRICE,
  MANOR_V7_GRASS_LIST_PRICE,
  MANOR_V7_HOUSE_UPGRADES,
  MANOR_V7_RECLAIM_RULES,
  manorV7DayKey,
  manorV7Decoration,
  manorV7Fish,
  manorV7LandUpgrade,
  manorV7MaxProductionCount,
  manorV7DailySignInReward,
  manorV7PastureGuard,
  manorV7StreakSignInReward,
  manorV7WildAnimal,
  manorV7WildCrystal,
  wildAttackDamage,
  type ManorV7AnimalView,
  type ManorV7DecorationDefinition,
  type ManorV7FriendSummary,
  type ManorV7LandView,
  type ManorV7View
} from "@party-games/manor-v7";
import type { AccountUserView, ManorGuestbookView } from "@party-games/shared";
import type { ManorV7Service } from "./manor-v7-service.js";

type FlashParams = Record<string, string>;

const FLASH_VIP_LEVEL = 7;
const FLASH_VIP_STATUS = 2;

export class ManorV7FlashAdapter {
  constructor(private readonly service: ManorV7Service) {}

  handleFarm(
    user: AccountUserView,
    query: unknown,
    body: unknown,
    now = Date.now()
  ): unknown {
    const params = flashParams(query, body);
    const moduleName = (params.qzonemod ?? params.mod ?? "").toLowerCase();
    const actionName = (params.act ?? "").toLowerCase();

    if (moduleName === "user" && actionName === "run") {
      return this.#farmBootstrap(user, params, now);
    }
    if (moduleName === "user" && actionName === "getnotice") {
      const timestamp = Math.floor(now / 1000);
      return {
        id: timestamp,
        content: "欢迎来到本地 QQ 农牧场。当前版本使用站点账号和本地存档，农场与牧场进度会自动保存。",
        time: timestamp,
        have_new_feeds: false,
        have_new_msg: false,
        have_new_sysmsg: false,
        code: 1
      };
    }
    if (moduleName === "user" && actionName === "qqshow") {
      return flashQShowProfile(this.service.getView(user, now));
    }
    if (moduleName === "cgi_get_user_info") return this.#profile(user, "farm", params, now);
    if (moduleName === "chat" && actionName === "getallinfo") {
      return this.#profile(user, "farm", params, now);
    }
    if (moduleName === "chat" && actionName === "sendchat") {
      return this.#sendChat(user, params, now);
    }
    if (moduleName === "chat" && actionName === "clearchat") {
      this.service.clearGuestbook(user, now);
      return { chat: [], code: 1 };
    }
    if (moduleName === "chat" && actionName === "clearlog") {
      return { code: 1 };
    }
    if (moduleName === "feast" && actionName === "getpackagelist") {
      return flashDailyPackage(this.service.getView(user, now), now);
    }
    if (moduleName === "feast" && actionName === "getpackage") {
      const after = this.service.performAction(user, { type: "claim-daily-package" }, now);
      return flashDailyPackage(after, now, true);
    }
    if (moduleName === "friend") return this.#friends(user, params, now);
    if (moduleName === "cgi_farm_getstatus_filter") return this.#friendStatus(user, now);
    if (moduleName === "cgi_farm_seed_list" || moduleName === "seed") {
      return flashSeedInventory(this.service.getView(user, now));
    }
    if (moduleName === "cgi_farm_getusercrop") {
      return flashProduceInventory(this.service.getView(user, now));
    }
    if (
      moduleName === "cgi_farm_set_lock" ||
      (moduleName === "cgi_get_repertory" && ["lock", "unlock"].includes((params.target ?? "").toLowerCase()))
    ) {
      return this.#setProduceLock(user, params, now);
    }
    if (moduleName === "usertool") return this.#userTool(user, actionName, params, now);
    if (moduleName === "item") return this.#item(user, actionName, params, now);
    if (moduleName === "cgi_farm_buyitem") return this.#item(user, "buy", params, now);
    if (moduleName === "qqshow") return this.#qqShow(user, actionName, params, now);
    if (moduleName === "repertory") return this.#repertory(user, actionName, params, now);
    if (moduleName === "farmlandstatus") {
      return this.#farmlandAction(user, actionName, params, now);
    }
    if (moduleName === "user" && actionName === "reclaimpay") {
      return flashReclaimQuery(this.service.getView(user, now));
    }
    if (moduleName === "user" && actionName === "reclaim") {
      let place = 0;
      const { before, after } = this.service.performActionWithPrevious(
        user,
        (view: ManorV7View) => {
          const next = view.farm.lands.find((land) => !land.unlocked);
          if (!next) throw new Error("所有土地都已开垦");
          place = next.id;
          return { type: "reclaim-land", landId: next.id };
        },
        now
      );
      return { code: 1, direction: "", ecode: 0, money: after.coins - before.coins, place };
    }
    if (moduleName === "cgi_farm_upgrade") {
      return this.#upgradeFarmLand(user, "red", integer(params.confirm) === 1, now);
    }
    if (moduleName === "cgi_farm_upgrade_black") {
      return this.#upgradeFarmLand(user, "black", integer(params.op) === 1, now);
    }
    if (moduleName === "cgi_farm_request_count" || moduleName === "request") {
      return { alread: 0, show: 0, unread: 0 };
    }
    if (moduleName === "cgi_fish_list") return flashFishShop(this.service.getView(user, now));
    if (moduleName === "cgi_fish_unlock") return this.#unlockFish(user, params, now);
    if (moduleName === "cgi_fish_buy") return this.#buyFish(user, params, now);
    if (moduleName === "cgi_fish_index") return flashFishPool(this.service.getView(user, now));
    if (moduleName === "cgi_fish_plant") return this.#plantFish(user, params, now);
    if (moduleName === "cgi_fish_harvest") return this.#harvestFish(user, params, now);
    if (moduleName === "cgi_fish_output") return flashFishOutput(this.service.getView(user, now), params);
    if (moduleName === "cgi_fish_user_rep") return flashFishRepertory(this.service.getView(user, now));
    if (moduleName === "cgi_fish_getall") {
      return { repertory: flashFishRepertory(this.service.getView(user, now)) };
    }
    if (moduleName === "cgi_fish_sale") return this.#sellFish(user, params, now);
    if (moduleName === "cgi_fish_register") return { code: 1, direction: "", ecode: 0 };
    if (moduleName === "cgi_farm_login_home" || moduleName === "cgi_farm_login_click") {
      return flashSignInStatus(this.#recordSignInVisit(user, now), now);
    }
    if (moduleName === "cgi_pasture_signin" || moduleName === "cgi_signin") {
      return this.#claimSignIn(user, params, now);
    }
    if (moduleName === "hydra_feeds_select") {
      return { data: flashActivityLog(this.service.getView(user, now)), ecode: 0 };
    }
    if (moduleName === "hydra_feeds_delete") return { data: [], ecode: 0 };
    if (moduleName === "cgi_get_rep_history") {
      return flashProfileHistory(this.service.getView(user, now), "farm");
    }
    if (moduleName === "cgi_farm_exchange") {
      return flashCostHistory(this.service.getView(user, now));
    }
    if (moduleName === "fcg_ws_get_costfeeds") return { code: 1, cost: [] };
    if (moduleName === "sysmsg_select") {
      return flashSystemMessages(this.service.getView(user, now), params);
    }
    if (moduleName === "feeds" || moduleName === "hydra_feeds" || moduleName === "sysmsg") {
      return [];
    }
    return flashFailure(`该原版功能尚未接入：${moduleName || "unknown"}${actionName ? `/${actionName}` : ""}`);
  }

  #upgradeFarmLand(
    user: AccountUserView,
    tier: "red" | "black",
    confirmed: boolean,
    now: number
  ) {
    const before = this.service.getView(user, now);
    const query = flashLandUpgradeQuery(before, tier);
    if (!confirmed || query.ecode !== 0) return query;

    const after = this.service.performAction(
      user,
      { type: "upgrade-land", landId: query.place + 1, tier },
      now
    );
    return {
      code: 1,
      direction: "土地升级成功",
      ecode: 0,
      money: after.coins - before.coins,
      place: query.place,
      output: 0,
      leavings: 0,
      min: 0,
      ...(tier === "red" ? { red: true } : { black: true, rank: 0 })
    };
  }

  #claimSignIn(user: AccountUserView, params: FlashParams, now: number) {
    const flag = integer(params.flag) ?? 2;
    if (flag === 1) {
      const days = positiveInteger(params.days, "连续登录天数");
      const reward = manorV7StreakSignInReward(days);
      this.service.performAction(user, { type: "claim-sign-in-streak-reward", days }, now);
      return {
        code: 1,
        direction: `连续登录奖励领取成功，获得${reward.name}。`,
        ecode: 0,
        id: reward.id,
        timestamp: Math.floor(now / 1_000)
      };
    }
    if (flag !== 2) throw new Error("签到类型无效");
    const after = this.service.performAction(user, { type: "claim-sign-in" }, now);
    const rewardIds = after.rewardClaims.signInRewardDay === manorV7DayKey(now)
      ? after.rewardClaims.signInRewardIds
      : [];
    const rewardId = rewardIds.at(-1);
    if (!rewardId) throw new Error("签到奖励生成失败");
    const reward = manorV7DailySignInReward(rewardId);
    return {
      canNum: Math.max(0, MANOR_V7_DAILY_SIGN_IN_LIMIT - rewardIds.length),
      code: 1,
      days: after.rewardClaims.signInStreak,
      direction: `签到成功，获得${reward.name}。`,
      ecode: 0,
      id: rewardId,
      number: rewardIds.length,
      timestamp: Math.floor(now / 1_000)
    };
  }

  #recordSignInVisit(user: AccountUserView, now: number): ManorV7View {
    const current = this.service.getView(user, now);
    return current.rewardClaims.signInDay === manorV7DayKey(now)
      ? current
      : this.service.performAction(user, { type: "record-sign-in-visit" }, now);
  }

  #unlockFish(user: AccountUserView, params: FlashParams, now: number) {
    const fishId = positiveInteger(params.fid, "鱼种编号");
    const { before, after } = this.service.performActionWithPrevious(
      user,
      { type: "unlock-fish", fishId },
      now
    );
    return { code: 1, fid: fishId, money: after.coins - before.coins };
  }

  #buyFish(user: AccountUserView, params: FlashParams, now: number) {
    const fishId = positiveInteger(params.fid, "鱼种编号");
    const quantity = positiveInteger(params.num ?? params.number, "鱼苗数量");
    const definition = manorV7Fish(fishId);
    const { before, after } = this.service.performActionWithPrevious(
      user,
      { type: "buy-fish-seed", fishId, quantity },
      now
    );
    return {
      code: 1,
      cId: fishId,
      direction: "",
      money: after.coins - before.coins,
      name: definition.name,
      num: quantity
    };
  }

  #plantFish(user: AccountUserView, params: FlashParams, now: number) {
    const fishId = positiveInteger(params.fid, "鱼种编号");
    const { before, after } = this.service.performActionWithPrevious(
      user,
      { type: "plant-fish", fishId },
      now
    );
    const beforeSerials = new Set(before.farm.fishPool.fish.map((fish) => fish.serial));
    const planted = after.farm.fishPool.fish.find((fish) => !beforeSerials.has(fish.serial));
    if (!planted) throw new Error("鱼苗放养失败");
    return { code: 1, exp: 0, ...flashFishState(after, planted) };
  }

  #harvestFish(user: AccountUserView, params: FlashParams, now: number) {
    const serials = positiveIntegerList(params.index, "鱼编号");
    const initial = this.service.getView(user, now);
    const harvests = serials.map((serial) => {
      const state = initial.farm.fishPool.fish.find((fish) => fish.serial === serial);
      if (!state) throw new Error("鱼不存在");
      const definition = manorV7Fish(state.fishId);
      const maturity = definition.cycleSeconds.at(-1) ?? definition.matureHours * 3_600;
      if (state.growthSeconds < maturity) throw new Error("鱼还没有成熟");
      return { serial, definition };
    });
    const results = harvests.map(({ serial, definition }) => {
      this.service.performAction(user, { type: "harvest-fish", serial }, now);
      return { code: 1, exp: definition.experience, i: serial, o: definition.baseYield };
    });
    return results.length === 1 ? results[0] : results;
  }

  #sellFish(user: AccountUserView, params: FlashParams, now: number) {
    const fishIds = positiveIntegerList(params.fIds ?? params.fid, "鱼种编号");
    const initial = this.service.getView(user, now);
    const singleQuantity = integer(params.num ?? params.number);
    const sales = fishIds.map((fishId) => {
      const definition = manorV7Fish(fishId);
      const available = initial.farm.fishPool.produceInventory.find((item) => item.sourceId === fishId)?.quantity ?? 0;
      const quantity = fishIds.length === 1 && singleQuantity !== undefined ? singleQuantity : available;
      if (quantity < 1 || quantity > available) throw new Error("鱼类库存不足");
      return { definition, fishId, quantity };
    });
    let revenue = 0;
    for (const sale of sales) {
      const { before, after } = this.service.performActionWithPrevious(
        user,
        { type: "sell-fish", fishId: sale.fishId, quantity: sale.quantity },
        now
      );
      revenue += after.coins - before.coins;
    }
    return {
      code: 1,
      money: revenue,
      name: sales.length === 1 ? sales[0]!.definition.name : "全部成鱼",
      number: sales.reduce((total, sale) => total + sale.quantity, 0)
    };
  }

  handlePasture(
    user: AccountUserView,
    query: unknown,
    body: unknown,
    now = Date.now()
  ): unknown {
    const params = flashParams(query, body);
    const moduleName = (params.mod ?? "").toLowerCase().split("?", 1)[0] ?? "";

    if (moduleName === "cgi_enter") {
      const ownerId = integer(params.uId);
      const view = ownerId && ownerId !== stableFlashUserId(user.id)
        ? this.#friendViewByFlashId(user, ownerId, now)
        : this.service.getView(user, now);
      return flashPastureBootstrap(view, this.service.getView(user, now));
    }
    if (moduleName === "friend") return this.#pastureFriends(user, now);
    if (moduleName === "cgi_farm_get_common_notice") {
      return { code: 1, content: "", time: Math.floor(now / 1000) };
    }
    if (moduleName === "cgi_pasture_login_home") {
      return flashPastureLoginStatus(this.#recordSignInVisit(user, now), now);
    }
    if (moduleName === "cgi_pasture_login_click") {
      return { ...flashPastureLoginStatus(this.#recordSignInVisit(user, now), now), is_playing: 1 };
    }
    if (moduleName === "cgi_signin") return this.#claimSignIn(user, params, now);
    if (moduleName === "cgi_get_gifts") {
      return flashDailyPackage(this.service.getView(user, now), now);
    }
    if (moduleName === "cgi_accept_gift") {
      const after = this.service.performAction(user, { type: "claim-daily-package" }, now);
      return flashDailyPackage(after, now, true);
    }
    if (moduleName === "cgi_pasture_checkbitmap" || moduleName === "cgi_farm_checkbitmap") {
      return { bitmap: 0, code: 1, ecode: 0, timestamp: Math.floor(now / 1000) };
    }

    if (moduleName === "cgi_buy_animal") return this.#buyAnimal(user, params, now);
    if (moduleName === "cgi_raise_cub") return this.#raiseInventoryAnimal(user, params, now);
    if (moduleName === "cgi_feedcan") return this.#usePastureCan(user, params, now);
    if (moduleName === "cgi_buy_guard") return this.#buyPastureGuard(user, params, now);
    if (moduleName === "cgi_post_product") return this.#startPastureProduction(user, params, now);
    if (moduleName === "cgi_buy_food") return this.#buyPastureGrassToInventory(user, params, now);
    if (moduleName === "cgi_feed_food") return this.#feedPasture(user, params, now);
    if (
      moduleName === "cgi_farm_set_lock" ||
      (moduleName === "cgi_get_repertory" && ["lock", "unlock"].includes((params.target ?? "").toLowerCase()))
    ) {
      return this.#setProduceLock(user, params, now);
    }
    if (moduleName === "cgi_harvest_product") return this.#harvestPasture(user, params, now);
    if (moduleName === "cgi_sale_product") return this.#sellPastureProduct(user, params, now);
    if (moduleName === "cgi_help_pasture") return this.#cleanPasture(user, params, now);
    if (moduleName === "cgi_steal_product") return this.#stealPastureProduct(user, params, now);
    if (moduleName === "cgi_up_animalhouse") return this.#upgradePastureHouse(user, params, now);
    if (moduleName === "cgi_buy_item") return this.#buyPastureDecoration(user, params, now);
    if (moduleName === "cgi_active_item") return this.#equipPastureDecoration(user, params, now);
    if (moduleName === "cgi_farm_get_userbeast") return this.#wildSlots(user, now);
    if (moduleName === "cgi_farm_open_slot") return this.#openWildSlot(user, params, now);
    if (moduleName === "cgi_farm_get_moralexp") {
      return { ecode: 0, moralexp: this.service.getView(user, now).pasture.wild.moralExperience };
    }
    if (moduleName === "cgi_farm_adopt_beast") return this.#adoptWildAnimal(user, params, now);
    if (moduleName === "cgi_farm_raise_beast") return this.#releaseWildAnimal(user, params, now);
    if (moduleName === "cgi_farm_reward_beast") return this.#claimWildReturn(user, params, now);
    if (moduleName === "cgi_farm_donate_beast") return this.#donateWildAnimal(user, params, now);
    if (moduleName === "cgi_farm_attack_beast") return this.#attackWildAnimal(user, params, now);
    if (moduleName === "cgi_farm_pickup_crystal") return this.#pickupWildCrystal(user, params, now);
    if (moduleName === "cgi_farm_hpage_beast") {
      return { ecode: 0, ...this.#wildOwnerView(user, params, now) };
    }
    if (moduleName === "cgi_farm_beast_getnick") return this.#wildNicknames(user, params, now);

    const view = this.service.getView(user, now);
    if (moduleName === "cgi_get_user_info") return this.#profile(user, "pasture", params, now);
    if (moduleName === "chat" && (params.act ?? "").toLowerCase() === "getallinfo") {
      return this.#profile(user, "pasture", params, now);
    }
    if (moduleName === "chat" && (params.act ?? "").toLowerCase() === "sendchat") {
      return this.#sendChat(user, params, now);
    }
    if (moduleName === "chat" && (params.act ?? "").toLowerCase() === "clearchat") {
      this.service.clearGuestbook(user, now);
      return { chat: [], code: 1 };
    }
    if (moduleName === "cgi_get_exp") {
      return { ecode: 0, msg: "success", result: 0, serverTime: Math.floor(now / 1_000), userFlag: {} };
    }
    if (moduleName === "cgi_get_animals") return flashAnimalShop(view);
    if (moduleName === "cgi_get_food") return flashGrassShop();
    if (moduleName === "cgi_get_toollist") return flashPastureToolShop(view);
    if (moduleName === "cgi_get_package") return flashPasturePackage(view);
    if (moduleName === "cgi_get_repertory" || moduleName === "cgi_get_repertory_animal") {
      return flashPastureRepertory(view);
    }
    if (moduleName === "cgi_get_rep_history") return flashProfileHistory(view, "pasture");
    if (moduleName === "cgi_farm_exchange") return flashCostHistory(view);
    if (moduleName === "fcg_ws_get_costfeeds") return { code: 1, cost: [] };
    if (moduleName === "cgi_farm_getusercrop") return flashPastureMaterialInventory(view);
    if (moduleName === "cgi_farm_get_usercrystal") return this.#wildInventory(user, params, now);
    if (moduleName === "cgi_get_items") return flashPastureDecorationShop(view);
    if (moduleName === "cgi_get_useritem") return flashPastureDecorationInventory(view);
    if (moduleName === "cgi_get_userguard") return flashPastureGuards(view);
    if (moduleName === "cgi_up_animalhouse_query") return flashHouseUpgradeQuery(view, params);
    if (moduleName === "sysmsg_select") return flashSystemMessages(view, params);
    if (moduleName === "cgi_get_notice" || moduleName === "cgi_get_parade") return [];
    return flashFailure(`该原版牧场功能尚未接入：${moduleName || "unknown"}`);
  }

  #wildSlots(user: AccountUserView, now: number) {
    const view = this.service.getView(user, now);
    const slots = new Map(view.pasture.wild.slots.map((slot) => [slot.slotId, flashWildSlot(slot, view.serverTime)]));
    return {
      ecode: 0,
      maxslotid: view.pasture.wild.maxSlotId,
      beasts: Object.fromEntries(
        Array.from({ length: view.pasture.wild.maxSlotId + 1 }, (_, slotId) => [String(slotId), slots.get(slotId) ?? null])
      )
    };
  }

  #profile(
    user: AccountUserView,
    area: "farm" | "pasture",
    params: FlashParams,
    now: number
  ) {
    const view = this.service.getView(user, now);
    const guestbook = this.service.getGuestbook(user, undefined, now);
    return flashProfile(view, area, params, flashGuestbook(guestbook));
  }

  #sendChat(user: AccountUserView, params: FlashParams, now: number) {
    const content = (params.msg ?? "").trim();
    if (!content) throw new Error("留言内容不能为空");
    const current = this.service.getGuestbook(user, undefined, now);
    const replyToFlashId = integer(params.toId);
    const replyTo = integer(params.isReply) === 1 && replyToFlashId
      ? current.messages.find((message) => stableFlashUserId(message.senderUserId) === replyToFlashId)
      : undefined;
    const guestbook = this.service.createGuestbookMessage(
      user,
      undefined,
      { content, ...(replyTo ? { replyToId: replyTo.id } : {}) },
      now
    );
    return { chat: flashGuestbook(guestbook), code: 1 };
  }

  #openWildSlot(user: AccountUserView, params: FlashParams, now: number) {
    const slotId = nonNegativeInteger(params.slotid, "槽位编号");
    const { before, after } = this.service.performActionWithPrevious(user, { type: "open-wild-slot", slotId }, now);
    return { ecode: 0, money: after.coins - before.coins, maxslotid: after.pasture.wild.maxSlotId };
  }

  #adoptWildAnimal(user: AccountUserView, params: FlashParams, now: number) {
    const slotId = nonNegativeInteger(params.slotid, "槽位编号");
    const animalType = positiveInteger(params.type, "野生动物编号");
    const { before, after } = this.service.performActionWithPrevious(
      user,
      { type: "adopt-wild-animal", slotId, animalType },
      now
    );
    return { ecode: 0, money: after.coins - before.coins };
  }

  #releaseWildAnimal(user: AccountUserView, params: FlashParams, now: number) {
    const slotId = nonNegativeInteger(params.slotid, "槽位编号");
    const animalType = positiveInteger(params.type, "野生动物编号");
    const ownerId = positiveInteger(params.ownerId, "好友编号");
    const friend = this.#friendByFlashId(user, ownerId, now);
    const result = this.service.performFriendAction(
      user,
      friend.userId,
      { type: "release-wild-animal", slotId, animalType, area: integer(params.isfarm) === 1 ? "farm" : "pasture" },
      now
    );
    return {
      ecode: 0,
      moralexp: manorV7WildAnimal(animalType).releaseMoral,
      drop: [],
      steal: {},
      beast: flashWildBeastBase(
        result.owner,
        integer(params.isfarm) === 1 ? "farm" : "pasture",
        result.visitor
      ),
      t: 1
    };
  }

  #claimWildReturn(user: AccountUserView, params: FlashParams, now: number) {
    const slotId = nonNegativeInteger(params.slotid, "槽位编号");
    const animalType = positiveInteger(params.type, "野生动物编号");
    const { before, after } = this.service.performActionWithPrevious(user, { type: "claim-wild-return", slotId }, now);
    const drops = flashWildInventoryDelta(before, after);
    return {
      ecode: 0,
      money: after.coins - before.coins,
      moralexp: after.pasture.wild.moralExperience - before.pasture.wild.moralExperience,
      drop: drops,
      type: animalType
    };
  }

  #donateWildAnimal(user: AccountUserView, params: FlashParams, now: number) {
    const slotId = nonNegativeInteger(params.slotid, "槽位编号");
    const animalType = positiveInteger(params.type, "野生动物编号");
    const { before, after } = this.service.performActionWithPrevious(user, { type: "donate-wild-animal", slotId }, now);
    return { ecode: 0, money: after.coins - before.coins, type: animalType };
  }

  #attackWildAnimal(user: AccountUserView, params: FlashParams, now: number) {
    const ownerId = positiveInteger(params.ownerId, "庄园主人编号");
    const index = nonNegativeInteger(params.index, "野生动物位置");
    const attackType = params.attackType || "Fight";
    const weaponId = nonNegativeInteger(params.weapon, "武器编号");
    const ownFlashId = stableFlashUserId(user.id);
    const attackerBefore = this.service.getView(user, now);
    const before = ownerId === ownFlashId
      ? this.service.getView(user, now)
      : this.#friendViewByFlashId(user, ownerId, now);
    const area = integer(params.isfarm) === 1 ? "farm" : "pasture";
    const target = before.pasture.wild.incomingAnimals.filter((animal) => animal.area === area)[index];
    if (!target) throw new Error("野生动物不存在或已经离开");
    let attackerAfter: ManorV7View;
    let ownerAfter: ManorV7View;
    if (ownerId === ownFlashId) {
      ownerAfter = this.service.performAction(
        user,
        { type: "attack-wild-animal", serial: target.serial, attackType, weaponId },
        now
      );
      attackerAfter = ownerAfter;
    } else {
      const friend = this.#friendByFlashId(user, ownerId, now);
      const result = this.service.performFriendAction(
        user,
        friend.userId,
        { type: "attack-wild-animal", serial: target.serial, attackType, weaponId },
        now
      );
      attackerAfter = result.visitor;
      ownerAfter = result.owner;
    }
    const updated = ownerAfter.pasture.wild.incomingAnimals.find((animal) => animal.serial === target.serial);
    const leftBlood = updated?.blood ?? 0;
    const damage = Math.max(0, target.blood - leftBlood);
    const moral = attackerAfter.pasture.wild.moralExperience - attackerBefore.pasture.wild.moralExperience;
    const beforeDrops = new Set(before.pasture.wild.crystalDrops.map((drop) => drop.serial));
    const drops = ownerAfter.pasture.wild.crystalDrops
      .filter((drop) => !beforeDrops.has(drop.serial))
      .map(flashWildDrop);
    return {
      ecode: 0,
      result: damage === 0 ? 3 : leftBlood === 0 ? 2 : 1,
      leftblood: leftBlood,
      subblood: damage || wildAttackDamage(attackType, weaponId),
      addmoral: Math.max(0, moral),
      drop: drops,
      t: updated?.status ?? 6
    };
  }

  #pickupWildCrystal(user: AccountUserView, params: FlashParams, now: number) {
    const ownerId = positiveInteger(params.ownerId, "庄园主人编号");
    const ownFlashId = stableFlashUserId(user.id);
    const owner = ownerId === ownFlashId
      ? this.service.getView(user, now)
      : this.#friendViewByFlashId(user, ownerId, now);
    const crystalId = positiveInteger(params.id, "水晶编号");
    const time = integer(params.time);
    const drop = owner.pasture.wild.crystalDrops.find((item) =>
      item.crystalId === crystalId && (time === undefined || Math.floor(item.createdAt / 1_000) === time)
    );
    if (!drop) throw new Error("水晶已经被捡走了");
    if (ownerId === ownFlashId) {
      this.service.performAction(user, { type: "pickup-wild-crystal", serial: drop.serial }, now);
    } else {
      const friend = this.#friendByFlashId(user, ownerId, now);
      this.service.performFriendAction(user, friend.userId, { type: "pickup-wild-crystal", serial: drop.serial }, now);
    }
    return { ecode: 0, direction: `捡到了${manorV7WildCrystal(crystalId).name}` };
  }

  #wildInventory(user: AccountUserView, params: FlashParams, now: number) {
    const view = this.service.getView(user, now);
    if (integer(params.type) === 10) {
      return {
        ecode: 0,
        info: [4, 5, 6].map((id) => ({ id, cId: id, cName: ["水拔子", "青铜飞刀", "白银飞刀"][id - 4], num: 99, type: 10 }))
      };
    }
    return {
      ecode: 0,
      info: view.pasture.wild.crystalInventory.map((entry) => ({
        cId: entry.sourceId,
        cName: manorV7WildCrystal(entry.sourceId).name,
        amount: entry.quantity,
        level: 0,
        price: manorV7WildCrystal(entry.sourceId).salePrice,
        type: 9
      }))
    };
  }

  #wildOwnerView(user: AccountUserView, params: FlashParams, now: number) {
    const ownerId = integer(params.ownerId);
    const view = ownerId && ownerId !== stableFlashUserId(user.id)
      ? this.#friendViewByFlashId(user, ownerId, now)
      : this.service.getView(user, now);
    return flashWildBeastBase(
      view,
      integer(params.isfarm) === 1 ? "farm" : "pasture",
      this.service.getView(user, now)
    );
  }

  #wildNicknames(user: AccountUserView, params: FlashParams, now: number) {
    const view = this.#wildOwnerView(user, params, now);
    return {
      ecode: 0,
      info: view.info.map((animal) => ({
        fid: animal.fid,
        nick: animal.nick,
        attack: Object.fromEntries(
          animal.attack.map((attack: { fid: number; nick: string }) => [String(attack.fid), attack.nick])
        )
      }))
    };
  }

  #pastureFriends(user: AccountUserView, now: number) {
    const ownView = this.service.getView(user, now);
    return [
      flashPastureFriendSummary(user.id, user.displayName, ownView),
      ...this.service.getSocial(user, now).friends.map((friend) =>
        flashPastureFriendSummary(
          friend.userId,
          friend.displayName,
          this.service.getFriendView(user, friend.userId, now)
        )
      )
    ];
  }

  #buyAnimal(user: AccountUserView, params: FlashParams, now: number) {
    const animalId = positiveInteger(params.cId ?? params.id, "动物编号");
    const quantity = positiveInteger(params.number ?? params.num, "购买数量");
    const before = this.service.getView(user, now);
    const existingSerials = new Set(before.pasture.animals.map((animal) => animal.serial));
    const after = this.service.performAction(user, { type: "buy-animal", animalId, quantity }, now);
    return {
      addExp: quantity * 5,
      animal: after.pasture.animals.filter((animal) => !existingSerials.has(animal.serial)).map((animal) => flashPastureAnimal(animal, after.serverTime)),
      code: 0,
      money: before.coins - after.coins,
      msg: "success",
      num: quantity,
      ecode: 0,
      poptype: 3
    };
  }

  #raiseInventoryAnimal(user: AccountUserView, params: FlashParams, now: number) {
    const animalId = positiveInteger(params.type ?? params.cId, "动物编号");
    const quantity = positiveInteger(params.number ?? params.num, "放养数量");
    const before = this.service.getView(user, now);
    const existingSerials = new Set(before.pasture.animals.map((animal) => animal.serial));
    const after = this.service.performAction(
      user,
      { type: "raise-animal-from-inventory", animalId, quantity },
      now
    );
    return {
      addExp: quantity * 5,
      animal: after.pasture.animals
        .filter((animal) => !existingSerials.has(animal.serial))
        .map((animal) => flashPastureAnimal(animal, after.serverTime)),
      code: 1,
      direction: "添加成功",
      ecode: 0,
      post_data: { number: quantity, type: animalId }
    };
  }

  #usePastureCan(user: AccountUserView, params: FlashParams, now: number) {
    const serial = positiveInteger(params.serial, "动物编号");
    const toolId = positiveInteger(params.tid, "罐头编号");
    const after = this.service.performAction(user, { type: "use-pasture-can", serial, toolId }, now);
    const animal = after.pasture.animals.find((item) => item.serial === serial);
    if (!animal) throw new Error("动物不存在");
    return {
      animal: flashPastureAnimal(animal, after.serverTime),
      code: 1,
      direction: "使用罐头成功",
      ecode: 0,
      post_data: { serial, tid: toolId },
      serial
    };
  }

  #buyPastureGuard(user: AccountUserView, params: FlashParams, now: number) {
    const guardId = positiveInteger(params.id, "看守员编号");
    const type = positiveInteger(params.type, "看守员类型");
    const quantity = positiveInteger(params.number, "购买数量");
    if (type !== 106 || quantity !== 1) throw new Error("看守员购买参数无效");
    const definition = manorV7PastureGuard(guardId);
    const { before, after } = this.service.performActionWithPrevious(
      user,
      { type: "buy-pasture-guard", guardId },
      now
    );
    const guard = after.pasture.guards.find((item) => item.id === guardId);
    if (!guard) throw new Error("看守员购买失败");
    return {
      code: 1,
      direction: "购买成功",
      ecode: 0,
      id: guardId,
      money: after.coins - before.coins,
      name: definition.name,
      post_data: { id: guardId, number: quantity, type },
      striketime: Math.floor(guard.remainingSeconds)
    };
  }

  #feedPasture(user: AccountUserView, params: FlashParams, now: number) {
    const quantity = positiveInteger(params.foodnum ?? params.number ?? params.num, "牧草数量");
    const type = integer(params.type) ?? 0;
    if (type === 2) throw new Error("给好友购买牧草暂未接入");
    const { before, after } = this.service.performActionWithPrevious(
      user,
      type === 0
        ? { type: "feed-grass-from-inventory", quantity }
        : { type: "buy-grass", quantity },
      now
    );
    const added = Math.max(0, Math.round(after.pasture.grass - before.pasture.grass));
    const cost = before.coins - after.coins;
    return {
      addExp: 0,
      added: type === 0 ? added : 0,
      alert: type === 0
        ? `成功添加 ${added} 棵牧草`
        : `成功购买 ${added} 棵牧草，共花费金币 ${cost}，已放入饲料机内。`,
      animal: after.pasture.animals.map((animal) => flashPastureAnimal(animal, after.serverTime)),
      code: 1,
      direction: `成功添加 ${added} 棵牧草`,
      ecode: 0,
      money: cost,
      poptype: 3,
      total: after.pasture.grass,
      type,
      uId: stableFlashUserId(user.id)
    };
  }

  #buyPastureGrassToInventory(user: AccountUserView, params: FlashParams, now: number) {
    const quantity = positiveInteger(params.foodnum ?? params.number ?? params.num, "牧草数量");
    const { before, after } = this.service.performActionWithPrevious(
      user,
      { type: "buy-grass-to-inventory", quantity },
      now
    );
    const cost = before.coins - after.coins;
    return {
      alert: `成功购买 ${quantity} 棵牧草，共花费金币 ${cost}，已放入物品包。`,
      code: 1,
      direction: `成功购买 ${quantity} 棵牧草`,
      ecode: 0,
      money: cost,
      num: quantity,
      tId: 1
    };
  }

  #startPastureProduction(user: AccountUserView, params: FlashParams, now: number) {
    const serial = positiveInteger(params.serial, "动物编号");
    const ownerId = integer(params.uId);
    let view: ManorV7View;
    if (ownerId && ownerId !== stableFlashUserId(user.id)) {
      const friend = this.#friendByFlashId(user, ownerId, now);
      view = this.service.performFriendAction(
        user,
        friend.userId,
        { type: "start-production", serial },
        now
      ).owner;
    } else {
      view = this.service.performAction(user, { type: "start-production", serial }, now);
    }
    const animal = view.pasture.animals.find((item) => item.serial === serial);
    if (!animal) throw new Error("动物不存在");
    return {
      addExp: 0,
      animal: flashPastureAnimal(animal, view.serverTime),
      code: 0,
      ecode: 0,
      serial
    };
  }

  #harvestPasture(user: AccountUserView, params: FlashParams, now: number) {
    const harvestType = integer(params.harvesttype);
    const requested = integer(params.type);
    const serial = integer(params.serial);
    if (harvestType === 2) {
      const result = this.service.performActionWithPrevious(
        user,
        { type: "harvest-animals", ...(serial === -1 || serial === undefined ? {} : { serial }) },
        now
      );
      const remaining = new Set(result.after.pasture.animals.map((animal) => animal.serial));
      const harvested = result.before.pasture.animals.filter((animal) => !remaining.has(animal.serial));
      const experience = harvested.reduce((total, animal) => total + animal.animal.animalHarvestExperience, 0);
      return [experience, harvested.map((animal) => animal.serial), []];
    }

    const result = this.service.performActionWithPrevious(
      user,
      { type: "collect-products", ...(requested === -1 || requested === undefined ? {} : { animalId: requested }) },
      now
    );
    const targets = result.before.pasture.animals.filter((animal) =>
      animal.pendingProduct > 0 && (requested === -1 || requested === undefined || animal.animalId === requested)
    );
    const experience = targets.reduce((total, animal) => total + animal.animal.byproductHarvestExperience, 0);
    const totals = result.after.pasture.productInventory.flatMap((entry) => {
      const beforeQuantity = result.before.pasture.productInventory.find((item) => item.sourceId === entry.sourceId)?.quantity ?? 0;
      return entry.quantity > beforeQuantity ? [[entry.sourceId, entry.quantity - beforeQuantity] as [number, number]] : [];
    });
    return [experience, [], totals];
  }

  #sellPastureProduct(user: AccountUserView, params: FlashParams, now: number) {
    if (integer(params.saleAll) === 1) {
      const { before, after } = this.service.performActionWithPrevious(
        user,
        { type: "sell-all-pasture-products" },
        now
      );
      return {
        code: 1,
        direction: `成功卖出仓库里的所有产品和动物，共获得 ${after.coins - before.coins} 金币`,
        money: after.coins - before.coins
      };
    }
    const requestedId = positiveInteger(params.cId, "产品编号");
    const quantity = positiveInteger(params.num ?? params.number, "出售数量");
    const harvestedAnimal = requestedId > 10_000;
    const animalId = harvestedAnimal ? requestedId - 10_000 : requestedId;
    const { before, after } = this.service.performActionWithPrevious(
      user,
      harvestedAnimal
        ? { type: "sell-harvested-animal", animalId, quantity }
        : { type: "sell-animal-product", animalId, quantity },
      now
    );
    const animal = before.catalogs.animals.find((item) => item.id === animalId);
    return {
      cId: requestedId,
      direction: harvestedAnimal
        ? `成功卖出 ${quantity} 只${animal?.name ?? "成年动物"}`
        : `成功卖出 ${quantity} 份${animal?.byproductName ?? "副产品"}`,
      money: after.coins - before.coins
    };
  }

  #cleanPasture(user: AccountUserView, params: FlashParams, now: number) {
    if (integer(params.type) !== 2) return flashFailure("当前仅支持清理便便");
    const before = this.service.getView(user, now);
    this.service.performAction(user, { type: "collect-manure" }, now);
    return { num: before.pasture.manure, pos: integer(params.pos) ?? 0, repNum: before.pasture.manure, type: 2 };
  }

  #stealPastureProduct(user: AccountUserView, params: FlashParams, now: number) {
    const ownerId = positiveInteger(params.uId, "好友编号");
    const friend = this.#friendByFlashId(user, ownerId, now);
    const owner = this.service.getFriendView(user, friend.userId, now);
    const requested = integer(params.type);
    const target = owner.pasture.animals.find((animal) =>
      animal.pendingProduct > animal.stolenProduct && (requested === -1 || requested === undefined || animal.animalId === requested)
    );
    if (!target) throw new Error("没有可偷取的副产品");
    this.service.performFriendAction(user, friend.userId, { type: "steal-product", serial: target.serial }, now);
    return [[target.animalId, 1]];
  }

  #upgradePastureHouse(user: AccountUserView, params: FlashParams, now: number) {
    const house = integer(params.type) === 1 ? "hutch" : "shed";
    const before = this.service.getView(user, now);
    const after = this.service.performAction(user, { type: "upgrade-house", house }, now);
    return {
      1: { id: pastureDecorationId(after), lv: 1 },
      2: { id: 102, lv: after.pasture.hutchLevel },
      3: { id: 103, lv: after.pasture.shedLevel },
      code: 1,
      money: after.coins - before.coins,
      ecode: 0
    };
  }

  #buyPastureDecoration(user: AccountUserView, params: FlashParams, now: number) {
    if ((params.useFB ?? "").toLowerCase() === "true" || integer(params.useFB) === 1) {
      return flashFailure("元宝购买未接入");
    }
    const itemId = positiveInteger(params.itemId ?? params.id, "装扮编号");
    const item = manorV7Decoration("pasture", itemId);
    const before = this.service.getView(user, now);
    this.service.performAction(user, { type: "buy-decoration", area: "pasture", decorationId: itemId }, now);
    const after = this.service.performAction(user, { type: "equip-decoration", area: "pasture", decorationId: itemId }, now);
    return {
      code: 1,
      direction: "",
      exp: item.experience,
      FB: 0,
      money: after.coins - before.coins,
      post_data: {
        itemId,
        skinBool: params.skinBool ?? "0",
        msgBool: params.msgBool ?? "0"
      }
    };
  }

  #equipPastureDecoration(user: AccountUserView, params: FlashParams, now: number) {
    const itemId = positiveInteger(params.itemId ?? params.id, "装扮编号");
    this.service.performAction(user, { type: "equip-decoration", area: "pasture", decorationId: itemId }, now);
    return { code: 1, id: itemId, skin: 0, msg: 0 };
  }

  #farmBootstrap(user: AccountUserView, params: FlashParams, now: number) {
    const ownerId = integer(params.ownerId);
    const view = ownerId && ownerId !== stableFlashUserId(user.id)
      ? this.#friendViewByFlashId(user, ownerId, now)
      : this.service.getView(user, now);
    return flashFarmBootstrap(view, this.service.getView(user, now));
  }

  #friends(user: AccountUserView, params: FlashParams, now: number): unknown {
    const social = this.service.getSocial(user, now);
    const ownView = this.service.getView(user, now);
    const own = flashFriendSummary({
      userId: user.id,
      displayName: user.displayName,
      farmLevel: ownView.farmLevel,
      pastureLevel: ownView.pastureLevel,
      coins: ownView.coins,
      isCurrentUser: true
    });
    const friends = social.friends.map(flashFriendSummary);
    const all = [own, ...friends];
    if (params.refresh === "friend") {
      return `_callback(${JSON.stringify({
        items: friends.map((friend) => ({
          uin: friend.uin,
          groupid: 0,
          name: friend.userName,
          img: "",
          yellow: FLASH_VIP_LEVEL,
          online: 1
        })),
        gpnames: [{ gpid: 0, gpname: "农场好友" }]
      })});`;
    }
    return all;
  }

  #friendStatus(user: AccountUserView, now: number) {
    const status: Record<string, Record<string, number>> = {};
    for (const friend of this.service.getSocial(user, now).friends) {
      const view = this.service.getFriendView(user, friend.userId, now);
      const flags: Record<string, number> = {};
      if (view.farm.lands.some((land) => land.harvestable && land.stolen < (land.crop?.baseYield ?? 0))) flags["1"] = Math.floor(now / 1000);
      if (view.farm.lands.some((land) => land.weeds)) flags["2"] = 1;
      if (view.farm.lands.some((land) => land.pests)) flags["3"] = 1;
      if (Object.keys(flags).length) status[String(stableFlashUserId(friend.userId))] = flags;
    }
    return { status };
  }

  #repertory(user: AccountUserView, action: string, params: FlashParams, now: number): unknown {
    if (action === "getuserseed") return flashUserPackage(this.service.getView(user, now));
    if (action === "getusercrop") return flashProduceInventory(this.service.getView(user, now));
    if (action === "buyseed") {
      const cropId = positiveInteger(params.cId, "种子编号");
      const quantity = positiveInteger(params.number, "购买数量");
      const before = this.service.getView(user, now);
      const after = this.service.performAction(user, { type: "buy-seed", cropId, quantity }, now);
      const crop = after.catalogs.crops.find((item) => item.id === cropId);
      return {
        code: 1,
        cId: cropId,
        cName: crop?.name ?? "种子",
        num: quantity,
        money: after.coins - before.coins
      };
    }
    if (action === "sale") {
      const cropId = positiveInteger(params.cId, "作物编号");
      const quantity = positiveInteger(params.number, "出售数量");
      const before = this.service.getView(user, now);
      const after = this.service.performAction(user, { type: "sell-produce", cropId, quantity }, now);
      return { cId: cropId, code: 1, direction: "出售成功", money: after.coins - before.coins };
    }
    if (action === "saleall") {
      const { before, after } = this.service.performActionWithPrevious(
        user,
        { type: "sell-all-produce" },
        now
      );
      return { code: 1, direction: "", money: after.coins - before.coins };
    }
    return flashFailure(`仓库功能尚未接入：${action || "unknown"}`);
  }

  #setProduceLock(user: AccountUserView, params: FlashParams, now: number): unknown {
    const cropId = positiveInteger(params.cId, "作物编号");
    const cropDirective = params.crop?.split(":")[1];
    const target = (params.target ?? "").toLowerCase();
    const locked = cropDirective === "1" || target === "lock";
    if (!locked && cropDirective !== "2" && target !== "unlock") {
      throw new Error("锁定操作无效");
    }
    this.service.performAction(user, { type: "set-produce-lock", cropId, locked }, now);
    return {
      code: 1,
      ecode: 0,
      post_data: { ...params, cId: String(cropId) },
      type: integer(params.type) ?? 0
    };
  }

  #userTool(user: AccountUserView, action: string, params: FlashParams, now: number): unknown {
    const view = this.service.getView(user, now);
    if (action === "getseedinfo") return flashSeedShop(view);
    if (action === "gettools") return flashToolShop(view);
    if (action === "buytool") {
      const type = positiveInteger(params.type, "工具类型");
      if (type !== 3) return flashFailure("当前仅支持金币化肥");
      const toolId = positiveInteger(params.tId, "工具编号");
      const quantity = positiveInteger(params.number, "购买数量");
      const before = view;
      const after = this.service.performAction(user, { type: "buy-tool", area: "farm", toolId, quantity }, now);
      const tool = after.catalogs.tools.find((item) => item.area === "farm" && item.itemType === 3 && item.id === toolId);
      return {
        tId: toolId,
        tName: tool?.name ?? `工具 ${toolId}`,
        code: 1,
        direction: "购买成功。",
        num: quantity,
        FB: 0,
        money: after.coins - before.coins,
        type
      };
    }
    return flashFailure(`工具商店功能尚未接入：${action || "unknown"}`);
  }

  #item(user: AccountUserView, action: string, params: FlashParams, now: number): unknown {
    const view = this.service.getView(user, now);
    if (action === "getuseritems") return flashDecorationInventory(view);
    if (action === "shop") return flashDecorationShop(view);
    if (action === "activeitem") {
      const id = positiveInteger(params.id ?? params.itemId, "装扮编号");
      const type = integer(params.type);
      if (type === 9 || MANOR_V7_BOARD_IDS.includes(id as (typeof MANOR_V7_BOARD_IDS)[number])) {
        this.service.performAction(user, { type: "set-board", boardId: id }, now);
        return { code: 1, id };
      }
      if (type === 10) {
        this.service.performAction(user, { type: "set-avatar", avatarId: id }, now);
        return { code: 1, id };
      }
      this.service.performAction(user, { type: "equip-decoration", area: "farm", decorationId: id }, now);
      return { code: 1, id };
    }
    if (action === "deactiveitem") {
      const id = positiveInteger(params.id ?? params.itemId, "装扮编号");
      const type = integer(params.type);
      if (type === 9 || MANOR_V7_BOARD_IDS.includes(id as (typeof MANOR_V7_BOARD_IDS)[number])) {
        this.service.performAction(user, { type: "set-board", boardId: null }, now);
        return { code: 1, id };
      }
      if (type === 10) {
        this.service.performAction(user, { type: "set-avatar", avatarId: null }, now);
        return { code: 1, id };
      }
      const defaultId = manorV7Decoration("farm", id).itemType;
      this.service.performAction(user, { type: "equip-decoration", area: "farm", decorationId: defaultId }, now);
      return { code: 1, id };
    }
    if (action === "buy") {
      if (integer(params.useFB)) return flashFailure("元宝购买未接入");
      const itemId = positiveInteger(params.itemId ?? params.id, "装扮编号");
      const item = manorV7Decoration("farm", itemId);
      const before = view;
      this.service.performAction(user, { type: "buy-decoration", area: "farm", decorationId: itemId }, now);
      const after = this.service.performAction(user, { type: "equip-decoration", area: "farm", decorationId: itemId }, now);
      return {
        code: 1,
        direction: "",
        exp: item.experience,
        itemId,
        itemName: item.name,
        levelUp: false,
        money: after.coins - before.coins,
        FB: 0,
        num: 1
      };
    }
    return flashFailure(`装扮功能尚未接入：${action || "unknown"}`);
  }

  #qqShow(user: AccountUserView, action: string, params: FlashParams, now: number): unknown {
    if (action === "activeitem") {
      const id = positiveInteger(params.id ?? params.itemId, "农场形象编号");
      this.service.performAction(user, { type: "set-avatar", avatarId: id }, now);
      return { code: "1", id };
    }
    if (action === "deactiveitem") {
      this.service.performAction(user, { type: "set-avatar", avatarId: null }, now);
      return { code: "1", id: 0 };
    }
    return flashFailure(`农场形象功能尚未接入：${action || "unknown"}`);
  }

  #farmlandAction(user: AccountUserView, action: string, params: FlashParams, now: number): unknown {
    if (action === "planting") {
      const cropId = positiveInteger(params.cId, "种子编号");
      const place = flashPlace(params.place);
      this.service.performAction(user, { type: "plant", landId: place + 1, cropId }, now);
      return { cId: cropId, farmlandIndex: place, code: 1, poptype: 1, direction: "", exp: 1, levelUp: false };
    }
    if (action === "water") return this.#careLand(user, params, "water", now);
    if (action === "clearweed") return this.#careMany(user, params, "remove-weeds", "weed", now);
    if (action === "spraying" || action === "pest") return this.#careMany(user, params, "remove-pests", "pest", now);
    if (action === "scrounge") return this.#stealMany(user, params, now);
    if (action === "harvest") return this.#harvestMany(user, params, now);
    if (action === "scarify") {
      const place = flashPlace(params.place);
      this.service.performAction(user, { type: "clear-land", landId: place + 1 }, now);
      return { farmlandIndex: place, code: 1, direction: "", exp: 0, levelUp: false };
    }
    if (action === "fertilize") {
      const place = flashPlace(params.place);
      const toolId = positiveInteger(params.tId, "化肥编号");
      const view = this.service.performAction(user, { type: "fertilize", landId: place + 1, toolId }, now);
      const land = requireLand(view, place);
      return { farmlandIndex: place, code: 1, tId: toolId, status: flashLandStatus(land, now) };
    }
    return flashFailure(`土地功能尚未接入：${action || "unknown"}`);
  }

  #careLand(user: AccountUserView, params: FlashParams, action: "water", now: number) {
    const place = flashPlace(params.place);
    const ownerId = integer(params.ownerId);
    let owner: ManorV7View;
    if (ownerId && ownerId !== stableFlashUserId(user.id)) {
      const friend = this.#friendByFlashId(user, ownerId, now);
      owner = this.service.performFriendAction(user, friend.userId, { type: action, landId: place + 1 }, now).owner;
    } else {
      owner = this.service.performAction(user, { type: action, landId: place + 1 }, now);
    }
    const land = requireLand(owner, place);
    return { farmlandIndex: place, code: 1, poptype: 1, direction: "浇水成功", money: 0, exp: 2, levelUp: false, humidity: land.watered ? 1 : 0 };
  }

  #careMany(
    user: AccountUserView,
    params: FlashParams,
    action: "remove-weeds" | "remove-pests",
    field: "weed" | "pest",
    now: number
  ) {
    const ownerId = integer(params.ownerId);
    const responses = flashPlaces(params.place).map((place) => {
      let owner: ManorV7View;
      if (ownerId && ownerId !== stableFlashUserId(user.id)) {
        const friend = this.#friendByFlashId(user, ownerId, now);
        owner = this.service.performFriendAction(user, friend.userId, { type: action, landId: place + 1 }, now).owner;
      } else {
        owner = this.service.performAction(user, { type: action, landId: place + 1 }, now);
      }
      const land = requireLand(owner, place);
      return {
        code: 1,
        direction: field === "weed" ? "除草成功" : "除虫成功",
        exp: 2,
        farmlandIndex: place,
        levelUp: false,
        money: 0,
        poptype: 1,
        [field]: field === "weed" ? Number(land.weeds) : Number(land.pests)
      };
    });
    return responses;
  }

  #harvestMany(user: AccountUserView, params: FlashParams, now: number): unknown {
    const responses = flashPlaces(params.place).map((place) => {
      const before = this.service.getView(user, now);
      const beforeLand = requireLand(before, place);
      const crop = beforeLand.crop;
      const beforeAmount = before.farm.produceInventory.find((entry) => entry.sourceId === crop?.id)?.quantity ?? 0;
      const after = this.service.performAction(user, { type: "harvest", landId: place + 1 }, now);
      const land = requireLand(after, place);
      const afterAmount = after.farm.produceInventory.find((entry) => entry.sourceId === crop?.id)?.quantity ?? 0;
      return {
        code: 1,
        direction: "",
        exp: crop?.experience ?? 0,
        farmlandIndex: place,
        harvest: Math.max(0, afterAmount - beforeAmount),
        levelUp: false,
        poptype: 4,
        status: flashLandActionStatus(land, now)
      };
    });
    return responses.length === 1 ? responses[0] : responses;
  }

  #stealMany(user: AccountUserView, params: FlashParams, now: number): unknown {
    const ownerId = positiveInteger(params.ownerId, "好友编号");
    const friend = this.#friendByFlashId(user, ownerId, now);
    const responses = flashPlaces(params.place).map((place) => {
      const before = this.service.getFriendView(user, friend.userId, now);
      const crop = requireLand(before, place).crop;
      const previousAmount = this.service.getView(user, now).farm.produceInventory.find((entry) => entry.sourceId === crop?.id)?.quantity ?? 0;
      const result = this.service.performFriendAction(user, friend.userId, { type: "steal-crop", landId: place + 1 }, now);
      const visitorAmount = result.visitor.farm.produceInventory.find((entry) => entry.sourceId === crop?.id)?.quantity ?? 0;
      return {
        code: 1,
        direction: result.message,
        farmlandIndex: place,
        harvest: Math.max(1, visitorAmount - previousAmount),
        poptype: 4,
        status: flashLandStatus(requireLand(result.owner, place), now)
      };
    });
    return responses.length === 1 ? responses[0] : responses;
  }

  #friendViewByFlashId(user: AccountUserView, flashId: number, now: number): ManorV7View {
    return this.service.getFriendView(user, this.#friendByFlashId(user, flashId, now).userId, now);
  }

  #friendByFlashId(user: AccountUserView, flashId: number, now: number): ManorV7FriendSummary {
    const friend = this.service.getSocial(user, now).friends.find((item) => stableFlashUserId(item.userId) === flashId);
    if (!friend) throw new Error("好友账号不存在");
    return friend;
  }
}

export function flashFarmBootstrap(view: ManorV7View, playerView: ManorV7View = view) {
  const now = Math.floor(view.serverTime / 1000);
  const dailyPackageClaimed = playerView.rewardClaims.dailyPackageDay === manorV7DayKey(view.serverTime);
  return {
    a: 0,
    b: 1,
    c: 0,
    // Status 3 is handled by the patched V7 shell as "claimed today" and hides the entry.
    d: dailyPackageClaimed ? 3 : 2,
    dog: { dogId: 0, isHungry: 0 },
    e: 0,
    exp: view.farmExperience,
    farmlandStatus: view.farm.lands.filter((land) => land.unlocked).map((land) => flashLandStatus(land, view.serverTime)),
    items: flashSelectedFarmItems(view),
    serverTime: { time: now },
    user: {
      canbad: 25,
      exp: view.farmExperience,
      headPic: "",
      healthMode: {
        beginTime: 0,
        canClose: 1,
        date: "1970-01-01|1970-01-07",
        endTime: 0,
        serverTime: now,
        set: 0,
        time: "08|00",
        valid: 0
      },
      missionTime: now,
      money: view.coins,
      FB: 0,
      moralexp: view.pasture.wild.moralExperience,
      pf: 1,
      uId: stableFlashUserId(view.owner.userId),
      uinLogin: stableFlashUserId(view.owner.userId),
      userName: view.owner.displayName,
      yellowlevel: FLASH_VIP_LEVEL,
      yellowstatus: FLASH_VIP_STATUS
    },
    weather: { weatherDesc: "晴天", weatherId: 1 },
    beast: flashWildBeastBase(view, "farm", playerView)
  };
}

function flashSelectedFarmItems(view: ManorV7View) {
  const entries: Array<[string, { itemId: number }]> = view.farm.selectedDecorationIds.map((id) => [
    String(manorV7Decoration("farm", id).itemType),
    { itemId: id }
  ]);
  if (view.farm.selectedBoardId !== null) entries.push(["9", { itemId: view.farm.selectedBoardId }]);
  if (view.farm.selectedAvatarId !== null) entries.push(["10", { itemId: view.farm.selectedAvatarId }]);
  return Object.fromEntries(entries);
}

function flashQShowProfile(view: ManorV7View) {
  return {
    code: "0",
    uin: stableFlashUserId(view.owner.userId),
    red: 1,
    style: "1",
    showtype: "0",
    sex: "M"
  };
}

function flashActivityLog(view: ManorV7View) {
  return view.activities.map((activity) => ({
    content: activity.message,
    msg: activity.message,
    time: Math.floor(activity.createdAt / 1_000)
  }));
}

function flashGuestbook(guestbook: ManorGuestbookView) {
  return guestbook.messages.map((message) => ({
    fromId: stableFlashUserId(message.senderUserId),
    fromName: message.senderDisplayName,
    isReply: Number(Boolean(message.replyTo)),
    msg: message.content,
    time: Math.floor(message.createdAt / 1_000),
    toName: message.replyTo?.senderDisplayName ?? guestbook.ownerDisplayName
  }));
}

function flashProfileHistory(view: ManorV7View, area: "farm" | "pasture") {
  if (area === "farm") {
    return view.farm.produceInventory.map((entry) => ({
      cId: entry.sourceId,
      cName: view.catalogs.crops.find((crop) => crop.id === entry.sourceId)?.name ?? `作物 ${entry.sourceId}`,
      harvest: entry.quantity,
      scrounge: 0
    }));
  }
  const ids = new Set([
    ...view.pasture.productInventory.map((entry) => entry.sourceId),
    ...view.pasture.harvestedAnimalInventory.map((entry) => entry.sourceId)
  ]);
  return [...ids].map((animalId) => {
    const definition = view.catalogs.animals.find((animal) => animal.id === animalId);
    const product = view.pasture.productInventory.find((entry) => entry.sourceId === animalId)?.quantity ?? 0;
    const harvested = view.pasture.harvestedAnimalInventory.find((entry) => entry.sourceId === animalId)?.quantity ?? 0;
    return {
      cId: animalId,
      cName: definition?.name ?? `动物 ${animalId}`,
      harvest: product + harvested,
      scrounge: 0
    };
  });
}

function flashCostHistory(view: ManorV7View) {
  const costKeywords = /购买|升级|开垦|添加|扩建/;
  return {
    code: 1,
    cost: view.activities
      .filter((activity) => costKeywords.test(activity.message))
      .map((activity) => ({
        msg: activity.message,
        time: Math.floor(activity.createdAt / 1_000),
        uid: stableFlashUserId(view.owner.userId),
        uin: stableFlashUserId(view.owner.userId)
      }))
  };
}

function flashSystemMessages(view: ManorV7View, postData: FlashParams) {
  return {
    data: view.activities.slice(0, 20).map((activity) => ({
      color: "#336600",
      opnick: "系统",
      time: Math.floor(activity.createdAt / 1_000),
      words: activity.message
    })),
    info: "succ",
    ret: 0,
    ...(Object.keys(postData).length ? { post_data: postData } : {})
  };
}

function flashProfile(
  view: ManorV7View,
  area: "farm" | "pasture" = "farm",
  postData: FlashParams = {},
  chat: ReturnType<typeof flashGuestbook> = []
) {
  return {
    chat,
    code: 1,
    log: flashActivityLog(view),
    post_data: postData,
    repertory: flashProfileHistory(view, area),
    user: {
      FB: 0,
      headPicBig: "",
      homePage: "",
      money: view.coins,
      moralexp: view.pasture.wild.moralExperience,
      uExp: area === "pasture" ? view.pastureExperience : view.farmExperience,
      uId: stableFlashUserId(view.owner.userId),
      uLevel: area === "pasture" ? view.pastureLevel : view.farmLevel,
      uName: view.owner.displayName
    }
  };
}

function flashDailyPackage(view: ManorV7View, now: number, claimed = false) {
  const alreadyClaimed = view.rewardClaims.dailyPackageDay === manorV7DayKey(now);
  const item = {
    cId: 1,
    eNum: 300,
    eParam: 1,
    eType: "6",
    name: "金币",
    num: 300,
    per: "枚",
    store: "金币账户",
    type: "6"
  };
  return {
    code: 1,
    claimed: alreadyClaimed,
    direction: claimed
      ? "每日礼包领取成功，获得金币 300。"
      : alreadyClaimed
        ? "今日每日礼包已经领取。"
        : "今日每日礼包：金币 300。",
    item: alreadyClaimed && !claimed ? [] : [item],
    packagetime: Math.floor(now / 1_000),
    title: "每日礼包",
    vipItem: []
  };
}

function flashSignInStatus(view: ManorV7View, now: number) {
  const number = dailySignInCount(view, now);
  return {
    bonus: pendingStreakSignInRewardDays(view, now) === null ? 0 : 1,
    code: 1,
    days: activeSignInStreak(view, now),
    ecode: 0,
    is_playing: 0,
    number,
    timestamp: Math.floor(now / 1_000)
  };
}

function flashPastureLoginStatus(view: ManorV7View, now: number) {
  const number = dailySignInCount(view, now);
  return {
    bonus: pendingStreakSignInRewardDays(view, now) === null ? 0 : 1,
    code: 1,
    days: activeSignInStreak(view, now),
    ecode: 0,
    is_playing: 0,
    // The pasture shell subtracts this used-attempt count from the daily limit.
    number,
    timestamp: Math.floor(now / 1_000)
  };
}

function dailySignInCount(view: ManorV7View, now: number): number {
  return view.rewardClaims.signInRewardDay === manorV7DayKey(now)
    ? view.rewardClaims.signInRewardIds.length
    : 0;
}

function activeSignInStreak(view: ManorV7View, now: number): number {
  const today = manorV7DayKey(now);
  const yesterday = manorV7DayKey(now - 24 * 60 * 60 * 1_000);
  return view.rewardClaims.signInDay === today || view.rewardClaims.signInDay === yesterday
    ? view.rewardClaims.signInStreak
    : 0;
}

function pendingStreakSignInRewardDays(view: ManorV7View, now: number): number | null {
  const streak = activeSignInStreak(view, now);
  const milestone = streak >= 7 ? 7 : streak === 5 ? 5 : streak === 3 ? 3 : null;
  return milestone !== null && !view.rewardClaims.signInStreakRewardDays.includes(milestone)
    ? milestone
    : null;
}

function flashPasturePackage(view: ManorV7View) {
  const grass = view.farm.produceInventory.find((entry) => entry.sourceId === 40)?.quantity ?? 0;
  return [
    { amount: grass, tId: 40, tName: "牧草", type: 4 },
    ...view.pasture.cubInventory.map((entry) => {
      const animal = view.catalogs.animals.find((item) => item.id === entry.sourceId);
      return {
        amount: entry.quantity,
        cId: entry.sourceId,
        cName: animal?.name ?? `动物 ${entry.sourceId}`,
        lv: animal?.originalLevel ?? 0,
        tId: entry.sourceId,
        tName: animal?.name ?? `动物 ${entry.sourceId}`,
        type: 9
      };
    }),
    ...view.pasture.toolInventory.map((entry) => {
      const tool = view.catalogs.tools.find((item) => (
        item.area === "pasture" && item.id === entry.sourceId && item.itemType === 7
      ));
      return {
        amount: entry.quantity,
        effect: tool?.effectSeconds ?? 0,
        tId: entry.sourceId,
        tName: tool?.name ?? `牧场道具 ${entry.sourceId}`,
        type: 7
      };
    })
  ];
}

export function flashPastureBootstrap(view: ManorV7View, playerView: ManorV7View = view) {
  const now = Math.floor(view.serverTime / 1000);
  const dailyPackageClaimed = playerView.rewardClaims.dailyPackageDay === manorV7DayKey(view.serverTime);
  return {
    animal: flashPastureAnimalsBySerial(view),
    stealflag: Object.fromEntries(view.pasture.animals.map((animal) => [String(animal.animalId), 3])),
    enemy: { type: 1, num: 0 },
    items: {
      1: { id: pastureDecorationId(view), lv: 1, skin: 0, msg: 0 },
      2: { id: 102, lv: view.pasture.hutchLevel },
      3: { id: 103, lv: view.pasture.shedLevel }
    },
    a: 0,
    c: 0,
    // The original pasture shell treats any non-zero value as a visible gift entry.
    d: dailyPackageClaimed ? 0 : 2,
    notice: "",
    guard: flashActivePastureGuard(view),
    animalFood: view.pasture.grass,
    badinfo: [
      { mynum: 0, num: 0, type: 1 },
      { mynum: 0, num: view.pasture.manure, type: 2 }
    ],
    parade: [],
    serverTime: { time: now },
    task: { taskFlag: 0, taskId: 10 },
    user: {
      exp: view.pastureExperience,
      headPic: "",
      money: view.coins,
      moralexp: view.pasture.wild.moralExperience,
      flv: view.farmLevel,
      FBPrice: 0,
      uId: stableFlashUserId(view.owner.userId),
      uin: stableFlashUserId(view.owner.userId),
      userName: view.owner.displayName,
      yellowlevel: FLASH_VIP_LEVEL,
      yellowstatus: FLASH_VIP_STATUS
    },
    weather: { weatherDesc: "晴天", weatherId: 1 },
    research: {
      den: { endtime: 0, animalid: 0 },
      shed: { endtime: 0, animalid: 0 }
    },
    beast: flashWildBeastBase(view, "pasture", playerView)
  };
}

function flashActivePastureGuard(view: ManorV7View) {
  const guard = view.pasture.guards.find((item) => item.active);
  if (!guard) return null;
  return {
    id: guard.id,
    name: manorV7PastureGuard(guard.id).name,
    striketime: Math.floor(guard.remainingSeconds)
  };
}

function flashPastureGuards(view: ManorV7View) {
  const now = Math.floor(view.serverTime / 1_000);
  return view.pasture.guards.map((guard) => ({
    expireTime: now + Math.floor(guard.remainingSeconds),
    itemId: guard.id,
    itemName: manorV7PastureGuard(guard.id).name,
    itemValidTime: Math.floor(guard.remainingSeconds),
    status: Number(guard.active)
  }));
}

function flashPastureAnimalsBySerial(view: ManorV7View) {
  // The original client iterates a dense response, then places each animal in
  // its internal 40-slot array by `serial`. Null response entries crash it.
  return view.pasture.animals.map((animal) => flashPastureAnimal(animal, view.serverTime));
}

function flashWildBeastBase(
  view: ManorV7View,
  area: "farm" | "pasture" = "pasture",
  playerView: ManorV7View = view
) {
  return {
    drop: view.pasture.wild.crystalDrops.map(flashWildDrop),
    info: view.pasture.wild.incomingAnimals
      .filter((animal) => animal.area === area)
      .map((animal) => flashWildIncoming(animal)),
    return: playerView.pasture.wild.slots
      .filter((slot) => slot.status === 1 || slot.status === 3)
      .map((slot) => ({ id: slot.slotId, type: slot.animalType, status: slot.status }))
  };
}

function flashWildIncoming(animal: ManorV7View["pasture"]["wild"]["incomingAnimals"][number]) {
  const attackFlags: Record<string, number> = { Fight: 1, Dog: 2, Hunter: 4, Gun: 8 };
  return {
    id: animal.ownerSlotId,
    serial: animal.serial,
    type: animal.animalType,
    fid: stableFlashUserId(animal.ownerUserId),
    nick: animal.ownerDisplayName,
    blood: animal.blood,
    status: animal.status,
    isfarm: Number(animal.area === "farm"),
    isqz: 0,
    returntime: Math.floor(animal.returnAt / 1_000),
    stealtime: Math.floor(animal.arrivedAt / 1_000),
    attack: animal.attacks.map((attack) => ({
      fid: stableFlashUserId(attack.attackerUserId),
      nick: attack.attackerDisplayName,
      issucc: attack.successful,
      flag: attackFlags[attack.attackType] ?? 1,
      id: attack.weaponId
    }))
  };
}

function flashWildSlot(
  slot: ManorV7View["pasture"]["wild"]["slots"][number],
  now: number
) {
  const definition = manorV7WildAnimal(slot.animalType);
  const targetId = slot.targetUserId ? stableFlashUserId(slot.targetUserId) : 0;
  return {
    type: slot.animalType,
    status: slot.status,
    income: slot.income,
    leftraise: slot.remainingReleases,
    curblood: slot.currentBlood,
    totalblood: definition.blood,
    price: definition.adoptionPrice,
    fid: targetId,
    friuid: targetId,
    isfarm: Number(slot.targetArea === "farm"),
    isqz: 0,
    returnleft: slot.returnAt === null ? 0 : Math.max(0, Math.ceil((slot.returnAt - now) / 60_000)),
    restleft: slot.restUntil === null ? 0 : Math.max(0, Math.ceil((slot.restUntil - now) / 60_000))
  };
}

function flashWildDrop(drop: ManorV7View["pasture"]["wild"]["crystalDrops"][number]) {
  return { type: 9, id: drop.crystalId, num: drop.quantity, time: Math.floor(drop.createdAt / 1_000) };
}

function flashWildInventoryDelta(before: ManorV7View, after: ManorV7View) {
  return after.pasture.wild.crystalInventory.flatMap((entry) => {
    const previous = before.pasture.wild.crystalInventory.find((item) => item.sourceId === entry.sourceId)?.quantity ?? 0;
    return entry.quantity > previous ? [{ type: 9, id: entry.sourceId, num: entry.quantity - previous }] : [];
  });
}

function flashPastureAnimal(animal: ManorV7AnimalView, nowMs: number) {
  const status = animal.visualState === "cub"
    ? 1
    : animal.visualState === "young"
      ? 2
      : animal.visualState === "production-ready"
        ? 3
        : animal.visualState === "production-action"
          ? 4
          : animal.visualState === "production-cooldown"
        ? 5
            : 6;
  const statusNext = status === 1
    ? 2
    : status === 2
      ? 3
      : status === 4
        ? 5
        : status === 5 && animal.productionCount < manorV7MaxProductionCount(animal.animal)
          ? 3
          : 6;
  // The original client decrements growTimeNext for every non-harvest state.
  // Status 3 is a manual action gate, so zero would make it become status 6 locally.
  const growTimeNext = status === 3 ? 12_993 : Math.floor(animal.remainingSeconds);
  return {
    buyTime: Math.max(0, Math.floor(nowMs / 1000 - animal.growthSeconds)),
    cId: animal.animalId,
    createTime: 0,
    growTime: Math.floor(animal.growthSeconds),
    growTimeNext,
    hungry: Number(animal.hungry),
    postTime: Math.floor(nowMs / 1000 - animal.productionProgressSeconds),
    productNum: Math.max(0, animal.pendingProduct - animal.stolenProduct),
    serial: animal.serial,
    status,
    statusNext,
    totalCome: Math.max(0, animal.pendingProduct - animal.stolenProduct)
  };
}

function flashPastureFriendSummary(userId: string, displayName: string, view: ManorV7View) {
  const uin = stableFlashUserId(userId);
  return {
    uId: uin,
    uin,
    userName: displayName,
    headPic: "",
    yellowlevel: FLASH_VIP_LEVEL,
    yellowstatus: FLASH_VIP_STATUS,
    exp: view.pastureExperience,
    money: view.coins,
    pf: 1
  };
}

function flashAnimalShop(view: ManorV7View) {
  return [...view.catalogs.animals]
    .filter((animal) => !MANOR_V7_SIGN_IN_ONLY_ANIMAL_IDS.includes(
      animal.id as (typeof MANOR_V7_SIGN_IN_ONLY_ANIMAL_IDS)[number]
    ))
    .sort((left, right) => left.originalLevel - right.originalLevel || left.id - right.id)
    .map((animal) => ({
      byproductprice: animal.byproductPrice,
      bsprice: 0,
      cId: animal.id,
      cLevel: animal.originalLevel,
      cName: animal.name,
      cType: PASTURE_RESTAURANT_ANIMAL_IDS.has(animal.id) ? 4 : 0,
      bName: animal.byproductName,
      consum: animal.consume,
      cub: animal.cubSeconds,
      cycle: animal.productionCycleSeconds,
      expect: PASTURE_RESTAURANT_ANIMAL_YIELD[animal.id] ?? 0,
      growing: `${animal.cubSeconds},${Math.max(0, animal.maturitySeconds - animal.cubSeconds)},${animal.productionSeconds},${animal.productionActionSeconds}`,
      growthCycle: 0,
      harvestbExp: animal.byproductHarvestExperience,
      harvestpExp: animal.animalHarvestExperience,
      maturingTime: animal.maturitySeconds,
      output: animal.baseYield,
      price: animal.purchasePrice,
      procreation: animal.productionSeconds,
      productime: animal.productionActionSeconds,
      productprice: animal.productPrice,
      msprice: 0,
      ...(PASTURE_VIP_ANIMAL_IDS.has(animal.id) ? { isvip: 1 } : {}),
      sinfo: ""
    }));
}

const PASTURE_RESTAURANT_ANIMAL_IDS = new Set([1040, 1041, 1538, 1539]);
const PASTURE_RESTAURANT_ANIMAL_YIELD: Record<number, number> = { 1040: 7, 1041: 8, 1538: 40, 1539: 40 };
const PASTURE_VIP_ANIMAL_IDS = new Set([
  1066, 1067, 1068, 1070, 1074, 1084, 1558, 1559, 1562,
  1563, 1564, 1565, 1566, 1567, 1575, 1580, 1581
]);

function flashGrassShop() {
  return [{
    FBPrice: 0,
    consume: "动物会持续消耗牧草",
    depict: "喂养动物（挨饿会停止成长或生产）",
    effect: 0,
    price: MANOR_V7_GRASS_LIST_PRICE,
    store: "购买后自动放入饲料机",
    tId: 1,
    tName: "牧草",
    timeLimit: 0,
    tip: "也可以在农场种植牧草。",
    type: 25
  }];
}

function flashPastureToolShop(view: ManorV7View) {
  return view.catalogs.tools
    .filter((tool) => tool.area === "pasture" && tool.available && tool.coinPrice > 0)
    .map((tool, index) => ({
      ...(tool.itemType === 10 && tool.id <= 7 ? { appid: 353, attacksucc: 100 } : {}),
      buyexp: 0,
      description: pastureToolDescription(tool.name, tool.itemType, tool.effectSeconds),
      effect: tool.effectSeconds,
      id: tool.id,
      left: 100,
      name: tool.name,
      order: index + 1,
      price: tool.coinPrice,
      qdprice: tool.premiumPrice,
      shortage: 0,
      status: 1,
      tips: "",
      type: tool.itemType,
      validtime: 0,
      yqdprice: tool.premiumPrice
    }));
}

function pastureToolDescription(name: string, type: number, effectSeconds: number): string {
  if (type === 7) return `${name}可缩短动物当前阶段的成长时间${Math.max(1, Math.round(effectSeconds / 3600))}小时。`;
  if (type === 10) return `${name}用于野生动物玩法。`;
  if (type === 12) return `${name}可缩短科研时间。`;
  if (type === 106) return `${name}可看守牧场。`;
  return `${name}是牧场常规道具。`;
}

function flashPastureRepertory(view: ManorV7View) {
  const products = view.pasture.productInventory.flatMap((entry) => {
    const animal = view.catalogs.animals.find((item) => item.id === entry.sourceId);
    if (!animal || entry.quantity < 1) return [];
    return [{
      amount: entry.quantity,
      cId: entry.sourceId,
      cName: animal.byproductName,
      lv: animal.originalLevel,
      price: animal.byproductPrice,
      type: 2
    }];
  });
  if (view.pasture.manure > 0) {
    products.push({ amount: view.pasture.manure, cId: 1506, cName: "便便", lv: 0, price: 30, type: 8 });
  }
  const harvestedAnimals = view.pasture.harvestedAnimalInventory.flatMap((entry) => {
    const animal = view.catalogs.animals.find((item) => item.id === entry.sourceId);
    if (!animal || entry.quantity < 1) return [];
    return [{
      amount: entry.quantity,
      cId: 10_000 + entry.sourceId,
      cName: animal.name,
      lv: animal.originalLevel,
      price: animal.productPrice,
      type: 3
    }];
  });
  return [...products, ...harvestedAnimals];
}

function flashPastureMaterialInventory(view: ManorV7View) {
  return view.farm.produceInventory.flatMap((entry) => {
    if (entry.sourceId <= 2000 || entry.quantity < 1) return [];
    const crop = view.catalogs.crops.find((item) => item.id === entry.sourceId);
    if (!crop) return [];
    return [{
      amount: entry.quantity,
      cId: entry.sourceId,
      cName: crop.name,
      ext: "",
      high_price: 0,
      isLock: Number(Boolean(entry.locked)),
      lock: Number(Boolean(entry.locked)),
      level: crop.originalLevel,
      price: crop.salePrice,
      type: crop.cropType
    }];
  });
}

function flashPastureDecorationShop(view: ManorV7View) {
  return view.catalogs.decorations
    .filter((item) => item.area === "pasture" && item.coinPrice > 0)
    .sort((left, right) => left.originalLevel - right.originalLevel || left.id - right.id)
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      price: item.coinPrice,
      FBPrice: item.premiumPrice,
      YFBPrice: item.premiumPrice,
      exp: item.experience,
      level: item.originalLevel,
      validTime: item.validSeconds,
      skin: "0",
      msg: "0"
    }));
}

function flashPastureDecorationInventory(view: ManorV7View) {
  const owned = view.catalogs.decorations
    .filter((item) => item.area === "pasture" && view.ownedDecorationIds.includes(item.id))
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      itemValidTime: 0,
      status: Number(view.pasture.selectedDecorationIds.includes(item.id)),
      yellowtype: 0,
      skin: 0,
      msg: 0
    }));
  if (view.ownedDecorationIds.includes(105)) {
    owned.unshift({
      itemId: 105,
      itemName: "默认牧场",
      itemType: 101,
      itemValidTime: 0,
      status: Number(view.pasture.selectedDecorationIds.includes(105)),
      yellowtype: 0,
      skin: 0,
      msg: 0
    });
  }
  return owned;
}

function flashHouseUpgradeQuery(view: ManorV7View, params: FlashParams) {
  const house = integer(params.type) === 1 ? "hutch" : "shed";
  const current = house === "hutch" ? view.pasture.hutchLevel : view.pasture.shedLevel;
  const upgrade = MANOR_V7_HOUSE_UPGRADES[house].find((item) => item.level === current + 1);
  if (!upgrade) return flashFailure("该建筑已达到最高等级");
  return { level: upgrade.requiredLevel, iscdtime: false, money: upgrade.coins, qd: 0, ecode: 0 };
}

function flashLandUpgradeQuery(view: ManorV7View, tier: "red" | "black") {
  const sourceTier = tier === "red" ? "normal" : "red";
  const candidates = view.farm.lands.filter((land) => land.unlocked && land.tier === sourceTier);
  const target = candidates.find((land) => !land.crop);
  const upgradedCount = tier === "red"
    ? view.farm.lands.filter((land) => land.tier !== "normal").length
    : view.farm.lands.filter((land) => land.tier === "black").length;

  if (!candidates.length) {
    return {
      code: 1,
      direction: tier === "red" ? "所有已开垦土地都已升级为红土地" : "没有可升级的红土地",
      ecode: tier === "red" ? -30120 : -30342,
      money: 0,
      qd: 0,
      yqd: 0,
      place: -1,
      level: 0,
      allBlack: tier === "black" && view.farm.lands.filter((land) => land.unlocked).every((land) => land.tier === "black"),
      cd: 0
    };
  }

  const fallback = candidates[0]!;
  const rule = manorV7LandUpgrade(tier, upgradedCount);
  if (!target) {
    return {
      code: 1,
      direction: tier === "red" ? "请先清空一块普通土地再升级" : "请先清空一块红土地再升级",
      ecode: tier === "red" ? -30123 : -30342,
      money: rule.coins,
      qd: rule.premium,
      yqd: rule.premium,
      place: fallback.id - 1,
      level: rule.level,
      allBlack: false,
      cd: 0
    };
  }

  const levelReady = view.farmLevel >= rule.level;
  const coinsReady = view.coins >= rule.coins;
  const ready = levelReady && coinsReady;
  const direction = !levelReady
    ? `升级第 ${target.id} 块${tier === "red" ? "红" : "黑"}土地需要农场达到 ${rule.level} 级`
    : !coinsReady
      ? `升级第 ${target.id} 块${tier === "red" ? "红" : "黑"}土地需要 ${rule.coins} 金币`
      : `升级第 ${target.id} 块${tier === "red" ? "红" : "黑"}土地需要 ${rule.coins} 金币`;
  return {
    code: 1,
    direction,
    ecode: ready ? 0 : -30123,
    money: rule.coins,
    qd: rule.premium,
    yqd: rule.premium,
    place: target.id - 1,
    level: rule.level,
    allBlack: false,
    cd: 0
  };
}

function pastureDecorationId(view: ManorV7View): number {
  return view.pasture.selectedDecorationIds.find((id) => {
    try {
      return manorV7Decoration("pasture", id).itemType === 101;
    } catch {
      return false;
    }
  }) ?? 105;
}

export function flashLandStatus(land: ManorV7LandView, nowMs: number) {
  const now = Math.floor(nowMs / 1000);
  const crop = land.crop;
  const output = crop ? crop.baseYield : 0;
  return {
    a: crop?.id ?? 0,
    b: flashCropStatus(land),
    c: 0,
    d: 0,
    e: 1,
    f: Number(land.weeds),
    g: Number(land.pests),
    h: land.watered ? 1 : 0,
    i: 100,
    j: land.harvests,
    k: land.harvestable ? output : 0,
    l: land.harvestable ? Math.floor(output * 0.6) : 0,
    m: land.harvestable ? Math.max(0, output - land.stolen) : 0,
    n: land.thiefUserIds.length
      ? Object.fromEntries(land.thiefUserIds.map((id) => [String(stableFlashUserId(id)), 1]))
      : [],
    o: land.fertilizedSeconds,
    p: [],
    q: crop ? now - Math.floor(land.growthSeconds) : 0,
    r: now,
    bitmap: land.tier === "black" ? 2 : land.tier === "red" ? 1 : 0,
    pId: 0
  };
}

function flashLandActionStatus(land: ManorV7LandView, nowMs: number) {
  const now = Math.floor(nowMs / 1_000);
  const crop = land.crop;
  const output = crop && land.harvestable ? crop.baseYield : 0;
  return {
    action: [],
    bitmap: land.tier === "black" ? 2 : land.tier === "red" ? 1 : 0,
    cId: crop?.id ?? 0,
    cropStatus: flashCropStatus(land),
    fertilize: land.fertilizedSeconds,
    harvestTimes: land.harvests,
    health: 100,
    humidity: land.watered ? 1 : 0,
    leavings: land.harvestable ? Math.max(0, output - land.stolen) : 0,
    min: land.harvestable ? Math.floor(output * 0.6) : 0,
    oldhumidity: 1,
    oldpest: 0,
    oldweed: 0,
    output,
    pId: 0,
    pest: Number(land.pests),
    plantTime: crop ? now - Math.floor(land.growthSeconds) : 0,
    thief: {},
    updateTime: now,
    weed: Number(land.weeds)
  };
}

export function stableFlashUserId(userId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2_000_000_000 + 1;
}

function flashCropStatus(land: ManorV7LandView): number {
  if (!land.crop) return 0;
  if (land.visualState === "seed") return 1;
  if (land.visualState === "sprout") return 2;
  if (land.visualState === "young") return 3;
  if (land.visualState === "growing") return 4;
  if (land.visualState === "mature") return 6;
  return 7;
}

function flashSeedInventory(view: ManorV7View) {
  return view.farm.seedInventory.map((entry) => {
    const crop = view.catalogs.crops.find((item) => item.id === entry.sourceId);
    return {
      amount: entry.quantity,
      cId: entry.sourceId,
      cName: crop?.name ?? `种子 ${entry.sourceId}`,
      level: crop?.originalLevel ?? 0,
      lifecycle: crop?.salePrice ?? 0,
      price: Math.floor((crop?.seedPrice ?? 0) * 0.5),
      type: 1
    };
  });
}

function flashSeedShop(view: ManorV7View) {
  return [...view.catalogs.crops]
    .sort((left, right) => left.originalLevel - right.originalLevel || left.id - right.id)
    .map((crop) => ({
      cId: crop.id,
      cLevel: crop.originalLevel,
      cName: crop.name,
      cType: crop.cropType,
      cropExp: crop.experience,
      expect: crop.baseYield * crop.salePrice * crop.harvestCycles,
      growthCycle: crop.growthSeconds,
      high_sale: 0,
      maturingTime: crop.harvestCycles,
      output: crop.baseYield,
      price: crop.seedPrice,
      sale: crop.salePrice
    }));
}

function flashReclaimQuery(view: ManorV7View) {
  const unlocked = view.farm.lands.filter((land) => land.unlocked).length;
  const rule = MANOR_V7_RECLAIM_RULES.find((item) => item.unlocked === unlocked);
  if (!rule) return flashFailure("所有土地都已开垦");
  return { code: 1, ecode: 0, level: rule.level, money: rule.coins };
}

function flashFishShop(view: ManorV7View) {
  const unlocked = new Set(view.farm.fishPool.unlockedFishIds);
  return view.catalogs.fish.map((fish) => ({
    fid: fish.id,
    lock: unlocked.has(fish.id) ? 1 : 2,
    type: 23
  }));
}

function flashFishPool(view: ManorV7View) {
  return {
    code: 1,
    fish: view.farm.fishPool.fish.map((fish) => flashFishState(view, fish)),
    open: Number(view.farm.fishPool.opened)
  };
}

function flashFishState(
  view: ManorV7View,
  fish: ManorV7View["farm"]["fishPool"]["fish"][number]
) {
  const definition = manorV7Fish(fish.fishId);
  const maturity = definition.cycleSeconds.at(-1) ?? definition.matureHours * 3_600;
  const mature = fish.growthSeconds >= maturity;
  return {
    f: 0,
    fid: fish.fishId,
    i: fish.serial,
    l: mature ? definition.baseYield : 0,
    o: mature ? definition.baseYield : 0,
    p: Math.floor(view.serverTime / 1_000) - Math.floor(fish.growthSeconds),
    s: []
  };
}

function flashFishOutput(view: ManorV7View, params: FlashParams) {
  const serial = positiveInteger(params.index, "鱼编号");
  const fish = view.farm.fishPool.fish.find((item) => item.serial === serial);
  if (!fish) throw new Error("鱼不存在");
  const state = flashFishState(view, fish);
  return { i: state.i, l: state.l, o: state.o };
}

function flashFishRepertory(view: ManorV7View) {
  return view.farm.fishPool.produceInventory.map((entry) => ({
    fid: entry.sourceId,
    lock: 0,
    num: entry.quantity,
    type: 23
  }));
}

function flashToolShop(view: ManorV7View) {
  return view.catalogs.tools
    .filter((tool) => tool.area === "farm" && tool.available && tool.coinPrice > 0)
    .map((tool) => ({
      FBPrice: tool.premiumPrice,
      YFBPrice: tool.premiumPrice,
      depict: "",
      effect: tool.effectSeconds,
      is_vip: 0,
      price: tool.coinPrice,
      saleOut: false,
      shortage: 0,
      tId: tool.id,
      tName: tool.name,
      timeLimit: 0,
      type: tool.itemType
    }));
}

function flashUserPackage(view: ManorV7View) {
  return [
    ...view.farm.seedInventory.map((entry) => {
      const crop = view.catalogs.crops.find((item) => item.id === entry.sourceId);
      return {
        type: 1,
        cId: entry.sourceId,
        cName: crop?.name ?? `种子 ${entry.sourceId}`,
        amount: entry.quantity,
        lifecycle: Math.max(1, Math.round((crop?.growthSeconds ?? 3600) / 3600)),
        level: crop?.originalLevel ?? 0
      };
    }),
    ...view.farm.toolInventory.map((entry) => {
      const toolId = entry.sourceId % 100_000;
      const tool = view.catalogs.tools.find((item) => item.area === "farm" && item.id === toolId);
      return { type: 3, tId: toolId, tName: tool?.name ?? `道具 ${toolId}`, amount: entry.quantity, depict: "" };
    }),
    ...view.farm.fishPool.seedInventory.map((entry) => {
      const fish = view.catalogs.fish.find((item) => item.id === entry.sourceId);
      return {
        type: 23,
        cId: entry.sourceId,
        fId: entry.sourceId,
        cName: fish?.name ?? `鱼苗 ${entry.sourceId}`,
        amount: entry.quantity,
        lifecycle: fish?.matureHours ?? 0,
        level: 0
      };
    })
  ];
}

function flashProduceInventory(view: ManorV7View) {
  return {
    allFlower: [],
    crop: view.farm.produceInventory.map((entry) => {
      const crop = view.catalogs.crops.find((item) => item.id === entry.sourceId);
      return {
        amount: entry.quantity,
        cId: entry.sourceId,
        cName: crop?.name ?? `作物 ${entry.sourceId}`,
        ext: "",
        high_price: 0,
        isLock: Number(Boolean(entry.locked)),
        lock: Number(Boolean(entry.locked)),
        level: crop?.originalLevel ?? 0,
        price: crop?.salePrice ?? 0,
        type: crop?.cropType ?? 1
      };
    }),
    flowerPath: "module/ui/flower"
  };
}

function flashDecorationInventory(view: ManorV7View) {
  const items = view.ownedDecorationIds.flatMap((id) => {
    try {
      const item = manorV7Decoration("farm", id);
      return [flashDecorationItem(item, view.farm.selectedDecorationIds.includes(id))];
    } catch {
      return [];
    }
  });
  return {
    code: 1,
    current: items.filter((item) => item.status === 1),
    direction: "",
    ecode: 0,
    items
  };
}

function flashDecorationShop(view: ManorV7View) {
  return view.catalogs.decorations
    .filter((item) => item.area === "farm" && item.coinPrice > 0)
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      itemDesc: item.setName,
      itemType: item.itemType,
      itemValidTime: item.validSeconds,
      price: item.coinPrice,
      FBPrice: item.premiumPrice,
      YFBPrice: item.premiumPrice,
      exp: item.experience,
      level: item.originalLevel
    }));
}

function flashDecorationItem(item: ManorV7DecorationDefinition, active: boolean) {
  return {
    created: 0,
    itemId: item.id,
    itemType: item.itemType,
    validTime: 0,
    status: Number(active),
    id: item.id,
    itemName: item.name,
    price: item.coinPrice,
    exp: item.experience
  };
}

function flashFriendSummary(friend: ManorV7FriendSummary) {
  const uin = stableFlashUserId(friend.userId);
  return {
    uId: uin,
    uin,
    userName: friend.displayName,
    headPic: "",
    yellowlevel: FLASH_VIP_LEVEL,
    yellowstatus: FLASH_VIP_STATUS,
    exp: friend.farmLevel,
    pastrueExp: friend.pastureLevel,
    money: friend.coins,
    pf: 1
  };
}

function flashParams(query: unknown, body: unknown): FlashParams {
  return { ...toFlashParams(query), ...toFlashParams(body) };
}

function toFlashParams(value: unknown): FlashParams {
  if (typeof value === "string") return Object.fromEntries(new URLSearchParams(value));
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Array.isArray(item) ? String(item[0] ?? "") : String(item ?? "")]));
}

function flashPlaces(value: string | undefined): number[] {
  const places = String(value ?? "").split(",").filter(Boolean).map((item) => flashPlace(item));
  if (!places.length) throw new Error("土地编号无效");
  return places;
}

function flashPlace(value: string | undefined): number;
function flashPlace(value: string): number;
function flashPlace(value: string | undefined): number {
  const place = integer(value);
  if (place === undefined || place < 0 || place > 23) throw new Error("土地编号无效");
  return place;
}

function positiveInteger(value: string | undefined, label: string): number {
  const parsed = integer(value);
  if (!parsed || parsed < 1) throw new Error(`${label}无效`);
  return parsed;
}

function nonNegativeInteger(value: string | undefined, label: string): number {
  const parsed = integer(value);
  if (parsed === undefined || parsed < 0) throw new Error(`${label}无效`);
  return parsed;
}

function positiveIntegerList(value: string | undefined, label: string): number[] {
  const parsed = String(value ?? "")
    .split(",")
    .filter(Boolean)
    .map((item) => positiveInteger(item, label));
  if (!parsed.length || new Set(parsed).size !== parsed.length) throw new Error(`${label}无效`);
  return parsed;
}

function integer(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function requireLand(view: ManorV7View, place: number): ManorV7LandView {
  const land = view.farm.lands.find((item) => item.id === place + 1);
  if (!land) throw new Error("土地不存在");
  return land;
}

function flashFailure(direction: string) {
  return { code: 0, poptype: 1, direction };
}
