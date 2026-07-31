import {
  TURTLE_SOUP_PROMPT_VERSION,
  type AdminTurtleSoupPromptUpdateRequest,
  type TurtleSoupDifficulty
} from "@party-games/shared";
import type { TurtleSoupLogEntry, TurtleSoupPuzzleState } from "../domain.js";

export type TurtleSoupPromptConfig = AdminTurtleSoupPromptUpdateRequest;
export type TurtleSoupPromptProvider = () =>
  | TurtleSoupPromptConfig
  | Promise<TurtleSoupPromptConfig>;

interface TurtleSoupCreatePromptInput {
  tags: string[];
  difficulty: TurtleSoupDifficulty;
  seed: string;
}

interface TurtleSoupQuestionPromptInput {
  puzzle: TurtleSoupPuzzleState;
  question: string;
}

interface TurtleSoupGuessPromptInput {
  puzzle: TurtleSoupPuzzleState;
  guess: string;
}

interface TurtleSoupHintPromptInput {
  puzzle: TurtleSoupPuzzleState;
  foundKeyPointIds: string[];
  log: TurtleSoupLogEntry[];
}

type PromptValues = Record<string, string>;

export const DEFAULT_TURTLE_SOUP_PROMPT_CONFIG: TurtleSoupPromptConfig = {
  version: TURTLE_SOUP_PROMPT_VERSION,
  story: `Prompt 版本：{{promptVersion}}
【角色设定】
你是一位精通海龟汤（情境猜谜）创作的大师。你将严格遵循以下指引，创作出令人拍案叫绝的谜题。若用户未特别指定，默认创作基调为“本格”。

标签：{{tags}}
难度：{{difficulty}}，{{difficultyText}}
随机种子：{{seed}}

【核心原则】
1. 唯一真相：汤底必须能够唯一、完整地解释汤面中呈现的所有离奇现象，不存在第二种同样合理的解释。
2. 严丝合缝：汤面中出现的每一个细节（物品、动作、颜色、数字、环境等）在汤底中都必须有对应的、逻辑必然的解释，不得有废笔。
3. 可推理性：谜题必须仅凭汤面信息与“是/否/无关”的回答就能在理论上被玩家完全推理还原，不依赖特定小众知识或创作者脑洞。
4. 情理之中，意料之外：汤底揭示时玩家应感到惊讶，但立即觉得完全合理，所有线索全部指向它。
5. 叙述诚实性：汤面可以是受限视角，可以因视角产生描述偏差，但不可凭空捏造客观事实。若存在不可靠叙述，必须在汤面中埋藏可识别的逻辑矛盾或视角线索。
6. 角色行为动机合理性：每个角色的关键行动都必须具备清晰、符合人性的底层逻辑动机，杜绝只为制造悬疑而存在的情节工具人。

【基调选择（本格/变格）】
请在创作前明确选择基调，它将决定谜题的世界观边界：
- 本格：完全遵循现实世界物理、生物、心理及社会逻辑。禁止出现任何超自然力量、魔法、鬼魂、时空穿越、预言、读心等非现实元素。
- 变格：允许引入科幻、奇幻、恐怖、超自然、梦境、虚拟现实、时间循环等非现实设定。这些设定必须作为故事背景的有机部分，通过角色经历、感受和情节推进自然流露。所有离奇情节须严格遵循这套内在逻辑，不允许临时追加规则或自相矛盾。

【汤面形式类型】
根据标签和难度，从以下形式中选择一种：陈述式、第一人称叙述式、对话/独白式、文档式、公告/指令式。

【汤面文体要求】
1. 篇幅：短小精悍，中文汤面控制在 50 至 200 字之间。
2. 语言：白描为主，多用名词与动词，杜绝“诡异”“恐怖”“奇怪”等主观评价性词语。
3. 留白：刻意隐藏关键信息，只呈现最令人困惑的表象片段。
4. 线索埋设：至少包含 3 个以上硬逻辑线索，它们单看正常，结合汤底才显现含义。
5. 氛围：通过细节反差或平静描述下隐含的异常，营造认知冲突。

【创作要求】
1. 先创作汤底：完整写出真相全文，包含确切人物关系、核心动机、事件全过程、关键转折与最终状态。汤底必须完整自洽。
2. 动机构建：为每个角色的反常行为内省心理根源，形成“想要什么→为什么想要→所以做了什么”的闭环。
3. 后提炼汤面：从汤底中切割出时间线上最令人困惑、最能隐藏核心真相的片段。
4. 线索与红鲱鱼：汤面中必须至少包含 3 个以上硬逻辑线索；可以设置 1~2 个自然形成的误导，但必须能在汤底中完全解释。
5. 可问答性：预判玩家可能提出的“是否”问题，确保汤底对汤面涉及的一切可提问点都有清晰的是/否/无关答案。
6. 惊奇感：汤底应具有强烈反转或揭示感，例如身份错位、时间错觉、因果倒置、语义重解等。
7. 变格处理原则：变格元素绝不单独以“设定：xxx”或“规则：xxx”的形式列出，应通过人物所见、所为、所感自然带出。

【服务端契约】
1. 真相要点数量必须为 {{keyPointCount}} 个，每个要点是独立、可验证的事实片段。
2. 渐进提示 hints 必须给出 2 至 5 条，每条不直接说出答案。
3. surface 必须以明确问题收束，例如“为什么？”或“发生了什么？”。
4. answer 不少于 30 个中文字符。

【逻辑自检】
创作完成后，必须逐条完成以下自检，任何一项未通过都需回炉修改：
- 覆盖性检查：汤面每一句话、每个物件、每个行为，在汤底中是否都有必要作用？
- 一致性检查：汤底与汤面在时间顺序、人物状态、物理可能性上是否存在矛盾？
- 动机与行为深度检查：每个行为是否源于角色自身性格、过往经历和当前处境下的真实需求？
- 本格封闭性检查（本格题必检）：是否能用完全现实的理由解释所有现象？
- 变格自然融贯检查（变格题必检）：非现实现象是否前后逻辑一致，并通过具体情节和角色体验展现？
- 可推理检查：只给汤面并回答是/否，普通逻辑能力玩家能否在合理时间内推导出全部真相？
- 歧义与梗检查：核心反转是否依赖谐音、多义字或极小众文化背景？
- 重读验证：揭示汤底后再读汤面，是否所有困惑都能通透解释？

【格式要求】
严格返回 JSON：{"title":"","surface":"","answer":"","key_points":[],"hints":[]}`,
  question: `Prompt 版本：{{promptVersion}}
你是一个海龟汤裁判。
【汤面】：{{surface}}
【汤底】：{{answer}}

任务：根据汤底回答玩家提问：“{{question}}”

判定准则：
1. 汤底是真相唯一依据，允许合理常识推断。
2. 只能回答“是”“不是”“无关”“是也不是”。
3. 问题部分正确、前提有误或涉及主观错觉时，回答“是也不是”。
4. 严禁剧透，reason 只能说明判定类型，不能透露未猜中的真相细节。

严格返回 JSON：{"res":"是|不是|无关|是也不是","reason":""}`,
  guess: `Prompt 版本：{{promptVersion}}
你是一个海龟汤裁判。
【汤面】：{{surface}}
【汤底】：{{answer}}
【真相要点表】：{{keyPointsJson}}

任务：分析玩家推理：“{{guess}}”

判定规则：
1. 做语义匹配，不做死板字面匹配。
2. achieved_point_ids 只能填写真相要点表中的 id，且必须是玩家已经实质性猜中的要点。
3. achieved_points 兼容填写真相要点表中的原文；如果能返回 id，优先返回 achieved_point_ids。
4. wrong_segments 只能填写玩家输入中的原文片段，用于明显矛盾或完全错误的部分。
5. matched_segments 只能填写玩家输入中的原文片段，用于和真相吻合的部分。
6. 不要把模糊提问或纯假设强行判定为命中。
7. comment 不超过 15 个字，不能剧透未命中的真相。

严格返回 JSON：{"matched_segments":[],"wrong_segments":[],"achieved_point_ids":[],"achieved_points":[],"comment":""}`,
  hint: `Prompt 版本：{{promptVersion}}
你是一个海龟汤引导者。
【汤面】：{{surface}}
【汤底】：{{answer}}
【已猜中】：{{foundKeyPoints}}
【未猜中】：{{unfoundKeyPoints}}
【近期提问】：{{recentQuestions}}
【已有提示】：{{recentHints}}

给一句反问式提示，引导玩家思考尚未猜中的要点。
要求：不剧透、不重复已有提示、不直接说答案，30 字以内。只输出提示正文。`
};

