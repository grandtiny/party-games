import {
  KeyRound,
  LogIn,
  Plus,
  RefreshCw,
  Spade,
  Trash2
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { PokerBlindLevel, PokerTableMode } from "@party-games/shared";
import { createRoom, joinRoom, recoverRoom } from "../../api";
import { AppShell } from "../../platform/AppShell";
import { saveSession } from "../../session";

type EntryMode = "create" | "join" | "recover";

export function PokerEntryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<EntryMode>("create");
  const [tableMode, setTableMode] = useState<PokerTableMode>("points");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [blindLevels, setBlindLevels] = useState<PokerBlindLevel[]>([
    { smallBlind: 5, bigBlind: 10, ante: 0 }
  ]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const updateInitialBlind = (kind: "smallBlind" | "bigBlind", value: number) => {
    if (kind === "smallBlind") setSmallBlind(value);
    else setBigBlind(value);
    setBlindLevels((levels) =>
      levels.map((level, index) => (index === 0 ? { ...level, [kind]: value } : level))
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const session =
        mode === "create"
          ? await createRoom({
              gameType: "poker",
              nickname,
              password,
              poker:
                tableMode === "points"
                  ? { mode: tableMode, smallBlind, bigBlind }
                  : {
                      mode: tableMode,
                      smallBlind,
                      bigBlind,
                      blindStructure: blindLevels
                    }
            })
          : mode === "join"
            ? await joinRoom({ roomCode, nickname, password })
            : await recoverRoom({ roomCode, recoveryCode });
      saveSession(session, "poker");
      navigate(`/poker/room/${session.roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const addBlindLevel = () => {
    setBlindLevels((levels) => {
      const previous = levels.at(-1) ?? { smallBlind, bigBlind, ante: 0 };
      return [
        ...levels,
        {
          smallBlind: previous.bigBlind,
          bigBlind: previous.bigBlind * 2,
          ante: previous.ante
        }
      ];
    });
  };

  return (
    <AppShell scope="poker" title="德州扑克" backTo="/">
      <section className="entry-layout poker-entry">
        <div className="entry-heading">
          <Spade size={36} />
          <div>
            <p className="eyebrow">TEXAS HOLD'EM</p>
            <h1>多人牌桌</h1>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="进入方式">
          {([[
            "create",
            "创建"
          ], ["join", "加入"], ["recover", "恢复"]] as const).map(([value, label]) => (
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
          {mode === "create" ? (
            <div className="segmented poker-mode-switch" role="tablist" aria-label="牌桌类型">
              <button
                type="button"
                className={tableMode === "points" ? "is-active" : ""}
                onClick={() => setTableMode("points")}
              >
                积分桌
              </button>
              <button
                type="button"
                className={tableMode === "tournament" ? "is-active" : ""}
                onClick={() => setTableMode("tournament")}
              >
                淘汰赛
              </button>
            </div>
          ) : null}

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

          {mode === "create" ? (
            <>
              <div className="poker-number-grid">
                <label>
                  小盲
                  <input
                    type="number"
                    min={1}
                    value={smallBlind}
                    onChange={(event) => updateInitialBlind("smallBlind", Number(event.target.value))}
                    required
                  />
                </label>
                <label>
                  大盲
                  <input
                    type="number"
                    min={2}
                    value={bigBlind}
                    onChange={(event) => updateInitialBlind("bigBlind", Number(event.target.value))}
                    required
                  />
                </label>
              </div>

              {tableMode === "tournament" ? (
                <div className="blind-editor">
                  <div className="blind-editor__heading">
                    <strong>盲注级别</strong>
                    <button className="icon-button" type="button" onClick={addBlindLevel} title="添加级别">
                      <Plus size={17} />
                    </button>
                  </div>
                  {blindLevels.map((level, index) => (
                    <div className="blind-level" key={index}>
                      <span>{index + 1}</span>
                      {(["smallBlind", "bigBlind", "ante"] as const).map((field) => (
                        <label key={field}>
                          {field === "smallBlind" ? "小盲" : field === "bigBlind" ? "大盲" : "前注"}
                          <input
                            type="number"
                            min={field === "ante" ? 0 : 1}
                            value={level[field]}
                            disabled={index === 0 && field !== "ante"}
                            onChange={(event) =>
                              setBlindLevels((levels) =>
                                levels.map((candidate, candidateIndex) =>
                                  candidateIndex === index
                                    ? { ...candidate, [field]: Number(event.target.value) }
                                    : candidate
                                )
                              )
                            }
                          />
                        </label>
                      ))}
                      <button
                        className="icon-button"
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          setBlindLevels((levels) => levels.filter((_, levelIndex) => levelIndex !== index))
                        }
                        title="删除级别"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
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
            {mode === "create" ? "创建牌桌" : mode === "join" ? "加入牌桌" : "恢复身份"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
