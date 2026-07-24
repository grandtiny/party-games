import { createGomokuGame, playGomokuMove } from "./game.js";
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
export type GomokuPuzzleObjective = "win" | "defend";

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

interface PuzzleTemplate extends Omit<GomokuPuzzle, "id" | "number" | "title"> {
  title: string;
}

const TRANSFORMS = [
  { id: "a", shift: [0, 0], map: (x: number, y: number) => [x, y] as const },
  { id: "b", shift: [1, -1], map: (x: number, y: number) => [14 - y, x] as const },
  { id: "c", shift: [-1, 1], map: (x: number, y: number) => [14 - x, 14 - y] as const },
  { id: "d", shift: [1, 1], map: (x: number, y: number) => [y, 14 - x] as const },
  { id: "e", shift: [-1, -1], map: (x: number, y: number) => [14 - x, y] as const },
  { id: "f", shift: [0, 1], map: (x: number, y: number) => [y, x] as const }
] as const;

const puzzleTemplates: PuzzleTemplate[] = [
  {
    title: "封口成五",
    category: "finish",
    difficulty: "beginner",
    ruleSet: "renju",
    toMove: "black",
    black: points([[4, 7], [5, 7], [6, 7], [7, 7]]),
    white: points([[3, 7]]),
    objective: "win",
    solutionLines: [points([[8, 7]])],
    hints: ["寻找只差一子的连续棋形。", "白棋已经封住其中一端。", "落在四颗黑棋的另一端。"],
    forbiddenDecoys: []
  },
  {
    title: "纵向收束",
    category: "finish",
    difficulty: "beginner",
    ruleSet: "renju",
    toMove: "white",
    black: points([[7, 3]]),
    white: points([[7, 4], [7, 5], [7, 6], [7, 7]]),
    objective: "win",
    solutionLines: [points([[7, 8]])],
    hints: ["白方没有禁手限制。", "观察纵向的四颗白棋。", "在下端补成五连。"],
    forbiddenDecoys: []
  },
  {
    title: "补齐断点",
    category: "finish",
    difficulty: "beginner",
    ruleSet: "renju",
    toMove: "black",
    black: points([[4, 7], [5, 7], [6, 7], [8, 7]]),
    white: points([[3, 7]]),
    objective: "win",
    solutionLines: [points([[7, 7]])],
    hints: ["连续五子可以包含当前空缺。", "不要只观察棋形两端。", "填入黑棋中间的唯一断点。"],
    forbiddenDecoys: []
  },
  {
    title: "斜线终结",
    category: "finish",
    difficulty: "beginner",
    ruleSet: "freestyle",
    toMove: "white",
    black: points([[3, 3]]),
    white: points([[4, 4], [5, 5], [6, 6], [7, 7]]),
    objective: "win",
    solutionLines: [points([[8, 8]])],
    hints: ["斜线同样可以形成五连。", "左上方向已经被黑棋封住。", "延伸右下端。"],
    forbiddenDecoys: []
  },
  {
    title: "唯一防点",
    category: "defense",
    difficulty: "intermediate",
    ruleSet: "renju",
    toMove: "black",
    black: points([[3, 7]]),
    white: points([[4, 7], [5, 7], [6, 7], [7, 7]]),
    objective: "defend",
    solutionLines: [points([[8, 7]])],
    hints: ["先检查对手下一手是否能直接获胜。", "白棋的四连只有一端开放。", "封住白棋右端。"],
    forbiddenDecoys: []
  },
  {
    title: "斜线拦截",
    category: "defense",
    difficulty: "intermediate",
    ruleSet: "renju",
    toMove: "white",
    black: points([[4, 4], [5, 5], [6, 6], [7, 7]]),
    white: points([[3, 3]]),
    objective: "defend",
    solutionLines: [points([[8, 8]])],
    hints: ["黑方下一手能够形成正好五连。", "左上端已经被白棋占据。", "封住右下端。"],
    forbiddenDecoys: []
  },
  {
    title: "避开三三",
    category: "forbidden",
    difficulty: "intermediate",
    ruleSet: "renju",
    toMove: "black",
    black: points([
      [6, 7], [8, 7], [7, 6], [7, 8],
      [4, 3], [5, 3], [6, 3], [7, 3]
    ]),
    white: points([[3, 3]]),
    objective: "win",
    solutionLines: [points([[8, 3]])],
    hints: ["中心看似强势，但黑方需要检查禁手。", "中心落子会同时形成两个活三。", "先完成上方已经存在的四连。"],
    forbiddenDecoys: points([[7, 7]])
  },
  {
    title: "五连优先",
    category: "forbidden",
    difficulty: "intermediate",
    ruleSet: "renju",
    toMove: "black",
    black: points([[3, 7], [4, 7], [5, 7], [6, 7], [7, 5], [7, 6], [7, 8]]),
    white: [],
    objective: "win",
    solutionLines: [points([[7, 7]])],
    hints: ["禁手判定需要先检查是否已经正好五连。", "中心落子会产生横向五连。", "正好五连优先获胜。"],
    forbiddenDecoys: []
  },
  {
    title: "连续冲四",
    category: "vcf",
    difficulty: "advanced",
    ruleSet: "renju",
    toMove: "black",
    black: points([[7, 7], [5, 8], [8, 6], [8, 7], [8, 9], [7, 5], [9, 7], [6, 10], [5, 10], [7, 3], [7, 9]]),
    white: points([[6, 7], [8, 8], [10, 9], [7, 6], [10, 10], [9, 8], [5, 7], [5, 6], [5, 4], [4, 6], [9, 6]]),
    objective: "win",
    solutionLines: [
      points([[10, 7], [11, 7], [6, 4], [5, 3], [10, 8]]),
      points([[10, 7], [11, 7], [6, 4], [10, 8], [5, 3]])
    ],
    hints: ["每一步都要制造对手必须回应的冲四。", "第一步从右侧横线施压。", "从 K8 开始连续冲四。"],
    forbiddenDecoys: []
  },
  {
    title: "连续威胁",
    category: "vct",
    difficulty: "advanced",
    ruleSet: "renju",
    toMove: "black",
    black: points([[7, 7], [7, 6], [9, 8], [6, 7], [7, 3], [9, 7], [11, 6], [6, 4], [8, 4], [8, 9]]),
    white: points([[8, 8], [8, 7], [8, 5], [7, 8], [8, 6], [6, 10], [7, 5], [11, 7], [4, 7], [7, 10]]),
    objective: "win",
    solutionLines: [
      points([[9, 4], [7, 4], [9, 5], [9, 6], [6, 2], [5, 1], [10, 6]]),
      points([[9, 4], [7, 4], [9, 5], [9, 6], [6, 2], [10, 6], [5, 1]])
    ],
    hints: ["连续威胁不只包含冲四，也可以利用活三。", "先扩大右上区域的进攻空间。", "第一步落在 J11。"],
    forbiddenDecoys: []
  }
];

