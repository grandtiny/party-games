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
  const trimmed = endpoint.trim().replace(/\/$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

export function stripThinking(value: string): string {
  return value.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
