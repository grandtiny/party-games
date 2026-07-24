import { ArrowLeft, CircleUserRound, Dice5 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "./AccountContext";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  backTo?: string;
  actions?: ReactNode;
  hideAccountAction?: boolean;
  scope?: "platform" | "clocktower" | "poker" | "minesweeper" | "sudoku" | "turtle-soup";
}

export function AppShell({
  children,
  title = "聚会游戏",
  backTo,
  actions,
  hideAccountAction = false,
  scope = "platform"
}: AppShellProps) {
  const { status } = useAccount();
  const accountTitle = status?.authenticated
    ? `${status.user?.displayName ?? "账号"} · 个人记录`
    : status?.initialized
      ? "账号登录"
      : "创建管理员账号";
  return (
    <div className={`app-shell app-shell--${scope}`} data-scope={scope}>
      <header className="topbar">
        <div className="topbar__leading">
          {backTo ? (
            <Link className="icon-button" to={backTo} aria-label="返回">
              <ArrowLeft size={20} />
            </Link>
          ) : (
            <span className="brand-mark" aria-hidden="true">
              <Dice5 size={20} />
            </span>
          )}
          <span className="topbar__title">{title}</span>
        </div>
        <div className="topbar__actions">
          {actions}
          {!hideAccountAction ? (
            <Link
              className={`icon-button ${status?.authenticated ? "is-account-active" : ""}`}
              to="/account"
              aria-label={accountTitle}
              title={accountTitle}
            >
              <CircleUserRound size={19} />
            </Link>
          ) : null}
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
