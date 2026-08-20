import type { ManorActivityView } from "@party-games/shared";
import { History, X } from "lucide-react";

export function ManorActivityWindow({
  activities,
  onClose
}: {
  activities: ManorActivityView[];
  onClose: () => void;
}) {
  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="manor-activity-window"
        role="dialog"
        aria-modal="true"
        aria-label="庄园动态"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <History size={20} aria-hidden="true" />
          <strong>庄园动态</strong>
          <button type="button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {activities.length === 0 ? (
          <div className="manor-activity-window__empty">暂无好友互动记录</div>
        ) : (
          <ol className="manor-activity-list">
            {activities.map((activity) => (
              <li key={activity.id}>
                <span className={`manor-activity-list__kind manor-activity-list__kind--${activity.kind}`} aria-hidden="true" />
                <span>
                  <strong>{activity.actorName}</strong>
                  <small>{activity.message}</small>
                </span>
                <time dateTime={new Date(activity.createdAt).toISOString()}>
                  {formatActivityTime(activity.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function formatActivityTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(timestamp);
}
