import { describe, expect, it } from "vitest";
import {
  POKER_FIXED_BUY_IN,
  PlayerStatus,
  createPokerEngineEnvelope,
  createPokerTable,
  handlePokerTableCommand,
  migratePokerTable,
  projectPokerTable,
  restorePokerEngine,
  type CreatePokerTableInput,
  type PokerTableCommand,
  type PokerTableState
} from "../src/index.js";

const OWNER_ID = "p0";
const BASE_INPUT: CreatePokerTableInput = {
  mode: "points",
  tableSeed: "party-games-poker-table",
  now: 1_000,
  smallBlind: 5,
  bigBlind: 10,
  players: [
    { playerId: OWNER_ID, nickname: "Player 0", seat: 0 },
    { playerId: "p1", nickname: "Player 1", seat: 1 }
  ]
};

function command<T extends PokerTableCommand>(value: T): T {
  return value;
}

function handle(
  state: PokerTableState,
  pokerCommand: PokerTableCommand,
  now: number
): PokerTableState {
  return handlePokerTableCommand(state, pokerCommand, {
    now,
    ownerPlayerId: OWNER_ID
  });
}

function deal(state: PokerTableState, actorPlayerId = OWNER_ID): PokerTableState {
  return handle(
    state,
    command({ type: "poker:deal", actorPlayerId, payload: {} }),
    2_000
  );
}

function fourPlayerInput(): CreatePokerTableInput {
  return {
    ...BASE_INPUT,
    players: [
      { playerId: OWNER_ID, nickname: "Player 0", seat: 0 },
      { playerId: "p1", nickname: "Player 1", seat: 1 },
      { playerId: "p2", nickname: "Player 2", seat: 2 },
      { playerId: "p3", nickname: "Player 3", seat: 3 }
    ]
  };
}

function corruptedUnequalAllInState(): PokerTableState {
  const state = deal(createPokerTable(fourPlayerInput()));
  const engine = restorePokerEngine(state.engine);
  const players = engine.state.players.map((player, seat) => {
    if (!player) return player;
    if (seat === 0) {
      return {
        ...player,
        stack: 70,
        status: PlayerStatus.ACTIVE,
        betThisStreet: 10,
        totalInvestedThisHand: 10
      };
    }
    if (seat === 2) {
      return {
        ...player,
        stack: 0,
        status: PlayerStatus.ALL_IN,
        betThisStreet: 1_920,
        totalInvestedThisHand: 1_920
      };
    }
    return {
      ...player,
      stack: 0,
      status: PlayerStatus.ALL_IN,
      betThisStreet: 0,
      totalInvestedThisHand: 480
    };
  });
  Object.assign(engine.state, {
    players,
    currentBets: new Map([
      [0, 10],
      [2, 1_920]
    ]),
    activePlayers: [0, 2],
    actionTo: 0,
    lastAggressorSeat: 2,
    lastRaiseAmount: 1_910,
    minRaise: 3_830,
    initialChips: 2_000,
    timestamp: 3_000
  });
  return {
    ...state,
    engine: createPokerEngineEnvelope(engine, state.engine.tableSeed)
  };
}

