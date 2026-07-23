import type {
  AdminAuthStatusResponse,
  AdminConfigResponse,
  AdminLlmConfigUpdateRequest,
  AdminLlmTestResponse,
  AdminLoginRequest,
  AdminPasswordChangeRequest,
  AdminSetupRequest,
  CreateRoomRequest,
  JoinRoomRequest,
  RecoverRoomRequest,
  RulesAnswerResponse,
  RulesQuestionRequest,
  RoomSessionResponse
} from "@party-games/shared";

export async function createRoom(input: CreateRoomRequest): Promise<RoomSessionResponse> {
  return request("/api/rooms", { method: "POST", body: input });
}

export async function joinRoom(input: JoinRoomRequest): Promise<RoomSessionResponse> {
  return request("/api/rooms/join", { method: "POST", body: input });
}

export async function recoverRoom(input: RecoverRoomRequest): Promise<RoomSessionResponse> {
  return request("/api/rooms/recover", { method: "POST", body: input });
}

export async function askClocktowerRules(
  input: RulesQuestionRequest
): Promise<RulesAnswerResponse> {
  return request("/api/clocktower/rules/ask", { method: "POST", body: input });
}

export async function getAdminStatus(): Promise<AdminAuthStatusResponse> {
  return request("/api/admin/status");
}

export async function setupAdmin(input: AdminSetupRequest): Promise<AdminAuthStatusResponse> {
  return request("/api/admin/setup", { method: "POST", body: input });
}

export async function loginAdmin(input: AdminLoginRequest): Promise<AdminAuthStatusResponse> {
  return request("/api/admin/login", { method: "POST", body: input });
}

export async function logoutAdmin(): Promise<{ ok: true }> {
  return request("/api/admin/logout", { method: "POST" });
}

export async function getAdminConfig(): Promise<AdminConfigResponse> {
  return request("/api/admin/config");
}

export async function updateAdminLlmConfig(
  input: AdminLlmConfigUpdateRequest
): Promise<AdminConfigResponse> {
  return request("/api/admin/config/llm", { method: "PUT", body: input });
}

export async function testAdminLlmConfig(
  input: AdminLlmConfigUpdateRequest
): Promise<AdminLlmTestResponse> {
  return request("/api/admin/config/llm/test", { method: "POST", body: input });
}

export async function changeAdminPassword(
  input: AdminPasswordChangeRequest
): Promise<{ ok: true }> {
  return request("/api/admin/password", { method: "PUT", body: input });
}

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    ...(options.body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(options.body)
        })
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "请求失败");
  return data;
}
