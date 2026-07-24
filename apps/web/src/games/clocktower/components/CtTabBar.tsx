import type { CtTabDef, CtTabId } from "../tabs";

interface CtTabBarProps {
  tabs: CtTabDef[];
  activeTab: CtTabId;
  onSelect: (tabId: CtTabId) => void;
  unread?: Partial<Record<CtTabId, boolean>>;
}

export function CtTabBar({ tabs, activeTab, onSelect, unread = {} }: CtTabBarProps) {
  return (
    <nav className="ct-tabbar" role="tablist" aria-label="游戏操作区">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        const hasUnread = unread[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ct-tabbar__btn${isActive ? " is-active" : ""}`}
            onClick={() => onSelect(tab.id)}
          >
            <span className="ct-tabbar__icon">
              <Icon size={20} />
              {hasUnread ? <span className="ct-tabbar__dot" aria-hidden="true" /> : null}
            </span>
            <span className="ct-tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
