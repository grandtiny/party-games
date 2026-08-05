import {
  advanceGomokuPuzzleSolution,
  createGomokuPuzzleState,
  gomokuPuzzles,
  nextGomokuPuzzleSolutionMove,
  playGomokuMove,
  type GomokuAiDecision,
  type GomokuGameState,
  type GomokuPoint,
  type GomokuPuzzle,
  type GomokuPuzzleDifficulty
} from "@party-games/gomoku";
import {
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  RefreshCw,
  Star,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { syncGomokuProgress } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { GomokuBoard } from "./Board";
import {
  gomokuProgressItems,
  loadGomokuProgress,
  saveGomokuProgress,
  type GomokuLocalProgress
} from "./storage";

interface AiWorkerResponse {
  requestId: number;
  decision?: GomokuAiDecision;
  error?: string;
}

type PuzzleOutcome = "playing" | "won" | "lost" | "draw" | "error";

const difficultyLabels: Record<GomokuPuzzleDifficulty, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级"
};

export function GomokuPuzzlesPanel() {
  const { status: accountStatus } = useAccount();
  const [difficulty, setDifficulty] = useState<GomokuPuzzleDifficulty>("beginner");
  const filtered = useMemo(
    () => gomokuPuzzles.filter((puzzle) => puzzle.difficulty === difficulty),
    [difficulty]
  );
  const [selectedId, setSelectedId] = useState(filtered[0]?.id ?? gomokuPuzzles[0]?.id ?? "");
  const selected = gomokuPuzzles.find((puzzle) => puzzle.id === selectedId) ?? filtered[0];
  if (!selected) return null;
  return (
    <PuzzleWorkspace
      key={selected.id}
      puzzle={selected}
      filtered={filtered}
      difficulty={difficulty}
      onDifficulty={(next) => {
        setDifficulty(next);
        setSelectedId(gomokuPuzzles.find((puzzle) => puzzle.difficulty === next)?.id ?? selectedId);
      }}
      onSelect={setSelectedId}
      syncAccount={Boolean(accountStatus?.authenticated)}
    />
  );
}

