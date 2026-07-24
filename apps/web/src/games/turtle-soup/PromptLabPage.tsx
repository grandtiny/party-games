import { FlaskConical, Play, RefreshCw, Save, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../platform/AppShell";

type LabMode = "ask" | "guess" | "hint" | "story";

interface LabConfig {
  base: string;
  key: string;
  storyModel: string;
  fastModel: string;
}

const LABYRINTH_CONFIG_KEY = "labyrinth_cfg";

const DEFAULT_CONFIG: LabConfig = {
  base: "",
  key: "",
  storyModel: "",
  fastModel: ""
};

const DEFAULT_SURFACE =
  "一个人每天坐电梯回家，晴天总要提前几层下电梯再爬楼梯，雨天却能直接坐到家门口。为什么？";
const DEFAULT_ANSWER =
  "这个人个子很矮，平时够不到自己家的高楼层按钮，只能按到较低楼层再走楼梯。雨天他带着伞，可以用伞尖按到更高的楼层按钮，所以能直接到家。";
const DEFAULT_KEY_POINTS = "个子很矮\n够不到高楼层按钮\n雨天可以用伞按按钮";

export function TurtleSoupPromptLabPage() {
  const [config, setConfig] = useState<LabConfig>(() => loadConfig());
  const [mode, setMode] = useState<LabMode>("ask");
  const [surface, setSurface] = useState(DEFAULT_SURFACE);
  const [answer, setAnswer] = useState(DEFAULT_ANSWER);
  const [keyPoints, setKeyPoints] = useState(DEFAULT_KEY_POINTS);
  const [question, setQuestion] = useState("他是不是个子比较矮？");
  const [guess, setGuess] = useState("他太矮按不到按钮，下雨时用伞按到了。");
  const [tags, setTags] = useState("雨天, 电梯, 反常行为");
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const activePrompt = useMemo(
    () =>
      customPrompt.trim() ||
      promptForMode(mode, {
        surface,
        answer,
        keyPoints,
        question,
        guess,
        tags
      }),
    [answer, customPrompt, guess, keyPoints, mode, question, surface, tags]
  );

  const save = () => {
    localStorage.setItem(LABYRINTH_CONFIG_KEY, JSON.stringify(config));
    setMessage("原版浏览器 Key 配置已保存");
    setError(undefined);
  };

  const run = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    setResult("");
    try {
      const model = mode === "story" ? config.storyModel : config.fastModel || config.storyModel;
      const output = await runBrowserCompletion(config, model, activePrompt, mode === "story");
      setResult(output);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "测试失败");
    } finally {
      setBusy(false);
    }
  };

  const scanModels = async () => {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const models = await fetchModels(config);
      setMessage(`扫描到 ${models.length} 个模型：${models.slice(0, 6).join(" / ")}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "扫描失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      scope="turtle-soup"
      title="海龟汤提示词测试"
      backTo="/turtle-soup"
      actions={
        <Link className="reference-button" to="/turtle-soup">
          <FlaskConical size={16} />
          返回入口
        </Link>
      }
    >
      <div className="turtle-lab">
        <section className="turtle-lab-section">
          <div className="settings-section__heading">
            <FlaskConical size={23} />
            <div>
              <h1>原版浏览器直连</h1>
              <span className="config-state is-ready">测试线</span>
            </div>
          </div>
          <div className="turtle-lab-provider-note">
            平台级大模型链路预留给正式环境；当前页面保留原版 Base URL / API Key / 双模型配置，Key 仅保存在本浏览器。
          </div>
          <div className="settings-form settings-form--wide">
            <label>
              Base URL
              <input
                value={config.base}
                onChange={(event) => setConfig({ ...config, base: event.target.value })}
                placeholder="https://api.deepseek.com/v1"
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={config.key}
                onChange={(event) => setConfig({ ...config, key: event.target.value })}
                autoComplete="off"
              />
            </label>
            <div className="settings-field-grid">
              <label>
                故事模型
                <input
                  value={config.storyModel}
                  onChange={(event) => setConfig({ ...config, storyModel: event.target.value })}
                  placeholder="deepseek-reasoner"
                />
              </label>
              <label>
                裁判模型
                <input
                  value={config.fastModel}
                  onChange={(event) => setConfig({ ...config, fastModel: event.target.value })}
                  placeholder="deepseek-chat"
                />
              </label>
            </div>
            <div className="settings-actions">
              <button className="secondary-button" type="button" disabled={busy} onClick={scanModels}>
                <Search size={18} />
                扫描模型
              </button>
              <button className="primary-button" type="button" onClick={save}>
                <Save size={18} />
                保存配置
              </button>
            </div>
          </div>
        </section>

        <section className="turtle-lab-section turtle-lab-soup">
          <div className="settings-section__heading">
            <h2>汤面与汤底</h2>
          </div>
          <label>
            汤面
            <textarea value={surface} onChange={(event) => setSurface(event.target.value)} />
          </label>
          <label>
            汤底
            <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </label>
          <label>
            真相要点
            <textarea
              value={keyPoints}
              onChange={(event) => setKeyPoints(event.target.value)}
            />
          </label>
        </section>

        <form className="turtle-lab-section" onSubmit={run}>
          <div className="segmented turtle-lab-modes" role="tablist" aria-label="测试类型">
            {([
              ["ask", "提问判定"],
              ["guess", "猜谜判定"],
              ["hint", "提示生成"],
              ["story", "故事生成"]
            ] as const).map(([value, label]) => (
              <button
                type="button"
                className={mode === value ? "is-active" : ""}
                onClick={() => setMode(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "ask" ? (
            <label>
              玩家提问
              <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            </label>
          ) : null}
          {mode === "guess" ? (
            <label>
              玩家推理
              <textarea value={guess} onChange={(event) => setGuess(event.target.value)} />
            </label>
          ) : null}
          {mode === "story" ? (
            <label>
              生成标签
              <input value={tags} onChange={(event) => setTags(event.target.value)} />
            </label>
          ) : null}

          <label>
            Prompt
            <textarea
              className="turtle-lab-prompt"
              value={activePrompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
            />
          </label>

          {message ? <div className="notice notice--success">{message}</div> : null}
          {error ? <div className="notice notice--error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
            运行测试
          </button>
        </form>

        {result ? (
          <section className="turtle-lab-section turtle-lab-result">
            <h2>模型输出</h2>
            <pre>{result}</pre>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function loadConfig(): LabConfig {
  const raw = localStorage.getItem(LABYRINTH_CONFIG_KEY);
  if (!raw) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<LabConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function promptForMode(
  mode: LabMode,
  input: {
    surface: string;
    answer: string;
    keyPoints: string;
    question: string;
    guess: string;
    tags: string;
  }
): string {
  if (mode === "ask") {
    return `你是海龟汤裁判。只能根据汤底回答玩家提问，不能剧透。\n\n汤面：${input.surface}\n\n汤底：${input.answer}\n\n玩家提问：${input.question}\n\n只返回 JSON：{"res":"是|不是|无关|是也不是","reason":"不剧透的简短依据"}`;
  }
  if (mode === "guess") {
    return `你是海龟汤裁判。根据汤底和真相要点评估玩家推理。\n\n汤面：${input.surface}\n\n汤底：${input.answer}\n\n真相要点：\n${input.keyPoints}\n\n玩家推理：${input.guess}\n\n返回 JSON：{"matched_segments":[],"wrong_segments":[],"achieved_points":[],"comment":""}`;
  }
  if (mode === "hint") {
    return `你是海龟汤引导者。根据汤面、汤底和真相要点，给一句不剧透的反问式提示。\n\n汤面：${input.surface}\n\n汤底：${input.answer}\n\n真相要点：\n${input.keyPoints}\n\n只输出提示正文，30 字以内。`;
  }
  return `你是一位侧向思维谜题作者。根据标签创作一题逻辑自洽的海龟汤。\n\n标签：${input.tags}\n\n要求：汤面简洁，以“为什么？”或“发生了什么？”结尾；汤底完整解释反常点；真相要点可验证。\n\n严格返回 JSON：{"title":"","surface":"","answer":"","key_points":[]}`;
}

async function runBrowserCompletion(
  config: LabConfig,
  model: string,
  prompt: string,
  thinking: boolean
): Promise<string> {
  if (!config.base.trim() || !config.key.trim() || !model.trim()) {
    throw new Error("请先填写 Base URL、API Key 和模型名称");
  }
  const response = await fetch(`${config.base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.key}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      ...(thinking ? { enable_thinking: true } : {})
    })
  });
  if (!response.ok) throw new Error(`模型请求失败 HTTP ${response.status}`);
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || "模型没有返回内容";
}

async function fetchModels(config: LabConfig): Promise<string[]> {
  if (!config.base.trim()) throw new Error("请先填写 Base URL");
  const response = await fetch(`${config.base.replace(/\/$/, "")}/models`, {
    ...(config.key ? { headers: { authorization: `Bearer ${config.key}` } } : {})
  });
  if (!response.ok) throw new Error(`模型列表请求失败 HTTP ${response.status}`);
  const data = (await response.json()) as { data?: Array<{ id?: string }> };
  return (data.data ?? []).flatMap((model) => (model.id ? [model.id] : []));
}
