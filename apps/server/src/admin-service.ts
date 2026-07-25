import { performance } from "node:perf_hooks";
import type {
  AdminConfigResponse,
  AdminLlmConfigUpdateRequest,
  AdminLlmModelListRequest,
  AdminLlmModelListResponse,
  AdminLlmTestResponse,
  AdminTurtleSoupPromptConfigView,
  AdminTurtleSoupPromptUpdateRequest
} from "@party-games/shared";
import { AdminTurtleSoupPromptUpdateRequestSchema } from "@party-games/shared";
import { createSessionToken, hashPassword, hashSecret, verifyPassword } from "./auth.js";
import { SqliteRoomRepository } from "./repository.js";
import {
  OpenAICompatibleLanguageModelClient,
  listOpenAICompatibleModels,
  type LanguageModelClient,
  type LanguageModelConfig
} from "./language-model.js";
import {
  RulesLanguageModelAdapter,
  type LanguageModelAdapter
} from "./rules-assistant.js";
import {
  DEFAULT_TURTLE_SOUP_PROMPT_CONFIG,
  assertTurtleSoupPromptConfigUsable,
  type TurtleSoupPromptProvider
} from "./games/turtle-soup-prompts.js";

const LLM_SETTING_KEY = "platform.llm";
const LEGACY_LLM_SETTING_KEY = "clocktower.llm";
const TURTLE_SOUP_PROMPT_SETTING_KEY = "turtle-soup.prompts";
const ADMIN_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

interface StoredLanguageModelConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  storyModel?: string;
  judgeModel?: string;
  timeoutMs: number;
  apiKey?: string;
}

export class AdminService {
  readonly #sessions = new Map<string, number>();

  constructor(
    private readonly repository: SqliteRoomRepository,
    private readonly environment: NodeJS.ProcessEnv = process.env
  ) {}

  isInitialized(): boolean {
    return this.repository.hasAdminPassword();
  }

  isAuthenticated(token: string | undefined): boolean {
    if (!token) return false;
    this.#cleanupSessions();
    const expiresAt = this.#sessions.get(hashSecret(token));
    return typeof expiresAt === "number" && expiresAt > Date.now();
  }

  setup(password: string): string {
    if (!this.repository.initializeAdminPassword(hashPassword(password))) {
      throw new Error("管理员密码已经设置，请直接登录");
    }
    return this.#createSession();
  }

  login(password: string): string {
    const record = this.repository.getAdminPassword();
    if (!record || !verifyPassword(password, record)) throw new Error("管理员密码错误");
    return this.#createSession();
  }

  logout(token: string | undefined): void {
    if (token) this.#sessions.delete(hashSecret(token));
  }

  requireAuthentication(token: string | undefined): void {
    if (!this.isAuthenticated(token)) throw new Error("管理员会话无效，请重新登录");
  }

  changePassword(currentPassword: string, newPassword: string): string {
    const record = this.repository.getAdminPassword();
    if (!record || !verifyPassword(currentPassword, record)) {
      throw new Error("当前管理员密码错误");
    }
    this.repository.updateAdminPassword(hashPassword(newPassword));
    this.#sessions.clear();
    return this.#createSession();
  }

  getConfig(): AdminConfigResponse {
    const llm = this.#effectiveLanguageModelConfig();
    return {
      databaseSchemaVersion: this.repository.getSchemaVersion(),
      rulesRateLimitPerMinute: 20,
      llm: {
        enabled: llm.enabled,
        endpoint: llm.endpoint,
        model: llm.model,
        storyModel: llm.storyModel,
        judgeModel: llm.judgeModel,
        timeoutMs: llm.timeoutMs,
        hasApiKey: Boolean(llm.apiKey),
        ready: this.#isLanguageModelReady(llm),
        source: llm.source
      },
      turtleSoupPrompts: this.getTurtleSoupPromptConfig()
    };
  }

  updateLanguageModelConfig(input: AdminLlmConfigUpdateRequest): AdminConfigResponse {
    const existing = this.#storedLanguageModelConfig();
    const apiKey = input.clearApiKey
      ? ""
      : input.apiKey
        ? input.apiKey
        : existing && Object.prototype.hasOwnProperty.call(existing, "apiKey")
          ? existing.apiKey
          : undefined;
    const next: StoredLanguageModelConfig = {
      enabled: input.enabled,
      endpoint: input.endpoint,
      model: input.model,
      ...(input.storyModel !== undefined ? { storyModel: input.storyModel } : {}),
      ...(input.judgeModel !== undefined ? { judgeModel: input.judgeModel } : {}),
      timeoutMs: input.timeoutMs,
      ...(apiKey !== undefined ? { apiKey } : {})
    };
    const effective = this.#resolveLanguageModelConfig(next, "saved");
    if (effective.enabled && !this.#isLanguageModelReady(effective)) {
      throw new Error("启用大模型前需要填写接口地址、模型名称和 API Key");
    }
    this.repository.setSetting(LLM_SETTING_KEY, JSON.stringify(next));
    return this.getConfig();
  }

