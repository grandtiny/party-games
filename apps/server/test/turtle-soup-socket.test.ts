import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RoomSessionResponse, RoomView } from "@party-games/shared";
import { io, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const cleanupTasks: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanupTasks.splice(0).reverse()) await cleanup();
});

describe("turtle soup socket boundary", () => {
  it("serializes concurrent AI-backed actions and preserves reconnect state", async () => {
    const modelServer = await createTurtleSoupModelServer();
    const modelAddress = modelServer.address() as AddressInfo;
    const context = await createTestApp({
      PARTY_GAMES_LLM_ENABLED: "true",
      PARTY_GAMES_LLM_ENDPOINT: `http://127.0.0.1:${modelAddress.port}/v1`,
      PARTY_GAMES_LLM_API_KEY: "test-key",
      PARTY_GAMES_LLM_MODEL: "fake-model",
      PARTY_GAMES_LLM_STORY_MODEL: "fake-story-model",
      PARTY_GAMES_LLM_JUDGE_MODEL: "fake-judge-model",
      PARTY_GAMES_LLM_TIMEOUT_MS: "5000"
    });

    const owner = await context.roomService.createRoom({
      gameType: "turtle-soup",
      nickname: "Owner",
      password: "secret",
      turtleSoup: { difficulty: "normal", tags: ["团建", "误会"] }
    });
    const second = await context.roomService.joinRoom({
      roomCode: owner.roomCode,
      nickname: "Player 2",
      password: "secret"
    });

    const ownerConnection = await connectWithView(context.baseUrl, owner);
    const secondConnection = await connectWithView(context.baseUrl, second);
    cleanupTasks.push(() => {
      ownerConnection.socket.disconnect();
      secondConnection.socket.disconnect();
    });

    await emit(ownerConnection.socket, "room:set-seat", 1);
    await emit(secondConnection.socket, "room:set-seat", 2);
    await emit(ownerConnection.socket, "room:set-ready", true);
    await emit(secondConnection.socket, "room:set-ready", true);

    const startedViewPromise = nextView(
      ownerConnection.socket,
      (view) => view.room.turtleSoup?.status === "playing"
    );
    await emit(ownerConnection.socket, "room:start");
    const startedView = await startedViewPromise;

    expect(startedView.room.turtleSoup).toMatchObject({
      source: "model",
      judgeSource: "model",
      questionCount: 0
    });
    expect(startedView.room.turtleSoup?.answer).toBeUndefined();
    expect(
      startedView.room.turtleSoup?.keyPoints.every((point) => point.text === undefined)
    ).toBe(true);

    const twoQuestionsViewPromise = nextView(
      ownerConnection.socket,
      (view) => (view.room.turtleSoup?.questionCount ?? 0) >= 2
    );
    await Promise.all([
      emit(ownerConnection.socket, "turtle-soup:ask", "这和投影设备有关吗？"),
      emit(secondConnection.socket, "turtle-soup:ask", "是不是有人误会了现场情况？")
    ]);
    const twoQuestionsView = await twoQuestionsViewPromise;

    expect(twoQuestionsView.room.turtleSoup?.judgeSource).toBe("model");
    expect(twoQuestionsView.room.turtleSoup?.questionCount).toBe(2);
    expect(
      twoQuestionsView.room.turtleSoup?.log.filter((entry) => entry.kind === "question")
    ).toHaveLength(2);

    secondConnection.socket.disconnect();
    const reconnected = await connectWithView(context.baseUrl, second);
    cleanupTasks.push(() => reconnected.socket.disconnect());

    expect(reconnected.view.room.turtleSoup).toMatchObject({
      source: "model",
      judgeSource: "model",
      questionCount: 2,
      status: "playing"
    });
    expect(reconnected.view.room.turtleSoup?.answer).toBeUndefined();
    expect(
      reconnected.view.room.turtleSoup?.keyPoints.every((point) => point.text === undefined)
    ).toBe(true);

    const hintedViewPromise = nextView(
      ownerConnection.socket,
      (view) => (view.room.turtleSoup?.hintsUsed ?? 0) >= 1
    );
    await emit(reconnected.socket, "turtle-soup:hint");
    const hintedView = await hintedViewPromise;
    expect(hintedView.room.turtleSoup).toMatchObject({
      source: "model",
      judgeSource: "model",
      hintsUsed: 1
    });
    expect(
      hintedView.room.turtleSoup?.log.some(
        (entry) => entry.kind === "hint" && entry.content.length > 0
      )
    ).toBe(true);
  });
});

