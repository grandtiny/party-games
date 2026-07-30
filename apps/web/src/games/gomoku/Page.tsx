import {
  GomokuPosition,
  createGomokuGame,
  playGomokuMove,
  resignGomokuGame,
  restoreGomokuGame,
  rewindGomokuGame,
  type GomokuAiDecision,
  type GomokuAiDifficulty,
  type GomokuGameState,
  type GomokuMatchMode,
  type GomokuPoint,
  type GomokuRuleSet,
  type GomokuStone
} from "@party-games/gomoku";
import {
  BrainCircuit,
  Check,
  CircleDot,
  Flag,
  RefreshCw,
  RotateCcw,
  Timer,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  getGomokuOverview,
  submitGomokuMatch,
  syncGomokuProgress,
  updateGomokuSave
} from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { AppShell } from "../../platform/AppShell";
import { GomokuBoard } from "./Board";
import { GomokuLearnPanel } from "./LearnPanel";
import { GomokuPuzzlesPanel } from "./PuzzlesPanel";
import {
  addGomokuLocalMatch,
  createGomokuClientId,
  createGomokuSeed,
  gomokuProgressItems,
  loadGomokuGame,
  loadGomokuGameSnapshot,
  loadGomokuLocalMatches,
  loadGomokuProgress,
  loadGomokuSettings,
  markGomokuLocalMatchSynced,
  mergeGomokuProgress,
  saveGomokuGame,
  saveGomokuProgress,
  saveGomokuSettings,
  type GomokuLocalSettings
} from "./storage";

type GomokuTab = "play" | "puzzles" | "learn";

interface GomokuPageProps {
  tab: GomokuTab;
}

interface MatchConfig {
  ruleSet: GomokuRuleSet;
  mode: GomokuMatchMode;
  humanColor: GomokuStone;
  difficulty: GomokuAiDifficulty;
}

interface AiWorkerResponse {
  requestId: number;
  decision?: GomokuAiDecision;
  error?: string;
}

const DEFAULT_CONFIG: MatchConfig = {
  ruleSet: "renju",
  mode: "ai",
  humanColor: "black",
  difficulty: "normal"
};

