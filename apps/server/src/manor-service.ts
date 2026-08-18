import {
  applyManorAction,
  createManorFarm,
  migrateManorFarm,
  toManorFarmView,
  type ManorFarmState
} from "@party-games/manor";
import type {
  AccountUserView,
  ManorActionRequest,
  ManorFarmView
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

  #loadFarm(userId: string, now: number): ManorFarmState {
    const stored = this.repository.getManorFarm(userId);
    if (stored !== undefined) return migrateManorFarm(stored);
    return migrateManorFarm(
      this.repository.ensureManorFarm(userId, createManorFarm(now, userId))
    );
  }
}
