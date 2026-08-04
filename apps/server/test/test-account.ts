import type { AccountUserView } from "@party-games/shared";

export function testAccount(name: string): AccountUserView {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
  return {
    id: `test-account:${name}`,
    username: `test-${key}`,
    displayName: name,
    role: "member",
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}