export function renderTurtleSoupStoryPrompt(
  config: TurtleSoupPromptConfig,
  input: TurtleSoupCreatePromptInput,
  validationError = ""
): string {
  const prompt = renderTemplate(config.story, {
    ...baseValues(config.version),
    ...createValues(input),
    validationError
  });
  if (!validationError) return prompt;
  return `${prompt}

上一次输出未通过服务端校验：${validationError}
请重新生成一题，不要解释错误原因，只返回符合契约的 JSON。`;
}

export function renderTurtleSoupQuestionPrompt(
  config: TurtleSoupPromptConfig,
  input: TurtleSoupQuestionPromptInput
): string {
  return renderTemplate(config.question, {
    ...baseValues(config.version),
    surface: input.puzzle.surface,
    answer: input.puzzle.answer,
    question: input.question
  });
}

export function renderTurtleSoupGuessPrompt(
  config: TurtleSoupPromptConfig,
  input: TurtleSoupGuessPromptInput
): string {
  const keyPoints = input.puzzle.keyPoints.map((point) => ({
    id: point.id,
    text: point.text
  }));
  return renderTemplate(config.guess, {
    ...baseValues(config.version),
    surface: input.puzzle.surface,
    answer: input.puzzle.answer,
    keyPointsJson: JSON.stringify(keyPoints),
    guess: input.guess
  });
}

