import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  backTo?: string;
  actions?: ReactNode;
  variant?: "default" | "home";
}

export function AppShell({ children, title = "聚会游戏", backTo, actions, variant = "default" }: AppShellProps) {
  const shellClass = variant === "home" ? "app-shell app-shell--home" : "app-shell";
  const pageClass = variant === "home" ? "page page--home" : "page";
  return (
    <div className={shellClass}>
      <header className="topbar">
        <div className="topbar__leading">
          {backTo ? (
            <Link className="icon-button" to={backTo} aria-label="返回">
              <ArrowLeft size={20} />
            </Link>
          ) : (
            <span className="brand-mark" aria-hidden="true" />
          )}
          <span className="topbar__title">{title}</span>
        </div>
        <div className="topbar__actions">{actions}</div>
      </header>
      <main className={pageClass}>{children}</main>
    </div>
  );
}