export function GomokuPage({ tab }: GomokuPageProps) {
  const { status: accountStatus } = useAccount();
  const [initialSnapshot] = useState(loadGomokuGameSnapshot);
  const [game, setGame] = useState<GomokuGameState>(() =>
    initialSnapshot?.state ?? loadGomokuGame() ?? newGame(DEFAULT_CONFIG)
  );
  const [config, setConfig] = useState<MatchConfig>(() => configFromGame(game));
  const [settings, setSettings] = useState<GomokuLocalSettings>(() => loadGomokuSettings());
  const [pendingPoint, setPendingPoint] = useState<GomokuPoint>();
  const [thinking, setThinking] = useState(false);
  const [aiDecision, setAiDecision] = useState<GomokuAiDecision>();
  const [notice, setNotice] = useState<string>();
  const [accountSyncReady, setAccountSyncReady] = useState(false);
  const [contentSyncVersion, setContentSyncVersion] = useState(0);
  const workerRef = useRef<Worker | undefined>(undefined);
  const requestIdRef = useRef(0);
  const requestedStateRef = useRef<string | undefined>(undefined);
  const gameRef = useRef(game);

  gameRef.current = game;

  useEffect(() => {
    if (tab !== "play") {
      workerRef.current = undefined;
      return undefined;
    }
    const worker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestIdRef.current) return;
      if (!response.decision) {
        setThinking(false);
        setNotice(response.error ?? "AI 计算失败");
        return;
      }
      const delay = Math.max(120, 420 - response.decision.elapsedMs);
      window.setTimeout(() => {
        if (response.requestId !== requestIdRef.current) return;
        const current = gameRef.current;
        const result = playGomokuMove(
          current,
          response.decision?.point ?? { x: 7, y: 7 },
          current.currentPlayer,
          current.elapsedSeconds
        );
        if (result.ok) {
          setGame(result.state);
          setAiDecision(response.decision);
          playStoneSound(settings.sound, "ai");
        } else {
          setNotice("AI 返回了非法落子，已停止本次行动");
        }
        setThinking(false);
      }, delay);
    };
    return () => {
      if (workerRef.current === worker) workerRef.current = undefined;
      worker.terminate();
    };
  }, [settings.sound, tab]);

  useEffect(() => saveGomokuGame(game), [game]);
  useEffect(() => saveGomokuSettings(settings), [settings]);

  useEffect(() => {
    if (!accountStatus?.authenticated || !accountStatus.user) {
      setAccountSyncReady(false);
      return;
    }
    let cancelled = false;
    setAccountSyncReady(false);
    const synchronize = async () => {
      try {
        const overview = await getGomokuOverview();
        if (cancelled) return;
        const remoteSave = overview.save;
        if (
          remoteSave &&
          (!initialSnapshot ||
            new Date(remoteSave.updatedAt).getTime() >
              new Date(initialSnapshot.updatedAt).getTime())
        ) {
          const remoteState = restoreGomokuGame(remoteSave.state);
          setGame(remoteState);
          setConfig(configFromGame(remoteState));
          saveGomokuGame(remoteState, remoteSave.updatedAt);
        } else {
          await updateGomokuSave({ state: gameRef.current });
        }

        const mergedProgress = mergeGomokuProgress(loadGomokuProgress(), overview.progress);
        const items = gomokuProgressItems(mergedProgress);
        const remoteProgress =
          items.length > 0 ? await syncGomokuProgress({ items }) : overview.progress;
        saveGomokuProgress(mergeGomokuProgress(mergedProgress, remoteProgress));

        for (const match of loadGomokuLocalMatches().filter((item) => !item.synced)) {
          await submitGomokuMatch({ state: match.state });
          markGomokuLocalMatchSynced(match.state.id);
        }
        if (!cancelled) setContentSyncVersion((value) => value + 1);
      } catch (cause) {
        if (!cancelled) {
          setNotice(cause instanceof Error ? `账号同步失败：${cause.message}` : "账号同步失败");
        }
      } finally {
        if (!cancelled) setAccountSyncReady(true);
      }
    };
    void synchronize();
    return () => {
      cancelled = true;
    };
  }, [accountStatus?.user?.id]);

  useEffect(() => {
    if (!accountStatus?.authenticated || !accountSyncReady) return;
    const timeout = window.setTimeout(() => {
      void updateGomokuSave({ state: game }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [
    accountStatus?.authenticated,
    accountSyncReady,
    game.id,
    game.moves.length,
    Boolean(game.result),
    game.usedUndo,
    game.usedHint,
    game.setupMoveCount
  ]);

  useEffect(() => {
    if (!game.result) return;
    addGomokuLocalMatch(game);
    if (!accountStatus?.authenticated || !accountSyncReady) return;
    void submitGomokuMatch({ state: game })
      .then(() => markGomokuLocalMatchSynced(game.id))
      .catch(() => undefined);
  }, [game.result, accountStatus?.authenticated, accountSyncReady]);

  useEffect(() => {
    if (game.result) return;
    const timer = window.setInterval(
      () => setGame((current) => ({ ...current, elapsedSeconds: current.elapsedSeconds + 1 })),
      1000
    );
    return () => window.clearInterval(timer);
  }, [game.id, Boolean(game.result)]);

  const isAiTurn =
    game.mode === "ai" && !game.result && game.humanColor !== game.currentPlayer;

  useEffect(() => {
    if (!isAiTurn || !workerRef.current) return;
    const signature = `${game.id}:${game.moves.length}:${game.currentPlayer}`;
    if (requestedStateRef.current === signature) return;
    requestedStateRef.current = signature;
    requestIdRef.current += 1;
    setThinking(true);
    setPendingPoint(undefined);
    workerRef.current.postMessage({ requestId: requestIdRef.current, state: game });
  }, [game, isAiTurn]);

  const forbiddenPoints = useMemo(() => {
    if (
      !settings.showForbidden ||
      game.ruleSet !== "renju" ||
      game.currentPlayer !== "black" ||
      game.result
    ) {
      return [];
    }
    const position = GomokuPosition.fromMoves(game.moves);
    const points: GomokuPoint[] = [];
    for (let y = 0; y < 15; y += 1) {
      for (let x = 0; x < 15; x += 1) {
        const analysis = position.analyzePlacement({ x, y }, "black", "renju");
        if (!analysis.legal && analysis.forbidden) points.push({ x, y });
      }
    }
    return points;
  }, [game, settings.showForbidden]);

  const startNewGame = () => {
    if (game.moves.length > 0 && !game.result && !window.confirm("当前对局尚未结束，确认重新开局？")) {
      return;
    }
    requestIdRef.current += 1;
    requestedStateRef.current = undefined;
    setGame(newGame(config));
    setPendingPoint(undefined);
    setAiDecision(undefined);
    setNotice(undefined);
    setThinking(false);
  };

  const placeHumanMove = (point: GomokuPoint) => {
    if (thinking || game.result || (game.mode === "ai" && game.currentPlayer !== game.humanColor)) {
      return;
    }
    if (settings.confirmMoves) {
      setPendingPoint(point);
      return;
    }
    commitMove(point);
  };

  const commitMove = (point: GomokuPoint) => {
    const result = playGomokuMove(game, point, game.currentPlayer, game.elapsedSeconds);
    if (!result.ok) {
      setNotice(moveFailureLabel(result.failure));
      return;
    }
    setGame(result.state);
    setPendingPoint(undefined);
    setNotice(undefined);
    playStoneSound(settings.sound, "human");
  };

  const undo = () => {
    if (game.moves.length === 0) return;
    requestIdRef.current += 1;
    requestedStateRef.current = undefined;
    const removeCount =
      game.mode === "ai" && game.currentPlayer === game.humanColor ? 2 : 1;
    setGame(rewindGomokuGame(game, game.moves.length - removeCount));
    setPendingPoint(undefined);
    setThinking(false);
    setNotice(undefined);
  };

  const resign = () => {
    if (game.result || game.moves.length === 0) return;
    if (!window.confirm("确认认输并结束本局？")) return;
    requestIdRef.current += 1;
    setGame(
      resignGomokuGame(
        game,
        game.mode === "ai" ? (game.humanColor ?? game.currentPlayer) : game.currentPlayer,
        game.elapsedSeconds
      )
    );
    setThinking(false);
  };

  return (
    <AppShell scope="gomoku" title="五子棋" backTo="/">
      <nav className="gomoku-tabs" aria-label="五子棋模式">
        <GomokuTabLink to="/gomoku" active={tab === "play"} label="对局" />
        <GomokuTabLink to="/gomoku/puzzles" active={tab === "puzzles"} label="残局" />
        <GomokuTabLink to="/gomoku/learn" active={tab === "learn"} label="教学" />
      </nav>

      {tab === "play" ? (
        <div className="gomoku-play-layout">
          <section className="gomoku-match" aria-label="五子棋对局">
            <header className="gomoku-match__status">
              <div className={`gomoku-turn is-${game.currentPlayer}`}>
                <span className="gomoku-turn__stone" />
                <span>
                  <small>{game.result ? "本局结束" : thinking ? "AI 思考中" : "当前落子"}</small>
                  <strong>{statusLabel(game, thinking)}</strong>
                </span>
              </div>
              <div className="gomoku-match__metrics">
                <span>
                  <CircleDot size={16} /> {game.moves.length} 手
                </span>
                <span>
                  <Timer size={16} /> {formatTime(game.elapsedSeconds)}
                </span>
              </div>
            </header>

            <div className="gomoku-board-frame">
              <GomokuBoard
                state={game}
                forbiddenPoints={forbiddenPoints}
                disabled={thinking || Boolean(game.result)}
                onPoint={placeHumanMove}
                {...(pendingPoint ? { pendingPoint } : {})}
              />
            </div>

            {pendingPoint ? (
              <div className="gomoku-confirm-row">
                <span>确认 {coordinateLabel(pendingPoint)}</span>
                <button className="primary-button" type="button" onClick={() => commitMove(pendingPoint)}>
                  <Check size={17} /> 确认落子
                </button>
                <button className="icon-button" type="button" onClick={() => setPendingPoint(undefined)} aria-label="取消落子" title="取消落子">
                  <X size={18} />
                </button>
              </div>
            ) : null}

            {notice ? <p className="gomoku-notice" role="status">{notice}</p> : null}
            {game.result ? <ResultPanel game={game} onRestart={startNewGame} /> : null}
          </section>

          <aside className="gomoku-sidebar">
            <section className="gomoku-settings" aria-label="对局设置">
              <SettingGroup label="规则">
                <div className="segmented gomoku-segmented is-two">
                  <ChoiceButton active={config.ruleSet === "renju"} onClick={() => setConfig({ ...config, ruleSet: "renju" })}>禁手</ChoiceButton>
                  <ChoiceButton active={config.ruleSet === "freestyle"} onClick={() => setConfig({ ...config, ruleSet: "freestyle" })}>经典</ChoiceButton>
                </div>
              </SettingGroup>
              <SettingGroup label="对手">
                <div className="segmented gomoku-segmented is-two">
                  <ChoiceButton active={config.mode === "ai"} onClick={() => setConfig({ ...config, mode: "ai" })}>AI</ChoiceButton>
                  <ChoiceButton active={config.mode === "local"} onClick={() => setConfig({ ...config, mode: "local" })}>双人</ChoiceButton>
                </div>
              </SettingGroup>
              {config.mode === "ai" ? (
                <>
                  <SettingGroup label="执棋">
                    <div className="segmented gomoku-segmented is-two">
                      <ChoiceButton active={config.humanColor === "black"} onClick={() => setConfig({ ...config, humanColor: "black" })}>黑方</ChoiceButton>
                      <ChoiceButton active={config.humanColor === "white"} onClick={() => setConfig({ ...config, humanColor: "white" })}>白方</ChoiceButton>
                    </div>
                  </SettingGroup>
                  <SettingGroup label="难度">
                    <div className="segmented gomoku-segmented">
                      {(["easy", "normal", "hard"] as const).map((difficulty) => (
                        <ChoiceButton key={difficulty} active={config.difficulty === difficulty} onClick={() => setConfig({ ...config, difficulty })}>
                          {difficultyLabel(difficulty)}
                        </ChoiceButton>
                      ))}
                    </div>
                  </SettingGroup>
                </>
              ) : null}
              <button className="primary-button gomoku-new-game" type="button" onClick={startNewGame}>
                <RefreshCw size={17} /> 按当前设置开局
              </button>
            </section>

            <section className="gomoku-actions" aria-label="对局操作">
              <button className="secondary-button" type="button" onClick={undo} disabled={game.moves.length === 0}>
                <RotateCcw size={17} /> 悔棋
              </button>
              <button className="secondary-button" type="button" onClick={resign} disabled={game.moves.length === 0 || Boolean(game.result)}>
                <Flag size={17} /> 认输
              </button>
              <button className="secondary-button" type="button" onClick={() => setSettings({ ...settings, sound: !settings.sound })}>
                {settings.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
                {settings.sound ? "声音开" : "声音关"}
              </button>
            </section>

            <section className="gomoku-toggles" aria-label="显示设置">
              <ToggleRow label="落子确认" checked={settings.confirmMoves} onChange={(confirmMoves) => setSettings({ ...settings, confirmMoves })} />
              <ToggleRow label="显示禁手点" checked={settings.showForbidden} onChange={(showForbidden) => setSettings({ ...settings, showForbidden })} />
            </section>

            {aiDecision ? (
              <div className="gomoku-ai-meta">
                <BrainCircuit size={17} />
                <span>{aiDecision.source === "tactical" ? "战术求解" : `搜索 ${aiDecision.depth} 层`} · {aiDecision.nodes} 节点</span>
              </div>
            ) : null}
          </aside>
        </div>
      ) : tab === "puzzles" ? (
        <GomokuPuzzlesPanel key={`puzzles-${contentSyncVersion}`} />
      ) : (
        <GomokuLearnPanel key={`learn-${contentSyncVersion}`} />
      )}
    </AppShell>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="gomoku-setting"><span>{label}</span>{children}</label>;
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={active ? "is-active" : ""} aria-pressed={active} onClick={onClick}>{children}</button>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="gomoku-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function GomokuTabLink({ to, active, label }: { to: string; active: boolean; label: string }) {
  return <Link className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} to={to}>{label}</Link>;
}

function ResultPanel({ game, onRestart }: { game: GomokuGameState; onRestart: () => void }) {
  const result = game.result;
  if (!result) return null;
  const winner = result.outcome === "draw" ? "和棋" : `${result.outcome === "black" ? "黑方" : "白方"}获胜`;
  return (
    <div className="gomoku-result" role="status">
      <span className={`gomoku-result__stone is-${result.outcome}`} />
      <span><small>{result.reason === "resign" ? "对手认输" : result.reason === "board-full" ? "棋盘已满" : "五子连珠"}</small><strong>{winner}</strong></span>
      <button className="primary-button" type="button" onClick={onRestart}><RefreshCw size={17} /> 再来一局</button>
    </div>
  );
}

function newGame(config: MatchConfig): GomokuGameState {
  return createGomokuGame({
    id: createGomokuClientId(),
    ruleSet: config.ruleSet,
    mode: config.mode,
    startedAt: Date.now(),
    seed: createGomokuSeed(),
    ...(config.mode === "ai" ? { aiDifficulty: config.difficulty, humanColor: config.humanColor } : {})
  });
}

function configFromGame(game: GomokuGameState): MatchConfig {
  return {
    ruleSet: game.ruleSet,
    mode: game.mode,
    humanColor: game.humanColor ?? "black",
    difficulty: game.aiDifficulty ?? "normal"
  };
}

function statusLabel(game: GomokuGameState, thinking: boolean): string {
  if (game.result) {
    if (game.result.outcome === "draw") return "和棋";
    return `${game.result.outcome === "black" ? "黑方" : "白方"}获胜`;
  }
  if (thinking) return `${game.currentPlayer === "black" ? "黑方" : "白方"} AI`;
  return game.currentPlayer === "black" ? "黑方" : "白方";
}

function moveFailureLabel(failure: ReturnType<typeof playGomokuMove> extends infer Result ? Result extends { ok: false; failure: infer Failure } ? Failure : never : never): string {
  if (failure.reason === "forbidden") {
    return failure.forbidden === "double-three" ? "该点为三三禁手" : failure.forbidden === "double-four" ? "该点为四四禁手" : "该点会形成黑方长连";
  }
  if (failure.reason === "occupied") return "该位置已有棋子";
  if (failure.reason === "wrong-player") return "当前不是该方落子";
  return "当前不能在该位置落子";
}

function difficultyLabel(difficulty: GomokuAiDifficulty): string {
  return difficulty === "easy" ? "入门" : difficulty === "hard" ? "困难" : "普通";
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function coordinateLabel(point: GomokuPoint): string {
  return `${"ABCDEFGHJKLMNOP"[point.x] ?? "?"}${15 - point.y}`;
}

function playStoneSound(enabled: boolean, source: "human" | "ai"): void {
  if (!enabled) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = source === "human" ? 210 : 180;
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
    oscillator.onended = () => void context.close();
  } catch {
    // Audio feedback is optional and must not affect play.
  }
}