export const gomokuPuzzles: readonly GomokuPuzzle[] = puzzleTemplates.flatMap(
  (template, templateIndex) =>
    TRANSFORMS.map((transform, transformIndex) => {
      const number = templateIndex * TRANSFORMS.length + transformIndex + 1;
      return {
        ...transformPuzzle(template, transform),
        id: `gomoku-${String(number).padStart(3, "0")}`,
        number,
        title: `${template.title} ${transformIndex + 1}`
      };
    })
);

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
  ], [exercise("vcf-start", "找到连续冲四的第一步。", "K8 是求解器验证的连续冲四起点。", "renju", "black", puzzleTemplates[8]?.black ?? [], puzzleTemplates[8]?.white ?? [], [[10, 7]]), exercise("vcf-follow", "在回应后继续制造下一次冲四。", "第二次冲四延续强制应对。", "renju", "black", [...(puzzleTemplates[8]?.black ?? []), [10, 7]], [...(puzzleTemplates[8]?.white ?? []), [11, 7]], [[6, 4]])]),
  lesson(8, "VCT 连续威胁", "连续威胁结合活三和冲四，搜索范围比 VCF 更广。", [
    "先寻找能够持续保留先手的落点。",
    "困难 AI 和高级残局会调用本地 VCT 求解器。"
  ], [exercise("vct-start", "找到连续威胁的第一步。", "J11 打开了右上区域的连续进攻。", "renju", "black", puzzleTemplates[9]?.black ?? [], puzzleTemplates[9]?.white ?? [], [[9, 4]]), exercise("vct-follow", "回应后继续保持先手。", "J10 延续威胁链。", "renju", "black", [...(puzzleTemplates[9]?.black ?? []), [9, 4]], [...(puzzleTemplates[9]?.white ?? []), [7, 4]], [[9, 5]])])
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

function transformPuzzle(
  template: PuzzleTemplate,
  transform: (typeof TRANSFORMS)[number]
): PuzzleTemplate {
  const map = (point: GomokuPoint): GomokuPoint => {
    const [mappedX, mappedY] = transform.map(point.x, point.y);
    const pointWithShift = {
      x: mappedX + transform.shift[0],
      y: mappedY + transform.shift[1]
    };
    if (pointWithShift.x < 0 || pointWithShift.y < 0 || pointWithShift.x >= 15 || pointWithShift.y >= 15) {
      throw new Error(`关卡变换越界: ${transform.id}`);
    }
    return pointWithShift;
  };
  return {
    ...template,
    black: template.black.map(map),
    white: template.white.map(map),
    solutionLines: template.solutionLines.map((line) => line.map(map)),
    forbiddenDecoys: template.forbiddenDecoys.map(map)
  };
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
