import { FlaskConical, KeyRound, LogIn, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRoom, joinRoom, recoverRoom } from "../../api";
import { AppShell } from "../../platform/AppShell";
import { saveSession } from "../../session";

type EntryMode = "create" | "join" | "recover";

export function TurtleSoupEntryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<EntryMode>("create");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const session =
        mode === "create"
          ? await createRoom({ gameType: "turtle-soup", nickname, password })
          : mode === "join"
            ? await joinRoom({ roomCode, nickname, password })
            : await recoverRoom({ roomCode, recoveryCode });
      saveSession(session, "turtle-soup");
      navigate(`/turtle-soup/room/${session.roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      scope="turtle-soup"
      title="海龟汤"
      backTo="/"
      actions={
        <Link className="reference-button" to="/turtle-soup/lab">
          <FlaskConical size={16} />
          测试页
        </Link>
      }
    >
      <section className="entry-layout turtle-entry">
        <div className="entry-heading">
          <FlaskConical size={36} />
          <div>
            <p className="eyebrow">LATERAL THINKING</p>
            <h1>海龟汤</h1>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="进入方式">
          {([
            ["create", "创建"],
            ["join", "加入"],
            ["recover", "恢复"]
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

        <form className="entry-form" onSubmit={submit}>
          {mode !== "create" ? (
            <label>
              房间码
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                required
              />
            </label>
          ) : null}

          {mode !== "recover" ? (
            <label>
              玩家昵称
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={20}
                autoComplete="nickname"
                required
              />
            </label>
          ) : null}

          {mode === "recover" ? (
            <label>
              六位恢复码
              <input
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={6}
                required
              />
            </label>
          ) : (
            <label>
              房间口令
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={4}
                maxLength={64}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                required
              />
            </label>
          )}

          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? (
              <RefreshCw className="spin" size={18} />
            ) : mode === "recover" ? (
              <KeyRound size={18} />
            ) : (
              <LogIn size={18} />
            )}
            {mode === "create" ? "创建汤局" : mode === "join" ? "加入汤局" : "恢复身份"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
