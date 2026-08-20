import {
  applyManorFriendFarmAction,
  applyManorFriendPastureAction,
  applyManorFriendVisit,
  applyManorPastureAction,
  applyManorAction,
  appendManorBusinessTransactions,
  createManorFarm,
  migrateManorFarm,
  refreshManorDailyState,
  MANOR_SPECIAL_FEED_LIMIT,
  levelForExperience,
  levelForPastureExperience,
  toManorPastureView,
  toManorFlowerCatalog,
  toManorFarmView,
  toManorBusinessRecordViews,
  validateManorFarm,
  type ManorFarmState
} from "@party-games/manor";
import type {
  AccountUserView,
  ManorFriendFarmActionRequest,
  ManorFriendFarmView,
  ManorFriendPastureActionRequest,
  ManorFriendPastureView,
  ManorFriendSummaryView,
  ManorGuestbookCreateRequest,
  ManorGuestbookView,
  ManorSocialOverviewView,
  ManorActionRequest,
  ManorFarmView,
  ManorPastureActionRequest,
  ManorPastureView
} from "@party-games/shared";
import type { SqliteRoomRepository } from "./repository.js";

export interface ManorServiceOptions {
  timeScale?: number;
  legacyBackgroundUrl?: string;
}

export class ManorService {
  constructor(
    private readonly repository: SqliteRoomRepository,
    private readonly options: ManorServiceOptions = {}
  ) {}

  getFarm(user: AccountUserView, now = Date.now()): ManorFarmView {
    return toManorFarmView(this.#loadFarm(user.id, now), user.displayName, now, this.options);
  }

  getPasture(user: AccountUserView, now = Date.now()): ManorPastureView {
    const farm = this.#loadFarm(user.id, now);
    return this.#pastureView(farm, user.displayName, now, farm.produce.carrot);
  }

  getSocialOverview(user: AccountUserView, now = Date.now()): ManorSocialOverviewView {
    const friends = this.repository.listManorAccounts().map((account) => {
      const farm = this.#loadFarm(account.id, now);
      return this.#summary(account.id, account.displayName, farm, account.id === user.id);
    });
    return {
      friends: friends.filter((friend) => !friend.isCurrentUser),
      farmRanking: [...friends].sort(compareFarmRank),
      pastureRanking: [...friends].sort(comparePastureRank)
    };
  }

  getFriendFarm(
    visitor: AccountUserView,
    ownerUserId: string,
    now = Date.now()
  ): ManorFriendFarmView {
    const account = this.#friendAccount(visitor.id, ownerUserId);
    const currentVisitor = this.#loadFarm(visitor.id, now);
    const visit = applyManorFriendVisit(currentVisitor, now);
    if (visit.changed) {
      this.repository.updateManorFarm(visitor.id, currentVisitor.revision, visit.visitor);
    }
    const owner = this.#loadFarm(account.id, now);
    return {
      owner: this.#summary(account.id, account.displayName, owner, false),
      farm: toManorFarmView(owner, account.displayName, now, {
        ...this.options,
        includeBusinessRecords: false
      }),
      flowerCatalog: toManorFlowerCatalog(visit.visitor)
    };
  }

  getFriendPasture(
    visitor: AccountUserView,
    ownerUserId: string,
    now = Date.now()
  ): ManorFriendPastureView {
    const account = this.#friendAccount(visitor.id, ownerUserId);
    const currentVisitor = this.#loadFarm(visitor.id, now);
    const visit = applyManorFriendVisit(currentVisitor, now);
    if (visit.changed) {
      this.repository.updateManorFarm(visitor.id, currentVisitor.revision, visit.visitor);
    }
    const owner = this.#loadFarm(account.id, now);
    return {
      owner: this.#summary(account.id, account.displayName, owner, false),
      pasture: this.#pastureView(owner, account.displayName, now, currentVisitor.produce.carrot, false)
    };
  }

  handleFriendFarmAction(
    visitor: AccountUserView,
    ownerUserId: string,
    action: ManorFriendFarmActionRequest,
    now = Date.now()
  ): ManorFriendFarmView {
    const account = this.#friendAccount(visitor.id, ownerUserId);
    const currentVisitor = this.#loadFarm(visitor.id, now);
    const currentOwner = this.#loadFarm(account.id, now);
    const result = applyManorFriendFarmAction(
      currentVisitor,
      currentOwner,
      visitor.id,
      action,
      now,
      this.options,
      visitor.displayName
    );
    this.#saveFriendMutation(visitor.id, currentVisitor, account.id, currentOwner, result);
    return {
      owner: this.#summary(account.id, account.displayName, result.owner, false),
      farm: toManorFarmView(result.owner, account.displayName, now, {
        ...this.options,
        includeBusinessRecords: false
      }),
      flowerCatalog: toManorFlowerCatalog(result.visitor),
      message: result.message
    };
  }

  handleFriendPastureAction(
    visitor: AccountUserView,
    ownerUserId: string,
    action: ManorFriendPastureActionRequest,
    now = Date.now()
  ): ManorFriendPastureView {
    const account = this.#friendAccount(visitor.id, ownerUserId);
    const currentVisitor = this.#loadFarm(visitor.id, now);
    const currentOwner = this.#loadFarm(account.id, now);
    const result = applyManorFriendPastureAction(
      currentVisitor,
      currentOwner,
      visitor.id,
      action,
      now,
      this.options,
      visitor.displayName
    );
    this.#saveFriendMutation(visitor.id, currentVisitor, account.id, currentOwner, result);
    return {
      owner: this.#summary(account.id, account.displayName, result.owner, false),
      pasture: this.#pastureView(
        result.owner,
        account.displayName,
        now,
        result.visitor.produce.carrot,
        false
      ),
      message: result.message
    };
  }

