import type { TurtleSoupAnswerView, TurtleSoupDifficulty } from "@party-games/shared";
import type { LanguageModelClient } from "../language-model.js";
import type { TurtleSoupLogEntry, TurtleSoupPuzzleState } from "../domain.js";

export interface TurtleSoupCreateInput {
  tags: string[];
  difficulty: TurtleSoupDifficulty;
  seed: string;
}

export interface TurtleSoupQuestionInput {
  puzzle: TurtleSoupPuzzleState;
  question: string;
}

export interface TurtleSoupGuessInput {
  puzzle: TurtleSoupPuzzleState;
  guess: string;
}

export interface TurtleSoupHintInput {
  puzzle: TurtleSoupPuzzleState;
  foundKeyPointIds: string[];
  log: TurtleSoupLogEntry[];
}

export interface TurtleSoupQuestionJudgment {
  answer: TurtleSoupAnswerView;
  note?: string;
}

export interface TurtleSoupGuessJudgment {
  matchedKeyPointIds: string[];
  wrong: boolean;
  comment: string;
}

export interface TurtleSoupAiAdapter {
  createPuzzle(input: TurtleSoupCreateInput): Promise<TurtleSoupPuzzleState | undefined>;
  judgeQuestion(input: TurtleSoupQuestionInput): Promise<TurtleSoupQuestionJudgment | undefined>;
  judgeGuess(input: TurtleSoupGuessInput): Promise<TurtleSoupGuessJudgment | undefined>;
  createHint(input: TurtleSoupHintInput): Promise<string | undefined>;
}

export class ModelTurtleSoupAiAdapter implements TurtleSoupAiAdapter {
  constructor(private readonly client: LanguageModelClient) {}

  async createPuzzle(input: TurtleSoupCreateInput): Promise<TurtleSoupPuzzleState | undefined> {
    const text = await this.client.complete({
      purpose: "story",
      temperature: 0.85,
      json: true,
      enableThinking: true,
      messages: [
        {
          role: "user",
          content: storyPrompt(input)
        }
      ]
    });
    if (!text) return undefined;
    return normalizePuzzle(parseJson(text), input);
  }

  async judgeQuestion(
    input: TurtleSoupQuestionInput
  ): Promise<TurtleSoupQuestionJudgment | undefined> {
    const text = await this.client.complete({
      purpose: "judge",
      temperature: 0.1,
      json: true,
      enableThinking: true,
      messages: [
        {
          role: "system",
          content: questionPrompt(input)
        }
      ]
    });
    if (!text) return undefined;
    const data = parseJson(text);
    const answer = answerFromModel(data.res ?? data.answer);
    if (!answer) return undefined;
    const note = stringField(data.reason ?? data.note, 80);
    return { answer, ...(note ? { note } : {}) };
  }

  async judgeGuess(input: TurtleSoupGuessInput): Promise<TurtleSoupGuessJudgment | undefined> {
    const text = await this.client.complete({
      purpose: "judge",
      temperature: 0.1,
      json: true,
      enableThinking: true,
      messages: [
        {
          role: "system",
          content: guessPrompt(input)
        }
      ]
    });
    if (!text) return undefined;
    const data = parseJson(text);
    const achievedPointRefs = [
      ...arrayField(data.achieved_point_ids ?? data.achievedPointIds),
      ...arrayField(data.achieved_points ?? data.achievedPoints)
    ];
    const matchedKeyPointIds = mapAchievedPointRefs(input.puzzle, achievedPointRefs);
    const wrongSegments = arrayField(data.wrong_segments);
    const comment = stringField(data.comment, 32) || "继续推理";
    return {
      matchedKeyPointIds,
      wrong: wrongSegments.length > 0,
      comment
    };
  }

  async createHint(input: TurtleSoupHintInput): Promise<string | undefined> {
    const text = await this.client.complete({
      purpose: "judge",
      temperature: 0.45,
      maxTokens: 80,
      enableThinking: true,
      messages: [
        {
          role: "system",
          content: hintPrompt(input)
        }
      ]
    });
    return stringField(text, 60) || undefined;
  }
}

function storyPrompt(input: TurtleSoupCreateInput): string {
  const tags = input.tags.length > 0 ? input.tags.join("、") : "日常反常、悬疑、逻辑";
  const difficultyText =
    input.difficulty === "easy"
      ? "逻辑直观，线索较明显，适合团建破冰。"
      : input.difficulty === "hard"
        ? "核心诡计隐蔽，可以有复杂因果链，但不能依赖冷门专业知识。"
        : "标准海龟汤难度，需要侧向思维，可以有适度误导。";
  const keyPointCount = input.difficulty === "easy" ? "3-4" : input.difficulty === "hard" ? "6-8" : "4-6";
  return `你是一位侧向思维谜题大师。根据标签创作一个逻辑严密的海龟汤。

标签：${tags}
难度：${input.difficulty}，${difficultyText}
随机种子：${input.seed}

要求：
1. 汤面简洁、不剧透，以“为什么？”或“发生了什么？”结尾。
2. 汤底必须完整解释汤面中的所有反常点，避免纯巧合和不可验证超自然解释。
3. 标题要有悬疑感，但不能暗示核心诡计。
4. 提取 ${keyPointCount} 个真相要点，每个要点是独立、可验证的事实片段。
5. 给出 2-5 条渐进提示，提示不能直接说出答案。

严格返回 JSON：
{"title":"","surface":"","answer":"","key_points":[],"hints":[]}`;
}

