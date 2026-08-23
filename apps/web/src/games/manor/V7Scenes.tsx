import type {
  ManorV7AnimalView,
  ManorV7FriendSummary,
  ManorV7LandView,
  ManorV7View
} from "@party-games/manor-v7";
import {
  ClipboardList,
  History,
  House,
  MessageSquareText,
  RefreshCw,
  Trophy,
  Users
} from "lucide-react";
import type { CSSProperties } from "react";

export const MANOR_V7_ASSET_ROOT = "/assets/manor/v7-runtime";

export type ManorV7Scene = "farm" | "pasture";
export type ManorV7FarmTool =
  | "select"
  | "seed"
  | "water"
  | "weed"
  | "pest"
  | "harvest"
  | "hoe"
  | "steal";
export type ManorV7PastureTool = "collect" | "sell" | "steal";

interface HudProps {
  view: ManorV7View;
  ownView: ManorV7View;
  visiting: boolean;
  scene: ManorV7Scene;
  onSceneChange: (scene: ManorV7Scene) => void;
  onReturnHome: () => void;
  onOpenShop: () => void;
  onOpenWarehouse: () => void;
  onOpenDecorate: () => void;
}

export function ManorV7Hud({
  view,
  ownView,
  visiting,
  scene,
  onSceneChange,
  onReturnHome,
  onOpenShop,
  onOpenWarehouse,
  onOpenDecorate
}: HudProps) {
  const level = scene === "farm" ? view.farmLevel : view.pastureLevel;
  const experience = scene === "farm" ? view.farmExperience : view.pastureExperience;
  const nextExperience = scene === "farm" ? view.farmNextLevelExperience : view.pastureNextLevelExperience;
  const progress = Math.min(100, Math.max(0, nextExperience > 0 ? experience / nextExperience * 100 : 100));
  return (
    <>
      <div className="manor-v7-hud-bg" aria-hidden="true" />
      <section className="manor-v7-hud" aria-label="玩家信息">
        <span className="manor-v7-avatar" aria-hidden="true">{view.owner.displayName.trim().slice(0, 1) || "庄"}</span>
        <strong>{view.owner.displayName}</strong>
        <span className="manor-v7-exp-bar"><i style={{ width: `${progress}%` }} /></span>
        <span className="manor-v7-level">{level}</span>
        <span className="manor-v7-money">金币 <b>{formatNumber(visiting ? ownView.coins : view.coins)}</b></span>
        <span className="manor-v7-reputation">经验 {formatNumber(experience)}</span>
      </section>
      {visiting ? (
        <button className="manor-v7-return" type="button" onClick={onReturnHome}>
          <House size={15} /> 返回我的庄园
        </button>
      ) : null}
      <nav className="manor-v7-main-nav" aria-label="庄园导航">
        <NavButton asset="farm" label="农场" active={scene === "farm"} onClick={() => onSceneChange("farm")} />
        <NavButton asset="pasture" label="牧场" active={scene === "pasture"} onClick={() => onSceneChange("pasture")} />
        {!visiting ? <NavButton asset="warehouse" label="仓库" onClick={onOpenWarehouse} /> : null}
        {!visiting ? <NavButton asset="shop" label="商店" onClick={onOpenShop} /> : null}
        {!visiting ? <NavButton asset="decorate" label="装扮" onClick={onOpenDecorate} /> : null}
      </nav>
    </>
  );
}

function NavButton({ asset, label, active = false, onClick }: { asset: string; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={active ? "is-active" : undefined} type="button" title={label} aria-label={label} onClick={onClick}>
      <img src={`${MANOR_V7_ASSET_ROOT}/shell/nav/${asset}.png`} alt="" />
      <span>{label}</span>
    </button>
  );
}

interface FriendPanelProps {
  friends: readonly ManorV7FriendSummary[];
  activeUserId?: string;
  loading: boolean;
  onVisit: (friend: ManorV7FriendSummary) => void;
  onRefresh: () => void;
  onOpenFriends: () => void;
  onOpenRanking: () => void;
}

export function ManorV7FriendPanel({
  friends,
  activeUserId,
  loading,
  onVisit,
  onRefresh,
  onOpenFriends,
  onOpenRanking
}: FriendPanelProps) {
  return (
    <aside className="manor-v7-friends" aria-label="好友列表">
      <div className="manor-v7-friends__actions">
        <button type="button" title="全部好友" aria-label="全部好友" onClick={onOpenFriends}><Users size={16} /></button>
        <button type="button" title="排行榜" aria-label="排行榜" onClick={onOpenRanking}><Trophy size={16} /></button>
        <button type="button" title="刷新" aria-label="刷新" disabled={loading} onClick={onRefresh}><RefreshCw size={16} /></button>
      </div>
      <div className="manor-v7-friends__list">
        {friends.slice(0, 7).map((friend, index) => (
          <button
            className={friend.userId === activeUserId ? "is-active" : undefined}
            type="button"
            key={friend.userId}
            onClick={() => onVisit(friend)}
          >
            <span className={`manor-v7-rank manor-v7-rank--${Math.min(index + 1, 4)}`}>{index + 1}</span>
            <span className="manor-v7-friend-avatar" aria-hidden="true">{friend.displayName.trim().slice(0, 1)}</span>
            <span><strong>{friend.displayName}</strong><small>农 {friend.farmLevel} · 牧 {friend.pastureLevel}</small></span>
          </button>
        ))}
        {friends.length === 0 ? <p>还没有其他庄园好友</p> : null}
      </div>
    </aside>
  );
}

