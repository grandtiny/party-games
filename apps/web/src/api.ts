import type {
  AccountBootstrapRequest,
  AccountInviteCreateRequest,
  AccountInviteView,
  AccountLoginRequest,
  AccountOverviewResponse,
  AccountPasswordChangeRequest,
  AccountProfileUpdateRequest,
  AccountRegisterRequest,
  AccountStatusResponse,
  AdminAuthStatusResponse,
  AdminConfigResponse,
  AdminLlmConfigUpdateRequest,
  AdminLlmModelListRequest,
  AdminLlmModelListResponse,
  AdminLlmTestResponse,
  AdminLoginRequest,
  AdminPasswordChangeRequest,
  AdminSetupRequest,
  AdminTurtleSoupPromptUpdateRequest,
  CreateRoomRequest,
  GomokuMatchDetailView,
  GomokuMatchSubmitRequest,
  GomokuMatchView,
  GomokuOverviewResponse,
  GomokuProgressSyncRequest,
  GomokuProgressView,
  GomokuSaveUpdateRequest,
  GomokuSaveView,
  JoinRoomRequest,
  ManorActionRequest,
  ManorFarmView,
  ManorFriendFarmActionRequest,
  ManorFriendFarmView,
  ManorFriendPastureActionRequest,
  ManorFriendPastureView,
  ManorGuestbookCreateRequest,
  ManorGuestbookView,
  ManorPastureActionRequest,
  ManorPastureView,
  ManorSocialOverviewView,
  PlatformStatusResponse,
  PuzzleResultSubmitRequest,
  PuzzleResultView,
  RecoverRoomRequest,
  RulesAnswerResponse,
  RulesQuestionRequest,
  RoomSessionResponse
} from "@party-games/shared";

export async function createRoom(input: CreateRoomRequest): Promise<RoomSessionResponse> {
  return request("/api/rooms", { method: "POST", body: input });
}

export async function getPlatformStatus(): Promise<PlatformStatusResponse> {
  return request("/api/platform");
}

export async function getAccountStatus(): Promise<AccountStatusResponse> {
  return request("/api/account/status");
}

export async function bootstrapAccount(
  input: AccountBootstrapRequest
): Promise<AccountStatusResponse> {
  return request("/api/account/bootstrap", { method: "POST", body: input });
}

export async function loginAccount(
  input: AccountLoginRequest
): Promise<AccountStatusResponse> {
  return request("/api/account/login", { method: "POST", body: input });
}

export async function registerAccount(
  input: AccountRegisterRequest
): Promise<AccountStatusResponse> {
  return request("/api/account/register", { method: "POST", body: input });
}

export async function logoutAccount(): Promise<{ ok: true }> {
  return request("/api/account/logout", { method: "POST" });
}

export async function updateAccountProfile(
  input: AccountProfileUpdateRequest
): Promise<AccountStatusResponse> {
  return request("/api/account/profile", { method: "PUT", body: input });
}

export async function changeAccountPassword(
  input: AccountPasswordChangeRequest
): Promise<AccountStatusResponse> {
  return request("/api/account/password", { method: "PUT", body: input });
}

export async function getAccountOverview(): Promise<AccountOverviewResponse> {
  return request("/api/account/overview");
}

export async function getManorFarm(): Promise<ManorFarmView> {
  return request("/api/manor");
}

export async function performManorAction(input: ManorActionRequest): Promise<ManorFarmView> {
  return request("/api/manor/actions", { method: "POST", body: input });
}

export async function getManorPasture(): Promise<ManorPastureView> {
  return request("/api/manor/pasture");
}

export async function performManorPastureAction(
  input: ManorPastureActionRequest
): Promise<ManorPastureView> {
  return request("/api/manor/pasture/actions", { method: "POST", body: input });
}

export async function getManorSocialOverview(): Promise<ManorSocialOverviewView> {
  return request("/api/manor/social");
}

export async function getManorFriendFarm(userId: string): Promise<ManorFriendFarmView> {
  return request(`/api/manor/friends/${encodeURIComponent(userId)}/farm`);
}

