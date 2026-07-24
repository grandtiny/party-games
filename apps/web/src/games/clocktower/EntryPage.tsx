import { Clock3, KeyRound, LogIn, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom, recoverRoom } from "../../api";
import { saveSession } from "../../session";
import { AppShell } from "../../platform/AppShell";
import { useAccount } from "../../platform/AccountContext";
import { ClocktowerReferenceButton } from "./components/ClocktowerReferenceDialog";

type EntryMode = "create" | "join" | "recover";

export function ClocktowerEntryPage() {
  const navigate = useNavigate();
  const { status } = useAccount();
  const [mode, setMode] = useState<EntryMode>("create");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status?.user && !nickname) setNickname(status.user.displayName);
  }, [status?.user?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const session =
        mode === "create"
          ? await createRoom({ gameType: "clocktower", nickname, password })
          : mode === "join"
            ? await joinRoom({ roomCode, nickname, password })
            : await recoverRoom({ roomCode, recoveryCode });
      saveSession(session, "clocktower");
      navigate(`/clocktower/room/${session.roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      scope="clocktower"
      title="血染钟楼"
      backTo="/"
      actions={<ClocktowerReferenceButton />}
    >
      <section className="entry-layout">
        <div className="entry-heading">
          <Clock3 size={36} />
          <div>
            <p className="eyebrow">TROUBLE BREWING</p>
            <h1>暗流涌动</h1>
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
            {mode === "create" ? "创建房间" : mode === "join" ? "加入房间" : "恢复身份"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
