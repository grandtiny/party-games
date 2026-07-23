import { GameRegistry } from "@party-games/game-core";
import type { GameType } from "@party-games/shared";
import { ClocktowerGameModule } from "./clocktower.js";
import { PokerGameModule } from "./poker.js";
import type { ServerGameModule } from "../platform/game-module.js";

export interface GameRegistryOptions {
  pokerEnabled?: boolean;
}

export function createGameRegistry(
  options: GameRegistryOptions = {}
): GameRegistry<GameType, ServerGameModule> {
  return new GameRegistry<GameType, ServerGameModule>([
    new ClocktowerGameModule(),
    ...(options.pokerEnabled ? [new PokerGameModule()] : [])
  ]);
}
