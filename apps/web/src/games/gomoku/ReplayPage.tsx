import "./theme.css";
import { rewindGomokuGame, type GomokuGameState } from "@party-games/gomoku";
import type { GomokuMatchDetailView } from "@party-games/shared";
import {
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  RotateCcw
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGomokuMatch } from "../../api";
import { AppShell } from "../../platform/AppShell";
import { GomokuBoard } from "./Board";

export function GomokuReplayPage() {
  const { matchId = "" } = useParams();
  const [match, setMatch] = useState<GomokuMatchDetailView>();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    getGomokuMatch(matchId)
      .then((value) => {
        if (cancelled) return;
        setMatch(value);
        setStep(value.state.moves.length);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "复盘读取失败");
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!playing || !match) return;
    if (step >= match.state.moves.length) {
      setPlaying(false);
      return;
    }
    const timeout = window.setTimeout(() => setStep((value) => value + 1), 520);
    return () => window.clearTimeout(timeout);
  }, [playing, match, step]);

  const state = useMemo(() => {
    if (!match) return undefined;
    if (step >= match.state.moves.length) return match.state as GomokuGameState;
    return rewindGomokuGame(match.state as GomokuGameState, step);
  }, [match, step]);

  const minimumStep = match?.state.setupMoveCount ?? 0;

  return (
    <AppShell scope="gomoku" title="五子棋复盘" backTo="/account">
      {error ? (
        <div className="gomoku-replay-empty">
          <p>{error}</p>
          <Link className="secondary-button" to="/account">返回账号记录</Link>
        </div>
      ) : null}
      {!error && !state ? <div className="notice">正在读取棋谱…</div> : null}
      {match && state ? (
        <div className="gomoku-replay-layout">
          <section className="gomoku-match">
            <header className="gomoku-content-heading">
              <div>
                <span className="eyebrow">{match.mode === "ai" ? "人机对局" : "同屏双人"}</span>
                <h1>{resultLabel(match)}</h1>
              </div>
              <span className={`gomoku-side-chip is-${match.winner}`}>
                {match.winner === "draw" ? "和棋" : `${match.winner === "black" ? "黑" : "白"}方胜`}
              </span>
            </header>
            <div className="gomoku-board-frame">
              <GomokuBoard
                state={state}
                forbiddenPoints={[]}
                initialMoveCount={minimumStep}
                disabled
                onPoint={() => undefined}
              />
            </div>
          </section>

          <aside className="gomoku-replay-panel">
            <div className="gomoku-replay-count">
              <span>当前手数</span>
              <strong>{step} / {match.state.moves.length}</strong>
            </div>
            <input
              type="range"
              min={minimumStep}
              max={match.state.moves.length}
              value={step}
              onChange={(event) => {
                setPlaying(false);
                setStep(Number(event.target.value));
              }}
              aria-label="复盘手数"
            />
            <div className="gomoku-replay-controls">
              <button className="icon-button" type="button" onClick={() => { setPlaying(false); setStep(minimumStep); }} aria-label="回到开局" title="回到开局">
                <RotateCcw size={19} />
              </button>
              <button className="icon-button" type="button" disabled={step <= minimumStep} onClick={() => { setPlaying(false); setStep((value) => Math.max(minimumStep, value - 1)); }} aria-label="上一步" title="上一步">
                <ChevronLeft size={20} />
              </button>
              <button className="icon-button is-primary" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "暂停" : "播放"} title={playing ? "暂停" : "播放"}>
                {playing ? <CirclePause size={22} /> : <CirclePlay size={22} />}
              </button>
              <button className="icon-button" type="button" disabled={step >= match.state.moves.length} onClick={() => { setPlaying(false); setStep((value) => Math.min(match.state.moves.length, value + 1)); }} aria-label="下一步" title="下一步">
                <ChevronRight size={20} />
              </button>
            </div>
            <dl className="gomoku-replay-meta">
              <div><dt>规则</dt><dd>{match.ruleSet === "renju" ? "标准禁手" : "经典规则"}</dd></div>
              {match.aiDifficulty ? <div><dt>难度</dt><dd>{difficultyLabel(match.aiDifficulty)}</dd></div> : null}
              <div><dt>用时</dt><dd>{formatTime(match.elapsedSeconds)}</dd></div>
              <div><dt>记录</dt><dd>{new Intl.DateTimeFormat("zh-CN").format(new Date(match.createdAt))}</dd></div>
            </dl>
            {match.assisted ? <p className="gomoku-assisted-note">本局使用过悔棋、提示或残局摆盘，不计作无辅助对局。</p> : null}
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}

function resultLabel(match: GomokuMatchDetailView): string {
  if (match.outcome === "local") return "本地双人对局";
  if (match.outcome === "draw") return "与 AI 战平";
  return match.outcome === "win" ? "战胜 AI" : "AI 获胜";
}

function difficultyLabel(value: "easy" | "normal" | "hard"): string {
  return value === "easy" ? "入门" : value === "hard" ? "困难" : "普通";
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
