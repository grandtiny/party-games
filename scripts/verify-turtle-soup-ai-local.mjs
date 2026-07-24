import { io } from "socket.io-client";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = "turtle-soup-ai-local-verify";
const requireModel = process.env.REQUIRE_TURTLE_SOUP_MODEL !== "false";
const timeoutMs = Number(process.env.TURTLE_SOUP_VERIFY_TIMEOUT_MS ?? 45_000);

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

function waitForView(socket, predicate, timeoutMessage, waitMs = timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("room:view", onView);
      reject(new Error(timeoutMessage));
    }, waitMs);
    const onView = (view) => {
      if (!predicate(view)) return;
      clearTimeout(timeout);
      socket.off("room:view", onView);
      resolve(view);
    };
    socket.on("room:view", onView);
  });
}

function assertModelSource(view, step) {
  const soup = view.room.turtleSoup;
  if (!soup) throw new Error(`${step}: turtle soup view is missing`);
  if (requireModel && soup.source !== "model") {
    throw new Error(`${step}: expected AI-generated puzzle, got ${soup.source}`);
  }
  if (requireModel && soup.judgeSource !== "model") {
    throw new Error(`${step}: expected AI judge, got ${soup.judgeSource}`);
  }
}

const platform = await fetch(`${baseUrl}/api/platform`).then((response) => response.json());
if (!platform.enabledGames?.includes("turtle-soup")) {
  throw new Error("Turtle soup is disabled or missing from the platform.");
}

const owner = await post("/api/rooms", {
  gameType: "turtle-soup",
  nickname: "Turtle AI Verify",
  password,
  turtleSoup: {
    difficulty: "normal",
    tags: ["团建", "悬疑", "逻辑"]
  }
});
const socket = await connect(owner);

try {
  await emit(socket, "room:set-seat", 1);
  await emit(socket, "room:set-ready", true);

  const startedView = waitForView(
    socket,
    (view) => view.room.turtleSoup?.status === "playing",
    "Turtle soup start timed out"
  );
  await emit(socket, "room:start");
  const started = await startedView;
  assertModelSource(started, "start");

  const startedSoup = started.room.turtleSoup;
  if (startedSoup.answer !== undefined) throw new Error("Answer leaked before solved");
  if (startedSoup.keyPoints.some((point) => point.text !== undefined)) {
    throw new Error("Unfound key point text leaked before solved");
  }

  const answeredView = waitForView(
    socket,
    (view) => (view.room.turtleSoup?.questionCount ?? 0) >= 1,
    "Turtle soup AI question judgment timed out"
  );
  await emit(socket, "turtle-soup:ask", "这件事和某个人的误会有关吗？");
  const answered = await answeredView;
  assertModelSource(answered, "ask");
  const answerEntry = answered.room.turtleSoup.log.findLast(
    (entry) => entry.kind === "question"
  );
  if (!answerEntry) throw new Error("Question log entry was not recorded");

  const hintedView = waitForView(
    socket,
    (view) => (view.room.turtleSoup?.hintsUsed ?? 0) >= 1,
    "Turtle soup AI hint generation timed out"
  );
  await emit(socket, "turtle-soup:hint");
  const hinted = await hintedView;
  assertModelSource(hinted, "hint");
  const hintEntry = hinted.room.turtleSoup.log.findLast((entry) => entry.kind === "hint");
  if (!hintEntry?.content) throw new Error("Hint log entry was not recorded");

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: owner.roomCode,
        requireModel,
        puzzleSource: hinted.room.turtleSoup.source,
        judgeSource: hinted.room.turtleSoup.judgeSource,
        title: hinted.room.turtleSoup.title,
        questionAnswer: answerEntry.answer,
        questionCount: hinted.room.turtleSoup.questionCount,
        hintsUsed: hinted.room.turtleSoup.hintsUsed,
        keyPointCount: hinted.room.turtleSoup.keyPoints.length,
        answerHiddenVerified: true,
        keyPointLeakChecked: true
      },
      null,
      2
    )
  );
} finally {
  socket.disconnect();
}
