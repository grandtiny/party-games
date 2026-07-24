import { describe, expect, it } from "vitest";
import { TURTLE_SOUP_PROMPT_VERSION } from "@party-games/shared";
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
  readonly #outputs: string[];

  constructor(output: string | string[]) {
    this.#outputs = Array.isArray(output) ? output : [output];
  }

  async complete(input: LanguageModelCompletionInput): Promise<string | undefined> {
    this.requests.push(input);
    return this.#outputs[Math.min(this.requests.length - 1, this.#outputs.length - 1)];
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
  it("includes the shared prompt version in every model prompt", async () => {
    const client = new FakeLanguageModelClient([
      JSON.stringify({
        title: "雨夜来电",
        surface: "她接到自己的来电后立刻关灯。为什么？",
        answer:
          "电话来自她提前设置的定时语音提醒，她用自己的声音提醒自己有人可能在窗外观察，所以先关灯隐藏位置。",
        key_points: [
          "电话是提前设置的定时提醒",
          "来电声音来自她自己",
          "她担心窗外有人观察",
          "关灯是为了隐藏自己的位置"
        ],
        hints: ["声音不一定来自实时通话。", "她关灯是在保护自己的位置。"]
      }),
      JSON.stringify({ res: "是", reason: "方向有关" }),
      JSON.stringify({
        matched_segments: ["录音设备"],
        wrong_segments: [],
        achieved_point_ids: ["recording"],
        comment: "方向正确"
      }),
      "声音有没有可能早就被留下？"
    ]);
    const adapter = new ModelTurtleSoupAiAdapter(client);

    await adapter.createPuzzle({ difficulty: "normal", tags: ["电话"], seed: "seed-version" });
    await adapter.judgeQuestion({ puzzle, question: "声音和设备有关吗？" });
    await adapter.judgeGuess({ puzzle, guess: "声音可能来自录音设备。" });
    await adapter.createHint({ puzzle, foundKeyPointIds: [], log: [] });

    expect(client.requests).toHaveLength(4);
    for (const request of client.requests) {
      expect(request.messages[0]?.content).toContain(TURTLE_SOUP_PROMPT_VERSION);
    }
  });

  it("retries puzzle generation when the model returns a low quality payload", async () => {
    const client = new FakeLanguageModelClient([
      JSON.stringify({
        title: "坏题",
        surface: "一个人进门后笑了。",
        answer: "答案太短。",
        key_points: ["只有一个要点"],
        hints: ["提示"]
      }),
      JSON.stringify({
        title: "雨夜来电",
        surface: "她接到自己的来电后立刻关灯。为什么？",
        answer:
          "电话来自她提前设置的定时语音提醒，她用自己的声音提醒自己有人可能在窗外观察，所以先关灯隐藏位置。",
        key_points: [
          "电话是提前设置的定时提醒",
          "来电声音来自她自己",
          "她担心窗外有人观察"
        ],
        hints: ["声音不一定来自实时通话。", "她关灯是在保护自己的位置。"]
      })
    ]);
    const adapter = new ModelTurtleSoupAiAdapter(client);

    await expect(
      adapter.createPuzzle({ difficulty: "easy", tags: ["电话"], seed: "seed-1" })
    ).resolves.toMatchObject({
      source: "model",
      title: "雨夜来电",
      maxHints: 8,
      keyPoints: [
        { id: "kp-1", text: "电话是提前设置的定时提醒" },
        { id: "kp-2", text: "来电声音来自她自己" },
        { id: "kp-3", text: "她担心窗外有人观察" }
      ]
    });
    expect(client.requests).toHaveLength(2);
    expect(client.requests[0]?.messages[0]?.content).toContain(TURTLE_SOUP_PROMPT_VERSION);
    expect(client.requests[1]?.messages[0]?.content).toContain("上一次输出未通过服务端校验");
  });

  it("rejects puzzle generation after repeated invalid model payloads", async () => {
    const adapter = new ModelTurtleSoupAiAdapter(
      new FakeLanguageModelClient(
        JSON.stringify({
          title: "坏题",
          surface: "他沉默地坐着。",
          answer: "太短。",
          key_points: ["单点"],
          hints: ["提示"]
        })
      )
    );

    await expect(
      adapter.createPuzzle({ difficulty: "normal", tags: [], seed: "seed-2" })
    ).rejects.toThrow("海龟汤生成结果连续不合格");
  });

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
