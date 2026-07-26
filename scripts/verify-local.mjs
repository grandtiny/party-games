import { io } from "socket.io-client";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = "local-verify";
const stopAt = process.env.VERIFY_STOP_AT ?? "day-two";
const showRecoveryCode = process.env.SHOW_RECOVERY_CODE === "1";
const existingRoomCode = process.env.VERIFY_ROOM_CODE;
const existingRecoveryCodes = (process.env.VERIFY_RECOVERY_CODES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const existingRoomAction = process.env.VERIFY_ROOM_ACTION;

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
      auth: {
        roomCode: session.roomCode,
        sessionToken: session.sessionToken
      }
    });
    const timeout = setTimeout(() => reject(new Error("Socket connection timed out")), 5000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", reject);
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
      reject(new Error("Room view timed out"));
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

function waitForAnyView(sockets, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const listeners = [];
    const cleanup = () => {
      clearTimeout(timeout);
      listeners.forEach(({ socket, listener }) => socket.off("room:view", listener));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Room views timed out"));
    }, timeoutMs);
    sockets.forEach((socket, index) => {
      const listener = (view) => {
        if (!predicate(view)) return;
        cleanup();
        resolve({ index, view });
      };
      listeners.push({ socket, listener });
      socket.on("room:view", listener);
    });
  });
}

const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
if (health.ok !== true) throw new Error("Health check failed");
if (!Number.isInteger(health.databaseSchemaVersion) || health.databaseSchemaVersion < 5) {
  throw new Error("Database migrations are incomplete");
}
const rulesAnswer = await post("/api/clocktower/rules/ask", {
  question: "死亡玩家还能投票吗？"
});
if (!rulesAnswer.answer?.includes("死亡票")) throw new Error("Local rules answer is missing");

if (existingRoomCode) {
  await driveExistingRoom(existingRoomCode, existingRecoveryCodes, existingRoomAction);
  process.exit(0);
}

const owner = await post("/api/rooms", {
  gameType: "clocktower",
  nickname: "Verify 1",
  password
});
const sessions = [owner];
for (let index = 2; index <= 5; index += 1) {
  sessions.push(
    await post("/api/rooms/join", {
      roomCode: owner.roomCode,
      nickname: `Verify ${index}`,
      password
    })
  );
}