export function renderTurtleSoupHintPrompt(
  config: TurtleSoupPromptConfig,
  input: TurtleSoupHintPromptInput
): string {
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
  return renderTemplate(config.hint, {
    ...baseValues(config.version),
    surface: input.puzzle.surface,
    answer: input.puzzle.answer,
    foundKeyPoints: found.length > 0 ? found.join("；") : "暂无",
    unfoundKeyPoints: unfound.length > 0 ? unfound.join("；") : "已全部猜中",
    recentQuestions: recentQuestions.length > 0 ? recentQuestions.join("；") : "暂无",
    recentHints: recentHints.length > 0 ? recentHints.join("；") : "暂无"
  });
}

export function assertTurtleSoupPromptConfigUsable(
  config: TurtleSoupPromptConfig
): void {
  const errors = [
    ...missingPlaceholders("故事提示词", config.story, [
      "promptVersion",
      "tags",
      "difficulty",
      "difficultyText",
      "seed",
      "keyPointCount"
    ]),
    ...missingText("故事提示词", config.story, [
      "title",
      "surface",
      "answer",
      "key_points",
      "hints"
    ]),
    ...missingPlaceholders("提问裁判提示词", config.question, [
      "promptVersion",
      "surface",
      "answer",
      "question"
    ]),
    ...missingText("提问裁判提示词", config.question, ["res", "reason"]),
    ...missingPlaceholders("猜底裁判提示词", config.guess, [
      "promptVersion",
      "surface",
      "answer",
      "keyPointsJson",
      "guess"
    ]),
    ...missingText("猜底裁判提示词", config.guess, [
      "achieved_point_ids",
      "wrong_segments",
      "comment"
    ]),
    ...missingPlaceholders("提示生成提示词", config.hint, [
      "promptVersion",
      "surface",
      "answer",
      "foundKeyPoints",
      "unfoundKeyPoints"
    ])
  ];
  if (errors.length > 0) {
    throw new Error(`海龟汤提示词配置不可用：${errors.join("；")}`);
  }
}

function createValues(input: TurtleSoupCreatePromptInput): PromptValues {
  const tags = input.tags.length > 0 ? input.tags.join("、") : "日常反常、悬疑、逻辑";
  const difficultyText =
    input.difficulty === "easy"
      ? "逻辑直观，线索较明显，适合团建破冰。"
      : input.difficulty === "hard"
        ? "核心诡计隐蔽，可以有复杂因果链，但不能依赖冷门专业知识。"
        : "标准海龟汤难度，需要侧向思维，可以有适度误导。";
  const keyPointCount =
    input.difficulty === "easy" ? "3-4" : input.difficulty === "hard" ? "6-8" : "4-6";
  return {
    tags,
    difficulty: input.difficulty,
    difficultyText,
    keyPointCount,
    seed: input.seed
  };
}

function baseValues(version: string): PromptValues {
  return { promptVersion: version };
}

function renderTemplate(template: string, values: PromptValues): string {
  return template.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (match, key: string) =>
    values[key] ?? match
  );
}

function missingPlaceholders(
  label: string,
  template: string,
  placeholders: readonly string[]
): string[] {
  return placeholders
    .filter((placeholder) => !template.includes(`{{${placeholder}}}`))
    .map((placeholder) => `${label}缺少 {{${placeholder}}}`);
}

function missingText(label: string, template: string, values: readonly string[]): string[] {
  return values
    .filter((value) => !template.includes(value))
    .map((value) => `${label}缺少 ${value} 契约`);
}
