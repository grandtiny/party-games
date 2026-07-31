export interface LanguageModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type LanguageModelPurpose = "default" | "story" | "judge";

export interface LanguageModelConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  storyModel: string;
  judgeModel: string;
  timeoutMs: number;
}

export interface LanguageModelListConfig {
  endpoint: string;
  apiKey: string;
  timeoutMs: number;
}

export interface LanguageModelInfo {
  id: string;
  ownedBy?: string;
}

export interface LanguageModelCompletionInput {
  purpose?: LanguageModelPurpose;
  messages: LanguageModelMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  enableThinking?: boolean;
}

export interface LanguageModelClient {
  complete(input: LanguageModelCompletionInput): Promise<string | undefined>;
}

export class OpenAICompatibleLanguageModelClient implements LanguageModelClient {
  constructor(private readonly config: LanguageModelConfig) {}

  async complete(input: LanguageModelCompletionInput): Promise<string | undefined> {
    const model = this.#modelFor(input.purpose ?? "default");
    const response = await fetch(completionEndpoint(this.config.endpoint), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        ...(input.maxTokens === undefined ? {} : { max_tokens: input.maxTokens }),
        ...(input.json ? { response_format: { type: "json_object" } } : {}),
        ...(input.enableThinking ? { enable_thinking: true } : {})
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });
    if (!response.ok) throw new Error(`Language model returned HTTP ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return stripThinking(payload.choices?.[0]?.message?.content ?? "").trim() || undefined;
  }

  #modelFor(purpose: LanguageModelPurpose): string {
    if (purpose === "story") return this.config.storyModel || this.config.model;
    if (purpose === "judge") return this.config.judgeModel || this.config.model;
    return this.config.model;
  }
}

export function completionEndpoint(endpoint: string): string {
  return `${baseEndpoint(endpoint)}/chat/completions`;
}

export function modelsEndpoint(endpoint: string): string {
  return `${baseEndpoint(endpoint)}/models`;
}

export async function listOpenAICompatibleModels(
  config: LanguageModelListConfig
): Promise<LanguageModelInfo[]> {
  const response = await fetch(modelsEndpoint(config.endpoint), {
    method: "GET",
    headers: {
      authorization: `Bearer ${config.apiKey}`
    },
    signal: AbortSignal.timeout(config.timeoutMs)
  });
  if (!response.ok) throw new Error(`Language model returned HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  return normalizeModelList(payload);
}

export function stripThinking(value: string): string {
  return value.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function baseEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions")
    ? trimmed.slice(0, -"/chat/completions".length)
    : trimmed;
}

function normalizeModelList(payload: unknown): LanguageModelInfo[] {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : isRecord(payload) && Array.isArray(payload.models)
        ? payload.models
        : [];
  const models = new Map<string, LanguageModelInfo>();
  for (const item of items) {
    const id =
      typeof item === "string"
        ? item
        : isRecord(item) && typeof item.id === "string"
          ? item.id
          : "";
    const trimmedId = id.trim();
    if (!trimmedId) continue;
    const ownedBy =
      isRecord(item) && typeof item.owned_by === "string"
        ? item.owned_by.trim()
        : isRecord(item) && typeof item.ownedBy === "string"
          ? item.ownedBy.trim()
          : "";
    models.set(trimmedId, {
      id: trimmedId,
      ...(ownedBy ? { ownedBy } : {})
    });
  }
  return [...models.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