function PuzzleWorkspace({
  puzzle,
  filtered,
  difficulty,
  onDifficulty,
  onSelect,
  syncAccount
}: {
  puzzle: GomokuPuzzle;
  filtered: readonly GomokuPuzzle[];
  difficulty: GomokuPuzzleDifficulty;
  onDifficulty: (difficulty: GomokuPuzzleDifficulty) => void;
  onSelect: (id: string) => void;
  syncAccount: boolean;
}) {
  const [state, setState] = useState(() => createGomokuPuzzleState(puzzle));
  const [solutionPrefix, setSolutionPrefix] = useState<GomokuPoint[] | null>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [responding, setResponding] = useState(false);
  const [outcome, setOutcome] = useState<PuzzleOutcome>("playing");
  const [earnedStars, setEarnedStars] = useState<number>();
  const [notice, setNotice] = useState<string>();
  const [progress, setProgress] = useState<GomokuLocalProgress>(() => loadGomokuProgress());
  const workerRef = useRef<Worker | undefined>(undefined);
  const requestIdRef = useRef(0);
  const stateRef = useRef(state);
  const solutionPrefixRef = useRef<GomokuPoint[] | null>(solutionPrefix);
  const applyAiMoveRef = useRef<
    ((point: GomokuPoint, requestId: number) => void) | undefined
  >(undefined);

  stateRef.current = state;
  solutionPrefixRef.current = solutionPrefix;

  const initialMoveCount = puzzle.black.length + puzzle.white.length;
  const highlighted =
    hintLevel >= 3 &&
    !responding &&
    outcome === "playing" &&
    state.currentPlayer === puzzle.toMove
      ? nextGomokuPuzzleSolutionMove(puzzle, solutionPrefix)
      : undefined;
  const forbiddenPoints = hintLevel >= 2 ? puzzle.forbiddenDecoys : [];
  const currentIndex = filtered.findIndex((candidate) => candidate.id === puzzle.id);
  const movesPlayed = state.moves.length - initialMoveCount;
  const referenceMoves = Math.min(
    ...puzzle.solutionLines.map((line) => line.length)
  );

  const updateSolutionPrefix = (next: GomokuPoint[] | null) => {
    solutionPrefixRef.current = next;
    setSolutionPrefix(next);
  };

  const finish = (nextState: GomokuGameState) => {
    const movesUsed = Math.max(1, nextState.moves.length - initialMoveCount);
    const stars = Math.max(
      1,
      3 -
        Math.min(2, hintLevel) -
        Number(attempts > 1 || movesUsed > referenceMoves)
    );
    setEarnedStars(stars);
    setProgress((current) => {
      const previous = current.puzzles[puzzle.id];
      const next = {
        ...current,
        puzzles: {
          ...current.puzzles,
          [puzzle.id]: {
            stars: Math.max(previous?.stars ?? 0, stars),
            bestMoves: Math.min(previous?.bestMoves ?? Number.MAX_SAFE_INTEGER, movesUsed),
            hintsUsed: Math.min(previous?.hintsUsed ?? Number.MAX_SAFE_INTEGER, hintLevel)
          }
        }
      };
      saveGomokuProgress(next);
      if (syncAccount) {
        void syncGomokuProgress({ items: gomokuProgressItems(next) }).catch(() => undefined);
      }
      return next;
    });
  };

  const conclude = (nextState: GomokuGameState) => {
    const result = nextState.result;
    if (!result) return;
    setResponding(false);
    if (result.outcome === puzzle.toMove) {
      setOutcome("won");
      setNotice("你已经完成五连，残局挑战成功");
      finish(nextState);
      return;
    }
    if (result.outcome === "draw") {
      setOutcome("draw");
      setNotice("本题已经和棋，可以重来寻找获胜路线");
      return;
    }
    setOutcome("lost");
    setNotice("对手已经完成五连，可以重来本题再次尝试");
  };

  applyAiMoveRef.current = (point, requestId) => {
    if (requestId !== requestIdRef.current) return;
    const current = stateRef.current;
    if (current.result || current.currentPlayer === puzzle.toMove) return;
    const result = playGomokuMove(current, point, current.currentPlayer);
    if (!result.ok) {
      setResponding(false);
      setOutcome("error");
      setNotice("对手计算出了非法落点，请重来本题");
      return;
    }
    const nextPrefix = advanceGomokuPuzzleSolution(
      puzzle,
      solutionPrefixRef.current,
      point
    );
    stateRef.current = result.state;
    updateSolutionPrefix(nextPrefix);
    setState(result.state);
    setResponding(false);
    conclude(result.state);
  };

  useEffect(() => {
    const worker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestIdRef.current) return;
      if (!response.decision) {
        setResponding(false);
        setOutcome("error");
        setNotice(response.error ? `对手计算失败：${response.error}` : "对手计算失败，请重来本题");
        return;
      }
      const delay = Math.max(120, 360 - response.decision.elapsedMs);
      window.setTimeout(
        () => applyAiMoveRef.current?.(response.decision?.point ?? { x: 7, y: 7 }, response.requestId),
        delay
      );
    };
    return () => {
      requestIdRef.current += 1;
      if (workerRef.current === worker) workerRef.current = undefined;
      worker.terminate();
    };
  }, [puzzle.id]);

  useEffect(() => {
    if (
      outcome !== "playing" ||
      state.result ||
      state.currentPlayer === puzzle.toMove
    ) {
      return undefined;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setResponding(true);
    const scriptedResponse = nextGomokuPuzzleSolutionMove(puzzle, solutionPrefix);
    if (scriptedResponse) {
      const timer = window.setTimeout(
        () => applyAiMoveRef.current?.(scriptedResponse, requestId),
        360
      );
      return () => window.clearTimeout(timer);
    }
    if (!workerRef.current) {
      setResponding(false);
      setOutcome("error");
      setNotice("对手模块未就绪，请重来本题");
      return undefined;
    }
    workerRef.current.postMessage({ requestId, state });
    return undefined;
  }, [outcome, puzzle, solutionPrefix, state]);

  const reset = () => {
    requestIdRef.current += 1;
    const next = createGomokuPuzzleState(puzzle);
    stateRef.current = next;
    setState(next);
    updateSolutionPrefix([]);
    setHintLevel(0);
    setAttempts((value) => value + 1);
    setResponding(false);
    setOutcome("playing");
    setEarnedStars(undefined);
    setNotice(undefined);
  };

  const playAt = (point: GomokuPoint) => {
    if (outcome !== "playing" || responding || state.currentPlayer !== puzzle.toMove) return;
    const result = playGomokuMove(state, point, state.currentPlayer);
    if (!result.ok) {
      setNotice(
        result.failure.reason === "forbidden"
          ? forbiddenLabel(result.failure.forbidden)
          : "该位置不能落子"
      );
      return;
    }
    const nextPrefix = advanceGomokuPuzzleSolution(puzzle, solutionPrefix, point);
    stateRef.current = result.state;
    setState(result.state);
    updateSolutionPrefix(nextPrefix);
    setNotice(undefined);
    conclude(result.state);
  };

  const moveSelection = (offset: number) => {
    const next = filtered[currentIndex + offset];
    if (next) onSelect(next.id);
  };

  return (
    <div className="gomoku-content-layout">
      <aside className="gomoku-content-list">
        <div className="segmented gomoku-content-filter">
          {(Object.keys(difficultyLabels) as GomokuPuzzleDifficulty[]).map((value) => (
            <button type="button" className={difficulty === value ? "is-active" : ""} onClick={() => onDifficulty(value)} key={value}>
              {difficultyLabels[value]}
            </button>
          ))}
        </div>
        <div className="gomoku-puzzle-grid">
          {filtered.map((candidate) => {
            const result = progress.puzzles[candidate.id];
            return (
              <button type="button" className={candidate.id === puzzle.id ? "is-active" : ""} onClick={() => onSelect(candidate.id)} key={candidate.id}>
                <span>{String(candidate.number).padStart(2, "0")}</span>
                <strong>{candidate.title}</strong>
                <small>{result ? `${result.stars} 星` : categoryLabel(candidate.category)}</small>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="gomoku-content-board">
        <header className="gomoku-content-heading">
          <div>
            <span className="eyebrow">残局 {String(puzzle.number).padStart(2, "0")}</span>
            <h1>{puzzle.title}</h1>
          </div>
          <span className={`gomoku-side-chip is-${puzzle.toMove}`}>{puzzle.toMove === "black" ? "黑方" : "白方"}先行</span>
        </header>
        <div className="gomoku-board-frame">
          <GomokuBoard
            state={state}
            forbiddenPoints={forbiddenPoints}
            initialMoveCount={initialMoveCount}
            disabled={
              responding ||
              outcome !== "playing" ||
              state.currentPlayer !== puzzle.toMove
            }
            onPoint={playAt}
            {...(highlighted ? { pendingPoint: highlighted } : {})}
          />
        </div>
        <div className={`gomoku-puzzle-status is-${outcome}`} aria-live="polite">
          {outcome === "won" ? (
            <><Check size={18} /><strong>挑战成功</strong><span>{earnedStars ?? progress.puzzles[puzzle.id]?.stars ?? 1} 星</span></>
          ) : outcome === "lost" ? (
            <><X size={18} /><strong>对手获胜</strong><span>重来本题</span></>
          ) : outcome === "draw" ? (
            <><RefreshCw size={18} /><strong>本题和棋</strong><span>重新尝试</span></>
          ) : outcome === "error" ? (
            <><BrainCircuit size={18} /><strong>对手计算中断</strong><span>请重来</span></>
          ) : responding ? (
            <><BrainCircuit size={18} /><strong>对手正在计算应手</strong></>
          ) : (
            <><span className={`gomoku-mini-stone is-${puzzle.toMove}`} /><strong>轮到你，选择任意合法落点</strong><span>已下 {movesPlayed} 手</span></>
          )}
        </div>
        {notice ? <p className="gomoku-notice">{notice}</p> : null}
      </section>

      <aside className="gomoku-content-tools">
        <section>
          <span className="eyebrow">提示 {hintLevel}/3</span>
          <p>{puzzleHintText(puzzle, hintLevel, solutionPrefix)}</p>
          <button className="secondary-button" type="button" disabled={hintLevel >= 3 || outcome !== "playing"} onClick={() => setHintLevel((level) => Math.min(3, level + 1))}>
            <Lightbulb size={17} /> 下一条提示
          </button>
        </section>
        <section className="gomoku-tool-actions">
          <button className="secondary-button" type="button" onClick={reset}><RefreshCw size={17} /> 重来本题</button>
        </section>
        <section className="gomoku-puzzle-nav">
          <button className="icon-button" type="button" disabled={currentIndex <= 0} onClick={() => moveSelection(-1)} aria-label="上一关" title="上一关"><ChevronLeft size={19} /></button>
          <span>{currentIndex + 1} / {filtered.length}</span>
          <button className="icon-button" type="button" disabled={currentIndex >= filtered.length - 1} onClick={() => moveSelection(1)} aria-label="下一关" title="下一关"><ChevronRight size={19} /></button>
        </section>
        <section className="gomoku-progress-summary">
          <Star size={17} />
          <span>已完成 {Object.keys(progress.puzzles).length} / {gomokuPuzzles.length}</span>
        </section>
      </aside>
    </div>
  );
}

function categoryLabel(category: GomokuPuzzle["category"]): string {
  if (category === "finish") return "一步取胜";
  if (category === "defense") return "关键防守";
  if (category === "double-threat") return "双重威胁";
  if (category === "forbidden") return "禁手判断";
  return category.toUpperCase();
}

function puzzleHintText(
  puzzle: GomokuPuzzle,
  hintLevel: number,
  solutionPrefix: readonly GomokuPoint[] | null
): string {
  if (hintLevel === 0) return "自由选择合法落点，对手会实时应手，实际成五后才算完成。";
  if (hintLevel < 3) return puzzle.hints[hintLevel - 1] ?? puzzle.hints[0];
  if (solutionPrefix === null) {
    return "你已走出标准解线，仍可继续对弈；重来后可以重新查看推荐落点。";
  }
  return nextGomokuPuzzleSolutionMove(puzzle, solutionPrefix)
    ? "棋盘已标出当前标准解的推荐落点。"
    : "标准证明线已经走完，继续对弈直到产生实际胜负。";
}

function forbiddenLabel(reason: "double-three" | "double-four" | "overline"): string {
  return reason === "double-three" ? "这是黑方三三禁手" : reason === "double-four" ? "这是黑方四四禁手" : "这一步会形成黑方长连";
}