const sockets = await Promise.all(sessions.map(connect));
try {
  const latestViews = new Map();
  sockets.forEach((socket, index) => {
    socket.on("room:view", (view) => latestViews.set(index, view));
  });
  await Promise.all(
    sockets.map((socket, index) => emit(socket, "room:set-seat", index + 1))
  );
  await Promise.all(sockets.map((socket) => emit(socket, "room:set-ready", true)));
  const roleViews = sockets.map((socket) =>
    waitForView(socket, (view) => view.room.phase === "role-reveal")
  );
  await emit(sockets[0], "room:start");
  const views = await Promise.all(roleViews);
  views.forEach((view, index) => latestViews.set(index, view));

  for (const view of views) {
    if (!view.self.privateGame?.role?.id) throw new Error("Private role is missing");
    const serialized = JSON.stringify(view);
    for (const forbidden of ["actualRoleId", "rolesInPlay", "demonBluffRoleIds", '"seed":']) {
      if (serialized.includes(forbidden)) {
        throw new Error(`Private projection leaked ${forbidden}`);
      }
    }
  }

  if (stopAt !== "role-reveal") {
    const firstNightStarted = waitForView(
      sockets[0],
      (view) => view.room.phase === "first-night" || view.room.phase === "day"
    );
    for (let index = 0; index < sockets.length; index += 1) {
      await emit(sockets[index], "clocktower:confirm-role");
    }
    latestViews.set(0, await firstNightStarted);
  }

  let guard = 0;
  while (stopAt !== "role-reveal" && latestViews.get(0)?.room.phase === "first-night") {
    guard += 1;
    if (guard > 100) throw new Error("First night verification stalled");

    let actorIndex = sockets.findIndex(
      (_socket, index) => latestViews.get(index)?.self.privateGame?.nightAction
    );
    if (actorIndex < 0) {
      const nextAction = await waitForAnyView(
        sockets,
        (view) =>
          view.room.phase !== "first-night" ||
          Boolean(view.self.privateGame?.nightAction)
      );
      latestViews.set(nextAction.index, nextAction.view);
      if (nextAction.view.room.phase !== "first-night") break;
      actorIndex = nextAction.index;
    }

    const actorView = latestViews.get(actorIndex);
    const action = actorView.self.privateGame.nightAction;
    const nextView = waitForView(
      sockets[actorIndex],
      (view) => view.room.version > actorView.room.version
    );

    if (action.kind === "acknowledge") {
      await emit(sockets[actorIndex], "clocktower:night-ack");
    } else {
      const count = action.kind === "select-two" ? 2 : 1;
      await emit(
        sockets[actorIndex],
        "clocktower:night-select",
        action.options.slice(0, count).map((option) => option.playerId)
      );
    }
    latestViews.set(actorIndex, await nextView);
  }

  let finalView = latestViews.get(0);
  if (stopAt !== "role-reveal" && finalView?.room.phase === "first-night") {
    finalView = await waitForView(
      sockets[0],
      (view) => view.room.phase !== "first-night"
    );
    latestViews.set(0, finalView);
  }
  if (stopAt !== "role-reveal" && (finalView?.room.phase !== "day" || finalView.room.dayNumber !== 1)) {
    throw new Error("First night did not advance to day one");
  }

  if (stopAt === "night" || stopAt === "day-two") {
    const publicMessage = waitForView(
      sockets[0],
      (view) => view.chatMessages.some((message) => message.content === "public smoke message")
    );
    await emit(sockets[0], "chat:send", { content: "public smoke message" });
    await publicMessage;

    const privateMessage = waitForView(
      sockets[0],
      (view) => view.chatMessages.some((message) => message.content === "private smoke message")
    );
    await emit(sockets[1], "chat:send", {
      recipientPlayerId: sessions[0].playerId,
      content: "private smoke message"
    });
    const chatView = await privateMessage;
    const uninvolvedView = latestViews.get(2);
    if (chatView.chatMessages.length !== 2 || uninvolvedView.chatMessages.length !== 1) {
      throw new Error("Private chat projection leaked to an uninvolved player");
    }

    const nominationsOpened = waitForView(
      sockets[0],
      (view) => view.room.phase === "nominations"
    );
    for (const socket of sockets.slice(0, 3)) {
      await emit(socket, "clocktower:request-nominations");
    }
    await nominationsOpened;

    const safeTargetIndex = views.findIndex(
      (view) => !["virgin", "saint", "imp"].includes(view.self.privateGame.role.id)
    );
    if (safeTargetIndex < 0) throw new Error("No safe execution target was found");
    const safeTarget = sessions[safeTargetIndex];
    await emit(sockets[0], "clocktower:nominate", safeTarget.playerId);

    const voteCompleted = waitForView(
      sockets[0],
      (view) =>
        view.room.phase === "nominations" &&
        view.room.clocktowerDay?.publicEvents.some((event) => event.kind === "vote-completed"),
      20_000
    );
    for (const socket of sockets) {
      await emit(socket, "clocktower:set-vote", true);
    }
    await voteCompleted;

    const dayResolved = waitForView(
      sockets[0],
      (view) => view.room.phase === "night" || view.room.phase === "game-over"
    );
    for (const socket of sockets.slice(0, 3)) {
      await emit(socket, "clocktower:request-close-nominations");
    }
    finalView = await dayResolved;

    const executedPlayer = finalView.room.players.find(
      (player) => player.id === safeTarget.playerId
    );
    if (finalView.room.phase !== "night" || executedPlayer?.alive !== false) {
      throw new Error("Day flow did not resolve to the expected execution and night phase");
    }
  }

  if (stopAt === "day-two") {
    guard = 0;
    while (latestViews.get(0)?.room.phase === "night") {
      guard += 1;
      if (guard > 100) throw new Error("Other-night verification stalled");

      let actorIndex = sockets.findIndex(
        (_socket, index) => latestViews.get(index)?.self.privateGame?.nightAction
      );
      if (actorIndex < 0) {
        const nextAction = await waitForAnyView(
          sockets,
          (view) =>
            view.room.phase !== "night" || Boolean(view.self.privateGame?.nightAction)
        );
        latestViews.set(nextAction.index, nextAction.view);
        if (nextAction.view.room.phase !== "night") break;
        actorIndex = nextAction.index;
      }

      const actorView = latestViews.get(actorIndex);
      const action = actorView.self.privateGame.nightAction;
      const nextView = waitForView(
        sockets[actorIndex],
        (view) => view.room.version > actorView.room.version
      );

      if (action.kind === "acknowledge") {
        await emit(sockets[actorIndex], "clocktower:night-ack");
      } else {
        const count = action.kind === "select-two" ? 2 : 1;
        const options = [...action.options];
        if (actorView.self.privateGame.role.id === "imp") {
          options.sort((left, right) => {
            const leftPreferred = left.playerId !== actorView.self.playerId && left.alive;
            const rightPreferred = right.playerId !== actorView.self.playerId && right.alive;
            return Number(rightPreferred) - Number(leftPreferred);
          });
        }
        await emit(
          sockets[actorIndex],
          "clocktower:night-select",
          options.slice(0, count).map((option) => option.playerId)
        );
      }
      latestViews.set(actorIndex, await nextView);
    }

    finalView = latestViews.get(0);
    if (finalView?.room.phase === "night") {
      finalView = await waitForView(sockets[0], (view) => view.room.phase !== "night");
      latestViews.set(0, finalView);
    }
    if (finalView?.room.phase !== "day" || finalView.room.dayNumber !== 2) {
      throw new Error("Other night did not advance to day two");
    }
    if (
      !finalView.room.clocktowerDay?.publicEvents.some(
        (event) => event.kind === "night-deaths"
      )
    ) {
      throw new Error("Day two did not publish the night death result");
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        rulesAnswerSource: rulesAnswer.source,
        roomCode: owner.roomCode,
        players: views.length,
        phase: finalView.room.phase,
        dayNumber: finalView.room.dayNumber,
        publicEvents: finalView.room.clocktowerDay?.publicEvents.length ?? 0,
        chatMessagesVisibleToOwner: finalView.chatMessages.length,
        ...(showRecoveryCode ? { ownerRecoveryCode: owner.recoveryCode } : {}),
        ...(showRecoveryCode
          ? {
              recoveryCodes: sessions.map((session, index) => ({
                player: `Verify ${index + 1}`,
                code: session.recoveryCode
              }))
            }
          : {}),
        rolesDelivered: views.map((view) => view.self.privateGame.role.name)
      },
      null,
      2
    )
  );
} finally {
  for (const socket of sockets) socket.disconnect();
}

