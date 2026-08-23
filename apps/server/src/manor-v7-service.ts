import {
  advanceManorV7State,
  addManorV7Activity,
  createManorV7State,
  MANOR_V7_GRASS_CAPACITY,
  manorV7LevelForExperience,
  migrateManorV7State,
  parseManorV7Action,
  parseManorV7FriendAction,
  toManorV7View,
  transitionManorV7State,
  transitionManorV7FriendStates,
  validateManorV7State,
  type ManorV7Action,
  type ManorV7FriendActionResult,
  type ManorV7FriendSummary,
  type ManorV7SocialView,
  type ManorV7State,
  type ManorV7View
} from "@party-games/manor-v7";
import type {
  AccountUserView,
  ManorGuestbookCreateRequest,
  ManorGuestbookView,
  ManorTestGrantResourceRequest
} from "@party-games/shared";
import type { SqliteRoomRepository } from "./repository.js";

export interface ManorV7ServiceOptions {
  timeScale?: number;
}

export class ManorV7Service {
  constructor(
    private readonly repository: SqliteRoomRepository,
    private readonly options: ManorV7ServiceOptions = {}
  ) {}

  getView(user: AccountUserView, now = Date.now()): ManorV7View {
    const state = this.#loadAndAdvance(user.id, now);
    return toManorV7View(state, { userId: user.id, displayName: user.displayName }, now);
  }

  performAction(user: AccountUserView, input: unknown, now = Date.now()): ManorV7View {
    return this.performActionWithPrevious(user, input, now).after;
  }

  performActionWithPrevious(
    user: AccountUserView,
    input: unknown,
    now = Date.now()
  ): { before: ManorV7View; after: ManorV7View } {
    const current = this.#load(user.id, now);
    const previous = advanceManorV7State(current, now, this.options);
    const owner = { userId: user.id, displayName: user.displayName };
    const before = toManorV7View(previous, owner, now);
    const selectedInput = typeof input === "function"
      ? (input as (view: ManorV7View) => unknown)(before)
      : input;
    const action: ManorV7Action = parseManorV7Action(selectedInput);
    const next = transitionManorV7State(current, action, now, this.options);
    this.repository.updateManorV7State(user.id, current.revision, next);
    return {
      before,
      after: toManorV7View(next, owner, now)
    };
  }

  getSocial(user: AccountUserView, now = Date.now()): ManorV7SocialView {
    const summaries = this.repository.listManorAccounts().map((account) => {
      const state = this.#loadAndAdvance(account.id, now);
      return this.#summary(account.id, account.displayName, state, account.id === user.id);
    });
    return {
      friends: summaries.filter((item) => !item.isCurrentUser),
      farmRanking: [...summaries].sort(compareFarm),
      pastureRanking: [...summaries].sort(comparePasture)
    };
  }

  getFriendView(visitor: AccountUserView, ownerUserId: string, now = Date.now()): ManorV7View {
    if (visitor.id === ownerUserId) return this.getView(visitor, now);
    const account = this.repository.findManorAccount(ownerUserId);
    if (!account) throw new Error("好友账号不存在");
    const state = this.#loadAndAdvance(account.id, now);
    return toManorV7View(state, { userId: account.id, displayName: account.displayName }, now);
  }

  performFriendAction(
    visitor: AccountUserView,
    ownerUserId: string,
    input: unknown,
    now = Date.now()
  ): ManorV7FriendActionResult {
    const ownerAccount = this.#friendAccount(visitor.id, ownerUserId);
    const currentVisitor = this.#load(visitor.id, now);
    const currentOwner = this.#load(ownerAccount.id, now);
    const result = transitionManorV7FriendStates(
      currentVisitor,
      currentOwner,
      visitor.id,
      visitor.displayName,
      ownerAccount.id,
      ownerAccount.displayName,
      parseManorV7FriendAction(input),
      now,
      this.options
    );
    this.repository.updateManorV7StatesAtomically([
      { userId: visitor.id, expectedRevision: currentVisitor.revision, state: result.visitor },
      { userId: ownerAccount.id, expectedRevision: currentOwner.revision, state: result.owner }
    ]);
    return {
      visitor: toManorV7View(
        result.visitor,
        { userId: visitor.id, displayName: visitor.displayName },
        now
      ),
      owner: toManorV7View(
        result.owner,
        { userId: ownerAccount.id, displayName: ownerAccount.displayName },
        now
      ),
      message: result.message
    };
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

  advanceTestTime(
    user: AccountUserView,
    seconds: number,
    now = Date.now()
  ): { view: ManorV7View; message: string } {
    const current = this.#load(user.id, now);
    const elapsedMilliseconds = seconds * 1_000;
    const rebased = advanceManorV7State(current, now, this.options);
    rebased.updatedAt = Math.max(0, now - elapsedMilliseconds);
    rebaseWildlifeDeadlines(rebased, elapsedMilliseconds);
    const next = advanceManorV7State(rebased, now, { timeScale: 1 });
    next.revision = current.revision + 1;
    next.updatedAt = now;
    const duration = formatTestDuration(seconds);
    addManorV7Activity(next, "farm", `测试工具推进时间 ${duration}`, now);
    validateManorV7State(next);
    this.repository.updateManorV7State(user.id, current.revision, next);
    return {
      view: toManorV7View(next, { userId: user.id, displayName: user.displayName }, now),
      message: `庄园时间已推进 ${duration}`
    };
  }

  grantTestResource(
    user: AccountUserView,
    input: ManorTestGrantResourceRequest,
    now = Date.now()
  ): { view: ManorV7View; message: string } {
    const current = this.#load(user.id, now);
    const next = advanceManorV7State(current, now, this.options);
    const granted = grantResource(next, input);
    next.revision = current.revision + 1;
    next.updatedAt = now;
    addManorV7Activity(
      next,
      "farm",
      `测试工具发放 ${granted} ${testResourceLabel(input.resource)}`,
      now
    );
    validateManorV7State(next);
    this.repository.updateManorV7State(user.id, current.revision, next);
    return {
      view: toManorV7View(next, { userId: user.id, displayName: user.displayName }, now),
      message: `${testResourceLabel(input.resource)}已增加 ${granted}`
    };
  }

  #loadAndAdvance(userId: string, now: number): ManorV7State {
    const current = this.#load(userId, now);
    const advanced = advanceManorV7State(current, now, this.options);
    if (advanced.revision !== current.revision) {
      this.repository.updateManorV7State(userId, current.revision, advanced);
    }
    return advanced;
  }

