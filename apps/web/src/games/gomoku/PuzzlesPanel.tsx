import {
  GomokuPosition,
  createGomokuPuzzleState,
  gomokuPuzzles,
  playGomokuMove,
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
  Star
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { syncGomokuProgress } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { GomokuBoard } from "./Board";
import {
  gomokuProgressItems,
  loadGomokuProgress,
  saveGomokuGame,
  saveGomokuProgress,
  type GomokuLocalProgress
} from "./storage";

const difficultyLabels: Record<GomokuPuzzleDifficulty, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级"
};

export function GomokuPuzzlesPanel() {
  const { status: accountStatus } = useAccount();
  const navigate = useNavigate();
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
      onChallenge={(state) => {
        saveGomokuGame({
          ...state,
          id: crypto.randomUUID(),
          mode: "ai",
          humanColor: state.currentPlayer,
          aiDifficulty: "normal",
          startedAt: Date.now(),
          elapsedSeconds: 0,
          usedUndo: false,
          usedHint: false
        });
        navigate("/gomoku");
      }}
    />
  );
}

function PuzzleWorkspace({
  puzzle,
  filtered,
  difficulty,
  onDifficulty,
  onSelect,
  onChallenge,
  syncAccount
}: {
  puzzle: GomokuPuzzle;
  filtered: readonly GomokuPuzzle[];
  difficulty: GomokuPuzzleDifficulty;
  onDifficulty: (difficulty: GomokuPuzzleDifficulty) => void;
  onSelect: (id: string) => void;
  onChallenge: (state: GomokuGameState) => void;
  syncAccount: boolean;
}) {
  const [state, setState] = useState(() => createGomokuPuzzleState(puzzle));
  const [prefix, setPrefix] = useState<GomokuPoint[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [responding, setResponding] = useState(false);
  const [complete, setComplete] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [progress, setProgress] = useState<GomokuLocalProgress>(() => loadGomokuProgress());

  const initialMoveCount = puzzle.black.length + puzzle.white.length;
  const matchingLines = puzzle.solutionLines.filter((line) => prefixMatches(line, prefix));
  const highlighted = hintLevel >= 3 ? matchingLines[0]?.[prefix.length] : undefined;
  const forbiddenPoints = hintLevel >= 2 ? puzzle.forbiddenDecoys : [];
  const currentIndex = filtered.findIndex((candidate) => candidate.id === puzzle.id);

  const reset = () => {
    setState(createGomokuPuzzleState(puzzle));
    setPrefix([]);
    setMistakes(0);
    setHintLevel(0);
    setResponding(false);
    setComplete(false);
    setNotice(undefined);
  };

  const playAt = (point: GomokuPoint) => {
    if (complete || responding) return;
    const nextLines = matchingLines.filter((line) => samePoint(line[prefix.length], point));
    if (nextLines.length === 0) {
      const position = GomokuPosition.fromMoves(state.moves);
      const analysis = position.analyzePlacement(point, state.currentPlayer, state.ruleSet);
      setMistakes((value) => value + 1);
      setNotice(
        !analysis.legal && analysis.forbidden
          ? forbiddenLabel(analysis.forbidden)
          : puzzle.objective === "defend"
            ? "这一步无法解除对手的直接威胁"
            : "这一步不能保持题目的强制进攻"
      );
      return;
    }
    const result = playGomokuMove(state, point, state.currentPlayer);
    if (!result.ok) {
      setMistakes((value) => value + 1);
      setNotice("该位置不能落子");
      return;
    }
    const nextPrefix = [...prefix, point];
    setState(result.state);
    setPrefix(nextPrefix);
    setNotice(undefined);
    if (puzzle.objective === "defend" || result.state.result?.outcome === puzzle.toMove) {
      finish(nextPrefix.length);
      return;
    }
    const response = nextLines[0]?.[nextPrefix.length];
    if (!response) return;
    setResponding(true);
    window.setTimeout(() => {
      const responseResult = playGomokuMove(result.state, response, result.state.currentPlayer);
      if (responseResult.ok) {
        setState(responseResult.state);
        setPrefix([...nextPrefix, response]);
      }
      setResponding(false);
    }, 360);
  };

  const finish = (movesUsed: number) => {
    setComplete(true);
    const stars = Math.max(1, 3 - Math.min(2, hintLevel) - Math.min(1, mistakes));
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
            disabled={responding || complete}
            onPoint={playAt}
            {...(highlighted ? { pendingPoint: highlighted } : {})}
          />
        </div>
        <div className="gomoku-puzzle-status" aria-live="polite">
          {complete ? (
            <><Check size={18} /><strong>完成</strong><span>{progress.puzzles[puzzle.id]?.stars ?? 1} 星</span></>
          ) : responding ? (
            <><BrainCircuit size={18} /><strong>对手应手</strong></>
          ) : (
            <><span className={`gomoku-mini-stone is-${state.currentPlayer}`} /><strong>{puzzle.objective === "defend" ? "找到唯一防点" : "找到强制获胜路线"}</strong><span>失误 {mistakes}</span></>
          )}
        </div>
        {notice ? <p className="gomoku-notice">{notice}</p> : null}
      </section>

      <aside className="gomoku-content-tools">
        <section>
          <span className="eyebrow">提示 {hintLevel}/3</span>
          <p>{hintLevel === 0 ? "保持先手，先计算对手的唯一回应。" : puzzle.hints[hintLevel - 1]}</p>
          <button className="secondary-button" type="button" disabled={hintLevel >= 3 || complete} onClick={() => setHintLevel((level) => Math.min(3, level + 1))}>
            <Lightbulb size={17} /> 下一条提示
          </button>
        </section>
        <section className="gomoku-tool-actions">
          <button className="secondary-button" type="button" onClick={reset}><RefreshCw size={17} /> 重置</button>
          <button className="secondary-button" type="button" onClick={() => onChallenge(createGomokuPuzzleState(puzzle))}><BrainCircuit size={17} /> 挑战 AI</button>
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

function prefixMatches(line: readonly GomokuPoint[], prefix: readonly GomokuPoint[]): boolean {
  return prefix.every((point, index) => samePoint(line[index], point));
}

function samePoint(left: GomokuPoint | undefined, right: GomokuPoint | undefined): boolean {
  return Boolean(left && right && left.x === right.x && left.y === right.y);
}

function categoryLabel(category: GomokuPuzzle["category"]): string {
  if (category === "finish") return "一步取胜";
  if (category === "defense") return "关键防守";
  if (category === "forbidden") return "禁手判断";
  return category.toUpperCase();
}

function forbiddenLabel(reason: "double-three" | "double-four" | "overline"): string {
  return reason === "double-three" ? "这是黑方三三禁手" : reason === "double-four" ? "这是黑方四四禁手" : "这一步会形成黑方长连";
}
