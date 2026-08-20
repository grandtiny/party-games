import type { ManorDecorationType } from "@party-games/shared";
import { MANOR_DECORATION_DATA } from "./decorations.generated.js";

export interface ManorDecorationDefinition {
  sourceId: number;
  name: string;
  setName: string;
  category: ManorDecorationType;
  levelRequired: number;
  coinPrice: number;
  experience: number;
  validSeconds: number;
  purchasable: boolean;
  width: number;
  height: number;
  assetUrl: string;
  thumbnailUrl: string;
}

export const MANOR_DECORATIONS: readonly ManorDecorationDefinition[] = MANOR_DECORATION_DATA;

const DECORATION_BY_ID = new Map(
  MANOR_DECORATIONS.map((decoration) => [decoration.sourceId, decoration])
);

export function manorDecorationById(sourceId: number): ManorDecorationDefinition {
  const decoration = DECORATION_BY_ID.get(sourceId);
  if (!decoration) throw new Error("装扮不存在或尚未通过场景验收");
  return decoration;
}
