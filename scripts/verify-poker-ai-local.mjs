import { io } from "socket.io-client";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = "poker-ai-local-verify";

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `${path} failed`);
  return data;
}

async function expectJoinRejected(roomCode) {
  const response = await fetch(`${baseUrl}/api/rooms/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomCode, nickname: "Unexpected Player", password })
  });
  const data = await response.json();
  if (response.ok || !String(data.error).includes("单人 AI 房间")) {
    throw new Error("Solo AI room accepted an additional human player");
  }
}

function connect(session) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { roomCode: session.roomCode, sessionToken: session.sessionToken }
    });
    const timeout = setTimeout(() => reject(new Error("Socket connection timed out")), 5000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", reject);
  });
}

function emit(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    socket.emit(event, ...args, (ack) => {
      if (ack.ok) resolve();
      else reject(new Error(ack.error ?? `${event} failed`));
    });
  });
}

function waitForView(socket, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("room:view", onView);
      reject(new Error("Poker AI room view timed out"));
    }, timeoutMs);
    const onView = (view) => {
      if (!predicate(view)) return;
      clearTimeout(timeout);
      socket.off("room:view", onView);
      resolve(view);
    };
    socket.on("room:view", onView);
  });
}

const platform = await fetch(`${baseUrl}/api/platform`).then((response) => response.json());
if (!platform.enabledGames?.includes("poker")) {
  throw new Error("Poker is disabled. Start the server with POKER_ENABLED=true.");
}

const owner = await post("/api/rooms", {
  gameType: "poker",
  nickname: "Solo Verify",
  password,
  poker: { mode: "points", smallBlind: 5, bigBlind: 10, aiPlayerCount: 3 }
});
await expectJoinRejected(owner.roomCode);
const socket = await connect(owner);

try {
  const waitingView = waitForView(
    socket,
    (view) => view.room.pokerTable?.status === "waiting-hand"
  );
  await emit(socket, "room:start");
  const waiting = await waitingView;
  const bots = waiting.room.players.filter((player) => player.isBot);
  const human = waiting.room.players.find((player) => player.id === owner.playerId);
  if (bots.length !== 3 || !bots.every((player) => player.ready && player.seat !== null)) {
    throw new Error("AI players were not created, seated, and readied correctly");
  }
  if (!human?.ready || human.seat !== 1) {
    throw new Error("Human player was not seated and readied correctly");
  }

  const inHandView = waitForView(
    socket,
    (view) =>
      view.room.pokerTable?.status === "in-hand" &&
      view.room.pokerTable.actionPlayerId === owner.playerId
  );
  await emit(socket, "poker:deal");
  const inHand = await inHandView;
  const table = inHand.room.pokerTable;
  const ownerTablePlayer = table.players.find((player) => player.playerId === owner.playerId);
  if (ownerTablePlayer?.hand?.length !== 2) throw new Error("Human hole cards are missing");
  if (
    table.players.some(
      (player) => player.playerId !== owner.playerId && player.hand !== null
    )
  ) {
    throw new Error("AI hole cards leaked to the human player");
  }
  if (
    !table.actionHistory.some((record) =>
      bots.some((bot) => bot.id === record.playerId)
    )
  ) {
    throw new Error("AI players did not act automatically before the human turn");
  }
  const serialized = JSON.stringify(inHand);
  if (serialized.includes("tableSeed") || serialized.includes('"deck"')) {
    throw new Error("Private engine state leaked to the client");
  }

  const legalActions = inHand.self.poker?.legalActions;
  const action = legalActions?.actions.includes("check")
    ? "check"
    : legalActions?.actions.includes("call")
      ? "call"
      : "fold";
  const actionHistoryLength = table.actionHistory.length;
  const continuedView = waitForView(
    socket,
    (view) => {
      const nextTable = view.room.pokerTable;
      if (!nextTable || view.room.version <= inHand.room.version) return false;
      return (
        nextTable.status !== "in-hand" ||
        (nextTable.actionPlayerId === owner.playerId &&
          nextTable.actionHistory.length > actionHistoryLength)
      );
    }
  );
  await emit(socket, "poker:act", { action });
  const continued = await continuedView;
  const continuedTable = continued.room.pokerTable;
  const stackTotal = continuedTable.players.reduce(
    (total, player) => total + player.stack + player.pendingAddOn,
    0
  );
  const totalChips =
    continuedTable.status === "in-hand"
      ? stackTotal + continuedTable.totalPot
      : stackTotal;
  if (totalChips !== 2000) throw new Error("Solo AI chip conservation failed");

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: owner.roomCode,
        players: continued.room.players.length,
        bots: bots.length,
        handNumber: continuedTable.handNumber,
        status: continuedTable.status,
        actionPlayerId: continuedTable.actionPlayerId,
        totalChips,
        privateCardsVerified: true,
        botAutoActionVerified: true,
        extraHumanRejected: true
      },
      null,
      2
    )
  );
} finally {
  socket.disconnect();
}
