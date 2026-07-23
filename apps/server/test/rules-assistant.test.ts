import { describe, expect, it } from "vitest";
import { RulesAssistant, type LanguageModelAdapter } from "../src/rules-assistant.js";

describe("rules assistant", () => {
  it("answers role questions from local bundled references", async () => {
    const response = await new RulesAssistant().answer("僧侣能保护自己吗？");
    expect(response.source).toBe("local");
    expect(response.matchedRoleIds).toContain("monk");
    expect(response.answer).toContain("选择除自己以外");
  });

  it("answers general death vote questions locally", async () => {
    const response = await new RulesAssistant().answer("死亡玩家还可以投票吗？");
    expect(response.matchedRuleSectionIds).toContain("death");
    expect(response.answer).toContain("死亡票");
  });

  it("answers night order questions from the engine-backed reference", async () => {
    const response = await new RulesAssistant().answer("其他夜晚的行动顺序是什么？");
    expect(response.matchedRuleSectionIds).toContain("other-night-order");
    expect(response.answer).toContain("投毒者");
    expect(response.answer).toContain("僧侣");
    expect(response.answer).toContain("小恶魔");
    expect(response.answer).toContain("投毒者；僧侣；小恶魔；守鸦人");
  });

  it("uses an optional model answer when available", async () => {
    const adapter: LanguageModelAdapter = {
      answerRules: async () => "模型整理后的答案"
    };
    const response = await new RulesAssistant(adapter).answer("酒鬼是什么？");
    expect(response.source).toBe("model");
    expect(response.answer).toBe("模型整理后的答案");
  });

  it("falls back to local rules when the model fails", async () => {
    const adapter: LanguageModelAdapter = {
      answerRules: async () => {
        throw new Error("model offline");
      }
    };
    const response = await new RulesAssistant(adapter).answer("酒鬼是什么？");
    expect(response.source).toBe("local");
    expect(response.matchedRoleIds).toContain("drunk");
    expect(response.answer).toContain("酒鬼");
  });
});
