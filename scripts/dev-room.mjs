// 本地开发用：创建 8 人血染钟楼房间（1 个人类 = 你 + 7 个虚拟玩家）。
// 虚拟玩家会自动入座 2~8 号位并准备，并在游戏进行中持续代你处理：
//   身份确认 / 夜间行动 / 白天申请提名 / 投票举手。
// 你（人类）断开 socket，可随时用浏览器恢复身份、坐 1 号位、推进游戏，
// 自由观察首夜 / 白天 / 提名 / 投票 / 复盘各阶段的 UI。
//
// 用法（在仓库根目录）：
//   node scripts/dev-room.mjs
//   # 自定义：
//   BASE_URL=http://127.0.0.1:3000 DEV_HUMAN_NAME=主持人 DEV_PASSWORD=dev-local node scripts/dev-room.mjs
//
// 脚本会持续运行（保持 bot 在线），按 Ctrl+C 退出。

import { io } from "socket.io-client";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = process.env.DEV_PASSWORD ?? "dev-local";
const humanNickname = process.env.DEV_HUMAN_NAME ?? "主持人";
const botNames = ["阿一", "阿二", "阿三", "阿四", "阿五", "阿六", "阿七"];

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
if (health.ok !== true) throw new Error("本地服务健康检查失败，确认后端已启动");

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

// bot 坐 2~8 号位并准备
await Promise.all(
  sockets.slice(1).map((socket, index) => emit(socket, "room:set-seat", index + 2))
);
await Promise.all(sockets.slice(1).map((socket) => emit(socket, "room:set-ready", true)));
// 人类断开 socket，留给浏览器接入
sockets[0].disconnect();

function scheduleBots() {
  botQueue = botQueue
    .then(() => processOneBotAction())
    .catch((error) => {
      console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
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

  // 身份确认
  const roleConfirmation = entries.find(
    ({ session, view }) =>
      view.room.phase === "role-reveal" &&
      !view.room.players.find((player) => player.id === session.playerId)?.roleConfirmed
  );
  if (roleConfirmation) {
    await emit(roleConfirmation.socket, "clocktower:confirm-role");
    return;
  }

  // 大厅阶段：bot 自动重新入座 + 准备（支持 rematch 后回到 lobby）
  if (publicView.room.phase === "lobby") {
    for (const entry of entries) {
      const me = entry.view.room.players.find((p) => p.id === entry.session.playerId);
      if (!me) continue;
      // bot 在 sessions 里的序号 +1 = 座位号（sessions[1]→2号位...）
      const seatNum = sessions.indexOf(entry.session) + 1;
      try {
        if (me.seat === null) await emit(entry.socket, "room:set-seat", seatNum);
      } catch { /* 座位可能已被占，忽略 */ }
      try {
        if (!me.ready) await emit(entry.socket, "room:set-ready", true);
      } catch { /* 忽略 */ }
    }
    return;
  }

  // 夜间行动
  const nightActor = entries.find(({ view }) => view.self.privateGame?.nightAction);
  if (nightActor) {
    await actAtNight(nightActor);
    return;
  }

  if (!["day", "nominations", "voting"].includes(publicView.room.phase)) return;
  const dayNumber = publicView.room.dayNumber ?? 1;

  const day = publicView.room.clocktowerDay;
  if (!day) return;

  // 白天讨论阶段：辅助申请进入提名（凑够多数）
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

  // 提名阶段：辅助申请结束提名
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

  // 投票阶段：举手
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
  // 恶魔优先杀非自己、非人类、非士兵/市长的存活玩家
  if (action.stepId === "imp") {
    options.sort((left, right) => {
      const preferred = (option) =>
        option.playerId !== session.playerId &&
        option.playerId !== humanPlayerId &&
        option.alive &&
        roleByPlayerId.get(option.playerId) !== "soldier" &&
        roleByPlayerId.get(option.playerId) !== "mayor";
      return Number(preferred(right)) - Number(preferred(left));
    });
  } else if (action.stepId === "poisoner") {
    // 投毒者优先针对非人类
    options.sort((left, right) =>
      Number(right.playerId !== humanPlayerId) - Number(left.playerId !== humanPlayerId)
    );
  } else if (action.stepId === "monk" || action.stepId === "butler") {
    // 僧侣/管家优先选择人类
    options.sort((left, right) =>
      Number(right.playerId === humanPlayerId) - Number(left.playerId === humanPlayerId)
    );
  } else if (action.stepId === "fortuneteller" || action.stepId === "ravenkeeper") {
    // 占卜师/守鸦人优先查恶魔
    options.sort((left, right) => {
      const leftIsImp = roleByPlayerId.get(left.playerId) === "imp";
      const rightIsImp = roleByPlayerId.get(right.playerId) === "imp";
      return Number(rightIsImp) - Number(leftIsImp);
    });
  }

  await emit(
    socket,
    "clocktower:night-select",
    options.slice(0, requiredCount).map((option) => option.playerId)
  );
}

const roomUrl = `http://localhost:5173/clocktower/room/${human.roomCode}`;
console.log("");
console.log("═══════════════════════════════════════════════════════");
console.log("  8 人血染钟楼测试房间已就绪");
console.log("═══════════════════════════════════════════════════════");
console.log(`  房间码       : ${human.roomCode}`);
console.log(`  房间口令     : ${password}`);
console.log(`  你的昵称     : ${humanNickname}（1 号位留给你）`);
console.log(`  恢复码       : ${human.recoveryCode}`);
console.log(`  虚拟玩家     : ${botNames.join("、")}（已坐 2~8 号位并准备）`);
console.log(`  浏览器打开   : ${roomUrl}`);
console.log("───────────────────────────────────────────────────────");
console.log("  虚拟玩家会自动陪你走完所有阶段：");
console.log("  身份确认 → 首夜行动 → 白天讨论 → 申请提名 → 投票");
console.log("  你可以随时用浏览器观察任意阶段的 UI。");
console.log("  按 Ctrl+C 退出（bot 会离线，房间保留）。");
console.log("═══════════════════════════════════════════════════════");
console.log("");

scheduleBots();

const shutdown = () => {
  for (const socket of sockets.slice(1)) socket.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await new Promise(() => undefined);
