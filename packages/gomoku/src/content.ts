import { createGomokuGame, playGomokuMove } from "./game.js";
import { gomokuPuzzleSeeds, type GomokuPuzzleSeedKind } from "./puzzle-seeds.js";
import { GomokuPosition, otherStone } from "./position.js";
import type {
  GomokuGameState,
  GomokuMove,
  GomokuPoint,
  GomokuRuleSet,
  GomokuStone
} from "./types.js";

export type GomokuPuzzleCategory =
  | "finish"
  | "defense"
  | "double-threat"
  | "forbidden"
  | "vcf"
  | "vct";
export type GomokuPuzzleDifficulty = "beginner" | "intermediate" | "advanced";
export type GomokuPuzzleObjective = "win" | "defend" | "prove";

export interface GomokuPuzzle {
  id: string;
  number: number;
  title: string;
  category: GomokuPuzzleCategory;
  difficulty: GomokuPuzzleDifficulty;
  ruleSet: GomokuRuleSet;
  toMove: GomokuStone;
  black: GomokuPoint[];
  white: GomokuPoint[];
  objective: GomokuPuzzleObjective;
  solutionLines: GomokuPoint[][];
  hints: [string, string, string];
  forbiddenDecoys: GomokuPoint[];
}

export interface GomokuLessonExercise {
  id: string;
  prompt: string;
  success: string;
  ruleSet: GomokuRuleSet;
  toMove: GomokuStone;
  black: GomokuPoint[];
  white: GomokuPoint[];
  correctMoves: GomokuPoint[];
}

export interface GomokuLesson {
  id: string;
  number: number;
  title: string;
  concept: string;
  points: string[];
  exercises: GomokuLessonExercise[];
}

const NOTE_COLUMNS = "ABCDEFGHIJKLMNO";

export const gomokuPuzzles: readonly GomokuPuzzle[] = gomokuPuzzleSeeds.map((seed, index) => {
  const moves = parseNotationList(seed.moves);
  const solution = parseNotationList(seed.solution);
  const number = index + 1;
  return {
    id: "gomoku-" + String(number).padStart(3, "0"),
    number,
    title: puzzleTitle(seed.kind, number),
    category: seed.kind,
    difficulty: seed.difficulty,
    ruleSet: "renju",
    toMove: moves.length % 2 === 0 ? "black" : "white",
    black: moves.filter((_, moveIndex) => moveIndex % 2 === 0),
    white: moves.filter((_, moveIndex) => moveIndex % 2 === 1),
    objective: "prove",
    solutionLines: [solution],
    hints: puzzleHints(seed.kind, solution.length),
    forbiddenDecoys: []
  };
});

const lessonVcfTemplate = {
  black: points([[7, 7], [5, 8], [8, 6], [8, 7], [8, 9], [7, 5], [9, 7], [6, 10], [5, 10], [7, 3], [7, 9]]),
  white: points([[6, 7], [8, 8], [10, 9], [7, 6], [10, 10], [9, 8], [5, 7], [5, 6], [5, 4], [4, 6], [9, 6]])
};

const lessonVctTemplate = {
  black: points([[7, 7], [7, 6], [9, 8], [6, 7], [7, 3], [9, 7], [11, 6], [6, 4], [8, 4], [8, 9]]),
  white: points([[8, 8], [8, 7], [8, 5], [7, 8], [8, 6], [6, 10], [7, 5], [11, 7], [4, 7], [7, 10]])
};

