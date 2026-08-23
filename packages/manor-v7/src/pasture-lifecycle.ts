import type { ManorV7AnimalDefinition } from "./types.js";

export function manorV7MaxProductionCount(animal: ManorV7AnimalDefinition): number {
  return Math.max(1, Math.ceil(animal.productionSeconds / animal.productionCycleSeconds));
}

export function manorV7ProductionCycleDuration(
  animal: ManorV7AnimalDefinition,
  cycleIndex: number
): number {
  const remaining = animal.productionSeconds - Math.max(0, cycleIndex) * animal.productionCycleSeconds;
  return Math.max(
    animal.productionActionSeconds,
    Math.min(animal.productionCycleSeconds, remaining)
  );
}
