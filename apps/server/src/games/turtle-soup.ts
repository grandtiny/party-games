import { createHash } from "node:crypto";
import type {
  RoomPhase,
  TurtleSoupAnswerView,
  TurtleSoupLogEntryView,
  TurtleSoupView
} from "@party-games/shared";
import {
  migrateInternalRoomState,
  type InternalRoomState,
  type TurtleSoupPuzzleState
} from "../domain.js";
import type {
  GameRoomCommand,
  GameRoomCreateContext,
  GameRoomHandleContext,
  GameRoomProjection,
  GameRoomProjectionContext,
  GameRoomTickContext,
  GameRoomUpdate,
  ServerGameModule
} from "../platform/game-module.js";
import type {
  TurtleSoupAiAdapter,
  TurtleSoupGuessJudgment,
  TurtleSoupQuestionJudgment
} from "./turtle-soup-ai.js";

export type TurtleSoupAiAction =
  | "create-puzzle"
  | "judge-question"
  | "judge-guess"
  | "create-hint";

export interface TurtleSoupAiFailureEvent {
  action: TurtleSoupAiAction;
  roomCode: string;
  error: string;
  puzzleId?: string;
  puzzleSource?: "model" | "local";
}

export type TurtleSoupAiFailureHandler = (event: TurtleSoupAiFailureEvent) => void;

const LOCAL_TURTLE_SOUP_PUZZLES: readonly TurtleSoupPuzzleState[] = [
  {
    id: "umbrella-elevator",
    title: "雨天到家",
    surface:
      "一个人每天坐电梯回家，晴天总要提前几层下电梯再爬楼梯，雨天却能直接坐到家门口。为什么？",
    answer:
      "这个人个子很矮，平时够不到自己家的高楼层按钮，只能按到较低楼层再走楼梯。雨天他带着伞，可以用伞尖按到更高的楼层按钮，所以能直接到家。",
    source: "local",
    maxHints: 3,
    keyPoints: [
      {
        id: "short",
        text: "这个人个子很矮",
        aliases: ["个子矮", "身高矮", "很矮", "小孩", "矮子", "够不着"]
      },
      {
        id: "button",
        text: "他平时够不到自己家的电梯按钮",
        aliases: ["按钮太高", "按不到", "够不到按钮", "楼层按钮", "电梯按钮"]
      },
      {
        id: "umbrella",
        text: "雨天带伞，可以用伞按按钮",
        aliases: ["伞", "雨伞", "伞尖", "用伞按", "拿伞"]
      }
    ],
    hints: [
      "雨天改变的不是电梯，而是他手里多了东西。",
      "关键不在天气本身，而在他能不能碰到某个位置。",
      "想想电梯按钮和身高之间的关系。"
    ]
  },
  {
    id: "doorbell-double",
    title: "门外的自己",
    surface:
      "午夜，一个人听见门铃响。他从猫眼看见门外站着“自己”，几分钟后他报了警。为什么？",
    answer:
      "门外并不是他本人，而是一个拿到他证件和外套的陌生人，试图冒充他骗开门。他从猫眼发现对方的伪装和自己的物品，意识到有人要入室或身份冒用，于是报警。",
    source: "local",
    maxHints: 3,
    keyPoints: [
      {
        id: "impostor",
        text: "门外的人不是他本人，而是在冒充他",
        aliases: ["冒充", "假扮", "不是本人", "陌生人", "骗子", "小偷"]
      },
      {
        id: "identity-items",
        text: "对方拿到了他的证件或外套等个人物品",
        aliases: ["证件", "身份证", "外套", "衣服", "个人物品", "钱包"]
      },
      {
        id: "break-in",
        text: "对方想骗他开门或入室",
        aliases: ["骗开门", "开门", "入室", "进屋", "抢劫", "偷东西"]
      }
    ],
    hints: [
      "猫眼里看到的“自己”不一定是本人。",
      "让他报警的不是长相，而是对方掌握了他的东西。",
      "对方真正想要的是让门从里面打开。"
    ]
  }
];