  #load(userId: string, now: number): ManorV7State {
    const stored = this.repository.getManorV7State(userId);
    if (stored) return migrateManorV7State(stored, now);
    return migrateManorV7State(
      this.repository.ensureManorV7State(userId, createManorV7State(now)),
      now
    );
  }

  #summary(
    userId: string,
    displayName: string,
    state: ManorV7State,
    isCurrentUser: boolean
  ): ManorV7FriendSummary {
    return {
      userId,
      displayName,
      farmLevel: manorV7LevelForExperience(state.farmExperience),
      pastureLevel: manorV7LevelForExperience(state.pastureExperience),
      coins: state.coins,
      isCurrentUser
    };
  }

  #friendAccount(currentUserId: string, ownerUserId: string) {
    if (!ownerUserId || ownerUserId === currentUserId) throw new Error("请选择其他好友的庄园");
    const account = this.repository.findManorAccount(ownerUserId);
    if (!account) throw new Error("好友账号不存在");
    return account;
  }
}

function compareFarm(left: ManorV7FriendSummary, right: ManorV7FriendSummary): number {
  return right.farmLevel - left.farmLevel || right.coins - left.coins || left.displayName.localeCompare(right.displayName, "zh-CN");
}

function comparePasture(left: ManorV7FriendSummary, right: ManorV7FriendSummary): number {
  return right.pastureLevel - left.pastureLevel || right.coins - left.coins || left.displayName.localeCompare(right.displayName, "zh-CN");
}

function parseStoredDate(value: string, fallback: number): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function grantResource(state: ManorV7State, input: ManorTestGrantResourceRequest): number {
  switch (input.resource) {
    case "coins":
      state.coins = safeResourceTotal(state.coins, input.amount);
      return input.amount;
    case "farm-experience":
      state.farmExperience = safeResourceTotal(state.farmExperience, input.amount);
      return input.amount;
    case "pasture-experience":
      state.pastureExperience = safeResourceTotal(state.pastureExperience, input.amount);
      return input.amount;
    case "fertilizer": {
      const entry = state.farm.toolInventory.find((item) => item.sourceId === 1);
      if (entry) entry.quantity = safeResourceTotal(entry.quantity, input.amount);
      else state.farm.toolInventory.push({ sourceId: 1, quantity: input.amount });
      return input.amount;
    }
    case "pasture-feed": {
      const previous = state.pasture.grass;
      state.pasture.grass = Math.min(MANOR_V7_GRASS_CAPACITY, previous + input.amount);
      return Math.round(state.pasture.grass - previous);
    }
  }
}

function safeResourceTotal(current: number, amount: number): number {
  const total = current + amount;
  if (!Number.isSafeInteger(total)) throw new Error("资源数量超过安全上限");
  return total;
}

function rebaseWildlifeDeadlines(state: ManorV7State, elapsedMilliseconds: number): void {
  for (const slot of state.pasture.wild.slots) {
    slot.releasedAt = shiftTimestamp(slot.releasedAt, elapsedMilliseconds);
    slot.returnAt = shiftTimestamp(slot.returnAt, elapsedMilliseconds);
    slot.restUntil = shiftTimestamp(slot.restUntil, elapsedMilliseconds);
  }
  for (const animal of state.pasture.wild.incomingAnimals) {
    animal.arrivedAt = Math.max(0, animal.arrivedAt - elapsedMilliseconds);
    animal.returnAt = Math.max(animal.arrivedAt, animal.returnAt - elapsedMilliseconds);
  }
  for (const drop of state.pasture.wild.crystalDrops) {
    drop.createdAt = Math.max(0, drop.createdAt - elapsedMilliseconds);
  }
}

function shiftTimestamp(value: number | null, elapsedMilliseconds: number): number | null {
  return value === null ? null : Math.max(0, value - elapsedMilliseconds);
}

function formatTestDuration(seconds: number): string {
  if (seconds % (24 * 60 * 60) === 0) return `${seconds / (24 * 60 * 60)} 天`;
  if (seconds % (60 * 60) === 0) return `${seconds / (60 * 60)} 小时`;
  return `${Math.round(seconds / 60)} 分钟`;
}

function testResourceLabel(resource: ManorTestGrantResourceRequest["resource"]): string {
  switch (resource) {
    case "coins": return "金币";
    case "farm-experience": return "农场经验";
    case "pasture-experience": return "牧场经验";
    case "fertilizer": return "普通化肥";
    case "pasture-feed": return "牧场饲料";
  }
}
