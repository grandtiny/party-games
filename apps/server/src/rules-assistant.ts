import {
  TROUBLE_BREWING_REFERENCE_ROLES,
  TROUBLE_BREWING_RULES_REFERENCE
} from "@party-games/clocktower";
import type { RulesAnswerResponse } from "@party-games/shared";

export interface LanguageModelAdapter {
  answerRules(input: { question: string; references: string }): Promise<string | undefined>;
}

export interface LanguageModelConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class OpenAICompatibleLanguageModelAdapter implements LanguageModelAdapter {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs = 8000
  ) {}

  async answerRules(input: { question: string; references: string }): Promise<string | undefined> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是血染钟楼暗流涌动规则助手。只能依据提供的本地资料回答，不推测当前房间隐藏身份，不参与任何游戏裁定。回答使用简洁中文。"
          },
          {
            role: "user",
            content: `问题：${input.question}\n\n本地资料：\n${input.references}`
          }
        ]
      }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    if (!response.ok) throw new Error(`Language model returned HTTP ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content?.trim() || undefined;
  }
}

export class RulesAssistant {
  readonly #cache = new Map<string, RulesAnswerResponse>();

  constructor(private readonly modelAdapter?: LanguageModelAdapter) {}

  async answer(question: string): Promise<RulesAnswerResponse> {
    const cacheKey = normalize(question);
    const cached = this.#cache.get(cacheKey);
    if (cached) return structuredClone(cached);
    const local = localRulesAnswer(question);
    if (!this.modelAdapter) return this.#remember(cacheKey, local);

    try {
      const modelAnswer = await this.modelAdapter.answerRules({
        question,
        references: local.answer
      });
      if (modelAnswer) {
        return this.#remember(cacheKey, { ...local, answer: modelAnswer, source: "model" });
      }
    } catch {
      // The deterministic local answer remains available when the optional model fails.
    }
    return this.#remember(cacheKey, local);
  }

  clearCache(): void {
    this.#cache.clear();
  }

  #remember(key: string, response: RulesAnswerResponse): RulesAnswerResponse {
    if (this.#cache.size >= 100) {
      const oldestKey = this.#cache.keys().next().value as string | undefined;
      if (oldestKey) this.#cache.delete(oldestKey);
    }
    this.#cache.set(key, structuredClone(response));
    return response;
  }
}

export function createLanguageModelAdapterFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): LanguageModelAdapter | undefined {
  const endpoint = environment.CLOCKTOWER_LLM_ENDPOINT?.trim();
  const apiKey = environment.CLOCKTOWER_LLM_API_KEY?.trim();
  const model = environment.CLOCKTOWER_LLM_MODEL?.trim();
  if (!endpoint || !apiKey || !model) return undefined;
  const timeout = Number(environment.CLOCKTOWER_LLM_TIMEOUT_MS ?? 8000);
  return new OpenAICompatibleLanguageModelAdapter(
    endpoint,
    apiKey,
    model,
    Number.isFinite(timeout) && timeout > 0 ? timeout : 8000
  );
}

function localRulesAnswer(question: string): RulesAnswerResponse {
  const normalizedQuestion = normalize(question);
  const terms = questionTerms(normalizedQuestion);
  const roleScores = TROUBLE_BREWING_REFERENCE_ROLES.map((role) => {
    const exactNames = [normalize(role.name), normalize(role.englishName), normalize(role.id)];
    const document = normalize(
      [
        role.name,
        role.englishName,
        role.ability,
        role.guide.overview,
        role.guide.timing,
        ...role.guide.rules,
        ...role.guide.notes
      ].join(" ")
    );
    const exactScore = exactNames.some((name) => name && normalizedQuestion.includes(name)) ? 30 : 0;
    return { role, exact: exactScore > 0, score: exactScore + scoreDocument(document, terms) };
  }).sort((left, right) => right.score - left.score);

  const sectionKeywords: Record<string, string[]> = {
    objective: ["获胜", "胜利", "输赢", "阵营", "恶魔死亡", "两人存活"],
    night: ["夜晚", "夜间", "夜序", "唤醒"],
    "first-night-order": ["首夜顺序", "首夜夜序", "首夜行动", "首夜先后"],
    "other-night-order": ["夜间顺序", "夜晚顺序", "夜序", "行动顺序", "谁先行动"],
    day: ["白天", "讨论", "声明", "聊天"],
    nomination: ["提名", "投票", "处决", "过半", "平票", "举手"],
    death: ["死亡", "死者", "死亡票", "出局", "鬼票"],
    malfunction: ["醉酒", "酒鬼", "中毒", "投毒", "能力失效", "错误信息"],
    registration: ["登记", "隐士", "间谍", "视为", "注册"]
  };
  const sectionScores = TROUBLE_BREWING_RULES_REFERENCE.map((section) => {
    const document = normalize([section.title, section.summary, ...section.points].join(" "));
    const keywordScore = (sectionKeywords[section.id] ?? []).reduce(
      (score, keyword) => score + (normalizedQuestion.includes(normalize(keyword)) ? 12 : 0),
      0
    );
    return { section, score: keywordScore + scoreDocument(document, terms) };
  }).sort((left, right) => right.score - left.score);

  const topRoleScore = roleScores[0]?.score ?? 0;
  const matchedRoles = roleScores
    .filter(
      ({ exact, score }) =>
        exact || (score >= 18 && score >= Math.max(12, topRoleScore * 0.65))
    )
    .slice(0, 2)
    .map(({ role }) => role);
  const topSectionScore = sectionScores[0]?.score ?? 0;
  const matchedSections = sectionScores
    .filter(({ score }) => score > 0 && score >= Math.max(6, topSectionScore * 0.55))
    .slice(0, 2)
    .map(({ section }) => section);

  const answerParts: string[] = [];
  for (const role of matchedRoles) {
    answerParts.push(
      `${role.name}：${role.ability}\n${role.guide.overview}\n${role.guide.rules.join("；")}`
    );
  }
  for (const section of matchedSections) {
    answerParts.push(`${section.title}：${section.summary}\n${section.points.join("；")}`);
  }
  if (answerParts.length === 0) {
    const objective = TROUBLE_BREWING_RULES_REFERENCE[0];
    if (objective) {
      answerParts.push(`${objective.title}：${objective.summary}\n${objective.points.join("；")}`);
    }
  }

  return {
    answer: answerParts.join("\n\n"),
    source: "local",
    matchedRoleIds: matchedRoles.map((role) => role.id),
    matchedRuleSectionIds: matchedSections.map((section) => section.id)
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function questionTerms(question: string): string[] {
  const characters = Array.from(question);
  const terms = new Set<string>();
  for (let index = 0; index < characters.length; index += 1) {
    const current = characters[index];
    const next = characters[index + 1];
    if (current) terms.add(current);
    if (current && next) terms.add(`${current}${next}`);
  }
  return [...terms].filter((term) => term.length > 0);
}

function scoreDocument(document: string, terms: readonly string[]): number {
  return terms.reduce((score, term) => score + (document.includes(term) ? term.length : 0), 0);
}