async function createTestApp(environment: NodeJS.ProcessEnv) {
  const directory = mkdtempSync(join(tmpdir(), "party-games-turtle-soup-socket-"));
  const context = await createApp({
    databasePath: join(directory, "test.sqlite"),
    logger: false,
    environment
  });
  await context.app.listen({ host: "127.0.0.1", port: 0 });
  const address = context.app.server.address() as AddressInfo;
  cleanupTasks.push(async () => {
    await context.app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { ...context, baseUrl: `http://127.0.0.1:${address.port}` };
}

function connectWithView(
  baseUrl: string,
  session: RoomSessionResponse
): Promise<{ socket: Socket; view: RoomView }> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      auth: { roomCode: session.roomCode, sessionToken: session.sessionToken }
    });
    let connected = false;
    let view: RoomView | undefined;
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Turtle soup socket view timed out"));
    }, 5000);
    const complete = () => {
      if (!connected || !view) return;
      clearTimeout(timeout);
      resolve({ socket, view });
    };
    socket.once("connect", () => {
      connected = true;
      complete();
    });
    socket.once("room:view", (nextRoomView) => {
      view = nextRoomView;
      complete();
    });
    socket.once("connect_error", reject);
  });
}

function nextView(
  socket: Socket,
  predicate: (view: RoomView) => boolean
): Promise<RoomView> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Turtle soup matching view timed out")), 5000);
    const handleView = (view: RoomView) => {
      if (!predicate(view)) return;
      clearTimeout(timeout);
      socket.off("room:view", handleView);
      resolve(view);
    };
    socket.on("room:view", handleView);
  });
}

function emit(socket: Socket, event: string, ...args: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit(event, ...args, (ack: { ok: boolean; error?: string }) => {
      if (ack.ok) resolve();
      else reject(new Error(ack.error ?? `${event} failed`));
    });
  });
}

async function createTurtleSoupModelServer(): Promise<Server> {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8");
    const body = raw ? (JSON.parse(raw) as { messages?: Array<{ content?: string }> }) : {};
    const prompt = body.messages?.[0]?.content ?? "";
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: modelContent(prompt) } }] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  cleanupTasks.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );
  return server;
}

function modelContent(prompt: string): string {
  if (prompt.includes("侧向思维谜题大师")) {
    return JSON.stringify({
      title: "天花板上的节目效果",
      surface: "团建时，主持人刚关灯，所有人都看向天花板并笑了。为什么？",
      answer:
        "主持人提前把同事的祝福视频投到了天花板上，关灯后投影才清晰可见。大家以为会出现恐怖桥段，实际看到的是提前准备的团建惊喜。",
      key_points: [
        "天花板上有投影画面",
        "主持人提前准备了祝福视频",
        "关灯是为了让投影更清晰",
        "大家原本误以为会出现恐怖桥段",
        "笑是因为看到的是团建惊喜"
      ],
      hints: ["关注关灯后什么东西更明显。", "大家看向天花板不是因为声音。"]
    });
  }
  if (prompt.includes("玩家提问")) {
    return JSON.stringify({ res: "是也不是", reason: "方向部分相关" });
  }
  if (prompt.includes("玩家推理")) {
    return JSON.stringify({
      matched_segments: [],
      wrong_segments: [],
      achieved_point_ids: [],
      achieved_points: [],
      comment: "继续观察"
    });
  }
  return "关灯后，房间里什么东西反而更清楚了？";
}
