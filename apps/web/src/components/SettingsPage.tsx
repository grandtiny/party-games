import type {
  AdminAuthStatusResponse,
  AdminConfigResponse,
  AdminLlmConfigUpdateRequest
} from "@party-games/shared";
import {
  Check,
  Database,
  KeyRound,
  LogOut,
  PlugZap,
  Save,
  ServerCog,
  ShieldCheck
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  changeAdminPassword,
  getAdminConfig,
  getAdminStatus,
  loginAdmin,
  logoutAdmin,
  setupAdmin,
  testAdminLlmConfig,
  updateAdminLlmConfig
} from "../api";
import { AppShell } from "./AppShell";

const EMPTY_LLM_DRAFT: AdminLlmConfigUpdateRequest = {
  enabled: false,
  endpoint: "",
  model: "",
  timeoutMs: 8000
};

export function SettingsPage() {
  const [status, setStatus] = useState<AdminAuthStatusResponse>();
  const [config, setConfig] = useState<AdminConfigResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const nextStatus = await getAdminStatus();
      setStatus(nextStatus);
      setConfig(nextStatus.authenticated ? await getAdminConfig() : undefined);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const logout = async () => {
    await logoutAdmin();
    setConfig(undefined);
    setStatus({ initialized: true, authenticated: false });
  };

  return (
    <AppShell
      title="系统设置"
      backTo="/"
      actions={
        status?.authenticated ? (
          <button
            className="icon-button"
            type="button"
            aria-label="退出管理"
            title="退出管理"
            onClick={logout}
          >
            <LogOut size={19} />
          </button>
        ) : null
      }
    >
      {loading ? <div className="notice">正在读取配置…</div> : null}
      {error ? <div className="notice notice--error">{error}</div> : null}
      {!loading && status && !status.authenticated ? (
        <AdminAccessForm initialized={status.initialized} onAuthenticated={load} />
      ) : null}
      {!loading && status?.authenticated && config ? (
        <SettingsWorkspace config={config} onConfigChange={setConfig} />
      ) : null}
    </AppShell>
  );
}

function AdminAccessForm({
  initialized,
  onAuthenticated
}: {
  initialized: boolean;
  onAuthenticated: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!initialized && password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (initialized) await loginAdmin({ password });
      else await setupAdmin({ password });
      await onAuthenticated();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-auth">
      <ShieldCheck size={32} />
      <div>
        <p className="eyebrow">ADMIN</p>
        <h1>{initialized ? "管理员登录" : "首次初始化"}</h1>
      </div>
      <form className="settings-form" onSubmit={submit}>
        <label>
          管理员密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete={initialized ? "current-password" : "new-password"}
            required
          />
        </label>
        {!initialized ? (
          <label>
            确认密码
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={busy}>
          <KeyRound size={18} />
          {busy ? "处理中…" : initialized ? "登录" : "创建管理员"}
        </button>
      </form>
    </section>
  );
}

function SettingsWorkspace({
  config,
  onConfigChange
}: {
  config: AdminConfigResponse;
  onConfigChange: (config: AdminConfigResponse) => void;
}) {
  const [llm, setLlm] = useState<AdminLlmConfigUpdateRequest>(() => draftFrom(config));
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [busy, setBusy] = useState<"save" | "test">();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const input = (): AdminLlmConfigUpdateRequest => ({
    ...llm,
    ...(apiKey ? { apiKey } : {}),
    ...(clearApiKey ? { clearApiKey: true } : {})
  });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("save");
    setMessage(undefined);
    setError(undefined);
    try {
      const next = await updateAdminLlmConfig(input());
      onConfigChange(next);
      setLlm(draftFrom(next));
      setApiKey("");
      setClearApiKey(false);
      setMessage("大模型配置已保存");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(undefined);
    }
  };

  const test = async () => {
    setBusy("test");
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await testAdminLlmConfig(input());
      setMessage(`${result.message} · ${result.latencyMs} ms`);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="settings-workspace">
      <section className="settings-section">
        <div className="settings-section__heading">
          <ServerCog size={23} />
          <div>
            <h1>规则问答模型</h1>
            <span className={`config-state ${config.llm.ready ? "is-ready" : ""}`}>
              {config.llm.ready ? "可用" : "未启用"}
            </span>
          </div>
        </div>

        <form className="settings-form settings-form--wide" onSubmit={save}>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={llm.enabled}
              onChange={(event) => setLlm({ ...llm, enabled: event.target.checked })}
            />
            <span>启用大模型增强</span>
          </label>
          <label>
            OpenAI 兼容接口
            <input
              type="url"
              value={llm.endpoint}
              onChange={(event) => setLlm({ ...llm, endpoint: event.target.value })}
              placeholder="https://example.com/v1/chat/completions"
              required={llm.enabled}
            />
          </label>
          <div className="settings-field-grid">
            <label>
              模型名称
              <input
                value={llm.model}
                onChange={(event) => setLlm({ ...llm, model: event.target.value })}
                required={llm.enabled}
              />
            </label>
            <label>
              超时时间（毫秒）
              <input
                type="number"
                min={1000}
                max={60000}
                step={500}
                value={llm.timeoutMs}
                onChange={(event) => setLlm({ ...llm, timeoutMs: Number(event.target.value) })}
                required
              />
            </label>
          </div>
          <label>
            API Key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                if (event.target.value) setClearApiKey(false);
              }}
              placeholder={config.llm.hasApiKey ? "已配置" : ""}
              autoComplete="off"
            />
          </label>
          {config.llm.hasApiKey ? (
            <label className="settings-toggle settings-toggle--compact">
              <input
                type="checkbox"
                checked={clearApiKey}
                onChange={(event) => {
                  setClearApiKey(event.target.checked);
                  if (event.target.checked) setApiKey("");
                }}
              />
              <span>移除现有 API Key</span>
            </label>
          ) : null}
          {message ? <div className="notice notice--success">{message}</div> : null}
          {error ? <div className="notice notice--error">{error}</div> : null}
          <div className="settings-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={test}
              disabled={Boolean(busy)}
            >
              <PlugZap size={18} />
              {busy === "test" ? "测试中…" : "测试连接"}
            </button>
            <button className="primary-button" type="submit" disabled={Boolean(busy)}>
              <Save size={18} />
              {busy === "save" ? "保存中…" : "保存配置"}
            </button>
          </div>
        </form>
      </section>

      <SystemStatus config={config} />
      <PasswordSection />
    </div>
  );
}

