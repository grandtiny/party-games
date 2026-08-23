import type {
  ManorV7Action,
  ManorV7FriendSummary,
  ManorV7SocialView,
  ManorV7View
} from "@party-games/manor-v7";
import type { ManorGuestbookView } from "@party-games/shared";
import { Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MANOR_V7_ASSET_ROOT, type ManorV7Scene } from "./V7Scenes";

export type ManorV7Window =
  | "shop"
  | "warehouse"
  | "tasks"
  | "decorate"
  | "friends"
  | "ranking"
  | "guestbook"
  | "activities";

interface ManorV7WindowPanelProps {
  type: ManorV7Window;
  scene: ManorV7Scene;
  view: ManorV7View;
  social?: ManorV7SocialView;
  guestbook?: ManorGuestbookView;
  busy: boolean;
  onClose: () => void;
  onAction: (action: ManorV7Action) => void;
  onSelectSeed: (cropId: number) => void;
  onVisit: (friend: ManorV7FriendSummary) => void;
  onGuestbookSubmit: (content: string) => void;
  onGuestbookClear: () => void;
}

export function ManorV7WindowPanel(props: ManorV7WindowPanelProps) {
  const title = windowTitle(props.type, props.scene);
  return (
    <div className="manor-v7-window-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) props.onClose();
    }}>
      <section className={`manor-v7-window manor-v7-window--${props.type}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" title="关闭" aria-label="关闭" onClick={props.onClose}><X size={18} /></button></header>
        <div className="manor-v7-window__body">
          {props.type === "shop" ? <ShopWindow {...props} /> : null}
          {props.type === "warehouse" ? <WarehouseWindow {...props} /> : null}
          {props.type === "tasks" ? <TasksWindow view={props.view} /> : null}
          {props.type === "decorate" ? <DecorationWindow {...props} /> : null}
          {props.type === "friends" ? <FriendsWindow onVisit={props.onVisit} {...(props.social ? { social: props.social } : {})} /> : null}
          {props.type === "ranking" ? <RankingWindow {...(props.social ? { social: props.social } : {})} /> : null}
          {props.type === "guestbook" ? <GuestbookWindow {...props} /> : null}
          {props.type === "activities" ? <ActivitiesWindow view={props.view} /> : null}
        </div>
      </section>
    </div>
  );
}

function ShopWindow({ scene, view, busy, onAction }: ManorV7WindowPanelProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("zh-CN");
  const crops = useMemo(() => view.catalogs.crops.filter((crop) =>
    crop.seedPrice > 0 && crop.originalLevel <= view.farmLevel && crop.name.toLocaleLowerCase("zh-CN").includes(query)
  ).slice(0, 80), [query, view.catalogs.crops, view.farmLevel]);
  const animals = useMemo(() => view.catalogs.animals.filter((animal) =>
    animal.purchasePrice > 0 && animal.originalLevel <= view.pastureLevel && animal.name.toLocaleLowerCase("zh-CN").includes(query)
  ).slice(0, 80), [query, view.catalogs.animals, view.pastureLevel]);
  const tools = useMemo(() => view.catalogs.tools.filter((tool) =>
    tool.area === scene && tool.available && tool.coinPrice > 0 && tool.name.toLocaleLowerCase("zh-CN").includes(query)
  ).slice(0, 80), [query, scene, view.catalogs.tools]);
  return (
    <>
      <SearchField value={search} onChange={setSearch} />
      {scene === "farm" ? (
        <ItemGrid>
          {crops.map((crop) => (
            <ShopItem
              key={`crop:${crop.id}`}
              image={`${MANOR_V7_ASSET_ROOT}/crops/${crop.id}/seed.png`}
              name={`${crop.name}种子`}
              detail={`等级 ${crop.originalLevel} · ${crop.harvestCycles} 季`}
              price={crop.seedPrice}
              disabled={busy || view.coins < crop.seedPrice}
              onBuy={() => onAction({ type: "buy-seed", cropId: crop.id, quantity: 1 })}
            />
          ))}
          {tools.map((tool) => (
            <ShopItem
              key={`tool:${tool.id}`}
              name={tool.name}
              detail={tool.effectSeconds > 0 ? `效果 ${formatDuration(tool.effectSeconds)}` : "农场道具"}
              price={tool.coinPrice}
              disabled={busy || view.coins < tool.coinPrice}
              onBuy={() => onAction({ type: "buy-tool", area: "farm", toolId: tool.id, quantity: 1 })}
            />
          ))}
        </ItemGrid>
      ) : (
        <>
          <div className="manor-v7-shop-grass">
            <strong>牧草</strong><span>当前 {Math.round(view.pasture.grass)} / 400</span>
            <button type="button" disabled={busy || view.coins < 600 || view.pasture.grass >= 1_000} onClick={() => onAction({ type: "buy-grass", quantity: 10 })}>添加 10 份 · 600 金币</button>
          </div>
          <ItemGrid>
            {animals.map((animal) => (
              <ShopItem
                key={`animal:${animal.id}`}
                image={`${MANOR_V7_ASSET_ROOT}/animals/${animal.id}/cub.png`}
                name={animal.name}
                detail={`${animal.house === "hutch" ? "窝" : "棚"} · 等级 ${animal.originalLevel}`}
                price={animal.purchasePrice}
                disabled={busy || view.coins < animal.purchasePrice}
                onBuy={() => onAction({ type: "buy-animal", animalId: animal.id, quantity: 1 })}
              />
            ))}
          </ItemGrid>
        </>
      )}
    </>
  );
}

function WarehouseWindow({ scene, view, busy, onAction, onSelectSeed, onClose }: ManorV7WindowPanelProps) {
  if (scene === "farm") {
    const seeds = view.farm.seedInventory.map((entry) => ({ entry, crop: view.catalogs.crops.find((crop) => crop.id === entry.sourceId) })).filter((item) => item.crop);
    const produce = view.farm.produceInventory.map((entry) => ({ entry, crop: view.catalogs.crops.find((crop) => crop.id === entry.sourceId) })).filter((item) => item.crop);
    return (
      <>
        <WindowSection title="种子包">
          <ItemGrid empty={seeds.length === 0}>
            {seeds.map(({ entry, crop }) => crop ? (
              <InventoryItem key={crop.id} image={`${MANOR_V7_ASSET_ROOT}/crops/${crop.id}/seed.png`} name={crop.name} quantity={entry.quantity} actionLabel="选择" onAction={() => { onSelectSeed(crop.id); onClose(); }} />
            ) : null)}
          </ItemGrid>
        </WindowSection>
        <WindowSection title="农产品">
          <ItemGrid empty={produce.length === 0}>
            {produce.map(({ entry, crop }) => crop ? (
              <InventoryItem key={crop.id} image={`${MANOR_V7_ASSET_ROOT}/crops/${crop.id}/mature.png`} name={crop.name} quantity={entry.quantity} actionLabel={`出售 · ${crop.salePrice}`} disabled={busy} onAction={() => onAction({ type: "sell-produce", cropId: crop.id, quantity: entry.quantity })} />
            ) : null)}
          </ItemGrid>
        </WindowSection>
      </>
    );
  }
  const products = view.pasture.productInventory.map((entry) => ({ entry, animal: view.catalogs.animals.find((animal) => animal.id === entry.sourceId) })).filter((item) => item.animal);
  return (
    <WindowSection title="牧场副产品">
      <ItemGrid empty={products.length === 0}>
        {products.map(({ entry, animal }) => animal ? (
          <InventoryItem key={animal.id} image={`${MANOR_V7_ASSET_ROOT}/animals/${animal.id}/producing-b.png`} name={animal.byproductName} quantity={entry.quantity} actionLabel={`出售 · ${animal.byproductPrice}`} disabled={busy} onAction={() => onAction({ type: "sell-animal-product", animalId: animal.id, quantity: entry.quantity })} />
        ) : null)}
      </ItemGrid>
    </WindowSection>
  );
}

function TasksWindow({ view }: { view: ManorV7View }) {
  return (
    <div className="manor-v7-task-list">
      {view.tasks.map((task) => (
        <article className={task.completed ? "is-complete" : undefined} key={task.key}>
          <span>{task.completed ? "完成" : `${task.progress}/${task.target}`}</span>
          <div><strong>{task.title}</strong><p>{task.description}</p></div>
          <b>奖励 {task.rewardCoins} 金币</b>
        </article>
      ))}
    </div>
  );
}

function DecorationWindow({ scene, view, busy, onAction }: ManorV7WindowPanelProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("zh-CN");
  const selected = scene === "farm" ? view.farm.selectedDecorationIds : view.pasture.selectedDecorationIds;
  const items = view.catalogs.decorations.filter((item) =>
    item.area === scene && item.coinPrice > 0 && item.name.toLocaleLowerCase("zh-CN").includes(query)
  ).slice(0, 100);
  return (
    <>
      <SearchField value={search} onChange={setSearch} />
      <ItemGrid>
        {items.map((item) => {
          const owned = view.ownedDecorationIds.includes(item.id);
          const equipped = selected.includes(item.id);
          const level = scene === "farm" ? view.farmLevel : view.pastureLevel;
          return (
            <ShopItem
              key={`${item.area}:${item.id}`}
              name={item.name}
              detail={`${item.setName} · 等级 ${item.originalLevel}`}
              actionLabel={equipped ? "使用中" : owned ? "使用" : "购买"}
              disabled={busy || equipped || level < item.originalLevel || !owned && view.coins < item.coinPrice}
              onBuy={() => onAction(owned
                ? { type: "equip-decoration", area: scene, decorationId: item.id }
                : { type: "buy-decoration", area: scene, decorationId: item.id })}
              {...(!owned ? { price: item.coinPrice } : {})}
            />
          );
        })}
      </ItemGrid>
    </>
  );
}

function FriendsWindow({ social, onVisit }: { social?: ManorV7SocialView; onVisit: (friend: ManorV7FriendSummary) => void }) {
  return (
    <div className="manor-v7-window-friends">
      {(social?.friends ?? []).map((friend) => (
        <button type="button" key={friend.userId} onClick={() => onVisit(friend)}>
          <span>{friend.displayName.trim().slice(0, 1)}</span>
          <strong>{friend.displayName}</strong>
          <small>农场 {friend.farmLevel} 级 · 牧场 {friend.pastureLevel} 级</small>
        </button>
      ))}
      {!social?.friends.length ? <p className="manor-v7-empty">还没有其他庄园好友</p> : null}
    </div>
  );
}

function RankingWindow({ social }: { social?: ManorV7SocialView }) {
  const [area, setArea] = useState<ManorV7Scene>("farm");
  const ranking = area === "farm" ? social?.farmRanking : social?.pastureRanking;
  return (
    <>
      <div className="manor-v7-segmented">
        <button className={area === "farm" ? "is-active" : undefined} type="button" onClick={() => setArea("farm")}>农场排行</button>
        <button className={area === "pasture" ? "is-active" : undefined} type="button" onClick={() => setArea("pasture")}>牧场排行</button>
      </div>
      <ol className="manor-v7-ranking">
        {(ranking ?? []).map((friend) => (
          <li className={friend.isCurrentUser ? "is-current" : undefined} key={friend.userId}>
            <span>{friend.displayName}</span><b>{area === "farm" ? friend.farmLevel : friend.pastureLevel} 级</b><small>{formatNumber(friend.coins)} 金币</small>
          </li>
        ))}
      </ol>
    </>
  );
}

function GuestbookWindow({ guestbook, busy, onGuestbookSubmit, onGuestbookClear }: ManorV7WindowPanelProps) {
  const [content, setContent] = useState("");
  return (
    <>
      <form className="manor-v7-guestbook-form" onSubmit={(event) => {
        event.preventDefault();
        const message = content.trim();
        if (!message) return;
        onGuestbookSubmit(message);
        setContent("");
      }}>
        <input value={content} maxLength={200} placeholder="写一条留言" onChange={(event) => setContent(event.target.value)} />
        <button type="submit" disabled={busy || !content.trim()}>留言</button>
        {guestbook?.canClear ? <button type="button" title="清空留言" aria-label="清空留言" disabled={busy || guestbook.messages.length === 0} onClick={onGuestbookClear}><Trash2 size={17} /></button> : null}
      </form>
      <div className="manor-v7-guestbook-list">
        {(guestbook?.messages ?? []).map((message) => (
          <article key={message.id}><strong>{message.senderDisplayName}</strong><time>{formatDate(message.createdAt)}</time><p>{message.content}</p></article>
        ))}
        {!guestbook?.messages.length ? <p className="manor-v7-empty">留言板还是空的</p> : null}
      </div>
    </>
  );
}

function ActivitiesWindow({ view }: { view: ManorV7View }) {
  return (
    <div className="manor-v7-activity-list">
      {view.activities.map((activity) => (
        <article key={activity.id}><time>{formatDate(activity.createdAt)}</time><span>{activity.message}</span></article>
      ))}
    </div>
  );
}

function ShopItem({ image, name, detail, price, actionLabel, disabled, onBuy }: { image?: string; name: string; detail: string; price?: number; actionLabel?: string; disabled: boolean; onBuy: () => void }) {
  return (
    <article className="manor-v7-shop-item">
      <span className="manor-v7-item-image">{image ? <img src={image} alt="" /> : <b>{name.slice(0, 1)}</b>}</span>
      <strong>{name}</strong><small>{detail}</small>
      <button type="button" disabled={disabled} onClick={onBuy}>{actionLabel ?? `${formatNumber(price ?? 0)} 金币`}</button>
    </article>
  );
}

function InventoryItem({ image, name, quantity, actionLabel, disabled = false, onAction }: { image: string; name: string; quantity: number; actionLabel: string; disabled?: boolean; onAction: () => void }) {
  return (
    <article className="manor-v7-shop-item manor-v7-inventory-item">
      <span className="manor-v7-item-image"><img src={image} alt="" /><i>{quantity}</i></span>
      <strong>{name}</strong><button type="button" disabled={disabled} onClick={onAction}>{actionLabel}</button>
    </article>
  );
}

function ItemGrid({ children, empty = false }: { children: React.ReactNode; empty?: boolean }) {
  return <div className="manor-v7-item-grid">{empty ? <p className="manor-v7-empty">仓库里暂时没有物品</p> : children}</div>;
}

function WindowSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="manor-v7-window-section"><h3>{title}</h3>{children}</section>;
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="manor-v7-search"><Search size={17} /><input value={value} placeholder="按名称查找" onChange={(event) => onChange(event.target.value)} /></label>;
}

function windowTitle(type: ManorV7Window, scene: ManorV7Scene): string {
  if (type === "shop") return scene === "farm" ? "农场商店" : "牧场商店";
  if (type === "warehouse") return scene === "farm" ? "农场仓库" : "牧场仓库";
  return { tasks: "庄园任务", decorate: "装扮庄园", friends: "好友和同学", ranking: "庄园排行榜", guestbook: "留言板", activities: "庄园动态" }[type];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours > 0 ? `${hours}小时${minutes}分` : `${Math.max(1, minutes)}分钟`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}