export function ManorV7Shortcuts({
  onTasks,
  onGuestbook,
  onActivities
}: {
  onTasks: () => void;
  onGuestbook: () => void;
  onActivities: () => void;
}) {
  return (
    <div className="manor-v7-shortcuts" aria-label="快捷功能">
      <button type="button" title="任务" aria-label="任务" onClick={onTasks}><ClipboardList size={19} /></button>
      <button type="button" title="留言板" aria-label="留言板" onClick={onGuestbook}><MessageSquareText size={19} /></button>
      <button type="button" title="动态" aria-label="动态" onClick={onActivities}><History size={19} /></button>
    </div>
  );
}

interface FarmSceneProps {
  view: ManorV7View;
  visiting: boolean;
  tool: ManorV7FarmTool;
  selectedSeedId?: number;
  busy: boolean;
  onToolChange: (tool: ManorV7FarmTool) => void;
  onLandClick: (land: ManorV7LandView) => void;
}

export function ManorV7FarmScene({
  view,
  visiting,
  tool,
  selectedSeedId,
  busy,
  onToolChange,
  onLandClick
}: FarmSceneProps) {
  const seed = view.catalogs.crops.find((crop) => crop.id === selectedSeedId);
  const reclaimLandId = view.farm.lands.find((land) => !land.unlocked)?.id;
  return (
    <div className="manor-v7-farm-scene">
      <img className="manor-v7-farm-house" src={`${MANOR_V7_ASSET_ROOT}/scene/farm/house.png`} alt="" />
      <img className="manor-v7-farm-fence" src={`${MANOR_V7_ASSET_ROOT}/scene/farm/fence.png`} alt="" />
      <img className="manor-v7-farm-doghouse" src={`${MANOR_V7_ASSET_ROOT}/scene/farm/doghouse.png`} alt="" />
      <div className="manor-v7-farm-pool" aria-hidden="true">
        <img className="manor-v7-farm-pool__water" src={`${MANOR_V7_ASSET_ROOT}/scene/farm/pool-water.png`} alt="" />
        <img className="manor-v7-farm-pool__frame" src={`${MANOR_V7_ASSET_ROOT}/scene/farm/pool-frame.png`} alt="" />
      </div>
      <div className="manor-v7-lands">
        {view.farm.lands.map((land, index) => (
          <ManorV7Land
            land={land}
            position={landPosition(index)}
            showReclaim={!visiting && land.id === reclaimLandId}
            busy={busy}
            key={land.id}
            onClick={() => onLandClick(land)}
          />
        ))}
      </div>
      <FarmToolbar
        visiting={visiting}
        tool={tool}
        onChange={onToolChange}
        {...(seed ? { selectedSeedName: seed.name } : {})}
      />
    </div>
  );
}