export class TurtleSoupGameModule implements ServerGameModule {
  readonly id = "turtle-soup" as const;
  readonly displayName = "海龟汤";
  readonly minPlayers = 1;
  readonly maxPlayers = 15;

  constructor(
    private readonly ai?: TurtleSoupAiAdapter,
    private readonly onAiFailure: TurtleSoupAiFailureHandler = () => {}
  ) {}

  async create(state: InternalRoomState, context: GameRoomCreateContext): Promise<GameRoomUpdate> {
    this.#assertTurtleSoupRoom(state);
    if (state.players.length < this.minPlayers || state.players.length > this.maxPlayers) {
      throw new Error(`海龟汤需要 ${this.minPlayers} 到 ${this.maxPlayers} 名玩家`);
    }
    const puzzle = await this.#createPuzzle(state, context);
    return {
      changes: {
        phase: "playing",
        turtleSoup: {
          puzzleId: puzzle.id,
          puzzle,
          judgeSource: puzzle.source,
          status: "playing",
          foundKeyPoints: {},
          hintsUsed: 0,
          log: [
            {
              id: `${state.version + 1}:start`,
              kind: "system",
              content:
                puzzle.source === "model"
                  ? "AI 已生成汤面，可以开始提问。"
                  : "汤面已公开，当前使用本地降级题。",
              createdAt: new Date(context.now).toISOString()
            }
          ]
        }
      },
      eventPayload: { puzzleId: puzzle.id, title: puzzle.title, source: puzzle.source }
    };
  }

  async handle(
    state: InternalRoomState,
    command: GameRoomCommand,
    context: GameRoomHandleContext
  ): Promise<GameRoomUpdate> {
    this.#assertTurtleSoupRoom(state);

    if (command.type === "turtle-soup:rematch") {
      if (state.ownerPlayerId !== command.actorPlayerId) {
        throw new Error("只有房主可以发起再来一局");
      }
      if (state.phase !== "game-over") throw new Error("当前汤局尚未结束");
      return {
        changes: {
          phase: "lobby",
          players: state.players.map((player) => ({ ...player, ready: false })),
          turtleSoup: undefined
        },
        clearChatMessages: true
      };
    }

    const turtleSoup = state.turtleSoup;
    if (!turtleSoup) throw new Error("海龟汤状态不存在");
    if (turtleSoup.status !== "playing") throw new Error("当前汤局已经结束");
    const puzzle = puzzleFor(turtleSoup);
    const createdAt = new Date(context.now).toISOString();

    if (command.type === "turtle-soup:ask") {
      const question = trimPayload(command.payload, "question", 2, 180);
      const judged = await this.#judgeQuestion(state.code, puzzle, question);
      return {
        changes: {
          turtleSoup: {
            ...turtleSoup,
            judgeSource: judged.source,
            log: [
              ...turtleSoup.log,
              {
                id: `${state.version + 1}:question`,
                kind: "question",
                actorPlayerId: command.actorPlayerId,
                content: question,
                answer: judged.answer,
                ...(judged.note ? { note: judged.note } : {}),
                createdAt
              }
            ]
          }
        },
        eventPayload: { answer: judged.answer, source: judged.source }
      };
    }

    if (command.type === "turtle-soup:guess") {
      const guess = trimPayload(command.payload, "guess", 2, 500);
      const judged = await this.#judgeGuess(state.code, puzzle, guess);
      const foundKeyPoints = { ...turtleSoup.foundKeyPoints };
      for (const keyPointId of judged.matchedKeyPointIds) {
        foundKeyPoints[keyPointId] ??= {
          playerId: command.actorPlayerId,
          foundAt: createdAt
        };
      }
      const solved = puzzle.keyPoints.every((keyPoint) => foundKeyPoints[keyPoint.id]);
      return {
        changes: {
          phase: solved ? "game-over" : "playing",
          turtleSoup: {
            ...turtleSoup,
            judgeSource: judged.source,
            status: solved ? "solved" : "playing",
            foundKeyPoints,
            ...(solved
              ? {
                  solvedByPlayerId: command.actorPlayerId,
                  solvedAt: createdAt
                }
              : {}),
            log: [
              ...turtleSoup.log,
              {
                id: `${state.version + 1}:guess`,
                kind: "guess",
                actorPlayerId: command.actorPlayerId,
                content: guess,
                matchedKeyPointIds: judged.matchedKeyPointIds,
                wrong: judged.wrong,
                comment: solved ? "真相已还原" : judged.comment,
                createdAt
              },
              ...(solved
                ? [
                    {
                      id: `${state.version + 1}:solved`,
                      kind: "system" as const,
                      content: "汤底已揭晓。",
                      createdAt
                    }
                  ]
                : [])
            ]
          }
        },
        eventPayload: {
          matchedKeyPointIds: judged.matchedKeyPointIds,
          solved,
          source: judged.source
        }
      };
    }

    if (command.type === "turtle-soup:hint") {
      if (turtleSoup.hintsUsed >= puzzle.maxHints) throw new Error("提示次数已用完");
      const hinted = await this.#createHint(state.code, puzzle, turtleSoup);
      return {
        changes: {
          turtleSoup: {
            ...turtleSoup,
            judgeSource: hinted.source,
            hintsUsed: turtleSoup.hintsUsed + 1,
            log: [
              ...turtleSoup.log,
              {
                id: `${state.version + 1}:hint`,
                kind: "hint",
                actorPlayerId: command.actorPlayerId,
                content: hinted.content,
                createdAt
              }
            ]
          }
        },
        eventPayload: { hintsUsed: turtleSoup.hintsUsed + 1, source: hinted.source }
      };
    }

    throw new Error(`海龟汤命令不受支持: ${command.type}`);
  }

