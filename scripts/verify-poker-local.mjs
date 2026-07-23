import { io } from "socket.io-client";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = "poker-local-verify";

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
      reject(new Error("Poker room view timed out"));
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
  nickname: "Poker Verify 1",
  password,
  poker: { mode: "points", smallBlind: 5, bigBlind: 10 }
});
const second = await post("/api/rooms/join", {
  roomCode: owner.roomCode,
  nickname: "Poker Verify 2",
  password
});
const sessions = [owner, second];
const sockets = await Promise.all(sessions.map(connect));

try {
  await Promise.all(sockets.map((socket, index) => emit(socket, "room:set-seat", index + 1)));
  await Promise.all(sockets.map((socket) => emit(socket, "room:set-ready", true)));
  const waitingViews = sockets.map((socket) =>
    waitForView(socket, (view) => view.room.pokerTable?.status === "waiting-hand")
  );
  await emit(sockets[0], "room:start");
  await Promise.all(waitingViews);

  const inHandViews = sockets.map((socket) =>
    waitForView(socket, (view) => view.room.pokerTable?.status === "in-hand")
  );
  await emit(sockets[0], "poker:deal");
  const views = await Promise.all(inHandViews);

  views.forEach((view, viewerIndex) => {
    const players = view.room.pokerTable?.players ?? [];
    if (players[viewerIndex]?.hand?.length !== 2) throw new Error("Own hole cards are missing");
    if (players[1 - viewerIndex]?.hand !== null) throw new Error("Opponent hole cards leaked");
    const serialized = JSON.stringify(view);
    if (serialized.includes("tableSeed") || serialized.includes('"deck"')) {
      throw new Error("Private engine state leaked to the client");
    }
  });

  const actionPlayerId = views[0].room.pokerTable?.actionPlayerId;
  const actorIndex = sessions.findIndex((session) => session.playerId === actionPlayerId);
  if (actorIndex < 0) throw new Error("Action player was not found");
  const settledView = waitForView(
    sockets[0],
    (view) => view.room.pokerTable?.status === "waiting-hand" && view.room.pokerTable.handNumber === 1
  );
  await emit(sockets[actorIndex], "poker:act", { action: "fold" });
  const settled = await settledView;
  const totalChips = settled.room.pokerTable.players.reduce(
    (total, player) => total + player.stack + player.pendingAddOn,
    0
  );
  if (totalChips !== 1000) throw new Error("Chip conservation failed");

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: owner.roomCode,
        players: sessions.length,
        mode: settled.room.pokerTable.mode,
        handNumber: settled.room.pokerTable.handNumber,
        status: settled.room.pokerTable.status,
        totalChips,
        privateCardsVerified: true
      },
      null,
      2
    )
  );
} finally {
  sockets.forEach((socket) => socket.disconnect());
}
