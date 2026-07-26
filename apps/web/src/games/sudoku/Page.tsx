import {
  CheckCircle2,
  CircleX,
  Eraser,
  Lightbulb,
  Pencil,
  RefreshCw,
  Timer,
  Undo2
} from "lucide-react";
import { getSudoku } from "sudoku-gen";
import { useEffect, useReducer, useRef, useState } from "react";
import { getAccountOverview, submitPuzzleResult } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { AppShell } from "../../platform/AppShell";

type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";
type SudokuStatus = "playing" | "complete";

interface GeneratedSudoku {
  puzzle: string;
  solution: string;
  difficulty: SudokuDifficulty;
}

interface SudokuSnapshot {
  values: string[];
  notes: number[][];
  mistakes: number;
  hintedIndexes: number[];
}

interface SudokuState extends SudokuSnapshot {
  puzzle: string;
  solution: string;
  difficulty: SudokuDifficulty;
  selectedIndex: number | null;
  noteMode: boolean;
  status: SudokuStatus;
  elapsedSeconds: number;
  history: SudokuSnapshot[];
}

type SudokuAction =
  | { type: "new"; sudoku: GeneratedSudoku }
  | { type: "select"; index: number }
  | { type: "input"; value: number }
  | { type: "erase" }
  | { type: "toggle-note-mode" }
  | { type: "undo" }
  | { type: "hint" }
  | { type: "tick" };

const difficulties: Record<SudokuDifficulty, string> = {
  easy: "简单",
  medium: "普通",
  hard: "困难",
  expert: "专家"
};

