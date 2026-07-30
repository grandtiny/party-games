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
import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { getAccountOverview, submitPuzzleResult } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { AppShell } from "../../platform/AppShell";

type MinesweeperLevel = "beginner" | "intermediate" | "expert";
type InputMode = "reveal" | "flag";
type FaceMood = "smile" | "oh" | "win" | "loss";

const TOUCH_FLAG_HOLD_MS = 420;
const TOUCH_MOVE_CANCEL_DISTANCE = 12;

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

/* ============================================================
   7 段数码管
   段位编号（顺时针，g 为中间横杠）：
       aaa
      f   b
      f   b
       ggg
      e   c
      e   c
       ddd
   ============================================================ */

type Segments = [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

const SEGMENTS: Record<string, Segments> = {
  //              a, b, c, d, e, f, g
  "0": [true, true, true, true, true, true, false],
  "1": [false, true, true, false, false, false, false],
  "2": [true, true, false, true, true, false, true],
  "3": [true, true, true, true, false, false, true],
  "4": [false, true, true, false, false, true, true],
  "5": [true, false, true, true, false, true, true],
  "6": [true, false, true, true, true, true, true],
  "7": [true, true, true, false, false, false, false],
  "8": [true, true, true, true, true, true, true],
  "9": [true, true, true, true, false, true, true],
  "-": [false, false, false, false, false, false, true],
  " ": [false, false, false, false, false, false, false]
};

const LED_WIDTH = 13;
const LED_HEIGHT = 23;

const BLANK_SEGMENTS: Segments = [false, false, false, false, false, false, false];

function SevenSegment({ char }: { char: string }) {
  const segs = SEGMENTS[char] ?? BLANK_SEGMENTS;
  const [a, b, c, d, e, f, g] = segs;
  // 6 个斜段 + 1 个中横段，坐标基于 13×23 viewBox
  return (
    <svg
      width={LED_WIDTH}
      height={LED_HEIGHT}
      viewBox="0 0 13 23"
      aria-hidden="true"
    >
      {/* a 顶横 */}
      <path className={`ms-led__seg${a ? " is-on" : ""}`} d="M2 1.5 L11 1.5 L9.5 3 L3.5 3 Z" />
      {/* b 右上竖 */}
      <path className={`ms-led__seg${b ? " is-on" : ""}`} d="M11 1.5 L11.5 2 L10 10.5 L8.5 10 L9.5 3 Z" />
      {/* c 右下竖 */}
      <path className={`ms-led__seg${c ? " is-on" : ""}`} d="M10 12.5 L11.5 21 L11 21.5 L9.5 21.5 L8.5 13 Z" />
      {/* d 底横 */}
      <path className={`ms-led__seg${d ? " is-on" : ""}`} d="M3.5 20 L9.5 20 L11 21.5 L2 21.5 Z" />
      {/* e 左下竖 */}
      <path className={`ms-led__seg${e ? " is-on" : ""}`} d="M2 21.5 L1.5 21 L3 12.5 L4.5 13 L3.5 21 Z" />
      {/* f 左上竖 */}
      <path className={`ms-led__seg${f ? " is-on" : ""}`} d="M1.5 2 L2 1.5 L3.5 3 L2.5 10 L1 10.5 Z" />
      {/* g 中横 */}
      <path className={`ms-led__seg${g ? " is-on" : ""}`} d="M3 10.5 L9.5 10.5 L10 12 L9.5 13 L3 13 L2.5 12 Z" />
    </svg>
  );
}

function SevenSegmentDisplay({ value }: { value: string }) {
  // 固定 3 位，不足补空格
  const padded = value.padStart(3, " ").slice(0, 3);
  return (
    <span className="ms-led" role="textbox" aria-label={value.trim() || "0"}>
      {padded.split("").map((char, i) => (
        <SevenSegment key={i} char={char} />
      ))}
    </span>
  );
}

/* ============================================================
   笑脸 · 4 种表情
   ============================================================ */

function SmileyFace({ mood }: { mood: FaceMood }) {
  // 公共：黄色圆脸 + 黑描边
  const face = (
    <circle cx="10" cy="10" r="8.5" fill="#ffd800" stroke="#000" strokeWidth="1" />
  );
  let features;
  if (mood === "win") {
    // 胜利：墨镜 + 笑嘴
    features = (
      <g fill="#000" stroke="#000">
        {/* 左墨镜 */}
        <rect x="2.5" y="7" width="5" height="3.5" rx="1" strokeWidth="0.5" />
        {/* 右墨镜 */}
        <rect x="9.5" y="7" width="5" height="3.5" rx="1" strokeWidth="0.5" />
        {/* 鼻梁 */}
        <line x1="7.5" y1="8.5" x2="9.5" y2="8.5" strokeWidth="0.8" />
        {/* 笑嘴 */}
        <path d="M5 14 Q10 18 15 14" fill="none" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    );
  } else if (mood === "loss") {
    // 失败：X 眼 + 下弯嘴
    features = (
      <g stroke="#000" strokeWidth="1.2" strokeLinecap="round" fill="none">
        <line x1="4" y1="6.5" x2="7" y2="9.5" />
        <line x1="7" y1="6.5" x2="4" y2="9.5" />
        <line x1="13" y1="6.5" x2="16" y2="9.5" />
        <line x1="16" y1="6.5" x2="13" y2="9.5" />
        <path d="M5.5 15.5 Q10 12 14.5 15.5" />
      </g>
    );
  } else if (mood === "oh") {
    // 惊吓：O 嘴 + 圆眼
    features = (
      <g stroke="#000" fill="#000">
        <circle cx="6" cy="8.5" r="1" />
        <circle cx="14" cy="8.5" r="1" />
        <ellipse cx="10" cy="15" rx="2" ry="2.5" fill="#000" stroke="none" />
      </g>
    );
  } else {
    // 默认微笑
    features = (
      <g stroke="#000" fill="#000">
        <circle cx="6" cy="8.5" r="1" />
        <circle cx="14" cy="8.5" r="1" />
        <path d="M5 13 Q10 17 15 13" fill="none" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {face}
      {features}
    </svg>
  );
}

export function MinesweeperPage() {
  const { status: accountStatus } = useAccount();
  const [level, setLevel] = useState<MinesweeperLevel>("beginner");
  const [game, dispatch] = useReducer(gameReducer, undefined, () => createGame("beginner"));
  const [inputMode, setInputMode] = useState<InputMode>("reveal");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTimes, setBestTimes] = useState<Partial<Record<MinesweeperLevel, number>>>(() =>
    loadBestTimes()
  );
  const submittedGameRef = useRef<string | undefined>(undefined);
  // 笑脸"oh"状态：鼠标按下未翻开格子时为 true
  const [pressing, setPressing] = useState(false);
  const pressingRef = useRef(false);
  const touchFlagTimerRef = useRef<number | undefined>(undefined);
  const touchFlagPressRef = useRef<
    { pointerId: number; startX: number; startY: number } | undefined
  >(undefined);
  const suppressNextClickRef = useRef(false);
  const suppressNextContextMenuRef = useRef(false);

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

  useEffect(() => {
    if (!accountStatus?.authenticated) return;
    void getAccountOverview()
      .then((overview) => {
        setBestTimes((current) => {
          const next = { ...current };
          for (const best of overview.personalBests) {
            if (best.game !== "minesweeper") continue;
            const difficulty = best.difficulty as MinesweeperLevel;
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
    if (!accountStatus?.authenticated || (game.status !== "win" && game.status !== "loss")) {
      return;
    }
    const resultKey = `${game.randSeed}:${game.status}`;
    if (submittedGameRef.current === resultKey) return;
    submittedGameRef.current = resultKey;
    void submitPuzzleResult({
      game: "minesweeper",
      difficulty: level,
      outcome: game.status,
      elapsedSeconds,
      mistakes: 0,
      hints: 0
    }).catch(() => undefined);
  }, [accountStatus?.authenticated, elapsedSeconds, game.randSeed, game.status, level]);

  const clearTouchFlagPress = () => {
    if (touchFlagTimerRef.current !== undefined) {
      window.clearTimeout(touchFlagTimerRef.current);
      touchFlagTimerRef.current = undefined;
    }
    touchFlagPressRef.current = undefined;
  };

  useEffect(() => () => clearTouchFlagPress(), []);

  const startNewGame = (nextLevel = level) => {
    setLevel(nextLevel);
    setElapsedSeconds(0);
    setInputMode("reveal");
    setPressing(false);
    pressingRef.current = false;
    clearTouchFlagPress();
    suppressNextClickRef.current = false;
    suppressNextContextMenuRef.current = false;
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

  const activateCellFromClick = (x: number, y: number) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    activateCell(x, y);
  };

  const handleCellPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    x: number,
    y: number
  ) => {
    if (event.pointerType === "mouse" || game.status !== "running") return;
    const cell = game.grid[y]?.[x];
    if (!cell || cell.status === "revealed" || cell.status === "detonated") return;

    clearTouchFlagPress();
    touchFlagPressRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    touchFlagTimerRef.current = window.setTimeout(() => {
      touchFlagTimerRef.current = undefined;
      touchFlagPressRef.current = undefined;
      suppressNextClickRef.current = true;
      suppressNextContextMenuRef.current = true;
      flagAt(x, y);
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
        suppressNextContextMenuRef.current = false;
      }, 900);
    }, TOUCH_FLAG_HOLD_MS);
  };

  const handleCellPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const press = touchFlagPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (distance > TOUCH_MOVE_CANCEL_DISTANCE) clearTouchFlagPress();
  };

  const handleCellPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (touchFlagPressRef.current?.pointerId === event.pointerId) clearTouchFlagPress();
  };

  const handleBoardContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  // 笑脸表情派生
  const faceMood: FaceMood =
    game.status === "win" ? "win" : game.status === "loss" ? "loss" : pressing ? "oh" : "smile";

  // 棋盘按下/抬起事件委托：仅 reveal 模式 + 进行中 + 鼠标左键才触发"oh"
  const handleBoardMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    if (inputMode !== "reveal") return;
    if (game.status !== "running" && game.status !== "ready") return;
    pressingRef.current = true;
    setPressing(true);
  };
  const handleBoardMouseUp = () => {
    if (!pressingRef.current) return;
    pressingRef.current = false;
    setPressing(false);
  };
  const handleBoardMouseLeave = () => {
    if (!pressingRef.current) return;
    pressingRef.current = false;
    setPressing(false);
  };

  const levelConfig = levels[level];
  const status = minesweeperStatus(game.status);
  const remainingMines =
    game.status === "ready" ? levelConfig.difficulty.numMines : game.remainingFlags;
  const boardStyle = {
    "--mine-columns": levelConfig.difficulty.width
  } as CSSProperties;

  // LED 显示值：剩余雷数（含负数）与计时（封顶 999）
  const mineDisplay = formatLedNumber(remainingMines);
  const timeDisplay = formatLedNumber(Math.min(999, elapsedSeconds));

  return (
    <AppShell scope="minesweeper" title="扫雷" backTo="/">
      <div className="ms-window">
        {/* 标题栏 */}
        <div className="ms-titlebar">
          <span className="ms-titlebar__icon" aria-hidden="true">
            <MineIcon />
          </span>
          <span className="ms-titlebar__text">扫雷</span>
          <span className="ms-titlebar__controls" aria-hidden="true">
            <span className="ms-titlebar__btn">
              <UnderscoreBar />
            </span>
            <span className="ms-titlebar__btn">
              <SquareBox />
            </span>
            <span className="ms-titlebar__btn">
              <CloseX />
            </span>
          </span>
        </div>

        {/* 菜单栏 */}
        <div className="ms-menubar" aria-hidden="true">
          <span className="ms-menubar__item">
            游戏<u>(</u>G)
          </span>
          <span className="ms-menubar__item">
            帮<u>(</u>H)
          </span>
        </div>

        {/* 正文区 */}
        <div className="ms-body">
          <div className="ms-counter-row">
            <SevenSegmentDisplay value={mineDisplay} />
            <button
              className={`ms-face${pressing ? " is-pressed" : ""}`}
              type="button"
              onClick={() => startNewGame()}
              aria-label="重新开始"
              title="重新开始"
            >
              <SmileyFace mood={faceMood} />
            </button>
            <SevenSegmentDisplay value={timeDisplay} />
          </div>

          <div
            className="ms-board-scroll"
            onContextMenuCapture={handleBoardContextMenu}
            onMouseDown={handleBoardMouseDown}
            onMouseUp={handleBoardMouseUp}
            onMouseLeave={handleBoardMouseLeave}
          >
            <div
              className={`ms-board ms-board--${level}`}
              style={boardStyle}
              role="grid"
              aria-label={`${levelConfig.label}扫雷棋盘`}
              data-status={game.status}
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
                        cell.status === "revealed" && cell.mineCount === 0 ? "is-empty" : "",
                        isMine ? "is-mine" : "",
                        showWinningFlag ? "is-winning-flag" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      role="gridcell"
                      data-count={cell.status === "revealed" ? cell.mineCount : undefined}
                      aria-label={cellLabel(cell.status, cell.mineCount, x, y)}
                      onClick={() => activateCellFromClick(x, y)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (suppressNextContextMenuRef.current) {
                          suppressNextContextMenuRef.current = false;
                          return;
                        }
                        flagAt(x, y);
                      }}
                      onPointerDown={(event) => handleCellPointerDown(event, x, y)}
                      onPointerMove={handleCellPointerMove}
                      onPointerUp={handleCellPointerEnd}
                      onPointerCancel={handleCellPointerEnd}
                      key={`${x}-${y}`}
                    >
                      {content}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 窗口下方辅助工具条 */}
      <div className="ms-toolbar">
        <div className="ms-toolbar__group ms-toolbar__group--difficulty">
          <span className="ms-toolbar__label">难度</span>
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
        </div>

        <div className="ms-toolbar__group ms-toolbar__group--input">
          <div className="segmented minesweeper-input-mode" role="tablist" aria-label="点击模式">
            <button
              type="button"
              className={inputMode === "reveal" ? "is-active" : ""}
              aria-selected={inputMode === "reveal"}
              onClick={() => setInputMode("reveal")}
            >
              <MousePointer2 size={14} />
              翻开
            </button>
            <button
              type="button"
              className={inputMode === "flag" ? "is-active" : ""}
              aria-selected={inputMode === "flag"}
              onClick={() => setInputMode("flag")}
              disabled={game.status !== "running"}
            >
              <Flag size={14} />
              插旗
            </button>
          </div>
        </div>

        <div className="ms-toolbar__group ms-toolbar__group--status">
          {bestTimes[level] !== undefined ? (
            <span className="ms-toolbar__stat">
              <Trophy size={14} />
              最佳 <strong>{formatTime(bestTimes[level] ?? 0)}</strong>
            </span>
          ) : null}
          <span className={`ms-toolbar__status ${status.className}`}>{status.label}</span>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------- 标题栏小图标（SVG，不依赖 emoji） ---------- */

function MineIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="9" r="5" fill="#000" />
      <circle cx="6.5" cy="7.5" r="1.2" fill="#fff" />
      {/* 尖刺 */}
      <g stroke="#000" strokeWidth="1" strokeLinecap="round">
        <line x1="8" y1="2" x2="8" y2="4" />
        <line x1="2" y1="9" x2="4" y2="9" />
        <line x1="12" y1="9" x2="14" y2="9" />
        <line x1="3.5" y1="4.5" x2="5" y2="6" />
        <line x1="12.5" y1="4.5" x2="11" y2="6" />
      </g>
    </svg>
  );
}

function UnderscoreBar() {
  return (
    <svg viewBox="0 0 10 10">
      <rect x="1.5" y="7" width="7" height="1.6" fill="currentColor" />
    </svg>
  );
}

function SquareBox() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="2" y="2" width="6" height="6" />
      <rect x="3.2" y="3.2" width="3.6" height="3.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CloseX() {
  return (
    <svg viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="2.5" y1="2.5" x2="7.5" y2="7.5" />
      <line x1="7.5" y1="2.5" x2="2.5" y2="7.5" />
    </svg>
  );
}

/* ---------- 工具函数 ---------- */

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

// LED 数值：3 位，负数第一位显示 "-"，其余前导零
function formatLedNumber(value: number): string {
  if (value < 0) {
    const abs = Math.min(99, Math.abs(value));
    return `-${String(abs).padStart(2, "0")}`;
  }
  return String(Math.min(999, value)).padStart(3, "0");
}

function loadBestTimes(): Partial<Record<MinesweeperLevel, number>> {
  try {
    return JSON.parse(window.localStorage.getItem("party-games:minesweeper-best") ?? "{}");
  } catch {
    return {};
  }
}
