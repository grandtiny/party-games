import { GameRegistry } from "@party-games/game-core";
import type { GameType } from "@party-games/shared";
import { ClocktowerGameModule } from "./clocktower.js";
import { PokerGameModule } from "./poker.js";
import {
  TurtleSoupGameModule,
  type TurtleSoupAiFailureHandler
} from "./turtle-soup.js";
import type { TurtleSoupAiAdapter } from "./turtle-soup-ai.js";
import type { ServerGameModule } from "../platform/game-module.js";

export interface GameRegistryOptions {
  pokerEnabled?: boolean;
  turtleSoupAi?: TurtleSoupAiAdapter;
  turtleSoupAiFailureHandler?: TurtleSoupAiFailureHandler;
}

export function createGameRegistry(
  options: GameRegistryOptions = {}
): GameRegistry<GameType, ServerGameModule> {
  return new GameRegistry<GameType, ServerGameModule>([
    new ClocktowerGameModule(),
    new TurtleSoupGameModule(options.turtleSoupAi, options.turtleSoupAiFailureHandler),
    ...(options.pokerEnabled ? [new PokerGameModule()] : [])
  ]);
}
