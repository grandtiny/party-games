import type {
  CreateRoomRequest,
  JoinRoomRequest,
  RecoverRoomRequest,
  RulesAnswerResponse,
  RulesQuestionRequest,
  RoomSessionResponse
} from "@party-games/shared";

export async function createRoom(input: CreateRoomRequest): Promise<RoomSessionResponse> {
  return request("/api/rooms", input);
}

export async function joinRoom(input: JoinRoomRequest): Promise<RoomSessionResponse> {
  return request("/api/rooms/join", input);
}

export async function recoverRoom(input: RecoverRoomRequest): Promise<RoomSessionResponse> {
  return request("/api/rooms/recover", input);
}

export async function askClocktowerRules(
  input: RulesQuestionRequest
): Promise<RulesAnswerResponse> {
  return request("/api/clocktower/rules/ask", input);
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "请求失败");
  return data;
}