export const gomokuLessons: readonly GomokuLesson[] = [
  lesson(1, "落子与胜负", "双方轮流在交叉点落子，先连成五子的一方获胜。", [
    "横、竖、两条斜线都能形成五连。",
    "经典规则允许五颗以上；禁手规则下黑方需要正好五颗。"
  ], [exercise("basic-win", "黑方补成横向五连。", "五子连珠，黑方获胜。", "renju", "black", [[4, 7], [5, 7], [6, 7], [7, 7]], [[3, 7]], [[8, 7]]), exercise("basic-diagonal", "白方补成斜向五连。", "斜线也是有效的获胜方向。", "renju", "white", [[3, 3]], [[4, 4], [5, 5], [6, 6], [7, 7]], [[8, 8]])]),
  lesson(2, "活二、眠三与活三", "开放端决定棋形能够继续发展的方向。", [
    "两端都开放的棋形更容易形成双向威胁。",
    "活三下一手可以形成两端可成五的直四。"
  ], [exercise("shape-open-three", "白方在中心形成横向活三。", "两端开放的三连具有持续进攻能力。", "freestyle", "white", [[3, 3]], [[6, 7], [8, 7]], [[7, 7]]), exercise("shape-sleep-three", "黑方延伸被封住一端的棋形。", "这是只有一个主要发展方向的眠三。", "renju", "black", [[5, 7], [6, 7]], [[4, 7]], [[7, 7]])]),
  lesson(3, "冲四与活四", "四连迫使对手立刻处理，否则下一手就会成五。", [
    "冲四只有一个成五点。",
    "活四有两个成五点，通常已经无法同时防守。"
  ], [exercise("four-rush", "黑方制造只有一个成五点的冲四。", "对手下一手必须封住右端。", "renju", "black", [[4, 7], [5, 7], [6, 7]], [[3, 7]], [[7, 7]]), exercise("four-open", "白方形成两端开放的活四。", "两端都能成五，防守方无法同时封住。", "freestyle", "white", [[3, 3]], [[5, 7], [6, 7], [7, 7]], [[8, 7]])]),
  lesson(4, "攻防优先级", "先检查直接获胜，再检查必须防守的对手威胁。", [
    "能直接成五时，不必进行其他布局。",
    "对手已有冲四时，必须先封堵。"
  ], [exercise("priority-win", "黑方选择直接获胜点。", "直接成五优先于防守普通棋形。", "renju", "black", [[4, 5], [5, 5], [6, 5], [7, 5]], [[3, 5], [7, 8], [8, 8], [9, 8]], [[8, 5]]), exercise("priority-block", "白方封住黑方唯一成五点。", "及时防守避免立即落败。", "renju", "white", [[4, 7], [5, 7], [6, 7], [7, 7]], [[3, 7]], [[8, 7]])]),
  lesson(5, "双重威胁", "一手棋同时制造两个威胁，常常能够突破单点防守。", [
    "交叉棋形可以同时影响两个方向。",
    "白方没有三三和四四禁手。"
  ], [exercise("fork-white", "白方在交叉点形成两个活三。", "白方可以合法制造双重威胁。", "renju", "white", [[3, 3]], [[6, 7], [8, 7], [7, 6], [7, 8]], [[7, 7]]), exercise("fork-freestyle", "经典规则下黑方形成双重威胁。", "经典规则没有三三禁手。", "freestyle", "black", [[6, 7], [8, 7], [7, 6], [7, 8]], [], [[7, 7]])]),
  lesson(6, "黑方禁手", "禁手规则限制黑方的长连、三三和四四。", [
    "白方不受这些禁手限制。",
    "黑方正好五连优先于三三、四四判断。"
  ], [exercise("forbidden-avoid", "避开中心三三，完成上方五连。", "中心是三三禁手，成五点才是正确选择。", "renju", "black", [[6, 7], [8, 7], [7, 6], [7, 8], [4, 3], [5, 3], [6, 3], [7, 3]], [[3, 3]], [[8, 3]]), exercise("forbidden-five", "黑方在中心完成正好五连。", "正好五连优先获胜，不按三三处理。", "renju", "black", [[3, 7], [4, 7], [5, 7], [6, 7], [7, 5], [7, 6], [7, 8]], [], [[7, 7]])]),
  lesson(7, "VCF 连续冲四", "连续冲四让对手每一手都只能处理成五威胁。", [
    "计算时要同时检查自己的下一次冲四位置。",
    "中途停止制造冲四，主动权通常就会丢失。"
  ], [exercise("vcf-start", "找到连续冲四的第一步。", "K8 是求解器验证的连续冲四起点。", "renju", "black", lessonVcfTemplate.black, lessonVcfTemplate.white, [[10, 7]]), exercise("vcf-follow", "在回应后继续制造下一次冲四。", "第二次冲四延续强制应对。", "renju", "black", [...lessonVcfTemplate.black, [10, 7]], [...lessonVcfTemplate.white, [11, 7]], [[6, 4]])]),
  lesson(8, "VCT 连续威胁", "连续威胁结合活三和冲四，搜索范围比 VCF 更广。", [
    "先寻找能够持续保留先手的落点。",
    "困难 AI 和高级残局会调用本地 VCT 求解器。"
  ], [exercise("vct-start", "找到连续威胁的第一步。", "J11 打开了右上区域的连续进攻。", "renju", "black", lessonVctTemplate.black, lessonVctTemplate.white, [[9, 4]]), exercise("vct-follow", "回应后继续保持先手。", "J10 延续威胁链。", "renju", "black", [...lessonVctTemplate.black, [9, 4]], [...lessonVctTemplate.white, [7, 4]], [[9, 5]])])
];

export function createGomokuPuzzleState(puzzle: GomokuPuzzle): GomokuGameState {
  return positionState(
    `puzzle:${puzzle.id}`,
    puzzle.ruleSet,
    puzzle.toMove,
    puzzle.black,
    puzzle.white
  );
}

export function createGomokuExerciseState(exercise: GomokuLessonExercise): GomokuGameState {
  return positionState(
    `lesson:${exercise.id}`,
    exercise.ruleSet,
    exercise.toMove,
    exercise.black,
    exercise.white
  );
}

