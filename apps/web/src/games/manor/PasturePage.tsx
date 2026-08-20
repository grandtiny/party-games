import type {
  ManorAnimalCatalogView,
  ManorAnimalHouse,
  ManorAnimalView,
  ManorPastureActionRequest,
  ManorPastureView
} from "@party-games/shared";
import { ArrowDown, ArrowUp, Carrot, History, Home, PackageOpen, RefreshCw, Search, ShoppingBasket, UsersRound, Wheat } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  getManorFriendPasture,
  getManorPasture,
  performManorFriendPastureAction,
  performManorPastureAction
} from "../../api";
import { AppShell } from "../../platform/AppShell";
import { ManorActivityWindow } from "./ActivityWindow";
import { ManorVisitBanner, type ManorVisitTarget } from "./SocialWindow";

const PASTURE_ASSET_ROOT = "/assets/manor/classic/pasture";

type PastureWindow = "shop" | "warehouse" | "feed" | "houses" | "queue" | "activities";

export function ManorPasturePage({
  visit,
  socialWindow,
  onOpenSocial,
  onReturnHome,
  onSwitchFarm
}: {
  visit: ManorVisitTarget | undefined;
  socialWindow: ReactNode;
  onOpenSocial: () => void;
  onReturnHome: () => void;
  onSwitchFarm: () => void;
}) {
  const [pasture, setPasture] = useState<ManorPastureView>();
  const [activeWindow, setActiveWindow] = useState<PastureWindow>();
  const [selectedAnimalSerial, setSelectedAnimalSerial] = useState<number>();
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [clock, setClock] = useState(Date.now());
  const [busyKey, setBusyKey] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const acceptPasture = useCallback((next: ManorPastureView) => {
    setPasture(next);
    setLoadedAt(Date.now());
    setError(undefined);
    setSelectedAnimalSerial((current) =>
      current && next.animals.some((animal) => animal.serial === current) ? current : undefined
    );
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setBusyKey("refresh");
    try {
      acceptPasture(
        visit
          ? (await getManorFriendPasture(visit.userId)).pasture
          : await getManorPasture()
      );
    } catch (requestError) {
      if (!silent) {
        setError(requestError instanceof Error ? requestError.message : "牧场读取失败");
      }
    } finally {
      if (!silent) setBusyKey(undefined);
    }
  }, [acceptPasture, visit]);

  useEffect(() => {
    void refresh();
    const polling = window.setInterval(() => void refresh(true), 10_000);
    return () => window.clearInterval(polling);
  }, [refresh]);

  useEffect(() => {
    const ticking = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(ticking);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 2_800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const act = useCallback(async (
    action: ManorPastureActionRequest,
    key: string,
    success: string
  ) => {
    if (busyKey) return false;
    setBusyKey(key);
    setError(undefined);
    try {
      const next = await performManorPastureAction(action);
      acceptPasture(next);
      setNotice(success);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "操作失败");
      return false;
    } finally {
      setBusyKey(undefined);
    }
  }, [acceptPasture, busyKey]);

  const actForFriend = useCallback(async (
    action: Parameters<typeof performManorFriendPastureAction>[1],
    key: string
  ) => {
    if (busyKey || !visit) return false;
    setBusyKey(key);
    setError(undefined);
    try {
      const result = await performManorFriendPastureAction(visit.userId, action);
      acceptPasture(result.pasture);
      setNotice(result.message ?? "好友互动完成");
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "好友互动失败");
      return false;
    } finally {
      setBusyKey(undefined);
    }
  }, [acceptPasture, busyKey, visit]);

  useEffect(() => {
    setActiveWindow(undefined);
    setSelectedAnimalSerial(undefined);
  }, [visit?.userId]);

  if (!pasture) {
    return (
      <AppShell scope="manor" title="怀旧庄园" backTo="/">
        <div className="manor-loading">
          <Wheat size={30} />
          <span>{error ?? "正在读取牧场..."}</span>
          {error ? (
            <button className="secondary-button" type="button" onClick={() => void refresh()}>
              <RefreshCw size={17} />
              重试
            </button>
          ) : null}
        </div>
      </AppShell>
    );
  }

  const serverNow = pasture.serverTime + (clock - loadedAt);
  const levelProgress = progressBetween(
    pasture.profile.experience,
    pasture.profile.currentLevelExperience,
    pasture.profile.nextLevelExperience
  );
  const selectedAnimal = pasture.animals.find(
    (animal) => animal.serial === selectedAnimalSerial
  );

  const selectAnimal = (animal: ManorAnimalView) => {
    setSelectedAnimalSerial(animal.serial);
    playAnimalSound(animal.audioUrls);
  };

  const performPrimaryAnimalAction = (animal: ManorAnimalView) => {
    if (visit) {
      if (animal.pendingProduct > animal.minimumProduct) {
        void actForFriend(
          { type: "steal-product", animalSerial: animal.serial },
          `friend-steal-product:${animal.serial}`
        );
        return;
      }
      if (animal.canStartProduction) {
        void actForFriend(
          { type: "help-production", animalSerial: animal.serial },
          `friend-help-production:${animal.serial}`
        ).then((succeeded) => {
          if (succeeded) playAnimalSound(animal.audioUrls);
        });
        return;
      }
      setNotice(
        animal.pendingProduct > 0
          ? "副产品已经达到最低保留数量"
          : animalStatusText(animal, serverNow)
      );
      return;
    }
    if (animal.canHarvestProduct) {
      void act(
        { type: "harvest-animal-product", animalSerial: animal.serial },
        `harvest-product:${animal.serial}`,
        `${animal.byproductName}已收入仓库`
      );
      return;
    }
    if (animal.canHarvestAnimal) {
      void act(
        { type: "harvest-animal", animalSerial: animal.serial },
        `harvest-animal:${animal.serial}`,
        `${animal.name}已收入仓库`
      );
      return;
    }
    if (animal.canStartProduction) {
      void act(
        { type: "start-animal-production", animalSerial: animal.serial },
        `produce:${animal.serial}`,
        `${animal.name}开始${animal.productionAction}`
      ).then((succeeded) => {
        if (succeeded) playAnimalSound(animal.audioUrls);
      });
      return;
    }
    setNotice(animalStatusText(animal, serverNow));
  };

  return (
    <AppShell
      scope="manor"
      title="怀旧庄园"
      backTo="/"
      actions={
        <>
          <button className="icon-button" type="button" aria-label="好友与排行" title="好友与排行" onClick={onOpenSocial}>
            <UsersRound size={18} />
          </button>
          <button className="icon-button" type="button" aria-label="庄园动态" title="庄园动态" onClick={() => setActiveWindow("activities")}>
            <History size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="刷新牧场"
            title="刷新牧场"
            disabled={busyKey === "refresh"}
            onClick={() => void refresh()}
          >
            <RefreshCw size={18} />
          </button>
        </>
      }
    >
      <div className="manor-page">
        {socialWindow}
        <div className="manor-stage-viewport">
          <div className="manor-stage-shell manor-stage-shell--pasture">
            <section className="manor-stage manor-stage--pasture" aria-label="QQ 牧场经典场景">
              <div className="pasture-head-bg" aria-hidden="true" />
              <PastureHud pasture={pasture} levelProgress={levelProgress} />
              {visit ? <ManorVisitBanner target={visit} onHome={onReturnHome} /> : null}
              <img className="manor-weather" src={pasture.weather.assetUrl} alt={pasture.weather.label} title={pasture.weather.label} />
              {pasture.weather.id === "rainy" ? <div className="manor-rain" aria-hidden="true" /> : null}

              <nav className="pasture-head-tools" aria-label="庄园功能">
                <PastureImageButton asset="nav-farm" label="我的农场" onClick={onSwitchFarm} />
                <PastureImageButton asset="nav-pasture" label="我的牧场" active={!visit} {...(visit ? { onClick: onReturnHome } : {})} />
                {!visit ? (
                  <>
                    <PastureImageButton asset="nav-warehouse" label="牧场仓库" onClick={() => setActiveWindow("warehouse")} />
                    <PastureImageButton asset="nav-shop" label="牧场商店" onClick={() => setActiveWindow("shop")} />
                  </>
                ) : null}
              </nav>

              <PastureBuilding
                house="hutch"
                status={pasture.houses.hutch}
                onOpen={() => visit ? setNotice("好友的动物窝") : setActiveWindow("houses")}
              />
              {pasture.houses.shed.level > 0 ? (
                <PastureBuilding
                  house="shed"
                  status={pasture.houses.shed}
                  onOpen={() => visit ? setNotice("好友的动物棚") : setActiveWindow("houses")}
                />
              ) : null}

              <div className="pasture-house-strip">
                <HouseStatus
                  label="窝"
                  status={pasture.houses.hutch}
                  onOpen={() => visit ? setNotice("好友的动物窝") : setActiveWindow("houses")}
                />
                <HouseStatus
                  label="棚"
                  status={pasture.houses.shed}
                  onOpen={() => visit ? setNotice("好友的动物棚") : setActiveWindow("houses")}
                />
              </div>

              {pasture.animals.map((animal, index) => (
                <PastureAnimal
                  animal={animal}
                  busy={Boolean(busyKey)}
                  key={animal.serial}
                  now={serverNow}
                  position={pastureAnimalPosition(index)}
                  selected={selectedAnimalSerial === animal.serial}
                  onSelect={() => selectAnimal(animal)}
                />
              ))}

              {Array.from({ length: pasture.mosquitoCount }, (_, index) => (
                <button
                  className="pasture-mosquito"
                  type="button"
                  aria-label="拍掉蚊子"
                  title="拍掉蚊子"
                  disabled={Boolean(busyKey)}
                  key={`mosquito:${index}`}
                  style={pastureMosquitoPosition(index)}
                  onClick={() => visit
                    ? void actForFriend({ type: "clean-mosquito" }, `friend-clean-mosquito:${index}`)
                    : void act({ type: "clean-mosquito" }, `clean-mosquito:${index}`, "拍掉 1 只蚊子，获得 3 点牧场经验")}
                >
                  <img src="/assets/manor/classic/legacy/mosquito.png" alt="" />
                </button>
              ))}

              {Array.from({ length: Math.min(pasture.poopCount, 8) }, (_, index) => (
                <button
                  className="pasture-poop"
                  type="button"
                  aria-label="清扫便便"
                  title="清扫便便"
                  disabled={Boolean(busyKey)}
                  key={`poop:${index}`}
                  style={pasturePoopPosition(index)}
                  onClick={() => visit
                    ? void actForFriend({ type: "clean-poop" }, `friend-clean-poop:${index}`)
                    : void act({ type: "clean-poop" }, `clean-poop:${index}`, "清扫完成，便便已收入牧场仓库")}
                >
                  <img src="/assets/manor/classic/legacy/manure.png" alt="" />
                  {index === 7 && pasture.poopCount > 8 ? <b>+{pasture.poopCount - 8}</b> : null}
                </button>
              ))}

              <button
                className="pasture-trough"
                type="button"
                aria-label={`饲料机，剩余 ${formatGrass(pasture.grass)} 份牧草`}
                title="添加牧草"
                onClick={() => setActiveWindow("feed")}
              >
                <img src={`${PASTURE_ASSET_ROOT}/ui/trough.png`} alt="" />
                <span>{formatGrass(pasture.grass)} / {pasture.grassCapacity}</span>
              </button>

              {error ? <div className="manor-message manor-message--error">{error}</div> : null}
              {!error && notice ? <div className="manor-message">{notice}</div> : null}

              <div className="pasture-toolbar" role="toolbar" aria-label="牧场工具">
                <PastureImageButton
                  asset="tool-hand"
                  label="查看动物"
                  active={Boolean(selectedAnimal)}
                  onClick={() => setNotice(selectedAnimal ? animalStatusText(selectedAnimal, serverNow) : "请先选择一只动物")}
                />
                {!visit ? <PastureImageButton asset="tool-animal" label="购买动物" onClick={() => setActiveWindow("shop")} /> : null}
                <PastureImageButton
                  asset="tool-produce"
                  label={visit ? "帮产或偷取" : "执行动物操作"}
                  onClick={() => selectedAnimal ? performPrimaryAnimalAction(selectedAnimal) : setNotice("请先选择一只动物")}
                />
                <PastureImageButton
                  asset="trough-buy"
                  label="购买牧草"
                  onClick={() => setActiveWindow("feed")}
                />
                <PastureImageButton
                  asset="tool-fly"
                  label={visit ? `放蚊子（今日剩余 ${pasture.mosquitoCount < 8 ? "可放" : "已满"}）` : "拍蚊子"}
                  onClick={() => visit
                    ? void actForFriend({ type: "release-mosquito", quantity: 1 }, "friend-release-mosquito")
                    : pasture.mosquitoCount > 0
                      ? void act({ type: "clean-mosquito" }, "clean-mosquito", "拍掉 1 只蚊子，获得 3 点牧场经验")
                      : setNotice("牧场当前没有蚊子")}
                />
                <PastureImageButton
                  asset="tool-poop"
                  label="清扫便便"
                  onClick={() => pasture.poopCount > 0
                    ? visit
                      ? void actForFriend({ type: "clean-poop" }, "friend-clean-poop")
                      : void act({ type: "clean-poop" }, "clean-poop", "清扫完成，便便已收入牧场仓库")
                    : setNotice("牧场当前没有便便")}
                />
                {!visit ? (
                  <PastureImageButton asset="tool-whistle" label="动物展示队列" onClick={() => setActiveWindow("queue")} />
                ) : null}
              </div>

              {selectedAnimal ? (
                <AnimalActionStrip
                  animal={selectedAnimal}
                  busy={Boolean(busyKey)}
                  friendMode={Boolean(visit)}
                  now={serverNow}
                  onAction={() => performPrimaryAnimalAction(selectedAnimal)}
                  carrotCount={pasture.carrotCount}
                  specialFeedRemaining={pasture.specialFeedRemaining}
                  onFeedCarrot={() => visit
                    ? void actForFriend(
                        { type: "feed-carrot", animalSerial: selectedAnimal.serial },
                        `friend-feed-carrot:${selectedAnimal.serial}`
                      )
                    : void act(
                        { type: "feed-animal-carrot", animalSerial: selectedAnimal.serial },
                        `feed-carrot:${selectedAnimal.serial}`,
                        `给${selectedAnimal.name}喂了胡萝卜，成长时间缩短 5 分钟`
                      )}
                />
              ) : null}

              {!visit && activeWindow === "shop" ? (
                <PastureShopWindow
                  busy={Boolean(busyKey)}
                  pasture={pasture}
                  onBuy={(animal) =>
                    void act(
                      { type: "buy-animal", animalId: animal.sourceId, quantity: 1 },
                      `buy-animal:${animal.sourceId}`,
                      `购买了 1 ${animal.animalUnit}${animal.name}`
                    )
                  }
                  onClose={() => setActiveWindow(undefined)}
                />
              ) : null}

              {!visit && activeWindow === "warehouse" ? (
                <PastureWarehouseWindow
                  busy={Boolean(busyKey)}
                  pasture={pasture}
                  onClose={() => setActiveWindow(undefined)}
                  onSell={(animalId, itemType, quantity, name) =>
                    void act(
                      { type: "sell-pasture-item", animalId, itemType, quantity },
                      `sell:${itemType}:${animalId}`,
                      `${name}已全部出售`
                    )
                  }
                />
              ) : null}

              {activeWindow === "feed" ? (
                <PastureFeedWindow
                  busy={Boolean(busyKey)}
                  friendMode={Boolean(visit)}
                  pasture={pasture}
                  onClose={() => setActiveWindow(undefined)}
                  onBuy={(quantity) => visit
                    ? void actForFriend({ type: "feed-grass", quantity }, "friend-feed-grass")
                    : void act(
                        { type: "buy-grass", quantity },
                        "buy-grass",
                        `已向饲料机添加 ${quantity} 份牧草`
                      )}
                />
              ) : null}

              {!visit && activeWindow === "houses" ? (
                <PastureHouseWindow
                  busy={Boolean(busyKey)}
                  pasture={pasture}
                  onClose={() => setActiveWindow(undefined)}
                  onUpgrade={(house) =>
                    void act(
                      { type: "upgrade-animal-house", house },
                      `upgrade:${house}`,
                      `${house === "hutch" ? "动物窝" : "动物棚"}升级完成`
                    )
                  }
                />
              ) : null}

              {!visit && activeWindow === "queue" ? (
                <PastureQueueWindow
                  animals={pasture.animals}
                  busy={Boolean(busyKey)}
                  onClose={() => setActiveWindow(undefined)}
                  onSave={(animalSerials) => void act(
                    { type: "set-animal-order", animalSerials },
                    "set-animal-order",
                    "动物展示队列已保存"
                  ).then((succeeded) => {
                    if (succeeded) setActiveWindow(undefined);
                  })}
                />
              ) : null}

              {activeWindow === "activities" ? (
                <ManorActivityWindow activities={pasture.activities} onClose={() => setActiveWindow(undefined)} />
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PastureHud({
  pasture,
  levelProgress
}: {
  pasture: ManorPastureView;
  levelProgress: number;
}) {
  const initial = pasture.profile.displayName.trim().slice(0, 1) || "牧";
  return (
    <div className="pasture-player-hud">
      <span className="pasture-player-hud__avatar" aria-hidden="true">{initial}</span>
      <strong className="pasture-player-hud__name">{pasture.profile.displayName}</strong>
      <span className="pasture-player-hud__experience">
        <i style={{ width: `${levelProgress * 100}%` }} />
      </span>
      <span className="pasture-player-hud__level" title={`牧场等级 ${pasture.profile.level}`}>
        {pasture.profile.level}
      </span>
      <span className="pasture-player-hud__coins">金币 {pasture.profile.coins}</span>
      <span className="pasture-player-hud__exp">经验 {pasture.profile.experience}</span>
    </div>
  );
}

function PastureImageButton({
  asset,
  label,
  active = false,
  onClick
}: {
  asset: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`pasture-image-button pasture-image-button--${asset} ${active ? "is-active" : ""}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <img src={`${PASTURE_ASSET_ROOT}/ui/${asset}.png`} alt="" />
    </button>
  );
}

function HouseStatus({
  label,
  status,
  onOpen
}: {
  label: string;
  status: ManorPastureView["houses"][ManorAnimalHouse];
  onOpen: () => void;
}) {
  return (
    <button type="button" title={`管理动物${label}`} onClick={onOpen}>
      <Home size={14} />
      <strong>{label} Lv.{status.level}</strong>
      <span>{status.occupied}/{status.capacity}</span>
    </button>
  );
}

function PastureBuilding({
  house,
  status,
  onOpen
}: {
  house: ManorAnimalHouse;
  status: ManorPastureView["houses"][ManorAnimalHouse];
  onOpen: () => void;
}) {
  return (
    <button
      className={`pasture-building pasture-building--${house}`}
      type="button"
      title={`管理${house === "hutch" ? "动物窝" : "动物棚"}`}
      aria-label={`${house === "hutch" ? "动物窝" : "动物棚"} ${status.level} 级，容量 ${status.occupied}/${status.capacity}`}
      onClick={onOpen}
    >
      <img src={status.assetUrl} alt="" />
      <span>{house === "hutch" ? "窝" : "棚"} Lv.{status.level} · {status.occupied}/{status.capacity}</span>
    </button>
  );
}

function PastureAnimal({
  animal,
  busy,
  now,
  position,
  selected,
  onSelect
}: {
  animal: ManorAnimalView;
  busy: boolean;
  now: number;
  position: CSSProperties;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`pasture-animal pasture-animal--${animal.visualState} ${selected ? "is-selected" : ""} ${animal.hungry ? "is-hungry" : ""}`}
      style={position}
    >
      <button type="button" disabled={busy} aria-label={`查看${animal.name}`} onClick={onSelect}>
        <img src={animalImageUrl(animal)} alt={animal.name} />
      </button>
      {animal.pendingProduct > 0 ? <b>{animal.byproductName} ×{animal.pendingProduct}</b> : null}
      {animal.hungry ? <em>缺草</em> : null}
      <span>
        <strong>{animal.name}</strong>
        <small>{animalStatusText(animal, now)}</small>
      </span>
    </div>
  );
}

function AnimalActionStrip({
  animal,
  busy,
  friendMode,
  now,
  carrotCount,
  specialFeedRemaining,
  onAction,
  onFeedCarrot
}: {
  animal: ManorAnimalView;
  busy: boolean;
  friendMode: boolean;
  now: number;
  carrotCount: number;
  specialFeedRemaining: number;
  onAction: () => void;
  onFeedCarrot: () => void;
}) {
  const actionLabel = friendMode
    ? animal.pendingProduct > animal.minimumProduct
      ? `偷取 1 ${animal.byproductName}`
      : animal.canStartProduction
        ? `帮忙${animal.productionAction}`
        : "暂不可操作"
    : animal.canHarvestProduct
      ? `收取${animal.byproductName} ×${animal.pendingProduct}`
    : animal.canHarvestAnimal
      ? `收获${animal.name}`
      : animal.canStartProduction
        ? `开始${animal.productionAction}`
        : "暂不可操作";
  const enabled = friendMode
    ? animal.pendingProduct > animal.minimumProduct || animal.canStartProduction
    : animal.canHarvestProduct || animal.canHarvestAnimal || animal.canStartProduction;
  return (
    <div className="pasture-animal-actions">
      <img src={animalImageUrl(animal)} alt="" />
      <span>
        <strong>{animal.name}</strong>
        <small>{animalStatusText(animal, now)}</small>
      </span>
      <button type="button" disabled={busy || !enabled} onClick={onAction}>{actionLabel}</button>
      {animal.canFeedCarrot ? (
        <button
          className="pasture-carrot-action"
          type="button"
          disabled={busy || carrotCount < 1 || specialFeedRemaining < 1}
          title={`胡萝卜库存 ${carrotCount}，今日还可喂 ${specialFeedRemaining} 次`}
          onClick={onFeedCarrot}
        >
          <Carrot size={15} />
          {carrotCount < 1 ? "没有胡萝卜" : specialFeedRemaining < 1 ? "今日已喂满" : `喂胡萝卜 ×${carrotCount}`}
        </button>
      ) : null}
    </div>
  );
}

function PastureQueueWindow({
  animals,
  busy,
  onSave,
  onClose
}: {
  animals: ManorAnimalView[];
  busy: boolean;
  onSave: (animalSerials: number[]) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState(() => animals.map((animal) => animal.serial));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };
  return (
    <PastureWindow title="动物展示队列" onClose={onClose}>
      <div className="pasture-queue-list">
        {order.map((serial, index) => {
          const animal = animals.find((candidate) => candidate.serial === serial);
          if (!animal) return null;
          return (
            <div key={serial}>
              <b>{index + 1}</b>
              <img src={animalImageUrl(animal)} alt="" />
              <span><strong>{animal.name}</strong><small>编号 #{animal.serial}</small></span>
              <button type="button" aria-label="上移" title="上移" disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
              <button type="button" aria-label="下移" title="下移" disabled={busy || index === order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
            </div>
          );
        })}
      </div>
      <footer className="pasture-queue-actions">
        <span>队列顺序决定动物在场景中的展示位置。</span>
        <button type="button" disabled={busy || order.length === 0} onClick={() => onSave(order)}>保存队列</button>
      </footer>
    </PastureWindow>
  );
}

function PastureShopWindow({
  pasture,
  busy,
  onBuy,
  onClose
}: {
  pasture: ManorPastureView;
  busy: boolean;
  onBuy: (animal: ManorAnimalCatalogView) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ManorAnimalHouse>("all");
  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pasture.catalog.filter((animal) =>
      (category === "all" || animal.category === category) &&
      (!normalized || animal.name.toLowerCase().includes(normalized) || animal.byproductName.toLowerCase().includes(normalized))
    );
  }, [category, pasture.catalog, query]);
  return (
    <PastureWindow title="牧场商店" onClose={onClose}>
      <div className="pasture-window-controls">
        <label>
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索动物" />
        </label>
        <div className="pasture-segments" role="group" aria-label="动物分类">
          {(["all", "hutch", "shed"] as const).map((value) => (
            <button className={category === value ? "is-active" : ""} type="button" key={value} onClick={() => setCategory(value)}>
              {value === "all" ? "全部" : value === "hutch" ? "窝养" : "棚养"}
            </button>
          ))}
        </div>
      </div>
      <div className="pasture-shop-list">
        {items.map((animal) => {
          const house = pasture.houses[animal.category];
          const hasRoom = house.occupied < house.capacity;
          const affordable = pasture.profile.coins >= animal.purchasePrice;
          return (
            <div className={!animal.unlocked ? "is-locked" : ""} key={animal.sourceId}>
              <span className="pasture-item-image">
                <img src={`${PASTURE_ASSET_ROOT}/animals/${animal.sourceId}/ready_to_produce.png`} alt="" />
              </span>
              <span>
                <strong>{animal.name}</strong>
                <small>{animal.productionAction}{animal.byproductName}，每次 {animal.baseYield}{animal.byproductUnit}</small>
                <em>牧场 {animal.levelRequired} 级 · {animal.purchasePrice} 金币</em>
              </span>
              <button type="button" disabled={busy || !animal.unlocked || !hasRoom || !affordable} onClick={() => onBuy(animal)}>
                {!animal.unlocked ? `${animal.levelRequired}级` : !hasRoom ? "已满" : !affordable ? "金币不足" : "购买"}
              </button>
            </div>
          );
        })}
      </div>
    </PastureWindow>
  );
}

function PastureWarehouseWindow({
  pasture,
  busy,
  onSell,
  onClose
}: {
  pasture: ManorPastureView;
  busy: boolean;
  onSell: (
    animalId: ManorPastureView["inventory"][number]["animalId"],
    itemType: "byproduct" | "animal",
    quantity: number,
    name: string
  ) => void;
  onClose: () => void;
}) {
  return (
    <PastureWindow title="牧场仓库" onClose={onClose}>
      {pasture.inventory.length === 0 && pasture.manure === 0 ? (
        <div className="pasture-window-empty"><PackageOpen size={28} /><span>仓库暂无产品</span></div>
      ) : (
        <div className="pasture-warehouse-list">
          {pasture.manure > 0 ? (
            <div>
              <span className="pasture-item-image">
                <img src="/assets/manor/classic/legacy/manure.png" alt="" />
              </span>
              <span><strong>便便 ×{pasture.manure}</strong><small>可在农场加工厂制作极速化肥</small></span>
            </div>
          ) : null}
          {pasture.inventory.flatMap((item) => {
            const animal = pasture.catalog.find((candidate) => candidate.sourceId === item.animalId);
            const entries = [];
            if (item.byproductCount > 0) {
              entries.push(
                <div key={`${item.animalId}:byproduct`}>
                  <span className="pasture-item-image">
                    <img src={`${PASTURE_ASSET_ROOT}/animals/${item.animalId}/production_early.png`} alt="" />
                  </span>
                  <span><strong>{item.byproductName} ×{item.byproductCount}</strong><small>单价 {item.byproductSalePrice} 金币</small></span>
                  <button type="button" disabled={busy} onClick={() => onSell(item.animalId, "byproduct", item.byproductCount, item.byproductName)}>全部出售</button>
                </div>
              );
            }
            if (item.animalCount > 0) {
              entries.push(
                <div key={`${item.animalId}:animal`}>
                  <span className="pasture-item-image">
                    <img src={`${PASTURE_ASSET_ROOT}/animals/${item.animalId}/lifecycle_complete.png`} alt="" />
                  </span>
                  <span><strong>{item.animalName} ×{item.animalCount}</strong><small>单价 {item.animalSalePrice} 金币</small></span>
                  <button type="button" disabled={busy} onClick={() => onSell(item.animalId, "animal", item.animalCount, animal?.name ?? item.animalName)}>全部出售</button>
                </div>
              );
            }
            return entries;
          })}
        </div>
      )}
    </PastureWindow>
  );
}

function PastureFeedWindow({
  pasture,
  busy,
  friendMode,
  onBuy,
  onClose
}: {
  pasture: ManorPastureView;
  busy: boolean;
  friendMode: boolean;
  onBuy: (quantity: number) => void;
  onClose: () => void;
}) {
  const available = Math.max(0, Math.floor(pasture.grassCapacity - pasture.grass));
  const affordable = friendMode ? 400 : Math.floor(pasture.profile.coins / pasture.grassPrice);
  const maximum = Math.max(1, Math.min(400, available, affordable));
  const [quantity, setQuantity] = useState(Math.min(10, maximum));
  const canBuy = available > 0 && affordable > 0;
  return (
    <PastureWindow title="添加牧草" onClose={onClose} compact>
      <div className="pasture-feed-window">
        <img src={`${PASTURE_ASSET_ROOT}/ui/trough-buy.png`} alt="饲料机" />
        <span>
          <strong>{formatGrass(pasture.grass)} / {pasture.grassCapacity}</strong>
          <small>每份牧草 {pasture.grassPrice} 金币{friendMode ? "，从我的金币扣除" : ""}</small>
        </span>
        <label>
          数量
          <input
            type="number"
            min={1}
            max={maximum}
            step={1}
            value={quantity}
            disabled={!canBuy}
            onChange={(event) => setQuantity(Math.max(1, Math.min(maximum, Number(event.target.value) || 1)))}
          />
        </label>
        <button type="button" disabled={busy || !canBuy} onClick={() => onBuy(quantity)}>
          {available <= 0 ? "饲料机已满" : affordable <= 0 ? "金币不足" : `${friendMode ? "代喂" : "购买"} · ${quantity * pasture.grassPrice} 金币`}
        </button>
      </div>
    </PastureWindow>
  );
}

function PastureHouseWindow({
  pasture,
  busy,
  onUpgrade,
  onClose
}: {
  pasture: ManorPastureView;
  busy: boolean;
  onUpgrade: (house: ManorAnimalHouse) => void;
  onClose: () => void;
}) {
  return (
    <PastureWindow title="窝棚升级" onClose={onClose} compact>
      <div className="pasture-house-window">
        {(["hutch", "shed"] as const).map((house) => {
          const status = pasture.houses[house];
          const next = status.nextUpgrade;
          const ready = next && pasture.profile.level >= next.levelRequired && pasture.profile.coins >= next.coinCost;
          return (
            <div key={house}>
              {status.level > 0 ? <img src={status.assetUrl} alt="" /> : <Home size={24} />}
              <span>
                <strong>{house === "hutch" ? "动物窝" : "动物棚"} Lv.{status.level}</strong>
                <small>容量 {status.occupied} / {status.capacity}</small>
                {next ? <em>牧场 {next.levelRequired} 级 · {next.coinCost} 金币</em> : <em>已满级</em>}
              </span>
              <button type="button" disabled={busy || !ready} onClick={() => onUpgrade(house)}>
                {!next ? "已满级" : pasture.profile.level < next.levelRequired ? `${next.levelRequired}级解锁` : pasture.profile.coins < next.coinCost ? "金币不足" : "升级"}
              </button>
            </div>
          );
        })}
      </div>
    </PastureWindow>
  );
}

function PastureWindow({
  title,
  children,
  compact = false,
  onClose
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section
        className={`pasture-window ${compact ? "pasture-window--compact" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <strong className="pasture-window__title">{title}</strong>
        <button className="pasture-window__close" type="button" aria-label="关闭" onClick={onClose} />
        <div className="pasture-window__body">{children}</div>
      </section>
    </div>
  );
}

function pastureAnimalPosition(index: number): CSSProperties {
  const columns = 5;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const stagger = row % 2 === 1 ? 3.5 : 0;
  return {
    left: `${13 + column * 14 + stagger}%`,
    top: `${24 + row * 15}%`,
    zIndex: 120 + row * 10 + column,
    "--pasture-animal-delay": `${-(index % 5) * 0.37}s`
  } as CSSProperties;
}

function pastureMosquitoPosition(index: number): CSSProperties {
  const positions = [
    [32, 26], [48, 20], [65, 29], [25, 47], [55, 43], [75, 50], [40, 61], [67, 65]
  ];
  const [left, top] = positions[index % positions.length] ?? positions[0]!;
  return {
    left: `${left}%`,
    top: `${top}%`,
    "--pasture-nuisance-delay": `${-(index % 4) * 0.43}s`
  } as CSSProperties;
}

function pasturePoopPosition(index: number): CSSProperties {
  const positions = [
    [22, 68], [34, 73], [47, 66], [59, 72], [71, 64], [28, 55], [51, 57], [78, 72]
  ];
  const [left, top] = positions[index % positions.length] ?? positions[0]!;
  return { left: `${left}%`, top: `${top}%` };
}

function animalImageUrl(animal: ManorAnimalView): string {
  return `${PASTURE_ASSET_ROOT}/animals/${animal.sourceId}/${animal.visualState}.png`;
}

function animalStatusText(animal: ManorAnimalView, now: number): string {
  if (animal.hungry) return "缺少牧草，成长已暂停";
  if (animal.canHarvestProduct) return `${animal.byproductName}可收取`;
  if (animal.canHarvestAnimal) return "生命周期结束，可收获";
  if (animal.canStartProduction) return `可以${animal.productionAction}`;
  const labels: Record<ManorAnimalView["visualState"], string> = {
    cub: "幼年期",
    growing: "成长期",
    ready_to_produce: "等待生产",
    production_early: "生产中",
    production_late: "休息中",
    lifecycle_complete: "生命周期结束"
  };
  const remaining = animal.nextStateAt ? Math.max(0, animal.nextStateAt - now) : 0;
  return remaining > 0 ? `${labels[animal.visualState]} · ${formatDuration(remaining)}` : labels[animal.visualState];
}

function playAnimalSound(urls: string[]): void {
  if (urls.length === 0) return;
  const url = urls[Math.floor(Math.random() * urls.length)];
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = 0.55;
  void audio.play().catch(() => undefined);
}

function formatGrass(value: number): string {
  return value >= 100 || Number.isInteger(value) ? Math.floor(value).toString() : value.toFixed(1);
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours > 0) return `${hours}小时${minutes > 0 ? `${minutes}分` : ""}`;
  if (minutes > 0) return `${minutes}分${seconds % 60}秒`;
  return `${seconds}秒`;
}

function progressBetween(value: number, start: number, end: number): number {
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (value - start) / (end - start)));
}
