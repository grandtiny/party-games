import {
  applyManorPastureAction,
  applyManorAction,
  createManorFarm,
  migrateManorFarm,
  toManorPastureView,
  toManorFarmView,
  validateManorFarm,
  type ManorFarmState
} from "@party-games/manor";
import type {
  AccountUserView,
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
      this.repository.ensureManorFarm(userId, createManorFarm(now, userId)),
      now
    );
  }
}
