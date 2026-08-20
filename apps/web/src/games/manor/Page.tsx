import type {
  ManorActionRequest,
  ManorCropId,
  ManorCropView,
  ManorDecorationType,
  ManorDecorationView,
  ManorFarmView,
  ManorFertilizerId,
  ManorFlowerCatalogView,
  ManorPlotView,
  ManorRewardItemView
} from "@party-games/shared";
import { Bug, Dog, Factory, Flower2, History, ListChecks, MessageSquare, ReceiptText, RefreshCw, Search, Sprout, UsersRound, Wheat } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  getManorFarm,
  getManorFriendFarm,
  performManorAction,
  performManorFriendFarmAction
} from "../../api";
import { AppShell } from "../../platform/AppShell";
import { ManorActivityWindow } from "./ActivityWindow";
import { ManorBusinessWindow } from "./BusinessWindow";
import { ManorFlowerWindow } from "./FlowerWindow";
import { ManorGuestbookWindow } from "./GuestbookWindow";
import { ManorPasturePage } from "./PasturePage";
import {
  ManorSocialWindow,
  ManorTaskWindow,
  ManorVisitBanner,
  type ManorVisitTarget
} from "./SocialWindow";

const ASSET_ROOT = "/assets/manor/classic";
const CROP_ASSET_VERSION = "classic-crops-v4";

type ManorTool = "move" | "hoe" | "seed" | "fertilizer" | "water" | "weed" | "pest" | "harvest" | "prank-weed" | "prank-pest";
type ClassicManorWindow = "seed-pack" | "fertilizer-pack" | "shop" | "warehouse";
type ManorWindow = ClassicManorWindow | "decorate" | "dog" | "factory" | "activities" | "flowers" | "business";

const TOOLS: ReadonlyArray<{ id: ManorTool; label: string; shortcut?: string }> = [
  { id: "move", label: "移动画面" },
  { id: "hoe", label: "翻地" },
  { id: "seed", label: "种子包" },
  { id: "fertilizer", label: "化肥包", shortcut: "F" },
  { id: "water", label: "浇水", shortcut: "Q" },
  { id: "weed", label: "除草", shortcut: "W" },
  { id: "pest", label: "除虫", shortcut: "E" },
  { id: "harvest", label: "收获", shortcut: "R" }
];

const VISITOR_PRANK_TOOLS: ReadonlyArray<{ id: ManorTool; label: string; shortcut?: string }> = [
  { id: "prank-weed", label: "放杂草" },
  { id: "prank-pest", label: "放害虫" }
];

export function ManorPage() {
  const [mode, setMode] = useState<"farm" | "pasture">("farm");
  const [visit, setVisit] = useState<ManorVisitTarget>();
  const [socialOpen, setSocialOpen] = useState(false);
  const [guestbookOpen, setGuestbookOpen] = useState(false);

  const visitFriend = (friend: ManorVisitTarget, nextMode: "farm" | "pasture") => {
    setVisit(friend);
    setMode(nextMode);
    setSocialOpen(false);
  };

  const social = (
    <ManorSocialWindow
      open={socialOpen}
      onClose={() => setSocialOpen(false)}
      onVisit={visitFriend}
    />
  );
  const guestbook = (
    <ManorGuestbookWindow
      open={guestbookOpen}
      onClose={() => setGuestbookOpen(false)}
      {...(visit ? { ownerUserId: visit.userId, ownerDisplayName: visit.displayName } : {})}
    />
  );

  if (mode === "pasture") {
    return (
      <ManorPasturePage
        visit={visit}
        socialWindow={social}
        guestbookWindow={guestbook}
        onOpenSocial={() => setSocialOpen(true)}
        onOpenGuestbook={() => setGuestbookOpen(true)}
        onReturnHome={() => setVisit(undefined)}
        onSwitchFarm={() => setMode("farm")}
      />
    );
  }

  return (
    <ManorFarmPage
      visit={visit}
      socialWindow={social}
      guestbookWindow={guestbook}
      onOpenSocial={() => setSocialOpen(true)}
      onOpenGuestbook={() => setGuestbookOpen(true)}
      onReturnHome={() => setVisit(undefined)}
      onSwitchPasture={() => setMode("pasture")}
    />
  );
}