function ManorV7Land({
  land,
  position,
  showReclaim,
  busy,
  onClick
}: {
  land: ManorV7LandView;
  position: { left: string; top: string; zIndex: number };
  showReclaim: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const soil = land.visualState === "locked"
    ? "locked"
    : `${land.tier}-${land.watered ? "wet" : "dry"}${land.id % 2 === 0 ? "-alt" : ""}`;
  const label = land.visualState === "locked"
    ? `第 ${land.id} 块荒地`
    : land.crop
      ? `${land.crop.name}，${landStatus(land)}`
      : `第 ${land.id} 块空地`;
  return (
    <div className={`manor-v7-land manor-v7-land--${land.visualState}`} style={position as CSSProperties}>
      <button type="button" disabled={busy} aria-label={label} title={label} onClick={onClick}>
        <img className="manor-v7-land__soil" src={`${MANOR_V7_ASSET_ROOT}/scene/land/${soil}.png`} alt="" />
      </button>
      {land.crop ? (
        <img
          className="manor-v7-land__crop"
          src={`${MANOR_V7_ASSET_ROOT}/crops/${land.crop.id}/${land.visualState}.png`}
          alt=""
        />
      ) : null}
      {land.weeds ? <img className="manor-v7-land__weed" src={`${MANOR_V7_ASSET_ROOT}/scene/land/weed.png`} alt="" /> : null}
      {land.pests ? <img className="manor-v7-land__pest" src={`${MANOR_V7_ASSET_ROOT}/scene/land/insect.png`} alt="" /> : null}
      {land.harvestable ? <img className="manor-v7-land__ready" src={`${MANOR_V7_ASSET_ROOT}/scene/land/can-pick.png`} alt="可收获" /> : null}
      {showReclaim ? <img className="manor-v7-land__reclaim" src={`${MANOR_V7_ASSET_ROOT}/scene/land/reclaim.png`} alt="" /> : null}
      <span>{land.id}</span>
    </div>
  );
}

function FarmToolbar({
  visiting,
  tool,
  selectedSeedName,
  onChange
}: {
  visiting: boolean;
  tool: ManorV7FarmTool;
  selectedSeedName?: string;
  onChange: (tool: ManorV7FarmTool) => void;
}) {
  const tools: Array<{ id: ManorV7FarmTool; label: string; asset: string }> = visiting
    ? [
        { id: "select", label: "查看", asset: "arrow" },
        { id: "water", label: "浇水", asset: "water" },
        { id: "weed", label: "除草", asset: "weed" },
        { id: "pest", label: "除虫", asset: "pesticide" },
        { id: "steal", label: "摘取", asset: "steal" }
      ]
    : [
        { id: "select", label: "查看", asset: "arrow" },
        { id: "seed", label: "播种", asset: "pack" },
        { id: "water", label: "浇水", asset: "water" },
        { id: "weed", label: "除草", asset: "weed" },
        { id: "pest", label: "除虫", asset: "pesticide" },
        { id: "harvest", label: "收获", asset: "hand" },
        { id: "hoe", label: "翻地", asset: "hoe" }
      ];
  return (
    <div className="manor-v7-farm-toolbar" aria-label="农场工具">
      {tools.map((item) => (
        <button className={tool === item.id ? "is-active" : undefined} type="button" title={item.label} aria-label={item.label} key={item.id} onClick={() => onChange(item.id)}>
          <img src={`${MANOR_V7_ASSET_ROOT}/shell/farm-tools/${item.asset}.png`} alt="" />
        </button>
      ))}
      {tool === "seed" ? <small>{selectedSeedName ?? "选择种子"}</small> : null}
    </div>
  );
}

interface PastureSceneProps {
  view: ManorV7View;
  visiting: boolean;
  tool: ManorV7PastureTool;
  busy: boolean;
  onToolChange: (tool: ManorV7PastureTool) => void;
  onAnimalClick: (animal: ManorV7AnimalView) => void;
  onCollectManure: () => void;
  onUpgradeHouse: (house: "hutch" | "shed") => void;
}

export function ManorV7PastureScene({
  view,
  visiting,
  tool,
  busy,
  onToolChange,
  onAnimalClick,
  onCollectManure,
  onUpgradeHouse
}: PastureSceneProps) {
  return (
    <div className="manor-v7-pasture-scene">
      <div className="manor-v7-pasture-horizon" />
      <div className="manor-v7-pasture-ground" />
      <img className="manor-v7-pasture-fence" src={`${MANOR_V7_ASSET_ROOT}/scene/pasture/default/fence.png`} alt="" />
      <img className="manor-v7-pasture-plant manor-v7-pasture-plant--1" src={`${MANOR_V7_ASSET_ROOT}/scene/pasture/default/plant-1.png`} alt="" />
      <img className="manor-v7-pasture-plant manor-v7-pasture-plant--2" src={`${MANOR_V7_ASSET_ROOT}/scene/pasture/default/plant-5.png`} alt="" />
      <HouseBuilding type="hutch" level={view.pasture.hutchLevel} visiting={visiting} onUpgrade={onUpgradeHouse} />
      <HouseBuilding type="shed" level={view.pasture.shedLevel} visiting={visiting} onUpgrade={onUpgradeHouse} />
      <div className="manor-v7-animals">
        {view.pasture.animals.map((animal, index) => (
          <button
            className={`manor-v7-animal manor-v7-animal--${animal.visualState}`}
            type="button"
            disabled={busy}
            style={animalPosition(index)}
            title={`${animal.animal.name} · ${animalStatus(animal)}`}
            aria-label={`${animal.animal.name}，${animalStatus(animal)}`}
            key={animal.serial}
            onClick={() => onAnimalClick(animal)}
          >
            <img src={animalImage(animal)} alt="" />
            {animal.collectable ? <span>可收取</span> : null}
          </button>
        ))}
      </div>
      {view.pasture.manure > 0 ? (
        <button className="manor-v7-manure" type="button" disabled={visiting || busy} title="清理便便" onClick={onCollectManure}>
          <img src={`${MANOR_V7_ASSET_ROOT}/shell/pasture-tools/poop.png`} alt="" />
          <span>{view.pasture.manure}</span>
        </button>
      ) : null}
      <PastureToolbar visiting={visiting} tool={tool} grass={view.pasture.grass} onChange={onToolChange} />
    </div>
  );
}

function HouseBuilding({ type, level, visiting, onUpgrade }: { type: "hutch" | "shed"; level: number; visiting: boolean; onUpgrade: (house: "hutch" | "shed") => void }) {
  const name = type === "hutch" ? "窝" : "棚";
  return (
    <button className={`manor-v7-house manor-v7-house--${type}`} type="button" disabled={visiting} title={`${name} ${level} 级`} onClick={() => onUpgrade(type)}>
      {level > 0 ? <img src={`${MANOR_V7_ASSET_ROOT}/scene/pasture/${type}/${level}.png`} alt="" /> : <span>建造{name}</span>}
      <b>{name} Lv.{level}</b>
    </button>
  );
}

function PastureToolbar({ visiting, tool, grass, onChange }: { visiting: boolean; tool: ManorV7PastureTool; grass: number; onChange: (tool: ManorV7PastureTool) => void }) {
  const tools: Array<{ id: ManorV7PastureTool; label: string; asset: string }> = visiting
    ? [{ id: "steal", label: "拿取副产品", asset: "steal" }]
    : [
        { id: "collect", label: "收取副产品", asset: "hand" },
        { id: "sell", label: "出售动物", asset: "produce" }
      ];
  return (
    <div className="manor-v7-pasture-toolbar" aria-label="牧场工具">
      <div className="manor-v7-feed"><img src={`${MANOR_V7_ASSET_ROOT}/shell/pasture-tools/feed-1.png`} alt="" /><b>{Math.round(grass)} / 400</b></div>
      {tools.map((item) => (
        <button className={tool === item.id ? "is-active" : undefined} type="button" title={item.label} aria-label={item.label} key={item.id} onClick={() => onChange(item.id)}>
          <img src={`${MANOR_V7_ASSET_ROOT}/shell/pasture-tools/${item.asset}.png`} alt="" />
        </button>
      ))}
    </div>
  );
}

function landPosition(index: number): { left: string; top: string; zIndex: number } {
  // QQ Farm V7 lays out 6x3 plots first, then appends six plots along the lower-left edge.
  const landWidth = 204 * 0.75;
  const landHeight = 102 * 0.75;
  const halfWidth = landWidth / 2;
  const halfHeight = landHeight / 2;
  let x: number;
  let y: number;
  if (index < 18) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    x = 46 + 3 * halfWidth + row * halfWidth - column * halfWidth;
    y = 320 - halfHeight + row * halfHeight + column * halfHeight;
  } else {
    const row = index - 18;
    x = 46 + row * halfWidth;
    y = 320 + landHeight + row * halfHeight;
  }
  return { left: `${x / 10.24}%`, top: `${y / 8}%`, zIndex: 100 + y };
}

