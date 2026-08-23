import {
  advanceManorV7State,
  createManorV7State,
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
  ManorGuestbookView
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
