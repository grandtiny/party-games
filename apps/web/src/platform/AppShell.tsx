import { ArrowLeft, Dice5 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  backTo?: string;
  actions?: ReactNode;
  scope?: "platform" | "clocktower";
}

export function AppShell({
  children,
  title = "聚会游戏",
  backTo,
  actions,
  scope = "platform"
}: AppShellProps) {
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
        <div className="topbar__actions">{actions}</div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