function animalPosition(index: number): CSSProperties {
  const row = Math.floor(index / 5);
  const column = index % 5;
  return {
    left: `${(300 + column * 90 + row % 2 * 28) / 10.24}%`,
    top: `${(300 + row * 82) / 8}%`,
    zIndex: 150 + row
  };
}

function animalImage(animal: ManorV7AnimalView): string {
  const state = animal.visualState === "cub"
    ? "cub"
    : animal.visualState === "young"
      ? "growing"
      : animal.visualState === "production-action"
        ? "producing-a"
        : animal.visualState === "production-cooldown"
          ? "producing-b"
          : animal.visualState === "harvestable"
            ? "retired"
            : "mature";
  return `${MANOR_V7_ASSET_ROOT}/animals/${animal.animal.id}/${state}.png`;
}

function landStatus(land: ManorV7LandView): string {
  if (land.visualState === "withered") return "已枯萎";
  if (land.harvestable) return "可以收获";
  if (land.weeds) return "有杂草";
  if (land.pests) return "有害虫";
  return land.remainingSeconds > 0 ? `剩余 ${formatDuration(land.remainingSeconds)}` : "生长中";
}

function animalStatus(animal: ManorV7AnimalView): string {
  if (animal.collectable) return `${animal.animal.byproductName}可收取`;
  if (animal.hungry) return "缺少牧草";
  if (animal.visualState === "production-ready") return "可以送去生产";
  if (animal.visualState === "harvestable") return "可以收获";
  if (animal.visualState === "production-action") return `生产剩余 ${formatDuration(animal.remainingSeconds)}`;
  if (animal.visualState === "production-cooldown") return `冷却剩余 ${formatDuration(animal.remainingSeconds)}`;
  return `成长剩余 ${formatDuration(animal.remainingSeconds)}`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${Math.max(1, minutes)}分钟`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}