async function driveExistingRoom(roomCode, recoveryCodes, action) {
  if (recoveryCodes.length < 3) {
    throw new Error("VERIFY_RECOVERY_CODES requires at least three comma-separated codes");
  }
  if (!["start-vote", "close-nominations", "finish-night"].includes(action)) {
    throw new Error(
      "VERIFY_ROOM_ACTION must be start-vote, close-nominations, or finish-night"
    );
  }

  const sessions = await Promise.all(
    recoveryCodes.map((recoveryCode) =>
      post("/api/rooms/recover", { roomCode, recoveryCode })
    )
  );
  const connections = await Promise.all(sessions.map(connectWithFirstView));
  const sockets = connections.map((connection) => connection.socket);
  try {
    const views = connections.map((connection) => connection.view);

    if (action === "start-vote") {
      let currentViews = views;
      if (views[0].room.phase === "day") {
        const nominationViews = Promise.all(
          sockets.map((socket) =>
            waitForView(socket, (view) => view.room.phase === "nominations")
          )
        );
        for (const socket of sockets.slice(0, 3)) {
          await emit(socket, "clocktower:request-nominations");
        }
        currentViews = await nominationViews;
      } else if (views[0].room.phase !== "nominations") {
        throw new Error(`Expected day or nominations phase, received ${views[0].room.phase}`);
      }
      const nominatorIndex = currentViews.findIndex(
        (view) => view.self.dayActions?.canNominate
      );
      if (nominatorIndex < 0) throw new Error("No recovered player can nominate");

      const safeTargetIndex = currentViews.findIndex(
        (view, index) =>
          index !== nominatorIndex &&
          !view.room.clocktowerDay.nomineesUsedPlayerIds.includes(view.self.playerId) &&
          !["virgin", "saint", "imp"].includes(view.self.privateGame.role.id)
      );
      const fallbackTargetIndex = currentViews.findIndex(
        (view) =>
          !view.room.clocktowerDay.nomineesUsedPlayerIds.includes(view.self.playerId) &&
          !["virgin", "saint", "imp"].includes(view.self.privateGame.role.id)
      );
      const targetIndex = safeTargetIndex >= 0 ? safeTargetIndex : fallbackTargetIndex;
      if (targetIndex < 0) throw new Error("No safe vote target was found");

      const votingStarted = waitForView(
        sockets[nominatorIndex],
        (view) => view.room.phase === "voting"
      );
      await emit(
        sockets[nominatorIndex],
        "clocktower:nominate",
        sessions[targetIndex].playerId
      );
      const voteView = await votingStarted;
      for (const socket of sockets) await emit(socket, "clocktower:set-vote", true);
      console.log(
        JSON.stringify(
          {
            ok: true,
            action,
            roomCode,
            nominatorPlayerId: sessions[nominatorIndex].playerId,
            nomineePlayerId: sessions[targetIndex].playerId,
            nomineeRole: currentViews[targetIndex].self.privateGame.role.name,
            voteOrder: voteView.room.clocktowerDay.currentVote.order
          },
          null,
          2
        )
      );
      return;
    }

    if (action === "finish-night") {
      const latestViews = new Map(connections.map((connection, index) => [index, connection.view]));
      sockets.forEach((socket, index) => {
        socket.on("room:view", (view) => latestViews.set(index, view));
      });
      let guard = 0;
      while (latestViews.get(0)?.room.phase === "night") {
        guard += 1;
        if (guard > 100) throw new Error("Existing-room night flow stalled");

        let actorIndex = sockets.findIndex(
          (_socket, index) => latestViews.get(index)?.self.privateGame?.nightAction
        );
        if (actorIndex < 0) {
          const nextAction = await waitForAnyView(
            sockets,
            (view) =>
              view.room.phase !== "night" || Boolean(view.self.privateGame?.nightAction)
          );
          latestViews.set(nextAction.index, nextAction.view);
          if (nextAction.view.room.phase !== "night") break;
          actorIndex = nextAction.index;
        }

        const actorView = latestViews.get(actorIndex);
        const nightAction = actorView.self.privateGame.nightAction;
        const nextView = waitForView(
          sockets[actorIndex],
          (view) => view.room.version > actorView.room.version
        );
        if (nightAction.kind === "acknowledge") {
          await emit(sockets[actorIndex], "clocktower:night-ack");
        } else {
          const count = nightAction.kind === "select-two" ? 2 : 1;
          const options = [...(nightAction.options ?? [])];
          if (actorView.self.privateGame.role.id === "imp") {
            options.sort((left, right) => {
              const leftPreferred = left.playerId !== actorView.self.playerId && left.alive;
              const rightPreferred = right.playerId !== actorView.self.playerId && right.alive;
              return Number(rightPreferred) - Number(leftPreferred);
            });
          }
          await emit(
            sockets[actorIndex],
            "clocktower:night-select",
            options.slice(0, count).map((option) => option.playerId)
          );
        }
        latestViews.set(actorIndex, await nextView);
      }

      let finalView = latestViews.get(0);
      if (finalView?.room.phase === "night") {
        finalView = await waitForView(sockets[0], (view) => view.room.phase !== "night");
      }
      console.log(
        JSON.stringify(
          {
            ok: true,
            action,
            roomCode,
            phase: finalView?.room.phase,
            dayNumber: finalView?.room.dayNumber,
            nightDeaths:
              finalView?.room.clocktowerDay?.publicEvents.find(
                (event) => event.kind === "night-deaths"
              )?.playerIds ?? []
          },
          null,
          2
        )
      );
      return;
    }

    if (views[0].room.phase !== "nominations") {
      throw new Error(`Expected nominations phase, received ${views[0].room.phase}`);
    }
    const dayResolved = waitForView(
      sockets[0],
      (view) => view.room.phase === "night" || view.room.phase === "game-over"
    );
    for (const socket of sockets.slice(0, 3)) {
      await emit(socket, "clocktower:request-close-nominations");
    }
    const finalView = await dayResolved;
    console.log(
      JSON.stringify(
        {
          ok: true,
          action,
          roomCode,
          phase: finalView.room.phase,
          winner: finalView.room.clocktowerDay?.winner,
          reason: finalView.room.clocktowerDay?.endReason
        },
        null,
        2
      )
    );
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
}