function ManorFarmPage({
  visit,
  socialWindow,
  guestbookWindow,
  onOpenSocial,
  onOpenGuestbook,
  onReturnHome,
  onSwitchPasture
}: {
  visit: ManorVisitTarget | undefined;
  socialWindow: ReactNode;
  guestbookWindow: ReactNode;
  onOpenSocial: () => void;
  onOpenGuestbook: () => void;
  onReturnHome: () => void;
  onSwitchPasture: () => void;
}) {
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const windowScrollLeftRef = useRef<number | undefined>(undefined);
  const [farm, setFarm] = useState<ManorFarmView>();
  const [flowerCatalog, setFlowerCatalog] = useState<ManorFlowerCatalogView[]>();
  const [selectedCropId, setSelectedCropId] = useState<ManorCropId>("radish");
  const [selectedFertilizerId, setSelectedFertilizerId] = useState<ManorFertilizerId>("ordinary");
  const [selectedTool, setSelectedTool] = useState<ManorTool>("move");
  const [activeWindow, setActiveWindow] = useState<ManorWindow>();
  const [reclaimPlotId, setReclaimPlotId] = useState<number>();
  const [inspectedPlotId, setInspectedPlotId] = useState<number>();
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [clock, setClock] = useState(Date.now());
  const [busyKey, setBusyKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [taskOpen, setTaskOpen] = useState(false);

  const acceptFarm = useCallback((next: ManorFarmView) => {
    setFarm(next);
    setLoadedAt(Date.now());
    setError(undefined);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setBusyKey("refresh");
    try {
      if (visit) {
        const result = await getManorFriendFarm(visit.userId);
        acceptFarm(result.farm);
        setFlowerCatalog(result.flowerCatalog);
      } else {
        acceptFarm(await getManorFarm());
        setFlowerCatalog(undefined);
      }
    } catch (requestError) {
      if (!silent) {
        setError(requestError instanceof Error ? requestError.message : "庄园读取失败");
      }
    } finally {
      if (!silent) setBusyKey(undefined);
    }
  }, [acceptFarm, visit]);

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
    const timeout = window.setTimeout(() => setNotice(undefined), 2_600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;

    if (
      activeWindow ||
      reclaimPlotId !== undefined ||
      farm && (!farm.starterGift.claimed || farm.pendingLevelRewards.length > 0)
    ) {
      windowScrollLeftRef.current ??= viewport.scrollLeft;
      viewport.scrollLeft = Math.round((viewport.scrollWidth - viewport.clientWidth) / 2);
      return;
    }

    if (windowScrollLeftRef.current !== undefined) {
      viewport.scrollLeft = windowScrollLeftRef.current;
      windowScrollLeftRef.current = undefined;
    }
  }, [activeWindow, farm, reclaimPlotId]);

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const keyTools: Partial<Record<string, ManorTool>> = {
        q: "water",
        w: "weed",
        e: "pest",
        r: "harvest"
      };
      const nextTool = keyTools[event.key.toLowerCase()];
      if (nextTool) setSelectedTool(nextTool);
      if (event.key.toLowerCase() === "f") setActiveWindow("fertilizer-pack");
      if (event.key === "Escape") {
        setActiveWindow(undefined);
        setReclaimPlotId(undefined);
      }
    };
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, []);

  const act = useCallback(async (
    action: ManorActionRequest,
    key: string,
    success: string | ((next: ManorFarmView) => string)
  ) => {
    if (busyKey) return false;
    setBusyKey(key);
    setError(undefined);
    try {
      const next = await performManorAction(action);
      acceptFarm(next);
      setNotice(typeof success === "function" ? success(next) : success);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "操作失败");
      return false;
    } finally {
      setBusyKey(undefined);
    }
  }, [acceptFarm, busyKey]);

  const actForFriend = useCallback(async (
    action: Parameters<typeof performManorFriendFarmAction>[1],
    key: string
  ) => {
    if (busyKey || !visit) return false;
    setBusyKey(key);
    setError(undefined);
    try {
      const result = await performManorFriendFarmAction(visit.userId, action);
      acceptFarm(result.farm);
      setFlowerCatalog(result.flowerCatalog);
      setNotice(result.message ?? "好友互动完成");
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "好友互动失败");
      return false;
    } finally {
      setBusyKey(undefined);
    }
  }, [acceptFarm, busyKey, visit]);

  useEffect(() => {
    setActiveWindow(undefined);
    setReclaimPlotId(undefined);
    setTaskOpen(false);
    setSelectedTool("move");
  }, [visit?.userId]);

  const serverNow = farm ? farm.serverTime + (clock - loadedAt) : clock;
  const selectedCrop = useMemo(
    () => farm?.catalog.find((crop) => crop.id === selectedCropId),
    [farm, selectedCropId]
  );
  const selectedFertilizer = useMemo(
    () => farm?.inventory.fertilizers.find((fertilizer) => fertilizer.id === selectedFertilizerId),
    [farm, selectedFertilizerId]
  );
  const reclaimPlot = useMemo(
    () => farm?.plots.find((plot) => plot.id === reclaimPlotId),
    [farm, reclaimPlotId]
  );
  const levelProgress = farm
    ? progressBetween(
        farm.profile.experience,
        farm.profile.currentLevelExperience,
        farm.profile.nextLevelExperience
      )
    : 0;

  const selectTool = (tool: ManorTool) => {
    if (tool === "seed") {
      setActiveWindow("seed-pack");
      return;
    }
    if (tool === "fertilizer") {
      setActiveWindow("fertilizer-pack");
      return;
    }
    setSelectedTool(tool);
  };

  const selectFertilizer = (fertilizerId: ManorFertilizerId) => {
    const fertilizer = farm?.inventory.fertilizers.find((candidate) => candidate.id === fertilizerId);
    if (!fertilizer || fertilizer.amount < 1) {
      setNotice(fertilizerId === "ordinary" ? "普通化肥不足，请先到商店购买" : "这种化肥需要通过升级奖励获得");
      if (fertilizerId === "ordinary") setActiveWindow("shop");
      return;
    }
    setSelectedFertilizerId(fertilizerId);
    setSelectedTool("fertilizer");
    setActiveWindow(undefined);
    setNotice(`已选择${fertilizer.name}`);
  };

  const selectSeed = (crop: ManorCropView) => {
    if (crop.seeds < 1) {
      setNotice(`${crop.name}种子不足，请先到商店购买`);
      return;
    }
    setSelectedCropId(crop.id);
    setSelectedTool("seed");
    setActiveWindow(undefined);
    setNotice(`已选择${crop.name}种子`);
  };

  const activatePlot = async (plot: ManorPlotView) => {
    setInspectedPlotId(plot.id);
    if (!farm || busyKey) return;
    if (visit) {
      if (!plot.unlocked) {
        setNotice("好友还没有开垦这块土地");
        return;
      }
      if (selectedTool === "move") {
        setNotice(plotSummary(plot, serverNow));
        return;
      }
      if (selectedTool === "prank-weed") {
        await actForFriend({ type: "add-weed", plotId: plot.id }, `friend-add-weed:${plot.id}`);
        return;
      }
      if (selectedTool === "prank-pest") {
        await actForFriend({ type: "add-pest", plotId: plot.id }, `friend-add-pest:${plot.id}`);
        return;
      }
      if (selectedTool === "water") {
        if (plot.watered) setNotice("这块土地当前水分正常");
        else await actForFriend({ type: "water", plotId: plot.id }, `friend-water:${plot.id}`);
        return;
      }
      if (selectedTool === "weed") {
        if (!plot.weed) setNotice("这块土地当前没有杂草");
        else await actForFriend({ type: "clear-weed", plotId: plot.id }, `friend-weed:${plot.id}`);
        return;
      }
      if (selectedTool === "pest") {
        if (!plot.pest) setNotice("这块土地当前没有害虫");
        else await actForFriend({ type: "clear-pest", plotId: plot.id }, `friend-pest:${plot.id}`);
        return;
      }
      if (selectedTool === "harvest") {
        if (plot.status !== "mature") setNotice("这块作物还不能偷取");
        else await actForFriend({ type: "steal-crop", plotId: plot.id }, `friend-steal:${plot.id}`);
        return;
      }
      setNotice("访问好友时只能查看、照料或偷取成熟作物");
      return;
    }
    if (!plot.unlocked) {
      setReclaimPlotId(plot.id);
      return;
    }

    switch (selectedTool) {
      case "move":
        setNotice(plotSummary(plot, serverNow));
        return;
      case "hoe":
        if (plot.status === "empty") {
          setNotice("土地已经翻好，可以播种");
          return;
        }
        if (plot.status !== "withered") {
          setNotice("作物尚未枯萎，暂时不能翻地");
          return;
        }
        await act(
          { type: "clear-plot", plotId: plot.id },
          `clear:${plot.id}`,
          (next) => {
            const reward = next.catalog.find((crop) => {
              const previous = farm.catalog.find((candidate) => candidate.id === crop.id);
              return crop.seeds > (previous?.seeds ?? 0);
            });
            if (!reward) return "枯萎作物已清理，获得 3 点经验";
            const previous = farm.catalog.find((crop) => crop.id === reward.id)?.seeds ?? 0;
            return `清理完成，获得 ${reward.seeds - previous} 包${reward.name}种子`;
          }
        );
        return;
      case "seed":
        if (plot.status !== "empty") {
          setNotice("这块土地已经种有作物");
          return;
        }
        if (!selectedCrop || selectedCrop.seeds < 1) {
          setActiveWindow("seed-pack");
          return;
        }
        await act(
          { type: "plant", plotId: plot.id, cropId: selectedCrop.id },
          `plant:${plot.id}`,
          `已种下${selectedCrop.name}`
        );
        return;
      case "water":
        if (plot.status === "empty" || plot.status === "withered") {
          setNotice(plot.status === "empty" ? "空地不需要浇水" : "作物已经枯萎，请用锄头清理");
          return;
        }
        if (plot.watered) {
          setNotice("这块土地当前水分正常");
          return;
        }
        await act({ type: "water", plotId: plot.id }, `water:${plot.id}`, "浇水完成，获得 2 金币和 2 经验");
        return;
      case "weed":
        if (!plot.weed) {
          setNotice("这块土地当前没有杂草");
          return;
        }
        await act({ type: "clear-weed", plotId: plot.id }, `weed:${plot.id}`, "杂草已清除，获得 2 金币和 2 经验");
        return;
      case "pest":
        if (!plot.pest) {
          setNotice("这块土地当前没有害虫");
          return;
        }
        await act({ type: "clear-pest", plotId: plot.id }, `pest:${plot.id}`, "害虫已清除，获得 2 金币和 2 经验");
        return;
      case "fertilizer":
        if (!selectedFertilizer || selectedFertilizer.amount < 1) {
          setActiveWindow("fertilizer-pack");
          return;
        }
        if (plot.status === "empty" || plot.status === "withered") {
          setNotice(plot.status === "empty" ? "空地不能施肥" : "作物已经枯萎，请用锄头清理");
          return;
        }
        if (plot.status === "mature" || plot.readyAt && plot.readyAt <= serverNow) {
          setNotice("成熟作物不需要施肥");
          return;
        }
        await act(
          { type: "fertilize", plotId: plot.id, fertilizerId: selectedFertilizer.id },
          `fertilize:${plot.id}`,
          (next) => {
            const nextPlot = next.plots.find((candidate) => candidate.id === plot.id);
            const reduced = Math.max(0, (plot.readyAt ?? 0) - (nextPlot?.readyAt ?? 0));
            return `${selectedFertilizer.name}使用完成，成熟时间提前 ${formatDuration(reduced)}`;
          }
        );
        return;
      case "harvest":
        if (plot.status === "withered") {
          setNotice("作物已经枯萎，请用锄头清理");
          return;
        }
        if (plot.status !== "mature" && (!plot.readyAt || plot.readyAt > serverNow)) {
          setNotice(plot.status === "empty" ? "这块土地还没有作物" : "作物尚未成熟");
          return;
        }
        await act(
          { type: "harvest", plotId: plot.id },
          `harvest:${plot.id}`,
          (next) => {
            const nextPlot = next.plots.find((candidate) => candidate.id === plot.id);
            if (nextPlot?.status === "withered") return "最后一季已收获，作物进入枯萎状态";
            return `本季已收获，进入第 ${(nextPlot?.harvestedCycles ?? 0) + 1} 季`;
          }
        );
    }
  };

  if (!farm) {
    return (
      <AppShell scope="manor" title="怀旧庄园" backTo="/">
        <div className="manor-loading">
          <Wheat size={30} />
          <span>{error ?? "正在读取庄园..."}</span>
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

  const backgroundImage = farm.decorations.active.background
    ? `url("${farm.decorations.active.background.assetUrl}")`
    : farm.art.backgroundUrl
      ? `url("${farm.art.backgroundUrl}")`
    : `url("${ASSET_ROOT}/farm-background.png")`;
  const fertilizerCount = farm.inventory.fertilizers.reduce(
    (total, fertilizer) => total + fertilizer.amount,
    0
  );
  const visibleTools = visit
    ? [
        ...TOOLS.filter((tool) => ["move", "water", "weed", "pest", "harvest"].includes(tool.id)),
        ...VISITOR_PRANK_TOOLS
      ]
    : TOOLS;
  const activeDog = farm.dog.catalog.find((dog) => dog.active);

  return (
    <AppShell
      scope="manor"
      title="怀旧庄园"
      backTo="/"
      actions={
        <>
          {!visit ? (
            <button className="icon-button" type="button" aria-label="新手任务" title="新手任务" onClick={() => setTaskOpen(true)}>
              <ListChecks size={18} />
            </button>
          ) : null}
          <button className="icon-button" type="button" aria-label="好友与排行" title="好友与排行" onClick={onOpenSocial}>
            <UsersRound size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="刷新庄园"
            title="刷新庄园"
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
        {guestbookWindow}
        {taskOpen && !visit ? <ManorTaskWindow tasks={farm.tasks} onClose={() => setTaskOpen(false)} /> : null}
        <div className="manor-stage-viewport" ref={stageViewportRef}>
          <div className="manor-stage-shell">
            <section
              className={`manor-stage manor-stage--tool-${selectedTool}`}
              style={{ backgroundImage }}
              aria-label="QQ 农场经典场景"
            >
              <div className="manor-head-bg" aria-hidden="true" />
              <FarmDecorations active={farm.decorations.active} />
              <PlayerHud farm={farm} levelProgress={levelProgress} />
              {visit ? <ManorVisitBanner target={visit} onHome={onReturnHome} /> : null}
              <img className="manor-weather" src={farm.weather.assetUrl} alt={farm.weather.label} title={farm.weather.label} />
              {farm.weather.id === "rainy" ? <div className="manor-rain" aria-hidden="true" /> : null}

              <nav className="manor-head-tools" aria-label="庄园功能">
                <ClassicButton asset="nav-farm" label="我的农场" active={!visit} {...(visit ? { onClick: onReturnHome } : {})} />
                <ClassicButton
                  asset="nav-pasture"
                  label="我的牧场"
                  onClick={onSwitchPasture}
                />
                {!visit ? (
                  <>
                    <ClassicButton asset="nav-warehouse" label="仓库" onClick={() => setActiveWindow("warehouse")} />
                    <ClassicButton asset="nav-shop" label="农场商店" onClick={() => setActiveWindow("shop")} />
                    <DecorationNavButton onClick={() => setActiveWindow("decorate")} />
                  </>
                ) : null}
              </nav>

              <div className="manor-feature-dock" aria-label="庄园扩展功能">
                {!visit ? (
                  <>
                    <ManorFeatureButton icon={<Dog size={18} />} label="看门狗" onClick={() => setActiveWindow("dog")} />
                    <ManorFeatureButton icon={<Factory size={18} />} label="加工厂" onClick={() => setActiveWindow("factory")} />
                  </>
                ) : null}
                <ManorFeatureButton icon={<History size={18} />} label="庄园动态" onClick={() => setActiveWindow("activities")} />
                <ManorFeatureButton icon={<Flower2 size={18} />} label={visit ? "赠送花束" : "我的花篮"} onClick={() => setActiveWindow("flowers")} />
                <ManorFeatureButton icon={<MessageSquare size={18} />} label="庄园留言" onClick={onOpenGuestbook} />
                {!visit ? <ManorFeatureButton icon={<ReceiptText size={18} />} label="经营流水" onClick={() => setActiveWindow("business")} /> : null}
              </div>

              {activeDog ? (
                <button
                  className={`manor-scene-dog ${farm.dog.fed ? "is-fed" : "is-hungry"}`}
                  type="button"
                  title={farm.dog.fed ? `${activeDog.name}正在看守农场` : `${activeDog.name}没有狗粮`}
                  aria-label={farm.dog.fed ? `${activeDog.name}正在看守农场` : `${activeDog.name}没有狗粮`}
                  onClick={() => visit ? setNotice(farm.dog.fed ? "好友的看门狗正在工作" : "好友的看门狗没有狗粮") : setActiveWindow("dog")}
                >
                  <img src={activeDog.assetUrl} alt="" />
                </button>
              ) : null}

              {farm.plots.map((plot, index) => (
                <FarmLand
                  busy={Boolean(busyKey)}
                  inspected={inspectedPlotId === plot.id}
                  key={plot.id}
                  now={serverNow}
                  plot={plot}
                  position={landPosition(index)}
                  onActivate={() => void activatePlot(plot)}
                />
              ))}

              {error ? <div className="manor-message manor-message--error">{error}</div> : null}
              {!error && notice ? <div className="manor-message">{notice}</div> : null}

              <div className="manor-toolbar" role="toolbar" aria-label="农场工具" style={{ gridTemplateColumns: `repeat(${visibleTools.length}, 1fr)` }}>
                {visibleTools.map((tool) => (
                  <ClassicButton
                    active={selectedTool === tool.id}
                    asset={toolAsset(tool.id)}
                    key={tool.id}
                    label={`${visit && tool.id === "harvest" ? "偷取" : tool.label}${tool.id === "fertilizer" ? ` ×${fertilizerCount}` : ""}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
                    onClick={() => selectTool(tool.id)}
                  />
                ))}
              </div>

              {!visit && activeWindow === "decorate" ? (
                <DecorationWindow
                  busy={Boolean(busyKey)}
                  coins={farm.profile.coins}
                  decorations={farm.decorations.catalog}
                  now={serverNow}
                  onActivate={(decoration) =>
                    void act(
                      { type: "activate-decoration", sourceId: decoration.sourceId },
                      `activate-decoration:${decoration.sourceId}`,
                      `已启用${decoration.name}`
                    )
                  }
                  onBuy={(decoration) =>
                    void act(
                      { type: "buy-decoration", sourceId: decoration.sourceId },
                      `buy-decoration:${decoration.sourceId}`,
                      `已购买并启用${decoration.name}`
                    )
                  }
                  onClose={() => setActiveWindow(undefined)}
                  onDeactivate={(decoration) =>
                    void act(
                      { type: "deactivate-decoration", sourceId: decoration.sourceId },
                      `deactivate-decoration:${decoration.sourceId}`,
                      `已停用${decoration.name}`
                    )
                  }
                />
              ) : null}

              {!visit && activeWindow === "dog" ? (
                <DogWindow
                  busy={Boolean(busyKey)}
                  coins={farm.profile.coins}
                  dog={farm.dog}
                  now={serverNow}
                  onActivate={(dogId) => void act({ type: "activate-dog", dogId }, `activate-dog:${dogId}`, "看门狗已更换")}
                  onBuy={(dogId) => void act({ type: "buy-dog", dogId }, `buy-dog:${dogId}`, "看门狗已入住农场")}
                  onBuyFood={(days) => void act({ type: "buy-dog-food", days }, `buy-dog-food:${days}`, `已补充 ${days} 天狗粮`)}
                  onClose={() => setActiveWindow(undefined)}
                />
              ) : null}

              {!visit && activeWindow === "factory" ? (
                <FactoryWindow
                  busy={Boolean(busyKey)}
                  factory={farm.factory}
                  onClose={() => setActiveWindow(undefined)}
                  onCraft={(quantity) => void act(
                    { type: "craft-instant-fertilizer", quantity },
                    `craft-instant-fertilizer:${quantity}`,
                    `加工完成，获得 ${quantity} 包极速化肥`
                  )}
                />
              ) : null}

              {activeWindow === "activities" ? (
                <ManorActivityWindow activities={farm.activities} onClose={() => setActiveWindow(undefined)} />
              ) : null}

              {activeWindow === "flowers" ? (
                <ManorFlowerWindow
                  basket={farm.flowerBasket}
                  busy={Boolean(busyKey)}
                  onClose={() => setActiveWindow(undefined)}
                  {...(visit && flowerCatalog ? {
                    catalog: flowerCatalog,
                    recipientName: visit.displayName,
                    onSend: (flowerId, message) => actForFriend(
                      { type: "send-flower", flowerId, message },
                      `send-flower:${flowerId}`
                    )
                  } : {})}
                />
              ) : null}

              {!visit && activeWindow === "business" ? (
                <ManorBusinessWindow records={farm.businessRecords} onClose={() => setActiveWindow(undefined)} />
              ) : null}

              {!visit && isClassicWindow(activeWindow) ? (
                <ClassicWindow
                  busy={Boolean(busyKey)}
                  coins={farm.profile.coins}
                  crops={farm.catalog}
                  inventory={farm.inventory}
                  kind={activeWindow}
                  selectedCropId={selectedCropId}
                  selectedFertilizerId={selectedFertilizerId}
                  onBuy={(crop) =>
                    void act(
                      { type: "buy-seeds", cropId: crop.id, quantity: 1 },
                      `buy:${crop.id}`,
                      `购买了 1 包${crop.name}种子`
                    )
                  }
                  onClose={() => setActiveWindow(undefined)}
                  onBuyFertilizer={() =>
                    void act(
                      { type: "buy-fertilizer", quantity: 1 },
                      "buy:fertilizer",
                      "购买了 1 包普通化肥"
                    )
                  }
                  onSelectSeed={selectSeed}
                  onSelectFertilizer={selectFertilizer}
                  onSell={(crop) =>
                    void act(
                      { type: "sell", cropId: crop.id, quantity: crop.produce },
                      `sell:${crop.id}`,
                      `${crop.name}已全部出售`
                    )
                  }
                  onSellAll={() =>
                    void act(
                      { type: "sell-all" },
                      "sell-all",
                      "农场仓库中的作物已全部出售"
                    )
                  }
                />
              ) : null}

              {!visit && reclaimPlot && !reclaimPlot.unlocked ? (
                <ReclaimDialog
                  busy={Boolean(busyKey)}
                  coins={farm.profile.coins}
                  level={farm.profile.level}
                  plot={reclaimPlot}
                  onClose={() => setReclaimPlotId(undefined)}
                  onConfirm={() => {
                    void act(
                      { type: "reclaim-plot", plotId: reclaimPlot.id },
                      `reclaim:${reclaimPlot.id}`,
                      `第 ${reclaimPlot.id} 块土地已开垦`
                    ).then((succeeded) => {
                      if (succeeded) setReclaimPlotId(undefined);
                    });
                  }}
                />
              ) : null}

              {!visit && !farm.starterGift.claimed ? (
                <RewardDialog
                  busy={Boolean(busyKey)}
                  items={farm.starterGift.items}
                  message="欢迎加入怀旧庄园，原版新手礼包已经准备好了。"
                  title="新手礼包"
                  confirmLabel="领取礼包"
                  onConfirm={() => {
                    void act(
                      { type: "claim-starter-gift" },
                      "claim:starter-gift",
                      "新手礼包已放入种子包和化肥包"
                    );
                  }}
                />
              ) : !visit && farm.pendingLevelRewards.length > 0 ? (
                <RewardDialog
                  busy={Boolean(busyKey)}
                  items={farm.pendingLevelRewards.flatMap((reward) => reward.items)}
                  message={`已达到 ${farm.pendingLevelRewards.at(-1)?.displayLevel ?? farm.profile.level} 级，奖励已自动放入背包。`}
                  title="升级奖励"
                  confirmLabel="知道了"
                  onConfirm={() => {
                    void act(
                      { type: "acknowledge-level-rewards" },
                      "acknowledge:level-rewards",
                      "升级奖励已确认"
                    );
                  }}
                />
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PlayerHud({ farm, levelProgress }: { farm: ManorFarmView; levelProgress: number }) {
  const initial = farm.profile.displayName.trim().slice(0, 1) || "农";
  return (
    <div className="manor-player-hud">
      <span className="manor-player-hud__avatar" aria-hidden="true">{initial}</span>
      <strong className="manor-player-hud__name">{farm.profile.displayName}</strong>
      <span className="manor-player-hud__experience">
        <i style={{ width: `${levelProgress * 100}%` }} />
      </span>
      <span className="manor-player-hud__level" title={`等级 ${farm.profile.level}`}>
        {farm.profile.level}
      </span>
      <span className="manor-player-hud__coins">金币 {farm.profile.coins}</span>
      <span className="manor-player-hud__exp">经验 {farm.profile.experience}</span>
    </div>
  );
}

function FarmLand({
  plot,
  now,
  position,
  busy,
  inspected,
  onActivate
}: {
  plot: ManorPlotView;
  now: number;
  position: { left: number; top: number; zIndex: number };
  busy: boolean;
  inspected: boolean;
  onActivate: () => void;
}) {
  const progress = plotProgress(plot, now);
  const stage = cropStage(plot, progress);
  const remaining = plot.readyAt ? Math.max(0, plot.readyAt - now) : 0;
  const soil = !plot.unlocked
    ? "land-grass.png"
    : plot.status !== "empty" && !plot.watered
      ? "land-arid.png"
      : "land-soil.png";
  const style = {
    left: `${position.left}%`,
    top: `${position.top}%`,
    zIndex: position.zIndex
  } satisfies CSSProperties;

  return (
    <div
      className={`manor-land manor-land--${plot.status} ${!plot.unlocked ? "manor-land--locked" : ""} ${inspected ? "is-inspected" : ""}`}
      style={style}
    >
      <button
        className="manor-land__hit"
        type="button"
        disabled={busy}
        aria-label={`第 ${plot.id} 块土地，${plotSummary(plot, now)}`}
        onClick={onActivate}
      >
        <img className="manor-land__soil" src={`${ASSET_ROOT}/${soil}`} alt="" />
      </button>
      {!plot.unlocked ? (
        <img className="manor-land__reclaim" src={`${ASSET_ROOT}/reclaim.png`} alt="" />
      ) : null}
      {plot.cropId && plot.cropSourceId ? (
        <img
          className={`manor-land__crop manor-land__crop--${plot.cropId} manor-land__crop--stage-${stage}`}
          src={cropImage(plot.cropSourceId ?? 0, stage)}
          alt=""
        />
      ) : null}
      {Array.from({ length: plot.weedLevel }, (_, index) => (
        <img
          className="manor-land__weed"
          src={`${ASSET_ROOT}/weed.png`}
          alt=""
          key={`weed:${index}`}
          style={{ "--manor-nuisance-index": index } as CSSProperties}
        />
      ))}
      {Array.from({ length: plot.pestLevel }, (_, index) => (
        <img
          className="manor-land__pest"
          src={`${ASSET_ROOT}/insect.png`}
          alt=""
          key={`pest:${index}`}
          style={{ "--manor-nuisance-index": index } as CSSProperties}
        />
      ))}
      {plot.status === "mature" || remaining === 0 && plot.status === "growing" ? (
        <img className="manor-land__harvest" src={`${ASSET_ROOT}/can-harvest.png`} alt="可摘" />
      ) : null}
      <span className="manor-land__tip">
        <strong>{!plot.unlocked ? `第 ${plot.id} 块荒地` : plot.status === "empty" ? `第 ${plot.id} 块土地` : plot.cropName}</strong>
        <small>{plotDetail(plot, now)}</small>
      </span>
    </div>
  );
}

function ReclaimDialog({
  plot,
  level,
  coins,
  busy,
  onClose,
  onConfirm
}: {
  plot: ManorPlotView;
  level: number;
  coins: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const requiredLevel = plot.unlockLevel ?? 0;
  const requiredCoins = plot.unlockCost ?? 0;
  const levelReady = level >= requiredLevel;
  const coinsReady = coins >= requiredCoins;
  const canReclaim = plot.nextUnlock && levelReady && coinsReady;
  const direction = !plot.nextUnlock
    ? "需要按顺序开垦前面的土地"
    : !levelReady
      ? `达到 ${requiredLevel} 级后才能开垦`
      : !coinsReady
        ? `还缺 ${formatCoins(requiredCoins - coins)} 金币`
        : "条件已满足，可以开垦";

  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="manor-window manor-reclaim-window"
        role="dialog"
        aria-modal="true"
        aria-label={`开垦第 ${plot.id} 块土地`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <strong className="manor-window__title">扩建土地</strong>
        <button className="manor-window__close" type="button" aria-label="关闭" onClick={onClose} />
        <div className="manor-reclaim-window__body">
          <img src={`${ASSET_ROOT}/reclaim.png`} alt="" />
          <div className="manor-reclaim-window__copy">
            <strong>第 {plot.id} 块土地</strong>
            <span>需要等级 {requiredLevel}</span>
            <span>需要金币 {formatCoins(requiredCoins)}</span>
            <small className={canReclaim ? "is-ready" : ""}>{direction}</small>
          </div>
          <button type="button" disabled={busy || !canReclaim} onClick={onConfirm}>
            开垦
          </button>
        </div>
      </section>
    </div>
  );
}

function RewardDialog({
  title,
  message,
  items,
  confirmLabel,
  busy,
  onConfirm
}: {
  title: string;
  message: string;
  items: ManorRewardItemView[];
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="manor-window-layer manor-reward-layer" role="presentation">
      <section className="manor-window manor-reward-window" role="dialog" aria-modal="true" aria-label={title}>
        <strong className="manor-window__title">{title}</strong>
        <div className="manor-reward-window__body">
          <p>{message}</p>
          <div className="manor-reward-list">
            {items.map((item, index) => {
              const image = rewardItemImage(item);
              return (
                <div key={`${item.kind}:${item.sourceId}:${index}`}>
                  <span className="manor-item-image">
                    {image ? <img src={image} alt="" /> : <b aria-hidden="true">装</b>}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      ×{item.quantity}
                      {!item.available ? " · 已记入装扮权益，装扮功能开放后可用" : ""}
                    </small>
                  </span>
                </div>
              );
            })}
          </div>
          <button type="button" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function FarmDecorations({
  active
}: {
  active: Partial<Record<ManorDecorationType, ManorDecorationView>>;
}) {
  return (
    <div className="manor-decoration-scene" aria-hidden="true">
      {(["fence", "house", "doghouse"] as const).map((category) => {
        const decoration = active[category];
        if (!decoration) return null;
        const stageSized = category === "fence" && (decoration.width > 800 || decoration.height > 500);
        return (
          <img
            className={`manor-decoration-scene__${category} ${stageSized ? "is-stage-sized" : ""}`}
            key={decoration.sourceId}
            src={decoration.assetUrl}
            alt=""
          />
        );
      })}
    </div>
  );
}

function DecorationNavButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="manor-decoration-nav"
      type="button"
      title="装扮农场"
      aria-label="装扮农场"
      onClick={onClick}
    >
      <img src="/assets/manor/classic/pasture/ui/nav-decorate.png" alt="" />
    </button>
  );
}

function DecorationWindow({
  decorations,
  coins,
  now,
  busy,
  onBuy,
  onActivate,
  onDeactivate,
  onClose
}: {
  decorations: ManorDecorationView[];
  coins: number;
  now: number;
  busy: boolean;
  onBuy: (decoration: ManorDecorationView) => void;
  onActivate: (decoration: ManorDecorationView) => void;
  onDeactivate: (decoration: ManorDecorationView) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ManorDecorationType>("all");
  const [scope, setScope] = useState<"shop" | "owned">("shop");
  const visible = useMemo(() => {
    const keyword = query.trim();
    return decorations.filter((decoration) =>
      (category === "all" || decoration.category === category) &&
      (scope === "shop" || decoration.owned) &&
      (!keyword ||
        decoration.name.includes(keyword) ||
        decoration.setName.includes(keyword) ||
        String(decoration.sourceId) === keyword)
    );
  }, [category, decorations, query, scope]);

  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="manor-window manor-decoration-window"
        role="dialog"
        aria-modal="true"
        aria-label="装扮农场"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <strong className="manor-window__title">装扮农场</strong>
        <button className="manor-window__close" type="button" aria-label="关闭" onClick={onClose} />
        <div className="manor-decoration-window__body">
          <div className="manor-decoration-controls">
            <div className="manor-decoration-segments" role="group" aria-label="装扮范围">
              <button className={scope === "shop" ? "is-active" : ""} type="button" onClick={() => setScope("shop")}>装扮商店</button>
              <button className={scope === "owned" ? "is-active" : ""} type="button" onClick={() => setScope("owned")}>我的装扮</button>
            </div>
            <label>
              <Search size={15} aria-hidden="true" />
              <input value={query} placeholder="名称、套装或编号" onChange={(event) => setQuery(event.target.value)} />
              <span>{visible.length} 件</span>
            </label>
          </div>
          <div className="manor-decoration-categories" role="group" aria-label="装扮分类">
            {(["all", "background", "house", "fence", "doghouse"] as const).map((value) => (
              <button className={category === value ? "is-active" : ""} type="button" key={value} onClick={() => setCategory(value)}>
                {decorationCategoryLabel(value)}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="manor-window__empty">暂无符合条件的装扮</p>
          ) : (
            <div className="manor-decoration-list">
              {visible.map((decoration) => {
                const canBuy = decoration.purchasable && decoration.unlocked && coins >= decoration.coinPrice;
                const buttonLabel = decoration.active
                  ? "停用"
                  : decoration.owned
                    ? "启用"
                    : !decoration.purchasable
                      ? "历史活动"
                      : !decoration.unlocked
                        ? `${decoration.levelRequired}级解锁`
                        : coins < decoration.coinPrice
                          ? "金币不足"
                          : "购买";
                return (
                  <article className={`${decoration.active ? "is-active" : ""} ${!decoration.unlocked ? "is-locked" : ""}`} key={decoration.sourceId}>
                    <img src={decoration.thumbnailUrl} alt="" />
                    <span>
                      <strong>{decoration.name}</strong>
                      <small>{decoration.setName} · {decorationCategoryLabel(decoration.category)}</small>
                      <em>
                        {decoration.owned
                          ? decoration.validUntil
                            ? `剩余 ${formatDuration(decoration.validUntil - now)}`
                            : "永久拥有"
                          : decoration.purchasable
                            ? `${formatCoins(decoration.coinPrice)} 金币 · +${decoration.experience} 经验`
                            : "原活动赠品，仅保留素材"}
                      </em>
                    </span>
                    <button
                      type="button"
                      disabled={busy || (!decoration.owned && !canBuy)}
                      onClick={() => decoration.active
                        ? onDeactivate(decoration)
                        : decoration.owned
                          ? onActivate(decoration)
                          : onBuy(decoration)}
                    >
                      {buttonLabel}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function decorationCategoryLabel(category: "all" | ManorDecorationType): string {
  const labels = {
    all: "全部",
    background: "背景",
    house: "小屋",
    fence: "栅栏",
    doghouse: "狗窝"
  } as const;
  return labels[category];
}

function ManorFeatureButton({
  icon,
  label,
  onClick
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
}

function DogWindow({
  dog,
  coins,
  now,
  busy,
  onBuy,
  onActivate,
  onBuyFood,
  onClose
}: {
  dog: ManorFarmView["dog"];
  coins: number;
  now: number;
  busy: boolean;
  onBuy: (dogId: ManorFarmView["dog"]["catalog"][number]["id"]) => void;
  onActivate: (dogId: ManorFarmView["dog"]["catalog"][number]["id"]) => void;
  onBuyFood: (days: ManorFarmView["dog"]["foodOptions"][number]["days"]) => void;
  onClose: () => void;
}) {
  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section className="manor-feature-window" role="dialog" aria-modal="true" aria-label="看门狗" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <Dog size={21} aria-hidden="true" />
          <strong>看门狗</strong>
          <button className="manor-window__close" type="button" aria-label="关闭" onClick={onClose} />
        </header>
        <div className="manor-dog-list">
          {dog.catalog.map((item) => (
            <article className={item.active ? "is-active" : ""} key={item.id}>
              <img src={item.assetUrl} alt="" />
              <span>
                <strong>{item.name}</strong>
                <small>抓偷菜概率 {Math.round(item.catchChance * 100)}%</small>
                <em>{item.owned ? item.active ? "当前出战" : "已拥有" : `${item.price} 金币`}</em>
              </span>
              <button
                type="button"
                disabled={busy || item.active || (!item.owned && coins < item.price)}
                onClick={() => item.owned ? onActivate(item.id) : onBuy(item.id)}
              >
                {item.active ? "出战中" : item.owned ? "出战" : coins < item.price ? "金币不足" : "购买"}
              </button>
            </article>
          ))}
        </div>
        <footer className="manor-dog-food">
          <span>
            <strong>{dog.fed ? "狗粮充足" : "狗粮已用完"}</strong>
            <small>{dog.fed ? `可工作至 ${formatDateTime(dog.fedUntil)}` : "没有狗粮时不会抓偷菜者"}</small>
          </span>
          {dog.foodOptions.map((option) => (
            <button
              type="button"
              disabled={busy || dog.catalog.every((item) => !item.owned) || coins < option.coinPrice}
              key={option.days}
              onClick={() => onBuyFood(option.days)}
            >
              +{option.days} 天 · {option.coinPrice} 金币
            </button>
          ))}
          {dog.fedUntil > now ? <i style={{ width: `${Math.min(100, ((dog.fedUntil - now) / (7 * 86_400_000)) * 100)}%` }} /> : null}
        </footer>
      </section>
    </div>
  );
}

function FactoryWindow({
  factory,
  busy,
  onCraft,
  onClose
}: {
  factory: ManorFarmView["factory"];
  busy: boolean;
  onCraft: (quantity: number) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const maximum = Math.max(1, factory.craftable);
  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section className="manor-feature-window manor-feature-window--factory" role="dialog" aria-modal="true" aria-label="加工厂" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <Factory size={21} aria-hidden="true" />
          <strong>加工厂</strong>
          <button className="manor-window__close" type="button" aria-label="关闭" onClick={onClose} />
        </header>
        <div className="manor-factory-recipe">
          <span>
            <img src="/assets/manor/classic/legacy/manure.png" alt="" />
            <strong>便便 ×{factory.recipe.manure}</strong>
            <small>持有 {factory.available.manure}</small>
          </span>
          <b>+</b>
          <span>
            <img src={cropImage(41, 5)} alt="" />
            <strong>红玫瑰 ×{factory.recipe.redRoses}</strong>
            <small>持有 {factory.available.redRoses}</small>
          </span>
          <b>+</b>
          <span className="is-coins">
            <strong>{factory.recipe.coins} 金币</strong>
            <small>持有 {factory.available.coins}</small>
          </span>
          <b>=</b>
          <span>
            <img src={fertilizerImage("instant")} alt="" />
            <strong>极速化肥 ×1</strong>
            <small>立即完成当前阶段</small>
          </span>
        </div>
        <footer className="manor-factory-actions">
          <label>
            加工数量
            <input
              type="number"
              min={1}
              max={maximum}
              value={quantity}
              disabled={factory.craftable < 1}
              onChange={(event) => setQuantity(Math.max(1, Math.min(maximum, Number(event.target.value) || 1)))}
            />
          </label>
          <span>当前最多可加工 {factory.craftable} 包</span>
          <button type="button" disabled={busy || factory.craftable < 1} onClick={() => onCraft(quantity)}>
            开始加工
          </button>
        </footer>
      </section>
    </div>
  );
}

function ClassicButton({
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
      className={`manor-classic-button manor-classic-button--${asset} ${active ? "is-active" : ""}`}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <span aria-hidden="true" />
    </button>
  );
}

function ClassicWindow({
  kind,
  crops,
  coins,
  inventory,
  selectedCropId,
  selectedFertilizerId,
  busy,
  onClose,
  onBuyFertilizer,
  onSelectSeed,
  onSelectFertilizer,
  onBuy,
  onSell,
  onSellAll
}: {
  kind: ClassicManorWindow;
  crops: ManorCropView[];
  coins: number;
  inventory: ManorFarmView["inventory"];
  selectedCropId: ManorCropId;
  selectedFertilizerId: ManorFertilizerId;
  busy: boolean;
  onClose: () => void;
  onBuyFertilizer: () => void;
  onSelectSeed: (crop: ManorCropView) => void;
  onSelectFertilizer: (fertilizerId: ManorFertilizerId) => void;
  onBuy: (crop: ManorCropView) => void;
  onSell: (crop: ManorCropView) => void;
  onSellAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const title = kind === "seed-pack"
    ? "种子包"
    : kind === "fertilizer-pack"
      ? "化肥包"
      : kind === "shop"
        ? "农场商店"
        : "仓库";
  const visibleCrops = useMemo(() => {
    if (kind === "fertilizer-pack") return [];
    const available = crops.filter((crop) => {
      if (kind === "shop") return crop.purchasable;
      if (kind === "seed-pack") return crop.seeds > 0;
      return crop.produce > 0;
    });
    const keyword = query.trim();
    if (!keyword) return available;
    return available.filter((crop) => crop.name.includes(keyword) || String(crop.sourceId) === keyword);
  }, [crops, kind, query]);
  const ordinaryFertilizer = inventory.fertilizers.find((fertilizer) => fertilizer.id === "ordinary");
  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section
        className={`manor-window manor-window--${kind}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <strong className="manor-window__title">{title}</strong>
        <button className="manor-window__close" type="button" aria-label="关闭" onClick={onClose} />
        <div className="manor-window__body">
          {kind !== "fertilizer-pack" ? (
            <label className="manor-window__search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder="查找作物"
                aria-label="按名称或原始编号查找作物"
                onChange={(event) => setQuery(event.target.value)}
              />
              <span>{visibleCrops.length} 种</span>
            </label>
          ) : null}
          {kind !== "fertilizer-pack" && visibleCrops.length === 0 ? (
            <p className="manor-window__empty">暂无符合条件的作物</p>
          ) : null}
          {kind === "seed-pack" ? (
            <div className="manor-seed-pack">
              {visibleCrops.map((crop) => (
                <button
                  className={crop.id === selectedCropId ? "is-selected" : ""}
                  key={crop.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectSeed(crop)}
                >
                  <span className="manor-item-image">
                    <img src={cropImage(crop.sourceId, 0)} alt="" />
                  </span>
                  <strong>{crop.name}</strong>
                  <small>剩余 {crop.seeds} 包</small>
                </button>
              ))}
            </div>
          ) : null}

          {kind === "fertilizer-pack" ? (
            <div className="manor-fertilizer-pack">
              {inventory.fertilizers.map((fertilizer) => (
                <button
                  className={fertilizer.id === selectedFertilizerId ? "is-selected" : ""}
                  key={fertilizer.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectFertilizer(fertilizer.id)}
                >
                  <span className="manor-item-image">
                    <img src={fertilizerImage(fertilizer.id)} alt="" />
                  </span>
                  <strong>{fertilizer.name}</strong>
                  <small>提前 {formatDuration(fertilizer.effectSeconds * 1_000)}</small>
                  <em>剩余 {fertilizer.amount} 包</em>
                </button>
              ))}
            </div>
          ) : null}

          {kind === "shop" ? (
            <div className="manor-shop-content">
              {!query.trim() && ordinaryFertilizer ? (
                <div className="manor-shop-tool">
                  <span className="manor-item-image">
                    <img src={`${ASSET_ROOT}/fertilizer.png`} alt="" />
                  </span>
                  <span className="manor-item-copy">
                    <strong>普通化肥</strong>
                    <small>每个生长阶段限用 1 包 · 提前 {formatDuration(ordinaryFertilizer.effectSeconds * 1_000)}</small>
                    <em>持有 {ordinaryFertilizer.amount} 包 · 金币 {ordinaryFertilizer.coinPrice ?? 0}</em>
                  </span>
                  <button
                    type="button"
                    disabled={busy || coins < (ordinaryFertilizer.coinPrice ?? 0)}
                    onClick={onBuyFertilizer}
                  >
                    购买
                  </button>
                </div>
              ) : null}
              <div className="manor-shop-list">
                {visibleCrops.map((crop) => (
                  <div className={!crop.unlocked ? "is-locked" : ""} key={crop.id}>
                    <span className="manor-item-image">
                      <img src={cropImage(crop.sourceId, 5)} alt="" />
                    </span>
                    <span className="manor-item-copy">
                      <strong>{crop.name}</strong>
                      <small>
                        {crop.unlocked
                          ? `${formatDuration(crop.growthSeconds * 1_000)}成熟 · ${crop.harvestCycles} 季 · 每季约 ${crop.baseYield}`
                          : `${crop.levelRequired} 级解锁`}
                      </small>
                      <em>种子金币 {crop.seedPrice}</em>
                    </span>
                    <button type="button" disabled={!crop.unlocked || busy} onClick={() => onBuy(crop)}>
                      购买
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {kind === "warehouse" ? (
            <>
              <div className="manor-warehouse-summary">
                <span>共 {crops.reduce((total, crop) => total + crop.produce, 0)} 份作物 · 价值 {crops.reduce((total, crop) => total + crop.produce * crop.salePrice, 0)} 金币</span>
                <button type="button" disabled={busy || crops.every((crop) => crop.produce < 1)} onClick={onSellAll}>一键出售全部</button>
              </div>
              <div className="manor-warehouse-list">
                {visibleCrops.map((crop) => (
                <div className={crop.produce > 0 ? "has-stock" : ""} key={crop.id}>
                  <span className="manor-item-image">
                    <img src={cropImage(crop.sourceId, 5)} alt="" />
                  </span>
                  <span className="manor-item-copy">
                    <strong>{crop.name}</strong>
                    <small>库存 {crop.produce} · 单价金币 {crop.salePrice}</small>
                    <em>总价金币 {crop.produce * crop.salePrice}</em>
                  </span>
                  <button type="button" disabled={crop.produce < 1 || busy} onClick={() => onSell(crop)}>
                    全部出售
                  </button>
                </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function landPosition(index: number): { left: number; top: number; zIndex: number } {
  const row = Math.floor(index / 3);
  const column = index % 3;
  const x = 250.1 + row * 100.05 - column * 100.05;
  const y = 287 + row * 49.2 + column * 49.2;
  return { left: x / 10, top: y / 7.68, zIndex: 10 + Math.round(y) };
}

function cropImage(sourceId: number, stage: number): string {
  const stageNames = ["seed", "sprout", "young", "growing", "pre_mature", "mature", "withered"] as const;
  const stageName = stageNames[Math.max(0, Math.min(6, stage))] ?? "seed";
  return `${ASSET_ROOT}/crops/${sourceId}/${stageName}.png?v=${CROP_ASSET_VERSION}`;
}

function fertilizerImage(id: ManorFertilizerId): string {
  const fileName = id === "ordinary"
    ? "fertilizer.png"
    : id === "fast"
      ? "fertilizer-fast.png"
      : "fertilizer-instant.png";
  return `${ASSET_ROOT}/${fileName}`;
}

function rewardItemImage(item: ManorRewardItemView): string | undefined {
  if (item.kind === "seed") return cropImage(item.sourceId, 0);
  if (item.kind === "fertilizer") {
    const id: ManorFertilizerId = item.sourceId === 1
      ? "ordinary"
      : item.sourceId === 2
        ? "fast"
        : "instant";
    return fertilizerImage(id);
  }
  return `/assets/manor/classic/decorations/thumbnails/${item.sourceId}.jpg`;
}

function cropStage(plot: ManorPlotView, progress: number): number {
  if (plot.status === "withered") return 6;
  if (plot.status === "mature") return 5;
  const thresholds = plot.visualStageThresholds ?? [0.16, 0.32, 0.55, 0.78];
  const sproutThreshold = thresholds[0] ?? 0.16;
  const youngThreshold = thresholds[1] ?? 0.32;
  const growingThreshold = thresholds[2] ?? 0.55;
  const preMatureThreshold = thresholds[3] ?? 0.78;
  if (progress < sproutThreshold) return 0;
  if (progress < youngThreshold) return 1;
  if (progress < growingThreshold) return 2;
  if (progress < preMatureThreshold) return 3;
  return 4;
}

function toolAsset(tool: ManorTool): string {
  if (tool === "pest" || tool === "prank-pest") return "tool-pesticide";
  if (tool === "prank-weed") return "tool-weed";
  return `tool-${tool}`;
}

function isClassicWindow(window: ManorWindow | undefined): window is ClassicManorWindow {
  return window === "seed-pack" || window === "fertilizer-pack" || window === "shop" || window === "warehouse";
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(timestamp);
}

function plotProgress(plot: ManorPlotView, now: number): number {
  if (!plot.plantedAt || !plot.readyAt) return plot.progress;
  return Math.max(0, Math.min(1, (now - plot.plantedAt) / (plot.readyAt - plot.plantedAt)));
}

function plotSummary(plot: ManorPlotView, now: number): string {
  if (!plot.unlocked) return `荒地，需要等级 ${plot.unlockLevel ?? 0} 和 ${formatCoins(plot.unlockCost ?? 0)} 金币开垦`;
  if (plot.status === "empty") return "空地，可以播种";
  if (plot.status === "withered") return `${plot.cropName ?? "作物"}已经枯萎，请用锄头清理`;
  if (plot.status === "mature" || plot.readyAt && plot.readyAt <= now) {
    return `${plot.cropName ?? "作物"}已成熟，可以收获`;
  }
  return `${plot.cropName ?? "作物"}生长中，${plotDetail(plot, now)}`;
}

function plotDetail(plot: ManorPlotView, now: number): string {
  if (!plot.unlocked) {
    return plot.nextUnlock
      ? `${plot.unlockLevel ?? 0} 级 · ${formatCoins(plot.unlockCost ?? 0)} 金币`
      : "请先开垦前面的土地";
  }
  if (plot.status === "empty") return "请选择种子后播种";
  if (plot.status === "withered") return `已完成 ${plot.harvestCycles ?? 1} 季，请用锄头清理`;
  const cycle = `${(plot.harvestedCycles ?? 0) + 1}/${plot.harvestCycles ?? 1} 季`;
  if (plot.status === "mature" || plot.readyAt && plot.readyAt <= now) {
    return `${cycle} · 预计收获 ${plot.estimatedYield ?? 0}`;
  }
  const states = [
    cycle,
    plot.readyAt ? formatDuration(Math.max(0, plot.readyAt - now)) : "生长中",
    plot.watered ? "水分正常" : "缺水",
    plot.weed ? "有杂草" : "",
    plot.pest ? "有害虫" : "",
    plot.fertilizedStage === undefined ? "" : "已使用化肥"
  ].filter(Boolean);
  return states.join(" · ");
}

function progressBetween(value: number, start: number, end: number): number {
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (value - start) / (end - start)));
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function formatCoins(value: number): string {
  return Math.max(0, value).toLocaleString("zh-CN");
}