export function SudokuPage() {
  const { status: accountStatus } = useAccount();
  const [state, dispatch] = useReducer(
    sudokuReducer,
    undefined,
    () => createSudokuState(getSudoku("easy") as GeneratedSudoku)
  );
  const [bestTimes, setBestTimes] = useState<Partial<Record<SudokuDifficulty, number>>>(() =>
    loadBestTimes()
  );
  const [difficultyMenuOpen, setDifficultyMenuOpen] = useState(false);
  const submittedPuzzleRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.status !== "playing") return;
    const interval = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(interval);
  }, [state.status, state.puzzle]);

  useEffect(() => {
    if (state.status !== "complete") return;
    setBestTimes((current) => {
      const previous = current[state.difficulty];
      if (previous !== undefined && previous <= state.elapsedSeconds) return current;
      const next = { ...current, [state.difficulty]: state.elapsedSeconds };
      window.localStorage.setItem("party-games:sudoku-best", JSON.stringify(next));
      return next;
    });
  }, [state.difficulty, state.elapsedSeconds, state.status]);

  useEffect(() => {
    if (!accountStatus?.authenticated) return;
    void getAccountOverview()
      .then((overview) => {
        setBestTimes((current) => {
          const next = { ...current };
          for (const best of overview.personalBests) {
            if (best.game !== "sudoku") continue;
            const difficulty = best.difficulty as SudokuDifficulty;
            const previous = next[difficulty];
            if (previous === undefined || best.elapsedSeconds < previous) {
              next[difficulty] = best.elapsedSeconds;
            }
          }
          return next;
        });
      })
      .catch(() => undefined);
  }, [accountStatus?.user?.id]);

  useEffect(() => {
    if (!accountStatus?.authenticated || state.status !== "complete") return;
    if (submittedPuzzleRef.current === state.puzzle) return;
    submittedPuzzleRef.current = state.puzzle;
    void submitPuzzleResult({
      game: "sudoku",
      difficulty: state.difficulty,
      outcome: "win",
      elapsedSeconds: state.elapsedSeconds,
      mistakes: state.mistakes,
      hints: state.hintedIndexes.length
    }).catch(() => undefined);
  }, [
    accountStatus?.authenticated,
    state.difficulty,
    state.elapsedSeconds,
    state.hintedIndexes.length,
    state.mistakes,
    state.puzzle,
    state.status
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        dispatch({ type: "input", value: Number(event.key) });
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
        event.preventDefault();
        dispatch({ type: "erase" });
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        dispatch({ type: "toggle-note-mode" });
        return;
      }
      const direction = arrowDirection(event.key);
      if (!direction) return;
      event.preventDefault();
      dispatch({ type: "select", index: moveSelection(state.selectedIndex, direction) });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedIndex]);

  const startNewPuzzle = (difficulty = state.difficulty) => {
    dispatch({ type: "new", sudoku: getSudoku(difficulty) as GeneratedSudoku });
  };

  const selectedValue =
    state.selectedIndex === null ? "" : (state.values[state.selectedIndex] ?? "");
  const remainingCells = state.values.filter((value) => value === "").length;

  return (
    <AppShell scope="sudoku" title="数独" backTo="/">
      <div className="sk-page">
        {/* —— 标题栏（单行精简）—— */}
        <header className="sk-header">
          <div className="sk-header__title">
            <h1>数独</h1>
            <p className="eyebrow">SUDOKU</p>
          </div>

          {/* —— 状态条（玻璃胶囊，置于 header 中间填充）—— */}
          <div className={`sk-statusbar ${state.status === "complete" ? "is-done" : ""}`} aria-live="polite">
            <button
              type="button"
              className="sk-diff-pill"
              aria-expanded={difficultyMenuOpen}
              aria-label="选择难度"
              onClick={() => setDifficultyMenuOpen((open) => !open)}
            >
              {difficulties[state.difficulty]} <span className="sk-diff-arrow">▾</span>
              {difficultyMenuOpen ? (
                <div className="sk-diff-popover" role="menu">
                  {(Object.entries(difficulties) as Array<[SudokuDifficulty, string]>).map(
                    ([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={state.difficulty === value}
                        className={state.difficulty === value ? "is-active" : ""}
                        onClick={() => {
                          startNewPuzzle(value);
                          setDifficultyMenuOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </button>
            <span className="sk-stat">
              <Timer size={14} />
              <strong>{formatTime(state.elapsedSeconds)}</strong>
            </span>
            <span className="sk-stat sk-stat--error">
              <CircleX size={14} />
              <strong>{state.mistakes}</strong>
            </span>
            <span className="sk-stat">
              剩 <strong>{remainingCells}</strong>
            </span>
            {bestTimes[state.difficulty] !== undefined ? (
              <span className="sk-stat sk-stat--best">
                最佳 <strong>{formatTime(bestTimes[state.difficulty] ?? 0)}</strong>
              </span>
            ) : null}
            {state.status === "complete" ? (
              <span className="sk-status-done">题目完成</span>
            ) : null}
          </div>

          <button
            className="icon-button sk-new-btn"
            type="button"
            onClick={() => startNewPuzzle()}
            aria-label="新题"
            title="新题"
          >
            <RefreshCw size={18} />
          </button>
        </header>

        {/* —— 棋盘区 —— */}
        <div className="sk-board-wrap">
          <div className="sudoku-board-frame">
            <div
              className={`sudoku-board ${state.status === "complete" ? "is-complete" : ""}`}
              role="grid"
              aria-label="数独棋盘"
              data-status={state.status}
            >
              {state.values.map((value, index) => {
                const row = Math.floor(index / 9);
                const column = index % 9;
                const given = state.puzzle[index] !== "-";
                const selected = state.selectedIndex === index;
                const peer = state.selectedIndex !== null && isPeer(index, state.selectedIndex);
                const sameValue = Boolean(value && selectedValue && value === selectedValue);
                const error = Boolean(value && value !== state.solution[index]);
                const hinted = state.hintedIndexes.includes(index);
                const notes = state.notes[index] ?? [];
                return (
                  <button
                    className={[
                      "sudoku-cell",
                      given ? "is-given" : "is-editable",
                      selected ? "is-selected" : "",
                      peer ? "is-peer" : "",
                      sameValue ? "is-same-value" : "",
                      error ? "is-error" : "",
                      hinted ? "is-hinted" : "",
                      column === 2 || column === 5 ? "is-box-right" : "",
                      row === 2 || row === 5 ? "is-box-bottom" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    role="gridcell"
                    aria-label={sudokuCellLabel(index, value, given, notes)}
                    aria-selected={selected}
                    onClick={() => dispatch({ type: "select", index })}
                    key={index}
                  >
                    {value ? (
                      <span className="sudoku-value">{value}</span>
                    ) : notes.length > 0 ? (
                      <span className="sudoku-notes" aria-hidden="true">
                        {Array.from({ length: 9 }, (_, noteIndex) => noteIndex + 1).map((note) => (
                          <span key={note}>{notes.includes(note) ? note : ""}</span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* —— 底部控制区（合并式）—— */}
        <div className="sk-controls" aria-label="数独输入">
          {/* 5×2 网格：1-5 / 6-9 + 撤销 */}
          <div className="sk-numpad-combo">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((value) => {
              const valueCount = state.values.filter((v) => v === String(value)).length;
              const fullyFilled = valueCount >= 9;
              return (
                <button
                  type="button"
                  className={selectedValue === String(value) ? "is-current" : ""}
                  aria-pressed={selectedValue === String(value)}
                  aria-label={fullyFilled ? `${value}（已填满）` : `${value}`}
                  onClick={() => dispatch({ type: "input", value })}
                  disabled={state.status === "complete"}
                  data-filled={fullyFilled ? "true" : "false"}
                  key={value}
                >
                  {value}
                </button>
              );
            })}
            <button
              type="button"
              className="sk-undo-btn"
              onClick={() => dispatch({ type: "undo" })}
              disabled={state.history.length === 0}
              title="撤销"
              aria-label="撤销"
            >
              <Undo2 size={16} />
              <span>撤销</span>
            </button>
          </div>

          {/* 3 列工具栏 */}
          <div className="sk-toolbar">
            <button
              type="button"
              onClick={() => dispatch({ type: "erase" })}
              disabled={state.status === "complete"}
              title="擦除"
              aria-label="擦除"
            >
              <Eraser size={16} />
              <span>擦除</span>
            </button>
            <button
              type="button"
              className={state.noteMode ? "is-active" : ""}
              aria-pressed={state.noteMode}
              onClick={() => dispatch({ type: "toggle-note-mode" })}
              disabled={state.status === "complete"}
              title="候选笔记"
              aria-label="候选笔记"
            >
              <Pencil size={16} />
              <span>笔记</span>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "hint" })}
              disabled={state.status === "complete"}
              title="提示"
              aria-label="提示"
            >
              <Lightbulb size={16} />
              <span>提示</span>
            </button>
          </div>

          {state.status === "complete" ? (
            <div className="sk-complete-banner" role="status">
              <CheckCircle2 size={18} />
              <span>用时 {formatTime(state.elapsedSeconds)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function sudokuReducer(state: SudokuState, action: SudokuAction): SudokuState {
  if (action.type === "new") return createSudokuState(action.sudoku);
  if (action.type === "select") return { ...state, selectedIndex: action.index };
  if (action.type === "toggle-note-mode") return { ...state, noteMode: !state.noteMode };
  if (action.type === "tick") {
    return state.status === "playing"
      ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 }
      : state;
  }
  if (action.type === "undo") {
    const previous = state.history.at(-1);
    if (!previous) return state;
    return {
      ...state,
      ...cloneSnapshot(previous),
      status: "playing",
      history: state.history.slice(0, -1)
    };
  }
  if (state.status === "complete") return state;

  if (action.type === "hint") {
    const target = hintTarget(state);
    if (target === undefined) return state;
    const values = [...state.values];
    const notes = cloneNotes(state.notes);
    values[target] = state.solution[target] ?? "";
    notes[target] = [];
    removePeerNote(notes, target, Number(values[target]));
    return finishSudokuUpdate(state, {
      values,
      notes,
      mistakes: state.mistakes,
      hintedIndexes: [...new Set([...state.hintedIndexes, target])]
    });
  }

  const index = state.selectedIndex;
  if (index === null || state.puzzle[index] !== "-") return state;

  if (action.type === "erase") {
    if (!state.values[index] && (state.notes[index]?.length ?? 0) === 0) return state;
    const values = [...state.values];
    const notes = cloneNotes(state.notes);
    values[index] = "";
    notes[index] = [];
    return finishSudokuUpdate(state, {
      values,
      notes,
      mistakes: state.mistakes,
      hintedIndexes: state.hintedIndexes.filter((candidate) => candidate !== index)
    });
  }

  if (action.type === "input") {
    if (state.noteMode && !state.values[index]) {
      const notes = cloneNotes(state.notes);
      const current = new Set(notes[index] ?? []);
      if (current.has(action.value)) current.delete(action.value);
      else current.add(action.value);
      notes[index] = [...current].sort((left, right) => left - right);
      return finishSudokuUpdate(state, {
        values: [...state.values],
        notes,
        mistakes: state.mistakes,
        hintedIndexes: [...state.hintedIndexes]
      });
    }

    const value = String(action.value);
    if (state.values[index] === value) return state;
    const values = [...state.values];
    const notes = cloneNotes(state.notes);
    values[index] = value;
    notes[index] = [];
    removePeerNote(notes, index, action.value);
    return finishSudokuUpdate(state, {
      values,
      notes,
      mistakes: state.mistakes + (value === state.solution[index] ? 0 : 1),
      hintedIndexes: state.hintedIndexes.filter((candidate) => candidate !== index)
    });
  }

  return state;
}

function createSudokuState(sudoku: GeneratedSudoku): SudokuState {
  return {
    puzzle: sudoku.puzzle,
    solution: sudoku.solution,
    difficulty: sudoku.difficulty,
    values: [...sudoku.puzzle].map((value) => (value === "-" ? "" : value)),
    notes: Array.from({ length: 81 }, () => []),
    mistakes: 0,
    hintedIndexes: [],
    selectedIndex: firstEmptyIndex(sudoku.puzzle),
    noteMode: false,
    status: "playing",
    elapsedSeconds: 0,
    history: []
  };
}

function finishSudokuUpdate(state: SudokuState, next: SudokuSnapshot): SudokuState {
  return {
    ...state,
    ...next,
    status: next.values.join("") === state.solution ? "complete" : "playing",
    history: [...state.history, snapshotOf(state)]
  };
}

function snapshotOf(state: SudokuState): SudokuSnapshot {
  return {
    values: [...state.values],
    notes: cloneNotes(state.notes),
    mistakes: state.mistakes,
    hintedIndexes: [...state.hintedIndexes]
  };
}

function cloneSnapshot(snapshot: SudokuSnapshot): SudokuSnapshot {
  return {
    values: [...snapshot.values],
    notes: cloneNotes(snapshot.notes),
    mistakes: snapshot.mistakes,
    hintedIndexes: [...snapshot.hintedIndexes]
  };
}

function cloneNotes(notes: number[][]): number[][] {
  return notes.map((values) => [...values]);
}

function hintTarget(state: SudokuState): number | undefined {
  const selected = state.selectedIndex;
  if (
    selected !== null &&
    state.puzzle[selected] === "-" &&
    state.values[selected] !== state.solution[selected]
  ) {
    return selected;
  }
  const target = state.values.findIndex(
    (value, index) => state.puzzle[index] === "-" && value !== state.solution[index]
  );
  return target >= 0 ? target : undefined;
}

function removePeerNote(notes: number[][], index: number, value: number): void {
  for (let candidate = 0; candidate < 81; candidate += 1) {
    if (!isPeer(index, candidate)) continue;
    notes[candidate] = (notes[candidate] ?? []).filter((note) => note !== value);
  }
}

function isPeer(left: number, right: number): boolean {
  if (left === right) return false;
  const leftRow = Math.floor(left / 9);
  const leftColumn = left % 9;
  const rightRow = Math.floor(right / 9);
  const rightColumn = right % 9;
  return (
    leftRow === rightRow ||
    leftColumn === rightColumn ||
    (Math.floor(leftRow / 3) === Math.floor(rightRow / 3) &&
      Math.floor(leftColumn / 3) === Math.floor(rightColumn / 3))
  );
}

function firstEmptyIndex(puzzle: string): number {
  const index = puzzle.indexOf("-");
  return index >= 0 ? index : 0;
}

function arrowDirection(key: string): "up" | "down" | "left" | "right" | undefined {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  return undefined;
}

function moveSelection(
  selectedIndex: number | null,
  direction: "up" | "down" | "left" | "right"
): number {
  const index = selectedIndex ?? 0;
  const row = Math.floor(index / 9);
  const column = index % 9;
  if (direction === "up") return ((row + 8) % 9) * 9 + column;
  if (direction === "down") return ((row + 1) % 9) * 9 + column;
  if (direction === "left") return row * 9 + ((column + 8) % 9);
  return row * 9 + ((column + 1) % 9);
}

function sudokuCellLabel(index: number, value: string, given: boolean, notes: number[]): string {
  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  if (value) return `第 ${row} 行第 ${column} 列，${value}${given ? "，题面数字" : ""}`;
  if (notes.length > 0) return `第 ${row} 行第 ${column} 列，候选 ${notes.join("、")}`;
  return `第 ${row} 行第 ${column} 列，空白`;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function loadBestTimes(): Partial<Record<SudokuDifficulty, number>> {
  try {
    return JSON.parse(window.localStorage.getItem("party-games:sudoku-best") ?? "{}");
  } catch {
    return {};
  }
}
