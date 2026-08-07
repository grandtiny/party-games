import { io } from "socket.io-client";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = "poker-tournament-local-verify";
let ownerAccountCookie = "";

async function post(path, body, cookie = ownerAccountCookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `${path} failed`);
  return data;
}

async function authenticateVerifyOwner() {
  const status = await fetch(`${baseUrl}/api/account/status`).then((response) =>
    response.json()
  );
  const username = process.env.VERIFY_ACCOUNT_USERNAME ?? "poker-verify";
  const accountPassword =
    process.env.VERIFY_ACCOUNT_PASSWORD ?? "poker-verify-password";
  const path = status.initialized ? "/api/account/login" : "/api/account/bootstrap";
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      status.initialized
        ? { username, password: accountPassword }
        : {
            username,
            displayName: "Poker Verify Owner",
            password: accountPassword,
            ...(process.env.VERIFY_LEGACY_ADMIN_PASSWORD
              ? { legacyAdminPassword: process.env.VERIFY_LEGACY_ADMIN_PASSWORD }
              : {})
          }
    )
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `${path} failed`);
  return sessionCookie(response);
}

async function createVerifyMember() {
  const invite = await post("/api/account/invites", { expiresInDays: 1 });
  const response = await fetch(`${baseUrl}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: `poker-member-${Date.now().toString(36)}`,
      displayName: "Poker Verify Member",
      password: "poker-member-verify-password",
      inviteCode: invite.code
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "/api/account/register failed");
  return sessionCookie(response);
}

function sessionCookie(response) {
  const value = response.headers.get("set-cookie");
  if (!value) throw new Error("Account session cookie is missing");
  return value.split(";", 1)[0];
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

function emitExpectedError(socket, event, expectedMessage) {
  return new Promise((resolve, reject) => {
    socket.emit(event, (ack) => {
      if (!ack.ok && String(ack.error).includes(expectedMessage)) resolve();
      else reject(new Error(`${event} did not fail with ${expectedMessage}`));
    });
  });
}

function waitForView(socket, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("room:view", onView);
      reject(new Error("Poker tournament room view timed out"));
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
ownerAccountCookie = await authenticateVerifyOwner();
const memberAccountCookie = await createVerifyMember();

const owner = await post("/api/rooms", {
  gameType: "poker",
  nickname: "Tournament Verify 1",
  password,
  poker: {
    mode: "tournament",
    smallBlind: 5,
    bigBlind: 10,
    blindStructure: [
      { smallBlind: 5, bigBlind: 10, ante: 0 },
      { smallBlind: 10, bigBlind: 20, ante: 2 },
      { smallBlind: 20, bigBlind: 40, ante: 4 }
    ],
    blindAdvanceMode: "automatic",
    blindLevelDurationMinutes: 1
  }
});
const second = await post("/api/rooms/join", {
  roomCode: owner.roomCode,
  nickname: "Tournament Verify 2",
  password
}, memberAccountCookie);
const sessions = [owner, second];
const sockets = await Promise.all(sessions.map(connect));

try {
  await Promise.all(sockets.map((socket, index) => emit(socket, "room:set-seat", index + 1)));
  await Promise.all(sockets.map((socket) => emit(socket, "room:set-ready", true)));
  const startedView = waitForView(
    sockets[0],
    (view) => view.room.pokerTable?.blindTimer?.status === "running"
  );
  await emit(sockets[0], "room:start");
  const started = await startedView;
  const startedTimer = started.room.pokerTable.blindTimer;
  if (
    started.room.pokerConfig?.blindAdvanceMode !== "automatic" ||
    started.room.pokerConfig.blindLevelDurationMinutes !== 1 ||
    !startedTimer?.nextLevelAt
  ) {
    throw new Error("Automatic blind configuration was not projected correctly");
  }

  await emitExpectedError(sockets[1], "poker:pause-blinds", "只有房主");
  const pausedView = waitForView(
    sockets[0],
    (view) => view.room.pokerTable?.blindTimer?.status === "paused"
  );
  await emit(sockets[0], "poker:pause-blinds");
  const paused = await pausedView;
  const remainingMs = paused.room.pokerTable.blindTimer?.remainingMs;
  if (!remainingMs || remainingMs > 60_000) {
    throw new Error("Paused blind timer did not preserve its remaining time");
  }

  const resumedView = waitForView(
    sockets[0],
    (view) => view.room.pokerTable?.blindTimer?.status === "running"
  );
  await emit(sockets[0], "poker:resume-blinds");
  const resumed = await resumedView;
  if ((resumed.room.pokerTable.blindTimer?.nextLevelAt ?? 0) <= Date.now()) {
    throw new Error("Resumed blind timer did not receive a future deadline");
  }
  await emitExpectedError(sockets[0], "poker:advance-blinds", "自动盲注模式");

  const inHandView = waitForView(
    sockets[0],
    (view) => view.room.pokerTable?.status === "in-hand"
  );
  await emit(sockets[0], "poker:deal");
  const inHand = await inHandView;
  if (
    inHand.room.pokerTable.blindLevel !== 0 ||
    inHand.room.pokerTable.smallBlind !== 5 ||
    inHand.room.pokerTable.bigBlind !== 10
  ) {
    throw new Error("Automatic blinds advanced before the level deadline");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: owner.roomCode,
        players: sessions.length,
        blindLevel: inHand.room.pokerTable.blindLevel,
        blindTimerStatus: inHand.room.pokerTable.blindTimer?.status,
        remainingMs,
        ownerOnlyPauseVerified: true,
        pauseResumeVerified: true,
        manualAdvanceRejected: true,
        prematureAdvanceRejected: true
      },
      null,
      2
    )
  );
} finally {
  sockets.forEach((socket) => socket.disconnect());
}
