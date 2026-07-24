import { chooseGomokuMove, type GomokuAiDecision, type GomokuGameState } from "@party-games/gomoku";

interface AiWorkerRequest {
  requestId: number;
  state: GomokuGameState;
}

interface AiWorkerResponse {
  requestId: number;
  decision?: GomokuAiDecision;
  error?: string;
}

self.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
  const { requestId, state } = event.data;
  void decide(state)
    .then((decision) => self.postMessage({ requestId, decision } satisfies AiWorkerResponse))
    .catch((error: unknown) =>
      self.postMessage({
        requestId,
        error: error instanceof Error ? error.message : "AI 计算失败"
      } satisfies AiWorkerResponse)
    );
};

async function decide(state: GomokuGameState): Promise<GomokuAiDecision> {
  let tacticalMove;
  if (state.aiDifficulty === "hard" && state.ruleSet === "renju" && state.moves.length >= 6) {
    try {
      const { findForcedGomokuMove } = await import("@party-games/gomoku/tactics");
      tacticalMove =
        findForcedGomokuMove(state.moves, state.currentPlayer, "vcf", 9) ??
        findForcedGomokuMove(state.moves, state.currentPlayer, "vct", 7);
    } catch {
      tacticalMove = undefined;
    }
  }
  return chooseGomokuMove({ state, ...(tacticalMove ? { tacticalMove } : {}) });
}