  handleAction(
    user: AccountUserView,
    action: ManorActionRequest,
    now = Date.now()
  ): ManorFarmView {
    const current = this.#loadFarm(user.id, now);
    const next = applyManorAction(current, action, now, this.options);
    this.repository.updateManorFarm(user.id, current.revision, next);
    return toManorFarmView(next, user.displayName, now, this.options);
  }

  handlePastureAction(
    user: AccountUserView,
    action: ManorPastureActionRequest,
    now = Date.now()
  ): ManorPastureView {
    const current = this.#loadFarm(user.id, now);
    const daily = refreshManorDailyState(current.daily, now);
    const result = applyManorPastureAction(current.pasture, current.coins, action, now, {
      ...this.options,
      availableCarrots: current.produce.carrot,
      specialFeedRemaining: MANOR_SPECIAL_FEED_LIMIT - daily.specialFeedsReceived
    });
    const produce = { ...current.produce };
    produce.carrot -= result.carrotsConsumed;
    daily.specialFeedsReceived += result.specialFeedsConsumed;
    const business = appendManorBusinessTransactions(
      current.businessRecords,
      current.nextBusinessRecordId,
      result.businessTransactions,
      now
    );
    const next: ManorFarmState = {
      ...current,
      pasture: result.pasture,
      coins: result.coins,
      produce,
      daily,
      businessRecords: business.records,
      nextBusinessRecordId: business.nextId,
      revision: current.revision + 1,
      updatedAt: now
    };
    validateManorFarm(next);
    this.repository.updateManorFarm(user.id, current.revision, next);
    return this.#pastureView(next, user.displayName, now, next.produce.carrot);
  }

  getGuestbook(
    viewer: AccountUserView,
    ownerUserId: string | undefined,
    now = Date.now()
  ): ManorGuestbookView {
    const owner = ownerUserId
      ? this.#friendAccount(viewer.id, ownerUserId)
      : { id: viewer.id, displayName: viewer.displayName };
    return {
      ownerUserId: owner.id,
      ownerDisplayName: owner.displayName,
      canClear: owner.id === viewer.id,
      messages: this.repository.listManorGuestbook(owner.id, 50).map((message) => ({
        id: message.id,
        senderUserId: message.senderUserId,
        senderDisplayName: message.senderDisplayName,
        content: message.content,
        createdAt: parseStoredDate(message.createdAt, now),
        ...(message.replyTo ? { replyTo: { ...message.replyTo } } : {})
      }))
    };
  }