  project(
    state: InternalRoomState,
    _context: GameRoomProjectionContext
  ): GameRoomProjection {
    this.#assertTurtleSoupRoom(state);
    const turtleSoup = state.turtleSoup;
    if (!turtleSoup) return { room: {}, self: {}, playerStates: {} };
    const puzzle = puzzleFor(turtleSoup);
    const solved = turtleSoup.status === "solved";
    const view: TurtleSoupView = {
      puzzleId: puzzle.id,
      title: puzzle.title,
      surface: puzzle.surface,
      source: puzzle.source,
      judgeSource: turtleSoup.judgeSource ?? puzzle.source,
      status: turtleSoup.status,
      questionCount: turtleSoup.log.filter((entry) => entry.kind === "question").length,
      hintsUsed: turtleSoup.hintsUsed,
      maxHints: puzzle.maxHints,
      keyPoints: puzzle.keyPoints.map((keyPoint) => {
        const found = turtleSoup.foundKeyPoints[keyPoint.id];
        return {
          id: keyPoint.id,
          found: Boolean(found),
          ...(found || solved ? { text: keyPoint.text } : {}),
          ...(found ? { foundByPlayerId: found.playerId } : {})
        };
      }),
      log: turtleSoup.log.map((entry) => structuredClone(entry) as TurtleSoupLogEntryView),
      ...(turtleSoup.solvedByPlayerId ? { solvedByPlayerId: turtleSoup.solvedByPlayerId } : {}),
      ...(solved ? { answer: puzzle.answer } : {})
    };
    return {
      room: { turtleSoup: view },
      self: {
        turtleSoup: {
          canAsk: turtleSoup.status === "playing",
          canGuess: turtleSoup.status === "playing",
          canRequestHint:
            turtleSoup.status === "playing" && turtleSoup.hintsUsed < puzzle.maxHints
        }
      },
      playerStates: {}
    };
  }

  tick(_state: InternalRoomState, _context: GameRoomTickContext): GameRoomUpdate | undefined {
    return undefined;
  }

  migrate(value: unknown): InternalRoomState {
    return migrateInternalRoomState(value);
  }