  async testLanguageModelConfig(
    input: AdminLlmConfigUpdateRequest
  ): Promise<AdminLlmTestResponse> {
    const existing = this.#storedLanguageModelConfig();
    const candidate: StoredLanguageModelConfig = {
      enabled: true,
      endpoint: input.endpoint,
      model: input.model,
      ...(input.storyModel !== undefined ? { storyModel: input.storyModel } : {}),
      ...(input.judgeModel !== undefined ? { judgeModel: input.judgeModel } : {}),
      timeoutMs: input.timeoutMs,
      ...(input.clearApiKey
        ? { apiKey: "" }
        : input.apiKey
          ? { apiKey: input.apiKey }
          : existing && Object.prototype.hasOwnProperty.call(existing, "apiKey")
            ? { apiKey: existing.apiKey }
            : {})
    };
    const config = this.#resolveLanguageModelConfig(candidate, "saved");
    if (!this.#isLanguageModelReady(config)) {
      throw new Error("测试连接需要接口地址、模型名称和 API Key");
    }
    const startedAt = performance.now();
    const answer = await new OpenAICompatibleLanguageModelClient(config).complete({
      purpose: "default",
      maxTokens: 16,
      messages: [{ role: "user", content: "请回复：连接成功" }]
    });
    return {
      ok: Boolean(answer),
      message: answer ? "连接成功，模型已返回内容" : "模型没有返回可用内容",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }

  async listLanguageModels(input: AdminLlmModelListRequest): Promise<AdminLlmModelListResponse> {
    const existing = this.#storedLanguageModelConfig();
    const effective = this.#effectiveLanguageModelConfig();
    const storedHasApiKey = existing && Object.prototype.hasOwnProperty.call(existing, "apiKey");
    const apiKey = input.clearApiKey
      ? ""
      : input.apiKey
        ? input.apiKey
        : storedHasApiKey
          ? existing?.apiKey ?? ""
          : effective.apiKey;
    const endpoint = input.endpoint || effective.endpoint;
    if (!endpoint.trim() || !apiKey.trim()) {
      throw new Error("拉取模型列表需要接口地址和 API Key");
    }
    const models = await listOpenAICompatibleModels({
      endpoint,
      apiKey,
      timeoutMs: input.timeoutMs
    });
    if (models.length === 0) throw new Error("模型接口未返回可用模型列表");
    return { models };
  }

  createLanguageModelAdapter(): LanguageModelAdapter {
    return new RulesLanguageModelAdapter(this.createLanguageModelClient());
  }

  getTurtleSoupPromptConfig(): AdminTurtleSoupPromptConfigView {
    const stored = this.#storedTurtleSoupPromptConfig();
    return {
      ...(stored ?? DEFAULT_TURTLE_SOUP_PROMPT_CONFIG),
      source: stored ? "saved" : "default"
    };
  }

  updateTurtleSoupPromptConfig(
    input: AdminTurtleSoupPromptUpdateRequest
  ): AdminConfigResponse {
    assertTurtleSoupPromptConfigUsable(input);
    this.repository.setSetting(TURTLE_SOUP_PROMPT_SETTING_KEY, JSON.stringify(input));
    return this.getConfig();
  }

  resetTurtleSoupPromptConfig(): AdminConfigResponse {
    this.repository.deleteSetting(TURTLE_SOUP_PROMPT_SETTING_KEY);
    return this.getConfig();
  }

  createTurtleSoupPromptProvider(): TurtleSoupPromptProvider {
    return () => {
      const { source: _source, ...config } = this.getTurtleSoupPromptConfig();
      return config;
    };
  }

  createLanguageModelClient(): LanguageModelClient {
    return {
      complete: async (input) => {
        const config = this.#effectiveLanguageModelConfig();
        if (!this.#isLanguageModelReady(config)) return undefined;
        return new OpenAICompatibleLanguageModelClient(config).complete(input);
      }
    };
  }

  close(): void {
    this.#sessions.clear();
  }

  clearSessions(): void {
    this.#sessions.clear();
  }

  #createSession(): string {
    const token = createSessionToken();
    this.#sessions.set(hashSecret(token), Date.now() + ADMIN_SESSION_LIFETIME_MS);
    return token;
  }

  #cleanupSessions(): void {
    const now = Date.now();
    for (const [tokenHash, expiresAt] of this.#sessions) {
      if (expiresAt <= now) this.#sessions.delete(tokenHash);
    }
  }

