import { describe, expect, it } from "vitest";
import type { TurtleSoupPuzzleState } from "../src/domain.js";
import {
  ModelTurtleSoupAiAdapter,
  type TurtleSoupAiAdapter
} from "../src/games/turtle-soup-ai.js";
import type {
  LanguageModelClient,
  LanguageModelCompletionInput
} from "../src/language-model.js";

class FakeLanguageModelClient implements LanguageModelClient {
  readonly requests: LanguageModelCompletionInput[] = [];

  constructor(private readonly output: string) {}

  async complete(input: LanguageModelCompletionInput): Promise<string | undefined> {
    this.requests.push(input);
    return this.output;
  }
}

const puzzle: TurtleSoupPuzzleState = {
  id: "model-soup",
  title: "录音房间",
  surface: "他在空房间听见自己的名字，于是立刻离开。为什么？",
  answer: "房间里有一台延迟播放的录音设备，录音内容来自他之前的声音。",
  source: "model",
  maxHints: 3,
  keyPoints: [
    { id: "recording", text: "声音来自录音设备" },
    { id: "delay", text: "录音是延迟播放的" }
  ],
  hints: []
};

describe("turtle soup AI adapter", () => {
  it("maps model guess judgments by key point id", async () => {
    const adapter = new ModelTurtleSoupAiAdapter(
      new FakeLanguageModelClient(
        JSON.stringify({
          matched_segments: ["录音设备"],
          wrong_segments: [],
          achieved_point_ids: ["recording"],
          comment: "方向正确"
        })
      )
    );

    await expect(
      adapter.judgeGuess({ puzzle, guess: "声音可能来自录音设备。" })
    ).resolves.toEqual({
      matchedKeyPointIds: ["recording"],
      wrong: false,
      comment: "方向正确"
    });
  });

  it("keeps the original achieved_points text contract compatible", async () => {
    const adapter: TurtleSoupAiAdapter = new ModelTurtleSoupAiAdapter(
      new FakeLanguageModelClient(
        JSON.stringify({
          matched_segments: ["延迟播放"],
          wrong_segments: ["有人躲着"],
          achieved_points: ["录音是延迟播放的"],
          comment: "部分命中"
        })
      )
    );

    await expect(
      adapter.judgeGuess({ puzzle, guess: "应该是延迟播放，但也许有人躲着。" })
    ).resolves.toEqual({
      matchedKeyPointIds: ["delay"],
      wrong: true,
      comment: "部分命中"
    });
  });
});