  validate(state: InternalRoomState): void {
    this.#assertTurtleSoupRoom(state);
    const turtleSoup = state.turtleSoup;
    if (!turtleSoup) {
      if (state.phase !== "lobby") throw new Error("非大厅阶段缺少海龟汤状态");
      return;
    }
    const puzzle = puzzleFor(turtleSoup);
    const playerIds = new Set(state.players.map((player) => player.id));
    for (const found of Object.values(turtleSoup.foundKeyPoints)) {
      if (!playerIds.has(found.playerId)) throw new Error("海龟汤要点包含未知玩家");
    }
    for (const keyPointId of Object.keys(turtleSoup.foundKeyPoints)) {
      if (!puzzle.keyPoints.some((keyPoint) => keyPoint.id === keyPointId)) {
        throw new Error("海龟汤状态包含未知要点");
      }
    }
    for (const entry of turtleSoup.log) {
      if ("actorPlayerId" in entry && !playerIds.has(entry.actorPlayerId)) {
        throw new Error("海龟汤记录包含未知玩家");
      }
    }
    const expectedPhase: RoomPhase = turtleSoup.status === "solved" ? "game-over" : "playing";
    if (state.phase !== expectedPhase) throw new Error("海龟汤状态与房间阶段不一致");
  }

  async #createPuzzle(
    state: InternalRoomState,
    context: GameRoomCreateContext
  ): Promise<TurtleSoupPuzzleState> {
    const config = state.turtleSoupConfig ?? { difficulty: "normal" as const, tags: [] };
    try {
      const puzzle = await this.ai?.createPuzzle({
        difficulty: config.difficulty,
        tags: config.tags,
        seed: context.seed
      });
      if (puzzle) return puzzle;
    } catch (cause) {
      this.#reportAiFailure({
        action: "create-puzzle",
        roomCode: state.code,
        error: errorMessage(cause)
      });
    }
    return selectLocalPuzzle(context.seed);
  }

  async #judgeQuestion(
    roomCode: string,
    puzzle: TurtleSoupPuzzleState,
    question: string
  ): Promise<TurtleSoupQuestionJudgment & { source: "model" | "local" }> {
    try {
      const judged = await this.ai?.judgeQuestion({ puzzle, question });
      if (judged) return { ...judged, source: "model" };
    } catch (cause) {
      this.#reportAiFailure({
        action: "judge-question",
        roomCode,
        puzzleId: puzzle.id,
        puzzleSource: puzzle.source,
        error: errorMessage(cause)
      });
    }
    return { ...judgeQuestionLocally(puzzle, question), source: "local" };
  }

  async #judgeGuess(
    roomCode: string,
    puzzle: TurtleSoupPuzzleState,
    guess: string
  ): Promise<TurtleSoupGuessJudgment & { source: "model" | "local" }> {
    try {
      const judged = await this.ai?.judgeGuess({ puzzle, guess });
      if (judged) return { ...judged, source: "model" };
    } catch (cause) {
      this.#reportAiFailure({
        action: "judge-guess",
        roomCode,
        puzzleId: puzzle.id,
        puzzleSource: puzzle.source,
        error: errorMessage(cause)
      });
    }
    return { ...judgeGuessLocally(puzzle, guess), source: "local" };
  }

  async #createHint(
    roomCode: string,
    puzzle: TurtleSoupPuzzleState,
    turtleSoup: NonNullable<InternalRoomState["turtleSoup"]>
  ): Promise<{ content: string; source: "model" | "local" }> {
    try {
      const hint = await this.ai?.createHint({
        puzzle,
        foundKeyPointIds: Object.keys(turtleSoup.foundKeyPoints),
        log: turtleSoup.log
      });
      if (hint) return { content: hint, source: "model" };
    } catch (cause) {
      this.#reportAiFailure({
        action: "create-hint",
        roomCode,
        puzzleId: puzzle.id,
        puzzleSource: puzzle.source,
        error: errorMessage(cause)
      });
    }
    return { content: nextLocalHint(puzzle, turtleSoup), source: "local" };
  }

  #reportAiFailure(event: TurtleSoupAiFailureEvent): void {
    try {
      this.onAiFailure(event);
    } catch {
      // Logging must not break the room flow.
    }
  }

  #assertTurtleSoupRoom(state: Pick<InternalRoomState, "gameType">): void {
    if (state.gameType !== this.id) throw new Error("房间与海龟汤模块不匹配");
  }
}