export async function performManorFriendFarmAction(
  userId: string,
  input: ManorFriendFarmActionRequest
): Promise<ManorFriendFarmView> {
  return request(`/api/manor/friends/${encodeURIComponent(userId)}/farm/actions`, {
    method: "POST",
    body: input
  });
}

export async function getManorFriendPasture(userId: string): Promise<ManorFriendPastureView> {
  return request(`/api/manor/friends/${encodeURIComponent(userId)}/pasture`);
}

export async function performManorFriendPastureAction(
  userId: string,
  input: ManorFriendPastureActionRequest
): Promise<ManorFriendPastureView> {
  return request(`/api/manor/friends/${encodeURIComponent(userId)}/pasture/actions`, {
    method: "POST",
    body: input
  });
}

export async function getManorGuestbook(userId?: string): Promise<ManorGuestbookView> {
  return request(userId
    ? `/api/manor/friends/${encodeURIComponent(userId)}/guestbook`
    : "/api/manor/guestbook");
}

export async function createManorGuestbookMessage(
  input: ManorGuestbookCreateRequest,
  userId?: string
): Promise<ManorGuestbookView> {
  return request(userId
    ? `/api/manor/friends/${encodeURIComponent(userId)}/guestbook`
    : "/api/manor/guestbook", {
    method: "POST",
    body: input
  });
}

export async function clearManorGuestbook(): Promise<ManorGuestbookView> {
  return request("/api/manor/guestbook", { method: "DELETE" });
}

export async function submitPuzzleResult(
  input: PuzzleResultSubmitRequest
): Promise<PuzzleResultView> {
  return request("/api/account/puzzle-results", { method: "POST", body: input });
}

export async function submitGomokuMatch(
  input: GomokuMatchSubmitRequest
): Promise<GomokuMatchView> {
  return request("/api/account/gomoku/matches", { method: "POST", body: input });
}

export async function getGomokuOverview(): Promise<GomokuOverviewResponse> {
  return request("/api/account/gomoku/overview");
}

export async function getGomokuMatch(matchId: string): Promise<GomokuMatchDetailView> {
  return request(`/api/account/gomoku/matches/${encodeURIComponent(matchId)}`);
}

export async function updateGomokuSave(
  input: GomokuSaveUpdateRequest
): Promise<GomokuSaveView> {
  return request("/api/account/gomoku/save", { method: "PUT", body: input });
}

export async function syncGomokuProgress(
  input: GomokuProgressSyncRequest
): Promise<GomokuProgressView[]> {
  return request("/api/account/gomoku/progress", { method: "PUT", body: input });
}

export async function getAccountInvites(): Promise<AccountInviteView[]> {
  return request("/api/account/invites");
}

export async function createAccountInvite(
  input: AccountInviteCreateRequest
): Promise<AccountInviteView> {
  return request("/api/account/invites", { method: "POST", body: input });
}

export async function revokeAccountInvite(inviteId: string): Promise<{ ok: true }> {
  return request(`/api/account/invites/${encodeURIComponent(inviteId)}`, {
    method: "DELETE"
  });
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

export async function listAdminLlmModels(
  input: AdminLlmModelListRequest
): Promise<AdminLlmModelListResponse> {
  return request("/api/admin/config/llm/models", { method: "POST", body: input });
}

export async function updateAdminTurtleSoupPrompts(
  input: AdminTurtleSoupPromptUpdateRequest
): Promise<AdminConfigResponse> {
  return request("/api/admin/config/turtle-soup-prompts", { method: "PUT", body: input });
}

export async function resetAdminTurtleSoupPrompts(): Promise<AdminConfigResponse> {
  return request("/api/admin/config/turtle-soup-prompts/reset", { method: "POST" });
}

export async function changeAdminPassword(
  input: AdminPasswordChangeRequest
): Promise<{ ok: true }> {
  return request("/api/admin/password", { method: "PUT", body: input });
}

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
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
