import { GameRegistry } from "@party-games/game-core";
import type { GameType } from "@party-games/shared";
import { ClocktowerGameModule } from "./clocktower.js";
import type { ServerGameModule } from "../platform/game-module.js";

export function createGameRegistry(): GameRegistry<GameType, ServerGameModule> {
  return new GameRegistry<GameType, ServerGameModule>([new ClocktowerGameModule()]);
}