describe("poker table domain", () => {
  it("migrates existing table players into the lifecycle state", () => {
    const state = createPokerTable(BASE_INPUT);
    const legacy = {
      ...state,
      schemaVersion: 1,
      players: state.players.map(
        ({ atTable: _atTable, stackAtHandStart: _stackAtHandStart, ...player }) => player
      )
    };
    const migrated = migratePokerTable(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.players).toEqual([
      expect.objectContaining({ atTable: true, stackAtHandStart: 500 }),
      expect.objectContaining({ atTable: true, stackAtHandStart: 500 })
    ]);
  });

  it("requires a blind structure for tournament tables", () => {
    expect(() => createPokerTable({ ...BASE_INPUT, mode: "tournament" })).toThrow(
      "淘汰赛必须配置盲注级别"
    );
  });

  it("rejects ambiguous or invalid blind settings", () => {
    expect(() =>
      createPokerTable({
        ...BASE_INPUT,
        blindStructure: [{ smallBlind: 5, bigBlind: 10, ante: 0 }]
      })
    ).toThrow("积分桌不使用盲注级别");
    expect(() =>
      createPokerTable({
        ...BASE_INPUT,
        mode: "tournament",
        blindStructure: [{ smallBlind: 10, bigBlind: 20, ante: 0 }]
      })
    ).toThrow("首个盲注级别必须与初始盲注一致");
  });

  it.each(["tournament", "points"] as const)(
    "starts every %s player with a fixed 500 buy-in",
    (mode) => {
      const state = createPokerTable({
        ...BASE_INPUT,
        mode,
        ...(mode === "tournament"
          ? {
              blindStructure: [
                { smallBlind: 5, bigBlind: 10, ante: 0 },
                { smallBlind: 10, bigBlind: 20, ante: 0 }
              ]
            }
          : {})
      });
      const engine = restorePokerEngine(state.engine);

      expect(state.players.every((player) => player.totalBuyIn === POKER_FIXED_BUY_IN)).toBe(
        true
      );
      expect(engine.state.players.filter(Boolean).map((player) => player?.stack)).toEqual([
        POKER_FIXED_BUY_IN,
        POKER_FIXED_BUY_IN
      ]);
    }
  );

  it("allows only the owner to deal and advance tournament blinds", () => {
    const pointsState = createPokerTable(BASE_INPUT);
    expect(() => deal(pointsState, "p1")).toThrow("只有房主可以执行该操作");

    const tournamentState = createPokerTable({
      ...BASE_INPUT,
      mode: "tournament",
      blindStructure: [
        { smallBlind: 5, bigBlind: 10, ante: 0 },
        { smallBlind: 10, bigBlind: 20, ante: 2 }
      ]
    });
    expect(() =>
      handle(
        tournamentState,
        command({ type: "poker:advance-blinds", actorPlayerId: "p1", payload: {} }),
        2_100
      )
    ).toThrow("只有房主可以执行该操作");

    const advanced = handle(
      tournamentState,
      command({ type: "poker:advance-blinds", actorPlayerId: OWNER_ID, payload: {} }),
      2_100
    );
    const engine = restorePokerEngine(advanced.engine);
    expect(engine.state.blindLevel).toBe(1);
    expect(engine.state.timestamp).toBe(2_100);
  });

  it("allows points rebuys only after a busted player's hand has ended", () => {
    let state = createPokerTable({ ...BASE_INPUT, smallBlind: 250, bigBlind: 500 });
    expect(() =>
      handle(
        state,
        command({ type: "poker:rebuy", actorPlayerId: OWNER_ID, payload: {} }),
        2_050
      )
    ).toThrow("仍有筹码时不能重新买入");

    state = deal(state);
    expect(() =>
      handle(
        state,
        command({ type: "poker:rebuy", actorPlayerId: "p1", payload: {} }),
        2_100
      )
    ).toThrow("本手牌结束后才能重新买入");

    const engine = restorePokerEngine(state.engine);
    const actorSeat = engine.state.actionTo;
    if (actorSeat === null) throw new Error("测试牌局缺少行动玩家");
    const actorPlayerId = engine.state.players[actorSeat]?.id;
    if (!actorPlayerId) throw new Error("测试牌局行动座位为空");
    state = handle(
      state,
      command({
        type: "poker:act",
        actorPlayerId,
        payload: { action: "call" }
      }),
      2_200
    );

    expect(state.status).toBe("waiting-hand");
    const settledEngine = restorePokerEngine(state.engine);
    const bustedPlayer = settledEngine.state.players.find((player) => player?.stack === 0);
    if (!bustedPlayer) throw new Error("测试牌局没有产生破产玩家");
    const rebought = handle(
      state,
      command({ type: "poker:rebuy", actorPlayerId: bustedPlayer.id, payload: {} }),
      2_300
    );
    const reboughtPlayer = rebought.players.find(
      (player) => player.playerId === bustedPlayer.id
    );
    const reboughtEnginePlayer = restorePokerEngine(rebought.engine).state.players.find(
      (player) => player?.id === bustedPlayer.id
    );

    expect(reboughtPlayer).toMatchObject({ buyIns: 2, totalBuyIn: 1_000 });
    expect(reboughtEnginePlayer?.pendingAddOn).toBe(POKER_FIXED_BUY_IN);
  });

  it("never permits tournament rebuys", () => {
    const state = createPokerTable({
      ...BASE_INPUT,
      mode: "tournament",
      blindStructure: [{ smallBlind: 5, bigBlind: 10, ante: 0 }]
    });
    expect(() =>
      handle(
        state,
        command({ type: "poker:rebuy", actorPlayerId: OWNER_ID, payload: {} }),
        2_000
      )
    ).toThrow("淘汰赛不允许重新买入");
    expect(() =>
      handle(
        state,
        command({ type: "poker:cash-out", actorPlayerId: OWNER_ID, payload: {} }),
        2_100
      )
    ).toThrow("淘汰赛不能离桌结算");
  });

  it("cash-outs and buys a points player back into the original seat", () => {
    let state = deal(createPokerTable(BASE_INPUT));
    const dealtEngine = restorePokerEngine(state.engine);
    const actingSeat = dealtEngine.state.actionTo;
    if (actingSeat === null) throw new Error("测试牌局缺少行动玩家");
    const actorPlayerId = dealtEngine.state.players[actingSeat]?.id;
    if (!actorPlayerId) throw new Error("测试牌局行动座位为空");
    state = handle(
      state,
      command({ type: "poker:act", actorPlayerId, payload: { action: "fold" } }),
      2_100
    );

    state = handle(
      state,
      command({ type: "poker:cash-out", actorPlayerId, payload: {} }),
      2_200
    );
    const cashedOut = projectPokerTable(state, actorPlayerId);
    const cashedOutPlayer = cashedOut.players.find(
      (player) => player.playerId === actorPlayerId
    );
    expect(cashedOutPlayer).toMatchObject({ atTable: false, buyIns: 1, netPoints: -5 });
    expect(cashedOut.self).toMatchObject({ totalBuyIn: 500, cashedOut: 495, netPoints: -5 });
    expect(cashedOut.totalPot).toBe(10);
    expect(restorePokerEngine(state.engine).state.players[actingSeat]).toBeNull();

    state = handle(
      state,
      command({ type: "poker:buy-in", actorPlayerId, payload: {} }),
      2_300
    );
    const boughtIn = projectPokerTable(state, actorPlayerId);
    const boughtInPlayer = boughtIn.players.find(
      (player) => player.playerId === actorPlayerId
    );
    expect(boughtInPlayer).toMatchObject({ atTable: true, buyIns: 2, netPoints: -5 });
    expect(boughtIn.self).toMatchObject({ totalBuyIn: 1_000, cashedOut: 495, netPoints: -5 });
    expect(restorePokerEngine(state.engine).state.players[actingSeat]).toMatchObject({
      id: actorPlayerId,
      stack: 500
    });
  });

  it("assigns unique final tournament places when the last opponent busts", () => {
    let state = createPokerTable({
      ...BASE_INPUT,
      mode: "tournament",
      smallBlind: 250,
      bigBlind: 500,
      blindStructure: [{ smallBlind: 250, bigBlind: 500, ante: 0 }]
    });
    state = deal(state);
    const engine = restorePokerEngine(state.engine);
    const actingSeat = engine.state.actionTo;
    if (actingSeat === null) throw new Error("测试淘汰赛缺少行动玩家");
    const actorPlayerId = engine.state.players[actingSeat]?.id;
    if (!actorPlayerId) throw new Error("测试淘汰赛行动座位为空");
    state = handle(
      state,
      command({ type: "poker:act", actorPlayerId, payload: { action: "call" } }),
      2_100
    );

    expect(state.status).toBe("complete");
    expect(state.players.map((player) => player.finishPlace).sort()).toEqual([1, 2]);
    expect(
      state.players.find((player) => player.playerId === state.winnerPlayerId)?.finishPlace
    ).toBe(1);
  });

  it("masks opponents' cards in player projections", () => {
    const state = deal(createPokerTable(BASE_INPUT));
    const engine = restorePokerEngine(state.engine);
    const view = projectPokerTable(state, OWNER_ID);

    expect(view.table.deck).toEqual([]);
    expect(view.table.players[0]?.hand).toEqual(engine.state.players[0]?.hand);
    expect(view.table.players[1]?.hand).toBeNull();
  });

  it("projects server-authoritative legal actions only for the acting player", () => {
    const state = deal(createPokerTable(BASE_INPUT));
    const engine = restorePokerEngine(state.engine);
    const actingSeat = engine.state.actionTo;
    if (actingSeat === null) throw new Error("测试牌局缺少行动玩家");
    const actingPlayer = engine.state.players[actingSeat];
    const waitingPlayer = engine.state.players.find(
      (player) => player && player.id !== actingPlayer?.id
    );
    if (!actingPlayer || !waitingPlayer) throw new Error("测试牌局玩家不完整");

    const actingView = projectPokerTable(state, actingPlayer.id);
    const waitingView = projectPokerTable(state, waitingPlayer.id);
    expect(actingView.self?.legalActions).toMatchObject({
      actions: ["fold", "call", "raise"],
      callAmount: 5,
      aggressiveAction: "raise",
      minAmount: 20,
      maxAmount: 500
    });
    expect(waitingView.self?.legalActions).toBeUndefined();
  });

  it("repairs stale busted-player investments before a short all-in call", () => {
    const state = corruptedUnequalAllInState();
    const view = projectPokerTable(state, OWNER_ID);

    expect(view.self?.legalActions).toMatchObject({
      actions: expect.arrayContaining(["fold", "call"]),
      callAmount: 70
    });

    const settled = handle(
      state,
      command({
        type: "poker:act",
        actorPlayerId: OWNER_ID,
        payload: { action: "call" }
      }),
      3_100
    );
    const settledEngine = restorePokerEngine(settled.engine);
    const totalStacks = settledEngine.state.players.reduce(
      (total, player) => total + (player?.stack ?? 0),
      0
    );

    expect(settled.status).toBe("waiting-hand");
    expect(totalStacks).toBe(2_000);
    expect(settledEngine.state.actionHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: expect.objectContaining({
            type: "UNCALLED_BET_RETURNED",
            amount: 1_840
          })
        })
      ])
    );
  });

  it("ignores busted seats when assigning heads-up blinds for the next hand", () => {
    const state = createPokerTable(fourPlayerInput());
    const engine = restorePokerEngine(state.engine);
    const players = engine.state.players.map((player, seat) => {
      if (!player) return player;
      const stack = seat === 0 ? 80 : seat === 2 ? 1_920 : 0;
      return {
        ...player,
        stack,
        status: stack > 0 ? PlayerStatus.WAITING : PlayerStatus.BUSTED,
        hand: null,
        shownCards: null,
        betThisStreet: 0,
        totalInvestedThisHand: 0
      };
    });
    Object.assign(engine.state, { players, initialChips: 2_000 });
    state.engine = createPokerEngineEnvelope(engine, state.engine.tableSeed);

    const dealt = deal(state);
    const dealtEngine = restorePokerEngine(dealt.engine);

    expect(dealt.blindPositions).toEqual({ smallBlindSeat: 0, bigBlindSeat: 2 });
    expect(dealtEngine.state.currentBets).toEqual(
      new Map([
        [0, 5],
        [2, 10]
      ])
    );
    expect(dealtEngine.state.actionTo).toBe(0);
    expect(dealtEngine.state.players[1]).toMatchObject({
      status: PlayerStatus.BUSTED,
      totalInvestedThisHand: 0,
      hand: null
    });
    expect(dealtEngine.state.players[3]).toMatchObject({
      status: PlayerStatus.BUSTED,
      totalInvestedThisHand: 0,
      hand: null
    });
  });

  it("keeps an explainable action log and settled pot after an uncontested hand", () => {
    let state = deal(createPokerTable(BASE_INPUT));
    const engine = restorePokerEngine(state.engine);
    const actingSeat = engine.state.actionTo;
    if (actingSeat === null) throw new Error("测试牌局缺少行动玩家");
    const actorPlayerId = engine.state.players[actingSeat]?.id;
    if (!actorPlayerId) throw new Error("测试牌局行动座位为空");

    state = handle(
      state,
      command({ type: "poker:act", actorPlayerId, payload: { action: "fold" } }),
      2_100
    );
    const view = projectPokerTable(state, OWNER_ID);
    expect(view.status).toBe("waiting-hand");
    expect(view.totalPot).toBe(10);
    expect(view.table.winners?.reduce((total, winner) => total + winner.amount, 0)).toBe(5);
    expect(view.actionHistory).toEqual([
      expect.objectContaining({
        playerId: actorPlayerId,
        street: "PREFLOP",
        action: "fold",
        potAfter: 15,
        allIn: false
      }),
      expect.objectContaining({
        action: "uncalled-return",
        amount: 5,
        potAfter: 10,
        allIn: false
      })
    ]);
  });

  it("calculates points as stack plus cash-outs minus total buy-ins", () => {
    const state = createPokerTable(BASE_INPUT);
    state.players[0] = {
      ...state.players[0]!,
      buyIns: 2,
      totalBuyIn: 1_000,
      cashedOut: 125
    };
    const engine = restorePokerEngine(state.engine);
    const enginePlayer = engine.state.players[0];
    if (!enginePlayer) throw new Error("测试牌局缺少玩家");
    enginePlayer.pendingAddOn = 500;
    state.engine = {
      ...state.engine,
      snapshot: JSON.parse(JSON.stringify(engine.snapshot))
    };

    const view = projectPokerTable(state, OWNER_ID);
    expect(view.self?.netPoints).toBe(125);
    expect(view.players[0]?.netPoints).toBe(125);
  });
});
