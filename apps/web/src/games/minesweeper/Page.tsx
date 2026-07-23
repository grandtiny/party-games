import {
  Bomb,
  Flag,
  MousePointer2,
  RefreshCw,
  Timer,
  Trophy
} from "lucide-react";
import {
  createCoordinate,
  gameReducer,
  revealCell,
  startGame,
  toggleFlag,
  type Difficulty,
  type Minesweeper
} from "minesweeper-redux";
import { useEffect, useReducer, useState, type CSSProperties } from "react";
import { AppShell } from "../../platform/AppShell";

type MinesweeperLevel = "beginner" | "intermediate" | "expert";
type InputMode = "reveal" | "flag";

const levels: Record<
  MinesweeperLevel,
  { label: string; difficulty: Difficulty; sizeLabel: string }
> = {
  beginner: {
    label: "初级",
    difficulty: { height: 9, width: 9, numMines: 10 },
    sizeLabel: "9×9"
  },
  intermediate: {
    label: "中级",
    difficulty: { height: 16, width: 16, numMines: 40 },
    sizeLabel: "16×16"
  },
  expert: {
    label: "高级",
    difficulty: { height: 16, width: 30, numMines: 99 },
    sizeLabel: "30×16"
  }
};

export function MinesweeperPage() {
  const [level, setLevel] = useState<MinesweeperLevel>("beginner");
  const [game, dispatch] = useReducer(gameReducer, undefined, () => createGame("beginner"));
  const [inputMode, setInputMode] = useState<InputMode>("reveal");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTimes, setBestTimes] = useState<Partial<Record<MinesweeperLevel, number>>>(() =>
    loadBestTimes()
  );

  useEffect(() => {
    if (game.status !== "running") return;
    const interval = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1000
    );
    return () => window.clearInterval(interval);
  }, [game.status, game.randSeed]);

  useEffect(() => {
    if (game.status !== "win") return;
    setBestTimes((current) => {
      const previous = current[level];
      if (previous !== undefined && previous <= elapsedSeconds) return current;
      const next = { ...current, [level]: elapsedSeconds };
      window.localStorage.setItem("party-games:minesweeper-best", JSON.stringify(next));
      return next;
    });
  }, [elapsedSeconds, game.status, level]);

  const startNewGame = (nextLevel = level) => {
    setLevel(nextLevel);
    setElapsedSeconds(0);
    setInputMode("reveal");
    dispatch(startGame({ difficulty: levels[nextLevel].difficulty, randSeed: randomSeed() }));
  };

  const revealAt = (x: number, y: number) => {
    if (game.status === "win" || game.status === "loss") return;
    const cell = game.grid[y]?.[x];
    if (!cell) return;
    if (cell.status === "revealed") {
      revealAdjacentCells(game, x, y, dispatch);
      return;
    }
    dispatch(revealCell({ coordinate: createCoordinate(x, y) }));
  };

  const flagAt = (x: number, y: number) => {
    if (game.status !== "running") return;
    dispatch(toggleFlag({ coordinate: createCoordinate(x, y) }));
  };

  const activateCell = (x: number, y: number) => {
    if (inputMode === "flag") flagAt(x, y);
    else revealAt(x, y);
  };

  const levelConfig = levels[level];
  const status = minesweeperStatus(game.status);
  const remainingMines =
    game.status === "ready" ? levelConfig.difficulty.numMines : game.remainingFlags;
  const boardStyle = {
    "--mine-columns": levelConfig.difficulty.width,
    "--mine-cell-size": level === "expert" ? "27px" : "32px"
  } as CSSProperties;

  return (
    <AppShell scope="minesweeper" title="扫雷" backTo="/">
      <section className="puzzle-header minesweeper-heading">
        <div>
          <p className="eyebrow">MINESWEEPER</p>
          <h1>扫雷</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => startNewGame()}
          aria-label="重新开始"
          title="重新开始"
        >
          <RefreshCw size={19} />
        </button>
      </section>

      <section className="puzzle-controls" aria-label="扫雷设置">
        <div
          className="segmented puzzle-difficulty"
          role="tablist"
          aria-label="扫雷难度"
          style={{ "--difficulty-count": 3 } as CSSProperties}
        >
          {(Object.entries(levels) as Array<
            [MinesweeperLevel, (typeof levels)[MinesweeperLevel]]
          >).map(([value, config]) => (
            <button
              type="button"
              className={level === value ? "is-active" : ""}
              aria-selected={level === value}
              onClick={() => startNewGame(value)}
              key={value}
            >
              {config.label} {config.sizeLabel}
            </button>
          ))}
        </div>

        <div className="puzzle-status-row">
          <span className="puzzle-stat">
            <Bomb size={17} />
            剩余 <strong>{Math.max(0, remainingMines)}</strong>
          </span>
          <span className="puzzle-stat">
            <Timer size={17} />
            <strong>{formatTime(elapsedSeconds)}</strong>
          </span>
          {bestTimes[level] !== undefined ? (
            <span className="puzzle-stat">
              <Trophy size={17} />
              最佳 <strong>{formatTime(bestTimes[level] ?? 0)}</strong>
            </span>
          ) : null}
          <span className={`puzzle-status-message ${status.className}`}>{status.label}</span>
        </div>

        <div className="segmented minesweeper-input-mode" role="tablist" aria-label="点击模式">
          <button
            type="button"
            className={inputMode === "reveal" ? "is-active" : ""}
            aria-selected={inputMode === "reveal"}
            onClick={() => setInputMode("reveal")}
          >
            <MousePointer2 size={16} />
            翻开
          </button>
          <button
            type="button"
            className={inputMode === "flag" ? "is-active" : ""}
            aria-selected={inputMode === "flag"}
            onClick={() => setInputMode("flag")}
            disabled={game.status !== "running"}
          >
            <Flag size={16} />
            插旗
          </button>
        </div>
      </section>

      <div className="minesweeper-board-scroll">
        <div
          className={`minesweeper-board minesweeper-board--${level}`}
          style={boardStyle}
          role="grid"
          aria-label={`${levelConfig.label}扫雷棋盘`}
        >
          {game.grid.flatMap((row, y) =>
            row.map((cell, x) => {
              const isMine = cell.mineCount === -1;
              const showWinningFlag = game.status === "win" && isMine;
              const content = showWinningFlag ? (
                <Flag size={16} />
              ) : cell.status === "flagged" ? (
                <Flag size={16} />
              ) : (cell.status === "revealed" || cell.status === "detonated") && isMine ? (
                <Bomb size={16} />
              ) : cell.status === "revealed" && cell.mineCount > 0 ? (
                cell.mineCount
              ) : null;
              return (
                <button
                  className={[
                    "minesweeper-cell",
                    `is-${cell.status}`,
                    isMine ? "is-mine" : "",
                    showWinningFlag ? "is-winning-flag" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  role="gridcell"
                  data-count={cell.status === "revealed" ? cell.mineCount : undefined}
                  aria-label={cellLabel(cell.status, cell.mineCount, x, y)}
                  onClick={() => activateCell(x, y)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    flagAt(x, y);
                  }}
                  key={`${x}-${y}`}
                >
                  {content}
                </button>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

function createGame(level: MinesweeperLevel): Minesweeper {
  return gameReducer(
    undefined,
    startGame({ difficulty: levels[level].difficulty, randSeed: randomSeed() })
  );
}

function revealAdjacentCells(
  game: Minesweeper,
  x: number,
  y: number,
  dispatch: (action: ReturnType<typeof revealCell>) => void
): void {
  const center = game.grid[y]?.[x];
  if (!center || center.status !== "revealed" || center.mineCount <= 0) return;
  const neighbors = adjacentCoordinates(game, x, y);
  const flagged = neighbors.filter(
    ([neighborX, neighborY]) => game.grid[neighborY]?.[neighborX]?.status === "flagged"
  ).length;
  if (flagged !== center.mineCount) return;
  neighbors.forEach(([neighborX, neighborY]) => {
    const cell = game.grid[neighborY]?.[neighborX];
    if (cell?.status === "hidden") {
      dispatch(revealCell({ coordinate: createCoordinate(neighborX, neighborY) }));
    }
  });
}

function adjacentCoordinates(game: Minesweeper, x: number, y: number): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) continue;
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      if (game.grid[neighborY]?.[neighborX]) coordinates.push([neighborX, neighborY]);
    }
  }
  return coordinates;
}

function minesweeperStatus(status: Minesweeper["status"]): {
  label: string;
  className: string;
} {
  if (status === "win") return { label: "已清除全部雷区", className: "is-win" };
  if (status === "loss") return { label: "踩雷，本局结束", className: "is-loss" };
  if (status === "running") return { label: "排雷中", className: "" };
  return { label: "翻开任意格开始", className: "" };
}

function cellLabel(
  status: "hidden" | "flagged" | "revealed" | "detonated",
  mineCount: number,
  x: number,
  y: number
): string {
  const position = `第 ${y + 1} 行第 ${x + 1} 列`;
  if (status === "hidden") return `${position}，未翻开`;
  if (status === "flagged") return `${position}，已插旗`;
  if (mineCount === -1) return `${position}，地雷`;
  return `${position}，周围 ${mineCount} 个地雷`;
}

function randomSeed(): number {
  return Date.now() + Math.random();
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function loadBestTimes(): Partial<Record<MinesweeperLevel, number>> {
  try {
    return JSON.parse(window.localStorage.getItem("party-games:minesweeper-best") ?? "{}");
  } catch {
    return {};
  }
}