function questionPrompt(input: TurtleSoupQuestionInput): string {
  return `你是一个海龟汤裁判。
【汤面】：${input.puzzle.surface}
【汤底】：${input.puzzle.answer}

任务：根据汤底回答玩家提问：“${input.question}”

判定准则：
1. 汤底是真相唯一依据，允许合理常识推断。
2. 只能回答“是”“不是”“无关”“是也不是”。
3. 问题部分正确、前提有误或涉及主观错觉时，回答“是也不是”。
4. 严禁剧透，reason 只能说明判定类型，不能透露未猜中的真相细节。

严格返回 JSON：{"res":"是|不是|无关|是也不是","reason":""}`;
}

function guessPrompt(input: TurtleSoupGuessInput): string {
  const keyPoints = input.puzzle.keyPoints.map((point) => ({
    id: point.id,
    text: point.text
  }));
  return `你是一个海龟汤裁判。
【汤面】：${input.puzzle.surface}
【汤底】：${input.puzzle.answer}
【真相要点表】：${JSON.stringify(keyPoints)}

任务：分析玩家推理：“${input.guess}”

判定规则：
1. 做语义匹配，不做死板字面匹配。
2. achieved_point_ids 只能填写真相要点表中的 id，且必须是玩家已经实质性猜中的要点。
3. achieved_points 兼容填写真相要点表中的原文；如果能返回 id，优先返回 achieved_point_ids。
4. wrong_segments 只能填写玩家输入中的原文片段，用于明显矛盾或完全错误的部分。
5. matched_segments 只能填写玩家输入中的原文片段，用于和真相吻合的部分。
6. 不要把模糊提问或纯假设强行判定为命中。
7. comment 不超过 15 个字，不能剧透未命中的真相。

严格返回 JSON：
{"matched_segments":[],"wrong_segments":[],"achieved_point_ids":[],"achieved_points":[],"comment":""}`;
}

function hintPrompt(input: TurtleSoupHintInput): string {
  const found = input.puzzle.keyPoints
    .filter((point) => input.foundKeyPointIds.includes(point.id))
    .map((point) => point.text);
  const unfound = input.puzzle.keyPoints
    .filter((point) => !input.foundKeyPointIds.includes(point.id))
    .map((point) => point.text);
  const recentQuestions = input.log
    .filter((entry) => entry.kind === "question")
    .slice(-5)
    .map((entry) => entry.content);
  const recentHints = input.log
    .filter((entry) => entry.kind === "hint")
    .slice(-5)
    .map((entry) => entry.content);
  return `你是一个海龟汤引导者。
【汤面】：${input.puzzle.surface}
【汤底】：${input.puzzle.answer}
【已猜中】：${found.length > 0 ? found.join("；") : "暂无"}
【未猜中】：${unfound.length > 0 ? unfound.join("；") : "已全部猜中"}
【近期提问】：${recentQuestions.length > 0 ? recentQuestions.join("；") : "暂无"}
【已有提示】：${recentHints.length > 0 ? recentHints.join("；") : "暂无"}

给一句反问式提示，引导玩家思考尚未猜中的要点。
要求：不剧透、不重复已有提示、不直接说答案，30 字以内。只输出提示正文。`;
}

function normalizePuzzle(data: Record<string, unknown>, input: TurtleSoupCreateInput): TurtleSoupPuzzleState {
  const title = stringField(data.title, 40);
  const surface = stringField(data.surface ?? data.puzzle, 300);
  const answer = stringField(data.answer, 1200);
  const keyPoints = arrayField(data.key_points ?? data.keyPoints)
    .map((text, index) => ({
      id: `kp-${index + 1}`,
      text
    }))
    .filter((point) => point.text.length > 0);
  if (!title || !surface || !answer || keyPoints.length < 2) {
    throw new Error("海龟汤生成结果缺少必要字段");
  }
  return {
    id: `model-${shortHash(`${input.seed}:${title}:${surface}`)}`,
    title,
    surface,
    answer,
    source: "model",
    maxHints: input.difficulty === "easy" ? 8 : input.difficulty === "hard" ? 2 : 5,
    keyPoints,
    hints: arrayField(data.hints).slice(0, 5)
  };
}

function parseJson(text: string): Record<string, unknown> {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("模型未返回 JSON");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function answerFromModel(value: unknown): TurtleSoupAnswerView | undefined {
  const text = String(value ?? "").trim();
  if (["是", "yes"].includes(text.toLowerCase())) return "yes";
  if (["不是", "否", "no"].includes(text.toLowerCase())) return "no";
  if (["无关", "irrelevant"].includes(text.toLowerCase())) return "irrelevant";
  if (["是也不是", "部分", "partial"].includes(text.toLowerCase())) return "partial";
  return undefined;
}

function mapAchievedPointRefs(
  puzzle: TurtleSoupPuzzleState,
  achievedPointRefs: readonly string[]
): string[] {
  const normalizedRefs = achievedPointRefs.map(normalize);
  const matched = new Set<string>();
  for (const point of puzzle.keyPoints) {
    const id = normalize(point.id);
    const text = normalize(point.text);
    if (
      normalizedRefs.some(
        (candidate) =>
          candidate === id ||
          candidate === text ||
          candidate.includes(text) ||
          text.includes(candidate)
      )
    ) {
      matched.add(point.id);
    }
  }
  return puzzle.keyPoints
    .filter((point) => matched.has(point.id))
    .map((point) => point.id);
}

function arrayField(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const text =
          stringField(item, 200) ||
          (isRecord(item)
            ? stringField(
                item.id ?? item.text ?? item.content ?? item.value ?? item.point,
                200
              )
            : "");
        return text ? [text] : [];
      })
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function shortHash(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}
