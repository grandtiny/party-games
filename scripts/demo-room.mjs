import { io } from "socket.io-client";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:18081";
const password = process.env.DEMO_PASSWORD ?? "demo-local";
const humanNickname = process.env.DEMO_HUMAN_NAME ?? "玩家";
const botNames = ["阿一", "阿二", "阿三", "阿四", "阿五", "阿六"];

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

function emit(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    socket.emit(event, ...args, (ack) => {
      if (ack.ok) resolve();
      else reject(new Error(ack.error ?? `${event} failed`));
    });
  });
}

function connectWithFirstView(session) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: {
        roomCode: session.roomCode,
        sessionToken: session.sessionToken
      }
    });
    let connected = false;
    let firstView;
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection or first room view timed out"));
    }, 5000);
    const complete = () => {
      if (!connected || !firstView) return;
      clearTimeout(timeout);
      resolve({ socket, view: firstView });
    };
    socket.once("connect", () => {
      connected = true;
      complete();
    });
    socket.once("room:view", (view) => {
      firstView = view;
      complete();
    });
    socket.once("connect_error", reject);
  });
}

const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
if (health.ok !== true) throw new Error("Local server health check failed");

const human = await post("/api/rooms", {
  gameType: "clocktower",
  nickname: humanNickname,
  password
});
const sessions = [human];
for (const nickname of botNames) {
  sessions.push(
    await post("/api/rooms/join", {
      roomCode: human.roomCode,
      nickname,
      password
    })
  );
}

const connections = await Promise.all(sessions.map(connectWithFirstView));
const sockets = connections.map((connection) => connection.socket);
const latestViews = new Map(connections.map((connection, index) => [index, connection.view]));
const humanPlayerId = human.playerId;
const publicGreetingDays = new Set();
const privateGreetingDays = new Set();
let botQueue = Promise.resolve();
sockets.forEach((socket, index) => {
  socket.on("room:view", (view) => {
    latestViews.set(index, view);
    scheduleBots();
  });
});

await Promise.all(
  sockets.slice(1).map((socket, index) => emit(socket, "room:set-seat", index + 2))
);
await Promise.all(sockets.slice(1).map((socket) => emit(socket, "room:set-ready", true)));
sockets[0].disconnect();

function scheduleBots() {
  botQueue = botQueue
    .then(() => processOneBotAction())
    .catch((error) => {
      console.error(`[demo] ${error instanceof Error ? error.message : String(error)}`);
    });
}

function botEntries() {
  return sessions.slice(1).map((session, offset) => ({
    index: offset + 1,
    session,
    socket: sockets[offset + 1],
    view: latestViews.get(offset + 1)
  }));
}