function SystemStatus({ config }: { config: AdminConfigResponse }) {
  return (
    <section className="settings-section">
      <div className="settings-section__heading">
        <Database size={23} />
        <h2>运行状态</h2>
      </div>
      <dl className="settings-status-list">
        <div>
          <dt>数据库版本</dt>
          <dd>{config.databaseSchemaVersion}</dd>
        </div>
        <div>
          <dt>规则问答限流</dt>
          <dd>{config.rulesRateLimitPerMinute} 次 / 分钟</dd>
        </div>
        <div>
          <dt>模型配置来源</dt>
          <dd>{sourceLabel(config.llm.source)}</dd>
        </div>
        <div>
          <dt>API Key</dt>
          <dd>{config.llm.hasApiKey ? "已配置" : "未配置"}</dd>
        </div>
      </dl>
    </section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await changeAdminPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage("管理员密码已更新");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-section__heading">
        <KeyRound size={23} />
        <h2>管理员密码</h2>
      </div>
      <form className="settings-form settings-form--wide" onSubmit={submit}>
        <label>
          当前密码
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete="current-password"
            required
          />
        </label>
        <div className="settings-field-grid">
          <label>
            新密码
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            确认新密码
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
        </div>
        {message ? (
          <div className="notice notice--success">
            <Check size={17} /> {message}
          </div>
        ) : null}
        {error ? <div className="notice notice--error">{error}</div> : null}
        <div className="settings-actions">
          <button className="secondary-button" type="submit" disabled={busy}>
            <KeyRound size={18} />
            {busy ? "更新中…" : "修改密码"}
          </button>
        </div>
      </form>
    </section>
  );
}

function draftFrom(config: AdminConfigResponse): AdminLlmConfigUpdateRequest {
  return {
    ...EMPTY_LLM_DRAFT,
    enabled: config.llm.enabled,
    endpoint: config.llm.endpoint,
    model: config.llm.model,
    timeoutMs: config.llm.timeoutMs
  };
}

function sourceLabel(source: AdminConfigResponse["llm"]["source"]): string {
  if (source === "saved") return "设置页面";
  if (source === "environment") return "环境变量";
  return "未配置";
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "操作失败";
}
