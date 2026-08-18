import type {
  ManorActionRequest,
  ManorCropId,
  ManorCropView,
  ManorFarmView,
  ManorPlotView
} from "@party-games/shared";
import {
  Bug,
  Coins,
  Droplets,
  Leaf,
  LockKeyhole,
  PackageOpen,
  RefreshCw,
  ShoppingBasket,
  Sprout,
  Store,
  Wheat
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getManorFarm, performManorAction } from "../../api";
import { AppShell } from "../../platform/AppShell";

export function ManorPage() {
  const [farm, setFarm] = useState<ManorFarmView>();
  const [selectedCropId, setSelectedCropId] = useState<ManorCropId>("radish");
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [clock, setClock] = useState(Date.now());
  const [busyKey, setBusyKey] = useState<string>();
  const [error, setError] = useState<string>();

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

  const act = useCallback(
    async (action: ManorActionRequest, key: string) => {
      if (busyKey) return;
      setBusyKey(key);
      setError(undefined);
      try {
        acceptFarm(await performManorAction(action));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "操作失败");
      } finally {
        setBusyKey(undefined);
      }
    },
    [acceptFarm, busyKey]
  );

  const serverNow = farm ? farm.serverTime + (clock - loadedAt) : clock;
  const selectedCrop = farm?.catalog.find((crop) => crop.id === selectedCropId);
  const levelProgress = farm
    ? progressBetween(
        farm.profile.experience,
        farm.profile.currentLevelExperience,
        farm.profile.nextLevelExperience
      )
    : 0;

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
        <header className="manor-profile">
          <div className="manor-profile__identity">
            <span className="manor-avatar" aria-hidden="true">
              <Wheat size={25} />
            </span>
            <span>
              <strong>{farm.profile.displayName}的庄园</strong>
              <small>等级 {farm.profile.level}</small>
            </span>
          </div>
          <div className="manor-profile__resources">
            <span>
              <Coins size={17} />
              <strong>{farm.profile.coins}</strong>
              金币
            </span>
            <span className="manor-experience">
              <small>经验 {farm.profile.experience}</small>
              <i aria-label={`升级进度 ${Math.round(levelProgress * 100)}%`}>
                <b style={{ width: `${levelProgress * 100}%` }} />
              </i>
            </span>
          </div>
        </header>

        <div className="manor-tabs" role="tablist" aria-label="庄园区域">
          <button className="is-active" type="button" role="tab" aria-selected="true">
            <Sprout size={17} />
            农场
          </button>
          <button type="button" role="tab" aria-selected="false" disabled>
            <LockKeyhole size={16} />
            牧场
          </button>
        </div>

        {error ? <div className="manor-alert">{error}</div> : null}

        <section
          className={`manor-scene ${farm.art.source === "legacy" ? "has-legacy-art" : ""}`}
          style={
            farm.art.backgroundUrl
              ? { backgroundImage: `url(${JSON.stringify(farm.art.backgroundUrl).slice(1, -1)})` }
              : undefined
          }
          aria-label="农田"
        >
          <div className="manor-scene__sky" aria-hidden="true">
            <span className="manor-sun" />
            <span className="manor-hills" />
          </div>
          <div className="manor-field">
            {farm.plots.map((plot) => (
              <FarmPlot
                busy={Boolean(busyKey)}
                key={plot.id}
                now={serverNow}
                plot={plot}
                selectedCrop={selectedCrop}
                onAction={act}
              />
            ))}
          </div>
          <span className="manor-art-source">
            {farm.art.source === "legacy" ? "怀旧资源" : "内置场景"}
          </span>
        </section>

        <section className="manor-seed-rack" aria-labelledby="manor-seeds-title">
          <div className="manor-section-heading">
            <span>
              <Store size={20} />
              <strong id="manor-seeds-title">种子商店</strong>
            </span>
            <small>当前选择：{selectedCrop?.name ?? "无"}</small>
          </div>
          <div className="manor-crop-grid">
            {farm.catalog.map((crop) => (
              <SeedItem
                busy={Boolean(busyKey)}
                crop={crop}
                key={crop.id}
                selected={crop.id === selectedCropId}
                onSelect={() => setSelectedCropId(crop.id)}
                onBuy={() =>
                  void act(
                    { type: "buy-seeds", cropId: crop.id, quantity: 1 },
                    `buy:${crop.id}`
                  )
                }
              />
            ))}
          </div>
        </section>

        <section className="manor-warehouse" aria-labelledby="manor-warehouse-title">
          <div className="manor-section-heading">
            <span>
              <PackageOpen size={20} />
              <strong id="manor-warehouse-title">仓库</strong>
            </span>
            <small>收获物可以换成金币</small>
          </div>
          <div className="manor-stock-list">
            {farm.catalog.map((crop) => (
              <div className={crop.produce > 0 ? "has-stock" : ""} key={crop.id}>
                <span className={`manor-crop-mark manor-crop-mark--${crop.id}`} aria-hidden="true">
                  {crop.emoji}
                </span>
                <span>
                  <strong>{crop.name}</strong>
                  <small>库存 {crop.produce} · 单价 {crop.salePrice}</small>
                </span>
                <button
                  type="button"
                  disabled={crop.produce < 1 || Boolean(busyKey)}
                  onClick={() =>
                    void act(
                      { type: "sell", cropId: crop.id, quantity: crop.produce },
                      `sell:${crop.id}`
                    )
                  }
                >
                  <Coins size={16} />
                  全部出售
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function FarmPlot({
  plot,
  selectedCrop,
  now,
  busy,
  onAction
}: {
  plot: ManorPlotView;
  selectedCrop: ManorCropView | undefined;
  now: number;
  busy: boolean;
  onAction: (action: ManorActionRequest, key: string) => Promise<void>;
}) {
  const progress = useMemo(() => plotProgress(plot, now), [now, plot]);
  const remaining = plot.readyAt ? Math.max(0, plot.readyAt - now) : 0;
  const isMature = plot.status === "mature" || remaining === 0 && plot.status !== "empty";

  return (
    <article className={`manor-plot manor-plot--${plot.status} ${isMature ? "is-mature" : ""}`}>
      <span className="manor-plot__number">{plot.id}</span>
      {plot.status === "empty" ? (
        <button
          className="manor-plot__plant"
          type="button"
          disabled={!selectedCrop?.unlocked || !selectedCrop.seeds || busy}
          title={selectedCrop ? `种植${selectedCrop.name}` : "选择种子"}
          onClick={() => {
            if (!selectedCrop) return;
            void onAction(
              { type: "plant", plotId: plot.id, cropId: selectedCrop.id },
              `plant:${plot.id}`
            );
          }}
        >
          <Sprout size={26} />
          <span>{selectedCrop?.seeds ? `种${selectedCrop.name}` : "空地"}</span>
        </button>
      ) : (
        <>
          <div className={`manor-plant manor-plant--${plot.cropId}`} aria-hidden="true">
            <span>{plot.cropEmoji}</span>
            <i />
          </div>
          <div className="manor-plot__status">
            <strong>{plot.cropName}</strong>
            <small>{isMature ? `可收获 ${plot.estimatedYield}` : formatDuration(remaining)}</small>
          </div>
          <div className="manor-plot__progress" aria-label={`成长进度 ${Math.round(progress * 100)}%`}>
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="manor-plot__actions">
            {isMature ? (
              <button
                className="is-harvest"
                type="button"
                disabled={busy}
                title="收获"
                onClick={() => void onAction({ type: "harvest", plotId: plot.id }, `harvest:${plot.id}`)}
              >
                <ShoppingBasket size={17} />
                收获
              </button>
            ) : null}
            {!plot.watered ? (
              <button
                type="button"
                disabled={busy}
                title="浇水"
                aria-label="浇水"
                onClick={() => void onAction({ type: "water", plotId: plot.id }, `water:${plot.id}`)}
              >
                <Droplets size={17} />
              </button>
            ) : null}
            {plot.weed ? (
              <button
                className="has-problem"
                type="button"
                disabled={busy}
                title="除草"
                aria-label="除草"
                onClick={() =>
                  void onAction({ type: "clear-weed", plotId: plot.id }, `weed:${plot.id}`)
                }
              >
                <Leaf size={17} />
              </button>
            ) : null}
            {plot.pest ? (
              <button
                className="has-problem"
                type="button"
                disabled={busy}
                title="除虫"
                aria-label="除虫"
                onClick={() =>
                  void onAction({ type: "clear-pest", plotId: plot.id }, `pest:${plot.id}`)
                }
              >
                <Bug size={17} />
              </button>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

function SeedItem({
  crop,
  selected,
  busy,
  onSelect,
  onBuy
}: {
  crop: ManorCropView;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onBuy: () => void;
}) {
  return (
    <article className={`manor-seed ${selected ? "is-selected" : ""} ${!crop.unlocked ? "is-locked" : ""}`}>
      <button
        className="manor-seed__select"
        type="button"
        disabled={!crop.unlocked}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className={`manor-crop-mark manor-crop-mark--${crop.id}`} aria-hidden="true">
          {crop.unlocked ? crop.emoji : <LockKeyhole size={18} />}
        </span>
        <span>
          <strong>{crop.name}</strong>
          <small>
            {crop.unlocked
              ? `${formatDuration(crop.growthSeconds * 1_000)} · 预计 ${crop.baseYield}`
              : `${crop.levelRequired} 级解锁`}
          </small>
        </span>
      </button>
      <span className="manor-seed__count">种子 {crop.seeds}</span>
      <button
        className="manor-seed__buy"
        type="button"
        disabled={!crop.unlocked || busy}
        onClick={onBuy}
      >
        <Coins size={15} />
        {crop.seedPrice}
      </button>
    </article>
  );
}

function plotProgress(plot: ManorPlotView, now: number): number {
  if (!plot.plantedAt || !plot.readyAt) return plot.progress;
  return Math.max(0, Math.min(1, (now - plot.plantedAt) / (plot.readyAt - plot.plantedAt)));
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
