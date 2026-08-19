import type {
  ManorActionRequest,
  ManorCropId,
  ManorCropView,
  ManorFarmView,
  ManorPlotView
} from "@party-games/shared";
import { RefreshCw, Search, Wheat } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getManorFarm, performManorAction } from "../../api";
import { AppShell } from "../../platform/AppShell";

const ASSET_ROOT = "/assets/manor/classic";
const CROP_ASSET_VERSION = "classic-crops-v3";

type ManorTool = "move" | "hoe" | "seed" | "fertilizer" | "water" | "weed" | "pest" | "harvest";
type ManorWindow = "seed-pack" | "shop" | "warehouse";

const TOOLS: ReadonlyArray<{ id: ManorTool; label: string; shortcut?: string }> = [
  { id: "move", label: "移动画面" },
  { id: "hoe", label: "翻地" },
  { id: "seed", label: "种子包" },
  { id: "fertilizer", label: "普通化肥", shortcut: "F" },
  { id: "water", label: "浇水", shortcut: "Q" },
  { id: "weed", label: "除草", shortcut: "W" },
  { id: "pest", label: "除虫", shortcut: "E" },
  { id: "harvest", label: "收获", shortcut: "R" }
];

export function ManorPage() {
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const windowScrollLeftRef = useRef<number | undefined>(undefined);
  const [farm, setFarm] = useState<ManorFarmView>();
  const [selectedCropId, setSelectedCropId] = useState<ManorCropId>("radish");
  const [selectedTool, setSelectedTool] = useState<ManorTool>("move");
  const [activeWindow, setActiveWindow] = useState<ManorWindow>();
  const [inspectedPlotId, setInspectedPlotId] = useState<number>();
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [clock, setClock] = useState(Date.now());
  const [busyKey, setBusyKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const acceptFarm = useCallback((next: ManorFarmView) => {
    setFarm(next);
    setLoadedAt(Date.now());
    setError(undefined);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setBusyKey("refresh");
    try {
      acceptFarm(await getManorFarm());
    } catch (requestError) {
      if (!silent) {
        setError(requestError instanceof Error ? requestError.message : "庄园读取失败");
      }
    } finally {
      if (!silent) setBusyKey(undefined);
    }
  }, [acceptFarm]);

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

    if (activeWindow) {
      windowScrollLeftRef.current ??= viewport.scrollLeft;
      viewport.scrollLeft = Math.round((viewport.scrollWidth - viewport.clientWidth) / 2);
      return;
    }

    if (windowScrollLeftRef.current !== undefined) {
      viewport.scrollLeft = windowScrollLeftRef.current;
      windowScrollLeftRef.current = undefined;
    }
  }, [activeWindow]);

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const keyTools: Partial<Record<string, ManorTool>> = {
        q: "water",
        w: "weed",
        e: "pest",
        f: "fertilizer",
        r: "harvest"
      };
      const nextTool = keyTools[event.key.toLowerCase()];
      if (nextTool) setSelectedTool(nextTool);
      if (event.key === "Escape") setActiveWindow(undefined);
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

  const serverNow = farm ? farm.serverTime + (clock - loadedAt) : clock;
  const selectedCrop = useMemo(
    () => farm?.catalog.find((crop) => crop.id === selectedCropId),
    [farm, selectedCropId]
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
    if (tool === "fertilizer" && farm?.inventory.fertilizer === 0) {
      setNotice("普通化肥不足，请先到商店购买");
      setActiveWindow("shop");
      return;
    }
    setSelectedTool(tool);
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
        if (plot.status === "empty" || plot.status === "withered") {
          setNotice(plot.status === "empty" ? "空地不能施肥" : "作物已经枯萎，请用锄头清理");
          return;
        }
        if (plot.status === "mature" || plot.readyAt && plot.readyAt <= serverNow) {
          setNotice("成熟作物不需要施肥");
          return;
        }
        await act(
          { type: "fertilize", plotId: plot.id },
          `fertilize:${plot.id}`,
          (next) => {
            const nextPlot = next.plots.find((candidate) => candidate.id === plot.id);
            const reduced = Math.max(0, (plot.readyAt ?? 0) - (nextPlot?.readyAt ?? 0));
            return `施肥完成，成熟时间提前 ${formatDuration(reduced)}`;
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

  const backgroundImage = farm.art.backgroundUrl
    ? `url("${farm.art.backgroundUrl}")`
    : `url("${ASSET_ROOT}/farm-background.png")`;

  return (
    <AppShell
      scope="manor"
      title="怀旧庄园"
      backTo="/"
      actions={
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
      }
    >
      <div className="manor-page">
        <div className="manor-stage-viewport" ref={stageViewportRef}>
          <div className="manor-stage-shell">
            <section
              className={`manor-stage manor-stage--tool-${selectedTool}`}
              style={{ backgroundImage }}
              aria-label="QQ 农场经典场景"
            >
              <div className="manor-head-bg" aria-hidden="true" />
              <PlayerHud farm={farm} levelProgress={levelProgress} />
              <img className="manor-weather" src={`${ASSET_ROOT}/sunny.png`} alt="晴天" />

              <nav className="manor-head-tools" aria-label="庄园功能">
                <ClassicButton asset="nav-farm" label="我的农场" active />
                <ClassicButton
                  asset="nav-pasture"
                  label="我的牧场"
                  onClick={() => setNotice("牧场入口已保留，牧场玩法正在按原版重构")}
                />
                <ClassicButton
                  asset="nav-warehouse"
                  label="仓库"
                  onClick={() => setActiveWindow("warehouse")}
                />
                <ClassicButton
                  asset="nav-shop"
                  label="农场商店"
                  onClick={() => setActiveWindow("shop")}
                />
              </nav>

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

              <div className="manor-toolbar" role="toolbar" aria-label="农场工具">
                {TOOLS.map((tool) => (
                  <ClassicButton
                    active={selectedTool === tool.id}
                    asset={`tool-${tool.id === "pest" ? "pesticide" : tool.id}`}
                    key={tool.id}
                    label={`${tool.label}${tool.id === "fertilizer" ? ` ×${farm.inventory.fertilizer}` : ""}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
                    onClick={() => selectTool(tool.id)}
                  />
                ))}
              </div>

              {activeWindow ? (
                <ClassicWindow
                  busy={Boolean(busyKey)}
                  coins={farm.profile.coins}
                  crops={farm.catalog}
                  fertilizer={farm.inventory}
                  kind={activeWindow}
                  selectedCropId={selectedCropId}
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
                  onSell={(crop) =>
                    void act(
                      { type: "sell", cropId: crop.id, quantity: crop.produce },
                      `sell:${crop.id}`,
                      `${crop.name}已全部出售`
                    )
                  }
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
  const soil = plot.status !== "empty" && !plot.watered ? "land-arid.png" : "land-soil.png";
  const style = {
    left: `${position.left}%`,
    top: `${position.top}%`,
    zIndex: position.zIndex
  } satisfies CSSProperties;

  return (
    <div
      className={`manor-land manor-land--${plot.status} ${inspected ? "is-inspected" : ""}`}
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
      {plot.cropId && plot.cropSourceId ? (
        <img
          className={`manor-land__crop manor-land__crop--${plot.cropId} manor-land__crop--stage-${stage}`}
          src={cropImage(plot.cropSourceId ?? 0, stage)}
          alt=""
        />
      ) : null}
      {plot.weed ? <img className="manor-land__weed" src={`${ASSET_ROOT}/weed.png`} alt="" /> : null}
      {plot.pest ? <img className="manor-land__pest" src={`${ASSET_ROOT}/insect.png`} alt="" /> : null}
      {plot.status === "mature" || remaining === 0 && plot.status === "growing" ? (
        <img className="manor-land__harvest" src={`${ASSET_ROOT}/can-harvest.png`} alt="可摘" />
      ) : null}
      <span className="manor-land__tip">
        <strong>{plot.status === "empty" ? `第 ${plot.id} 块土地` : plot.cropName}</strong>
        <small>{plotDetail(plot, now)}</small>
      </span>
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
  fertilizer,
  selectedCropId,
  busy,
  onClose,
  onBuyFertilizer,
  onSelectSeed,
  onBuy,
  onSell
}: {
  kind: ManorWindow;
  crops: ManorCropView[];
  coins: number;
  fertilizer: ManorFarmView["inventory"];
  selectedCropId: ManorCropId;
  busy: boolean;
  onClose: () => void;
  onBuyFertilizer: () => void;
  onSelectSeed: (crop: ManorCropView) => void;
  onBuy: (crop: ManorCropView) => void;
  onSell: (crop: ManorCropView) => void;
}) {
  const [query, setQuery] = useState("");
  const title = kind === "seed-pack" ? "种子包" : kind === "shop" ? "农场商店" : "仓库";
  const visibleCrops = useMemo(() => {
    const available = crops.filter((crop) => {
      if (kind === "shop") return crop.purchasable;
      if (kind === "seed-pack") return crop.seeds > 0;
      return crop.produce > 0;
    });
    const keyword = query.trim();
    if (!keyword) return available;
    return available.filter((crop) => crop.name.includes(keyword) || String(crop.sourceId) === keyword);
  }, [crops, kind, query]);
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
          {visibleCrops.length === 0 ? <p className="manor-window__empty">暂无符合条件的作物</p> : null}
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

          {kind === "shop" ? (
            <div className="manor-shop-content">
              {!query.trim() ? (
                <div className="manor-shop-tool">
                  <span className="manor-item-image">
                    <img src={`${ASSET_ROOT}/fertilizer.png`} alt="" />
                  </span>
                  <span className="manor-item-copy">
                    <strong>普通化肥</strong>
                    <small>每个生长阶段限用 1 包 · 提前 {formatDuration(fertilizer.fertilizerEffectSeconds * 1_000)}</small>
                    <em>持有 {fertilizer.fertilizer} 包 · 金币 {fertilizer.fertilizerPrice}</em>
                  </span>
                  <button
                    type="button"
                    disabled={busy || coins < fertilizer.fertilizerPrice}
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
                      <img src={cropImage(crop.sourceId, 3)} alt="" />
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
            <div className="manor-warehouse-list">
              {visibleCrops.map((crop) => (
                <div className={crop.produce > 0 ? "has-stock" : ""} key={crop.id}>
                  <span className="manor-item-image">
                    <img src={cropImage(crop.sourceId, 3)} alt="" />
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
  const stageNames = ["seed", "sprout", "growing", "mature", "withered"] as const;
  const stageName = stageNames[Math.max(0, Math.min(4, stage))] ?? "seed";
  return `${ASSET_ROOT}/crops/${sourceId}/${stageName}.png?v=${CROP_ASSET_VERSION}`;
}

function cropStage(plot: ManorPlotView, progress: number): number {
  if (plot.status === "withered") return 4;
  if (plot.status === "mature") return 3;
  const [sproutThreshold, growingThreshold] = plot.visualStageThresholds ?? [0.22, 0.55];
  if (progress < sproutThreshold) return 0;
  if (progress < growingThreshold) return 1;
  return 2;
}

function plotProgress(plot: ManorPlotView, now: number): number {
  if (!plot.plantedAt || !plot.readyAt) return plot.progress;
  return Math.max(0, Math.min(1, (now - plot.plantedAt) / (plot.readyAt - plot.plantedAt)));
}

function plotSummary(plot: ManorPlotView, now: number): string {
  if (plot.status === "empty") return "空地，可以播种";
  if (plot.status === "withered") return `${plot.cropName ?? "作物"}已经枯萎，请用锄头清理`;
  if (plot.status === "mature" || plot.readyAt && plot.readyAt <= now) {
    return `${plot.cropName ?? "作物"}已成熟，可以收获`;
  }
  return `${plot.cropName ?? "作物"}生长中，${plotDetail(plot, now)}`;
}

function plotDetail(plot: ManorPlotView, now: number): string {
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
    plot.fertilizedStage === undefined ? "" : "已使用普通化肥"
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