  #storedLanguageModelConfig(): StoredLanguageModelConfig | undefined {
    const stored =
      this.repository.getSetting(LLM_SETTING_KEY) ??
      this.repository.getSetting(LEGACY_LLM_SETTING_KEY);
    if (!stored) return undefined;
    try {
      return JSON.parse(stored) as StoredLanguageModelConfig;
    } catch {
      return undefined;
    }
  }

  #storedTurtleSoupPromptConfig(): AdminTurtleSoupPromptUpdateRequest | undefined {
    const stored = this.repository.getSetting(TURTLE_SOUP_PROMPT_SETTING_KEY);
    if (!stored) return undefined;
    try {
      const parsed = AdminTurtleSoupPromptUpdateRequestSchema.parse(JSON.parse(stored));
      assertTurtleSoupPromptConfigUsable(parsed);
      return parsed;
    } catch {
      return undefined;
    }
  }

  #effectiveLanguageModelConfig(): LanguageModelConfig & {
    source: "saved" | "environment" | "none";
  } {
    const stored = this.#storedLanguageModelConfig();
    if (stored) return this.#resolveLanguageModelConfig(stored, "saved");
    return this.#resolveLanguageModelConfig(
      undefined,
      this.#hasEnvironmentConfig() ? "environment" : "none"
    );
  }

  #resolveLanguageModelConfig(
    stored: StoredLanguageModelConfig | undefined,
    source: "saved" | "environment" | "none"
  ): LanguageModelConfig & { source: "saved" | "environment" | "none" } {
    const environmentEnabled = parseBoolean(
      this.environment.PARTY_GAMES_LLM_ENABLED ?? this.environment.CLOCKTOWER_LLM_ENABLED
    );
    const environmentEndpoint =
      this.environment.PARTY_GAMES_LLM_ENDPOINT?.trim() ??
      this.environment.CLOCKTOWER_LLM_ENDPOINT?.trim() ??
      "";
    const environmentApiKey =
      this.environment.PARTY_GAMES_LLM_API_KEY?.trim() ??
      this.environment.CLOCKTOWER_LLM_API_KEY?.trim() ??
      "";
    const environmentModel =
      this.environment.PARTY_GAMES_LLM_MODEL?.trim() ??
      this.environment.CLOCKTOWER_LLM_MODEL?.trim() ??
      "";
    const environmentStoryModel =
      this.environment.PARTY_GAMES_LLM_STORY_MODEL?.trim() ?? "";
    const environmentJudgeModel =
      this.environment.PARTY_GAMES_LLM_JUDGE_MODEL?.trim() ?? "";
    const environmentHasRequiredValues = Boolean(
      environmentEndpoint && environmentApiKey && environmentModel
    );
    const storedHasApiKey = stored && Object.prototype.hasOwnProperty.call(stored, "apiKey");
    const timeout = Number(
      stored?.timeoutMs ??
        this.environment.PARTY_GAMES_LLM_TIMEOUT_MS ??
        this.environment.CLOCKTOWER_LLM_TIMEOUT_MS ??
        8000
    );
    const model = stored?.model ?? environmentModel;
    return {
      enabled: stored?.enabled ?? environmentEnabled ?? environmentHasRequiredValues,
      endpoint: stored?.endpoint ?? environmentEndpoint,
      apiKey: storedHasApiKey
        ? stored?.apiKey ?? ""
        : environmentApiKey,
      model,
      storyModel: (stored?.storyModel ?? environmentStoryModel) || model,
      judgeModel: (stored?.judgeModel ?? environmentJudgeModel) || model,
      timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 8000,
      source
    };
  }

  #isLanguageModelReady(config: LanguageModelConfig): boolean {
    return Boolean(
      config.enabled && config.endpoint.trim() && config.apiKey.trim() && config.model.trim()
    );
  }

  #hasEnvironmentConfig(): boolean {
    return Boolean(
      this.environment.PARTY_GAMES_LLM_ENDPOINT?.trim() ||
      this.environment.PARTY_GAMES_LLM_API_KEY?.trim() ||
      this.environment.PARTY_GAMES_LLM_MODEL?.trim() ||
      this.environment.PARTY_GAMES_LLM_STORY_MODEL?.trim() ||
      this.environment.PARTY_GAMES_LLM_JUDGE_MODEL?.trim() ||
      this.environment.CLOCKTOWER_LLM_ENDPOINT?.trim() ||
      this.environment.CLOCKTOWER_LLM_API_KEY?.trim() ||
      this.environment.CLOCKTOWER_LLM_MODEL?.trim()
    );
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return undefined;
}