function selectLocalPuzzle(seed: string): TurtleSoupPuzzleState {
  const digest = createHash("sha256").update(seed).digest();
  const firstByte = digest[0] ?? 0;
  const puzzle =
    LOCAL_TURTLE_SOUP_PUZZLES[firstByte % LOCAL_TURTLE_SOUP_PUZZLES.length] ??
    LOCAL_TURTLE_SOUP_PUZZLES[0]!;
  return structuredClone(puzzle);
}

function puzzleFor(
  turtleSoup: Pick<NonNullable<InternalRoomState["turtleSoup"]>, "puzzle" | "puzzleId">
): TurtleSoupPuzzleState {
  if (turtleSoup.puzzle) return turtleSoup.puzzle;
  const puzzle = LOCAL_TURTLE_SOUP_PUZZLES.find(
    (candidate) => candidate.id === turtleSoup.puzzleId
  );
  if (!puzzle) throw new Error(`海龟汤题目不存在: ${turtleSoup.puzzleId}`);
  return structuredClone(puzzle);
}

function judgeQuestionLocally(
  puzzle: TurtleSoupPuzzleState,
  question: string
): TurtleSoupQuestionJudgment {
  const normalized = normalize(question);
  const keyPointTerms = puzzle.keyPoints.flatMap((keyPoint) => [
    keyPoint.text,
    ...(keyPoint.aliases ?? [])
  ]);
  const answerTerms = [puzzle.answer, ...keyPointTerms];
  const yes = containsAny(normalized, answerTerms);
  const no = containsAny(normalized, commonWrongTerms(puzzle));
  if (yes && no) return { answer: "partial", note: "问题里有一部分方向接近真相。" };
  if (yes) return { answer: "yes" };
  if (no) return { answer: "no" };
  return { answer: "irrelevant" };
}

function judgeGuessLocally(
  puzzle: TurtleSoupPuzzleState,
  guess: string
): TurtleSoupGuessJudgment {
  const normalized = normalize(guess);
  const matchedKeyPointIds = puzzle.keyPoints
    .filter((keyPoint) =>
      containsAny(normalized, [keyPoint.text, ...(keyPoint.aliases ?? [])])
    )
    .map((keyPoint) => keyPoint.id);
  const wrong = containsAny(normalized, commonWrongTerms(puzzle));
  return {
    matchedKeyPointIds,
    wrong,
    comment:
      matchedKeyPointIds.length > 0
        ? wrong
          ? "方向有对有错"
          : "方向正确"
        : wrong
          ? "这个方向不对"
          : "还没有击中要点"
  };
}

function nextLocalHint(
  puzzle: TurtleSoupPuzzleState,
  turtleSoup: NonNullable<InternalRoomState["turtleSoup"]>
): string {
  const hints = puzzle.hints ?? [];
  const firstUnfoundIndex = puzzle.keyPoints.findIndex(
    (keyPoint) => !turtleSoup.foundKeyPoints[keyPoint.id]
  );
  const hintIndex =
    firstUnfoundIndex >= 0
      ? Math.min(firstUnfoundIndex, hints.length - 1)
      : Math.min(turtleSoup.hintsUsed, hints.length - 1);
  return hints[hintIndex] ?? "重新审视汤面里最反常的地方。";
}

function trimPayload(
  payload: Record<string, unknown>,
  key: string,
  minLength: number,
  maxLength: number
): string {
  const value = payload[key];
  if (typeof value !== "string") throw new Error(`命令参数无效: ${key}`);
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new Error(`内容长度必须在 ${minLength} 到 ${maxLength} 个字符之间`);
  }
  return trimmed;
}

function commonWrongTerms(puzzle: TurtleSoupPuzzleState): string[] {
  if (puzzle.id === "umbrella-elevator") {
    return ["怕黑", "停电", "故障", "司机", "公交", "迷路"];
  }
  if (puzzle.id === "doorbell-double") {
    return ["鬼", "双胞胎", "梦", "穿越", "监控故障", "镜子"];
  }
  return ["鬼", "梦", "穿越", "魔法", "超能力"];
}

function containsAny(normalizedText: string, terms: readonly string[]): boolean {
  return terms.some((term) => normalizedText.includes(normalize(term)));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function errorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "unknown AI adapter error";
  return message.slice(0, 300);
}