  createGuestbookMessage(
    sender: AccountUserView,
    ownerUserId: string | undefined,
    input: ManorGuestbookCreateRequest,
    now = Date.now()
  ): ManorGuestbookView {
    const owner = ownerUserId
      ? this.#friendAccount(sender.id, ownerUserId)
      : { id: sender.id, displayName: sender.displayName };
    this.repository.createManorGuestbookMessage(
      owner.id,
      sender.id,
      input.content,
      input.replyToId,
      new Date(now).toISOString()
    );
    return this.getGuestbook(sender, ownerUserId, now);
  }

  clearGuestbook(owner: AccountUserView, now = Date.now()): ManorGuestbookView {
    this.repository.clearManorGuestbook(owner.id);
    return this.getGuestbook(owner, undefined, now);
  }

  #loadFarm(userId: string, now: number): ManorFarmState {
    const stored = this.repository.getManorFarm(userId);
    if (stored !== undefined) return migrateManorFarm(stored, now);
    return migrateManorFarm(
      this.repository.ensureManorFarm(
        userId,
        createManorFarm(now, userId, { enableStarterTasks: true })
      ),
      now
    );
  }

  #friendAccount(currentUserId: string, ownerUserId: string) {
    if (!ownerUserId || ownerUserId === currentUserId) throw new Error("请选择其他好友的庄园");
    const account = this.repository.findManorAccount(ownerUserId);
    if (!account) throw new Error("好友账号不存在");
    return account;
  }

  #summary(
    userId: string,
    displayName: string,
    farm: ManorFarmState,
    isCurrentUser: boolean
  ): ManorFriendSummaryView {
    return {
      userId,
      displayName,
      farmLevel: levelForExperience(farm.experience),
      farmExperience: farm.experience,
      pastureLevel: levelForPastureExperience(farm.pasture.experience),
      pastureExperience: farm.pasture.experience,
      isCurrentUser
    };
  }

  #pastureView(
    farm: ManorFarmState,
    displayName: string,
    now: number,
    availableCarrots: number,
    includeBusinessRecords = true
  ): ManorPastureView {
    const daily = refreshManorDailyState(farm.daily, now);
    return toManorPastureView(
      farm.pasture,
      farm.coins,
      farm.revision,
      displayName,
      now,
      {
        ...this.options,
        availableCarrots,
        businessRecords: includeBusinessRecords
          ? toManorBusinessRecordViews(farm.businessRecords)
          : [],
        specialFeedRemaining: MANOR_SPECIAL_FEED_LIMIT - daily.specialFeedsReceived
      }
    );
  }

  #saveFriendMutation(
    visitorUserId: string,
    currentVisitor: ManorFarmState,
    ownerUserId: string,
    currentOwner: ManorFarmState,
    result: { visitor: ManorFarmState; owner: ManorFarmState }
  ): void {
    this.repository.updateManorFarmsAtomically([
      {
        userId: visitorUserId,
        expectedRevision: currentVisitor.revision,
        state: result.visitor
      },
      {
        userId: ownerUserId,
        expectedRevision: currentOwner.revision,
        state: result.owner
      }
    ]);
  }
}

function parseStoredDate(value: string, fallback: number): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function compareFarmRank(left: ManorFriendSummaryView, right: ManorFriendSummaryView): number {
  return right.farmExperience - left.farmExperience || left.displayName.localeCompare(right.displayName, "zh-CN");
}

function comparePastureRank(left: ManorFriendSummaryView, right: ManorFriendSummaryView): number {
  return right.pastureExperience - left.pastureExperience || left.displayName.localeCompare(right.displayName, "zh-CN");
}
