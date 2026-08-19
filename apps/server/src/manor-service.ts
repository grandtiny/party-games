import {
  applyManorFriendFarmAction,
  applyManorFriendPastureAction,
  applyManorFriendVisit,
  applyManorPastureAction,
  applyManorAction,
  createManorFarm,
  migrateManorFarm,
  levelForExperience,
  levelForPastureExperience,
  toManorPastureView,
  toManorFarmView,
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
    return toManorPastureView(
      farm.pasture,
      farm.coins,
      farm.revision,
      user.displayName,
      now,
      this.options
    );
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
      farm: toManorFarmView(owner, account.displayName, now, this.options)
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
      pasture: toManorPastureView(
        owner.pasture,
        owner.coins,
        owner.revision,
        account.displayName,
        now,
        this.options
      )
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
      this.options
    );
    this.#saveFriendMutation(visitor.id, currentVisitor, account.id, currentOwner, result);
    return {
      owner: this.#summary(account.id, account.displayName, result.owner, false),
      farm: toManorFarmView(result.owner, account.displayName, now, this.options),
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
      this.options
    );
    this.#saveFriendMutation(visitor.id, currentVisitor, account.id, currentOwner, result);
    return {
      owner: this.#summary(account.id, account.displayName, result.owner, false),
      pasture: toManorPastureView(
        result.owner.pasture,
        result.owner.coins,
        result.owner.revision,
        account.displayName,
        now,
        this.options
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
    const result = applyManorPastureAction(current.pasture, current.coins, action, now, this.options);
    const next: ManorFarmState = {
      ...current,
      pasture: result.pasture,
      coins: result.coins,
      revision: current.revision + 1,
      updatedAt: now
    };
    validateManorFarm(next);
    this.repository.updateManorFarm(user.id, current.revision, next);
    return toManorPastureView(
      next.pasture,
      next.coins,
      next.revision,
      user.displayName,
      now,
      this.options
    );
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

function compareFarmRank(left: ManorFriendSummaryView, right: ManorFriendSummaryView): number {
  return right.farmExperience - left.farmExperience || left.displayName.localeCompare(right.displayName, "zh-CN");
}

function comparePastureRank(left: ManorFriendSummaryView, right: ManorFriendSummaryView): number {
  return right.pastureExperience - left.pastureExperience || left.displayName.localeCompare(right.displayName, "zh-CN");
}
