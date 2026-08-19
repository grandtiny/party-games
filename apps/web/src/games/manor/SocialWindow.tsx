import type {
  ManorFriendSummaryView,
  ManorSocialOverviewView,
  ManorTaskProgressView
} from "@party-games/shared";
import { Home, ListChecks, RefreshCw, Trophy, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getManorSocialOverview } from "../../api";

export interface ManorVisitTarget {
  userId: string;
  displayName: string;
}

export function ManorSocialWindow({
  open,
  onClose,
  onVisit
}: {
  open: boolean;
  onClose: () => void;
  onVisit: (friend: ManorVisitTarget, mode: "farm" | "pasture") => void;
}) {
  const [overview, setOverview] = useState<ManorSocialOverviewView>();
  const [tab, setTab] = useState<"friends" | "farm" | "pasture">("friends");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setOverview(await getManorSocialOverview());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "好友列表读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!open) return null;
  const items = tab === "friends"
    ? overview?.friends ?? []
    : tab === "farm"
      ? overview?.farmRanking ?? []
      : overview?.pastureRanking ?? [];
  return (
    <div className="manor-social-layer" role="presentation" onMouseDown={onClose}>
      <section className="manor-social-window" role="dialog" aria-modal="true" aria-label="庄园好友" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <strong><UsersRound size={18} />庄园好友</strong>
          <button type="button" aria-label="刷新好友" title="刷新好友" disabled={loading} onClick={() => void refresh()}><RefreshCw size={17} /></button>
          <button type="button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="manor-social-tabs" role="tablist">
          <button className={tab === "friends" ? "is-active" : ""} type="button" onClick={() => setTab("friends")}><UsersRound size={15} />好友</button>
          <button className={tab === "farm" ? "is-active" : ""} type="button" onClick={() => setTab("farm")}><Trophy size={15} />农场排行</button>
          <button className={tab === "pasture" ? "is-active" : ""} type="button" onClick={() => setTab("pasture")}><Trophy size={15} />牧场排行</button>
        </div>
        {error ? <div className="manor-social-empty">{error}</div> : null}
        {!error && loading && !overview ? <div className="manor-social-empty">正在读取...</div> : null}
        {!error && !loading && items.length === 0 ? <div className="manor-social-empty">暂无其他平台账号</div> : null}
        <div className="manor-social-list">
          {items.map((friend, index) => (
            <FriendRow
              friend={friend}
              key={friend.userId}
              onVisit={onVisit}
              {...(tab === "friends" ? {} : { rank: index + 1 })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function FriendRow({
  friend,
  rank,
  onVisit
}: {
  friend: ManorFriendSummaryView;
  rank?: number;
  onVisit: (friend: ManorVisitTarget, mode: "farm" | "pasture") => void;
}) {
  const target = { userId: friend.userId, displayName: friend.displayName };
  return (
    <div className={friend.isCurrentUser ? "is-current" : ""}>
      <b>{rank ? `#${rank}` : friend.displayName.slice(0, 1) || "友"}</b>
      <span>
        <strong>{friend.displayName}{friend.isCurrentUser ? "（我）" : ""}</strong>
        <small>农场 Lv.{friend.farmLevel} · 牧场 Lv.{friend.pastureLevel}</small>
      </span>
      {!friend.isCurrentUser ? (
        <span className="manor-social-list__actions">
          <button type="button" onClick={() => onVisit(target, "farm")}>农场</button>
          <button type="button" onClick={() => onVisit(target, "pasture")}>牧场</button>
        </span>
      ) : null}
    </div>
  );
}

export function ManorTaskWindow({ tasks, onClose }: { tasks: ManorTaskProgressView; onClose: () => void }) {
  return (
    <div className="manor-social-layer" role="presentation" onMouseDown={onClose}>
      <section className="manor-task-window" role="dialog" aria-modal="true" aria-label="新手任务" onMouseDown={(event) => event.stopPropagation()}>
        <header><strong><ListChecks size={18} />新手任务</strong><button type="button" aria-label="关闭" onClick={onClose}><X size={18} /></button></header>
        {tasks.current ? (
          <div className="manor-task-current">
            <b>{tasks.current.id + 1}</b>
            <span><strong>{tasks.current.name}</strong><small>{tasks.current.description}</small></span>
            <em>100 经验{tasks.current.rewardCoins ? ` · ${tasks.current.rewardCoins} 金币` : ""}</em>
          </div>
        ) : (
          <div className="manor-social-empty"><ListChecks size={26} />全部新手任务已完成</div>
        )}
        <footer>进度 {tasks.completedCount} / {tasks.total}</footer>
      </section>
    </div>
  );
}

export function ManorVisitBanner({ target, onHome }: { target: ManorVisitTarget; onHome: () => void }) {
  return <div className="manor-visit-banner"><span>正在访问 <strong>{target.displayName}</strong></span><button type="button" onClick={onHome}><Home size={15} />我的庄园</button></div>;
}