async function processOneBotAction() {
  const entries = botEntries().filter((entry) => entry.view);
  const publicView = entries[0]?.view;
  if (!publicView) return;

  const roleConfirmation = entries.find(
    ({ session, view }) =>
      view.room.phase === "role-reveal" &&
      !view.room.players.find((player) => player.id === session.playerId)?.roleConfirmed
  );
  if (roleConfirmation) {
    await emit(roleConfirmation.socket, "clocktower:confirm-role");
    return;
  }

  const nightActor = entries.find(({ view }) => view.self.privateGame?.nightAction);
  if (nightActor) {
    await actAtNight(nightActor);
    return;
  }

  if (!["day", "nominations", "voting"].includes(publicView.room.phase)) return;
  const dayNumber = publicView.room.dayNumber ?? 1;
  if (!publicGreetingDays.has(dayNumber)) {
    publicGreetingDays.add(dayNumber);
    await emit(entries[0].socket, "chat:send", {
      content: `第 ${dayNumber} 天，虚拟玩家已就位。你可以申请进入提名。`
    });
    return;
  }
  if (!privateGreetingDays.has(dayNumber) && entries[1]) {
    privateGreetingDays.add(dayNumber);
    await emit(entries[1].socket, "chat:send", {
      recipientPlayerId: humanPlayerId,
      content: `这是第 ${dayNumber} 天的虚拟玩家私聊。`
    });
    return;
  }

  const day = publicView.room.clocktowerDay;
  if (!day) return;
  if (
    publicView.room.phase === "day" &&
    day.nominationRequestPlayerIds.includes(humanPlayerId)
  ) {
    const helper = entries.find(({ view }) => view.self.dayActions?.canRequestNominations);
    if (helper) {
      await emit(helper.socket, "clocktower:request-nominations");
      return;
    }
  }

  if (
    publicView.room.phase === "nominations" &&
    day.closeRequestPlayerIds.includes(humanPlayerId)
  ) {
    const helper = entries.find(({ view }) => view.self.dayActions?.canRequestClose);
    if (helper) {
      await emit(helper.socket, "clocktower:request-close-nominations");
      return;
    }
  }

  if (publicView.room.phase === "voting") {
    const voters = entries.filter(
      ({ view }) =>
        view.self.dayActions?.canSetVoteIntent &&
        !view.self.dayActions.currentVoteIntent
    );
    if (voters.length > 0) {
      await Promise.allSettled(
        voters.map(({ socket }) => emit(socket, "clocktower:set-vote", true))
      );
    }
  }
}

async function actAtNight({ session, socket, view }) {
  const action = view.self.privateGame?.nightAction;
  if (!action) return;
  if (action.kind === "acknowledge") {
    await emit(socket, "clocktower:night-ack");
    return;
  }

  const requiredCount = action.kind === "select-two" ? 2 : 1;
  const options = [...(action.options ?? [])];
  const roleByPlayerId = new Map(
    [...latestViews.values()]
      .filter(Boolean)
      .map((candidate) => [candidate.self.playerId, candidate.self.privateGame?.role.id])
  );
  if (action.stepId === "imp") {
    options.sort((left, right) => {
      const leftRole = roleByPlayerId.get(left.playerId);
      const rightRole = roleByPlayerId.get(right.playerId);
      const leftPreferred =
        left.playerId !== session.playerId &&
        left.playerId !== humanPlayerId &&
        left.alive &&
        leftRole !== "soldier" &&
        leftRole !== "mayor";
      const rightPreferred =
        right.playerId !== session.playerId &&
        right.playerId !== humanPlayerId &&
        right.alive &&
        rightRole !== "soldier" &&
        rightRole !== "mayor";
      return Number(rightPreferred) - Number(leftPreferred);
    });
  } else if (action.stepId === "poisoner") {
    options.sort((left, right) => {
      const leftPreferred = left.playerId !== humanPlayerId;
      const rightPreferred = right.playerId !== humanPlayerId;
      return Number(rightPreferred) - Number(leftPreferred);
    });
  } else if (action.stepId === "monk" || action.stepId === "butler") {
    options.sort((left, right) =>
      Number(right.playerId === humanPlayerId) - Number(left.playerId === humanPlayerId)
    );
  } else if (action.stepId === "fortuneteller" || action.stepId === "ravenkeeper") {
    options.sort((left, right) => {
      const leftPreferred = roleByPlayerId.get(left.playerId) === "imp";
      const rightPreferred = roleByPlayerId.get(right.playerId) === "imp";
      return Number(rightPreferred) - Number(leftPreferred);
    });
  }

  await emit(
    socket,
    "clocktower:night-select",
    options.slice(0, requiredCount).map((option) => option.playerId)
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      roomCode: human.roomCode,
      password,
      humanNickname,
      recoveryCode: human.recoveryCode,
      botNames,
      processId: process.pid
    },
    null,
    2
  )
);
console.log("[demo] 虚拟玩家已在2至7号位准备，等待你恢复身份、选择1号位并开始游戏。");
scheduleBots();

const shutdown = () => {
  for (const socket of sockets.slice(1)) socket.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await new Promise(() => undefined);
