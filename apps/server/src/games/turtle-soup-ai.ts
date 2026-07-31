import type { TurtleSoupAnswerView, TurtleSoupDifficulty } from "@party-games/shared";
import type { LanguageModelClient } from "../language-model.js";
import type { TurtleSoupLogEntry, TurtleSoupPuzzleState } from "../domain.js";
import {
  DEFAULT_TURTLE_SOUP_PROMPT_CONFIG,
  renderTurtleSoupGuessPrompt,
  renderTurtleSoupHintPrompt,
  renderTurtleSoupQuestionPrompt,
  renderTurtleSoupStoryPrompt,
  type TurtleSoupPromptProvider
} from "./turtle-soup-prompts.js";

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
  constructor(
    private readonly client: LanguageModelClient,
    private readonly promptProvider: TurtleSoupPromptProvider = () =>
      DEFAULT_TURTLE_SOUP_PROMPT_CONFIG
  ) {}

  async createPuzzle(input: TurtleSoupCreateInput): Promise<TurtleSoupPuzzleState | undefined> {
    let validationError = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompts = await this.promptProvider();
      const text = await this.client.complete({
        purpose: "story",
        temperature: 0.85,
        json: true,
        enableThinking: true,
        messages: [
          {
            role: "user",
            content: renderTurtleSoupStoryPrompt(
              prompts,
              input,
              attempt === 0 ? "" : validationError
            )
          }
        ]
      });
      if (!text) return undefined;
      try {
        return normalizePuzzle(parseJson(text), input);
      } catch (cause) {
        validationError = errorMessage(cause);
      }
    }
    throw new Error(`海龟汤生成结果连续不合格: ${validationError || "unknown validation error"}`);
  }

  async judgeQuestion(
    input: TurtleSoupQuestionInput
  ): Promise<TurtleSoupQuestionJudgment | undefined> {
    const prompts = await this.promptProvider();
    const text = await this.client.complete({
      purpose: "judge",
      temperature: 0.1,
      json: true,
      enableThinking: true,
      messages: [
        {
          role: "system",
          content: renderTurtleSoupQuestionPrompt(prompts, input)
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
    const prompts = await this.promptProvider();
    const text = await this.client.complete({
      purpose: "judge",
      temperature: 0.1,
      json: true,
      enableThinking: true,
      messages: [
        {
          role: "system",
          content: renderTurtleSoupGuessPrompt(prompts, input)
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
    const prompts = await this.promptProvider();
    const text = await this.client.complete({
      purpose: "judge",
      temperature: 0.45,
      maxTokens: 80,
      enableThinking: true,
      messages: [
        {
          role: "system",
          content: renderTurtleSoupHintPrompt(prompts, input)
        }
      ]
    });
    return stringField(text, 60) || undefined;
  }
}

function normalizePuzzle(data: Record<string, unknown>, input: TurtleSoupCreateInput): TurtleSoupPuzzleState {
  const title = stringField(data.title, 40);
  const surface = stringField(data.surface ?? data.puzzle, 300);
  const answer = stringField(data.answer, 1200);
  const keyPoints = uniqueStrings(arrayField(data.key_points ?? data.keyPoints), 80)
    .map((text, index) => ({
      id: `kp-${index + 1}`,
      text
    }))
    .filter((point) => point.text.length > 0);
  const hints = uniqueStrings(arrayField(data.hints), 60).slice(0, 5);
  const keyPointRange = keyPointRangeFor(input.difficulty);
  if (!title || !surface || !answer) {
    throw new Error("海龟汤生成结果缺少必要字段");
  }
  if (!isQuestionLikeSurface(surface)) {
    throw new Error("汤面必须以明确的问题收束");
  }
  if (answer.length < 30) {
    throw new Error("汤底过短，无法支撑推理");
  }
  if (keyPoints.length < keyPointRange.min || keyPoints.length > keyPointRange.max) {
    throw new Error(
      `真相要点数量必须在 ${keyPointRange.min} 到 ${keyPointRange.max} 个之间`
    );
  }
  if (hints.length < 2) {
    throw new Error("至少需要 2 条渐进提示");
  }
  return {
    id: `model-${shortHash(`${input.seed}:${title}:${surface}`)}`,
    title,
    surface,
    answer,
    source: "model",
    maxHints: input.difficulty === "easy" ? 8 : input.difficulty === "hard" ? 2 : 5,
    keyPoints,
    hints
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

function uniqueStrings(values: readonly string[], maxLength: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim().slice(0, maxLength);
    if (!text) continue;
    const key = normalize(text);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function keyPointRangeFor(difficulty: TurtleSoupDifficulty): { min: number; max: number } {
  if (difficulty === "easy") return { min: 3, max: 4 };
  if (difficulty === "hard") return { min: 6, max: 8 };
  return { min: 4, max: 6 };
}

function isQuestionLikeSurface(surface: string): boolean {
  const trimmed = surface.trim();
  return (
    trimmed.endsWith("?") ||
    trimmed.endsWith("？") ||
    trimmed.includes("为什么") ||
    trimmed.includes("发生了什么")
  );
}

function shortHash(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "unknown validation error";
}
