import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const cleanupTasks: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanupTasks.splice(0).reverse()) await cleanup();
});

describe("admin settings", () => {
  it("initializes once, protects configuration, masks secrets and changes password", async () => {
    const { app } = await createTestApp();

    const initialStatus = await app.inject({ method: "GET", url: "/api/admin/status" });
    expect(initialStatus.json()).toEqual({
      initialized: false,
      authenticated: false,
      authenticationMode: "uninitialized"
    });
    expect(
      (await app.inject({ method: "GET", url: "/api/admin/config" })).statusCode
    ).toBe(401);

    const setupResults = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/admin/setup",
        payload: { password: "first-password" }
      }),
      app.inject({
        method: "POST",
        url: "/api/admin/setup",
        payload: { password: "second-password" }
      })
    ]);
    const successfulSetup = setupResults.find((response) => response.statusCode === 200);
    const initialPassword = setupResults[0]?.statusCode === 200
      ? "first-password"
      : "second-password";
    expect(setupResults.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(successfulSetup).toBeDefined();
    const cookie = sessionCookie(successfulSetup?.headers["set-cookie"]);
    expect(String(successfulSetup?.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(successfulSetup?.headers["set-cookie"])).toContain("SameSite=Strict");

    const configResponse = await app.inject({
      method: "GET",
      url: "/api/admin/config",
      headers: { cookie }
    });
    expect(configResponse.statusCode).toBe(200);
    expect(configResponse.json()).toMatchObject({
      databaseSchemaVersion: 4,
      llm: { enabled: false, hasApiKey: false, ready: false, source: "none" }
    });

    const savedConfig = await app.inject({
      method: "PUT",
      url: "/api/admin/config/llm",
      headers: { cookie },
      payload: {
        enabled: true,
        endpoint: "https://example.com/v1/chat/completions",
        model: "example-model",
        apiKey: "secret-api-key",
        timeoutMs: 5000
      }
    });
    expect(savedConfig.statusCode).toBe(200);
    expect(savedConfig.json()).toMatchObject({
      llm: { enabled: true, hasApiKey: true, ready: true, source: "saved" }
    });
    expect(savedConfig.body).not.toContain("secret-api-key");

    const passwordChange = await app.inject({
      method: "PUT",
      url: "/api/admin/password",
      headers: { cookie },
      payload: {
        currentPassword: initialPassword,
        newPassword: "updated-password"
      }
    });
    expect(passwordChange.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/admin/login",
          payload: { password: initialPassword }
        })
      ).statusCode
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/admin/login",
          payload: { password: "updated-password" }
        })
      ).statusCode
    ).toBe(200);
  });

  it("uses a saved OpenAI-compatible configuration for rule answers and connection tests", async () => {
    const modelServer = await createModelServer();
    const address = modelServer.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/v1/chat/completions`;
    const { app } = await createTestApp();
    const setup = await app.inject({
      method: "POST",
      url: "/api/admin/setup",
      payload: { password: "admin-password" }
    });
    const cookie = sessionCookie(setup.headers["set-cookie"]);
    const llmConfig = {
      enabled: true,
      endpoint,
      model: "test-model",
      storyModel: "story-model",
      judgeModel: "judge-model",
      apiKey: "test-key",
      timeoutMs: 3000
    };

    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/config/llm",
          headers: { cookie },
          payload: llmConfig
        })
      ).statusCode
    ).toBe(200);

    const testResponse = await app.inject({
      method: "POST",
      url: "/api/admin/config/llm/test",
      headers: { cookie },
      payload: llmConfig
    });
    expect(testResponse.statusCode).toBe(200);
    expect(testResponse.json()).toMatchObject({ ok: true });

    const answer = await app.inject({
      method: "POST",
      url: "/api/clocktower/rules/ask",
      payload: { question: "死亡玩家还能投票吗？" }
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toMatchObject({
      answer: "测试模型回答",
      source: "model"
    });
  });

  it("reads platform-level model configuration from environment variables", async () => {
    const { app } = await createTestApp({
      PARTY_GAMES_LLM_ENABLED: "true",
      PARTY_GAMES_LLM_ENDPOINT: "https://example.com/v1",
      PARTY_GAMES_LLM_API_KEY: "environment-key",
      PARTY_GAMES_LLM_MODEL: "default-model",
      PARTY_GAMES_LLM_STORY_MODEL: "story-model",
      PARTY_GAMES_LLM_JUDGE_MODEL: "judge-model"
    });
    const setup = await app.inject({
      method: "POST",
      url: "/api/admin/setup",
      payload: { password: "admin-password" }
    });
    const cookie = sessionCookie(setup.headers["set-cookie"]);

    const configResponse = await app.inject({
      method: "GET",
      url: "/api/admin/config",
      headers: { cookie }
    });

    expect(configResponse.statusCode).toBe(200);
    expect(configResponse.json()).toMatchObject({
      llm: {
        enabled: true,
        endpoint: "https://example.com/v1",
        model: "default-model",
        storyModel: "story-model",
        judgeModel: "judge-model",
        hasApiKey: true,
        ready: true,
        source: "environment"
      }
    });
    expect(configResponse.body).not.toContain("environment-key");
  });
});

async function createTestApp(environment: NodeJS.ProcessEnv = {}) {
  const directory = mkdtempSync(join(tmpdir(), "party-games-admin-test-"));
  const context = await createApp({
    databasePath: join(directory, "test.sqlite"),
    logger: false,
    environment
  });
  cleanupTasks.push(async () => {
    await context.app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return context;
}

async function createModelServer(): Promise<Server> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ message: { content: "测试模型回答" } }] })
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  cleanupTasks.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );
  return server;
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error("Admin session cookie missing");
  return value.split(";", 1)[0] ?? "";
}
