import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAccount } from "./AccountContext";

export function RequireAccount() {
  const location = useLocation();
  const { status, loading, error, refresh } = useAccount();

  if (loading) return <div className="route-loading">正在读取账号...</div>;
  if (!status) {
    return (
      <div className="route-loading">
        <span>{error ?? "账号状态读取失败"}</span>
        <button className="secondary-button" type="button" onClick={() => void refresh()}>
          重试
        </button>
      </div>
    );
  }
  if (!status.authenticated) {
    return (
      <Navigate
        to="/account"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <Outlet />;
}