export function validateGomokuPuzzle(puzzle: GomokuPuzzle): void {
  const initial = createGomokuPuzzleState(puzzle);
  const initialPosition = GomokuPosition.fromMoves(initial.moves);
  for (const decoy of puzzle.forbiddenDecoys) {
    const analysis = initialPosition.analyzePlacement(decoy, puzzle.toMove, puzzle.ruleSet);
    if (analysis.legal || !analysis.forbidden) {
      throw new Error(`${puzzle.id} 的禁手诱饵不是禁手`);
    }
  }
  if (puzzle.solutionLines.length === 0) throw new Error(`${puzzle.id} 没有解答`);
  for (const line of puzzle.solutionLines) {
    let state = initial;
    for (const move of line) {
      const result = playGomokuMove(state, move, state.currentPlayer);
      if (!result.ok) throw new Error(`${puzzle.id} 解答包含非法落子`);
      state = result.state;
    }
    if (puzzle.objective === "win" && state.result?.outcome !== puzzle.toMove) {
      throw new Error(`${puzzle.id} 解答没有让指定方获胜`);
    }
    if (puzzle.objective === "prove") {
      if (line.length < 5) throw new Error(`${puzzle.id} 证明线过短`);
      if (state.result && state.result.outcome !== puzzle.toMove) {
        throw new Error(`${puzzle.id} 证明线让对手获胜`);
      }
    }
    if (puzzle.objective === "defend") {
      const position = GomokuPosition.fromMoves(state.moves);
      const opponent = otherStone(puzzle.toMove);
      const opponentCanWin = position
        .legalMoves(opponent, puzzle.ruleSet)
        .some((point) => position.analyzePlacement(point, opponent, puzzle.ruleSet).winningLine.length > 0);
      if (opponentCanWin) throw new Error(`${puzzle.id} 的防守解仍允许对手立即获胜`);
    }
  }
}

function positionState(
  id: string,
  ruleSet: GomokuRuleSet,
  toMove: GomokuStone,
  black: readonly GomokuPoint[],
  white: readonly GomokuPoint[]
): GomokuGameState {
  const base = createGomokuGame({
    id,
    ruleSet,
    mode: "local",
    startedAt: 0,
    seed: 0
  });
  const moves: GomokuMove[] = [
    ...black.map((point) => ({ ...point, player: "black" as const })),
    ...white.map((point) => ({ ...point, player: "white" as const }))
  ].map((move, index) => ({ ...move, moveNumber: index + 1 }));
  GomokuPosition.fromMoves(moves);
  return {
    ...base,
    moves,
    currentPlayer: toMove,
    setupMoveCount: moves.length,
    setupCurrentPlayer: toMove
  };
}

function parseNotationList(value: string): GomokuPoint[] {
  if (value.trim().length === 0) return [];
  return value.split(",").map((notation) => {
    const column = NOTE_COLUMNS.indexOf(notation[0] ?? "");
    const row = Number.parseInt(notation.slice(1), 10) - 1;
    if (column < 0 || !Number.isInteger(row) || row < 0 || row >= 15) {
      throw new Error("无效五子棋坐标: " + notation);
    }
    return { x: column, y: row };
  });
}

function puzzleTitle(kind: GomokuPuzzleSeedKind, number: number): string {
  const label = kind === "vcf" ? "连续冲四" : "连续威胁";
  return label + " " + String(number).padStart(2, "0");
}

function puzzleHints(kind: GomokuPuzzleSeedKind, solutionLength: number): [string, string, string] {
  const attackerMoves = Math.ceil(solutionLength / 2);
  if (kind === "vcf") {
    return [
      "这题不是直接成五，需要连续冲四保持先手。",
      "完整解线需要 " + attackerMoves + " 次主动落子。",
      "从能迫使对手唯一应手的冲四点开始。"
    ];
  }
  return [
    "这题需要先制造连续威胁，不一定每一步都是直接冲四。",
    "完整解线需要 " + attackerMoves + " 次主动落子。",
    "优先寻找能同时保留后续威胁的落点。"
  ];
}

function lesson(
  number: number,
  title: string,
  concept: string,
  lessonPoints: string[],
  exercises: GomokuLessonExercise[]
): GomokuLesson {
  return { id: `lesson-${number}`, number, title, concept, points: lessonPoints, exercises };
}

function exercise(
  id: string,
  prompt: string,
  success: string,
  ruleSet: GomokuRuleSet,
  toMove: GomokuStone,
  black: readonly (readonly [number, number] | GomokuPoint)[],
  white: readonly (readonly [number, number] | GomokuPoint)[],
  correctMoves: readonly (readonly [number, number] | GomokuPoint)[]
): GomokuLessonExercise {
  return {
    id,
    prompt,
    success,
    ruleSet,
    toMove,
    black: normalizePoints(black),
    white: normalizePoints(white),
    correctMoves: normalizePoints(correctMoves)
  };
}

function normalizePoints(values: readonly (readonly [number, number] | GomokuPoint)[]): GomokuPoint[] {
  return values.map((value) =>
    "x" in value ? { x: value.x, y: value.y } : { x: value[0], y: value[1] }
  );
}

function points(values: readonly (readonly [number, number])[]): GomokuPoint[] {
  return values.map(([x, y]) => ({ x, y }));
}
