import { RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const RUFFLE_SCRIPT = "/vendor/ruffle/ruffle.js";
const MODULE_ROOT = "/module";

type RufflePlayerElement = HTMLElement & {
  ruffle(): {
    load(options: Record<string, unknown>): Promise<void>;
  };
};

interface RuffleRuntime {
  createPlayer(): RufflePlayerElement;
}

declare global {
  interface Window {
    RufflePlayer?: {
      config?: Record<string, unknown>;
      newest(): RuffleRuntime;
    };
  }
}

let ruffleScriptPromise: Promise<void> | undefined;

export type ManorRuffleScene = "farm" | "pasture";

export function ManorRufflePlayer({
  scene,
  refreshToken = 0
}: {
  scene: ManorRuffleScene;
  refreshToken?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RufflePlayerElement | undefined>(undefined);
  const loadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      const player = playerRef.current;
      playerRef.current = undefined;
      window.setTimeout(() => player?.remove(), 0);
    };
  }, []);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setError(undefined);

    const loadScene = async () => {
      await delay(150);
      if (!mountedRef.current || generationRef.current !== generation) return;
      await loadRuffleScript();
      await nextTask();
      if (!mountedRef.current || generationRef.current !== generation || !hostRef.current || !window.RufflePlayer) return;

      let player = playerRef.current;
      if (!player) {
        player = window.RufflePlayer.newest().createPlayer();
        playerRef.current = player;
        player.id = "manor-v7-flash-player";
        hostRef.current.replaceChildren(player);
      }
      player.setAttribute("aria-label", `QQ${scene === "farm" ? "农场" : "牧场"} 7.0 游戏场景`);
      delete player.dataset.ruffleLoaded;

      await player.ruffle().load({
        url: scene === "farm" ? `${MODULE_ROOT}/happyfarm3_v_101.swf` : `${MODULE_ROOT}/mcloader_v_28.swf`,
        parameters: scene === "farm" ? farmParameters() : pastureParameters(),
        autoplay: "on",
        unmuteOverlay: "hidden",
        allowScriptAccess: true,
        backgroundColor: "#ffffff",
        letterbox: "on",
        scale: "showAll",
        deviceFontRenderer: "canvas"
      });
      if (mountedRef.current && generationRef.current === generation) {
        player.dataset.ruffleLoaded = "true";
      }
    };

    const queuedLoad = loadQueueRef.current.catch(() => undefined).then(loadScene);
    loadQueueRef.current = queuedLoad.catch(() => undefined);
    void queuedLoad.catch((caught) => {
      if (mountedRef.current && generationRef.current === generation) setError(messageOf(caught));
    });
  }, [refreshToken, reloadToken, scene]);

  return (
    <div className="manor-flash-stage">
      <div className="manor-flash-player" ref={hostRef} />
      {error ? (
        <div className="manor-flash-error" role="alert">
          <strong>{scene === "farm" ? "农场" : "牧场"}场景加载失败</strong>
          <span>{error}</span>
          <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
            <RotateCw size={17} />
            重试
          </button>
        </div>
      ) : null}
    </div>
  );
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function farmParameters(): Record<string, string> {
  return {
    hmv2level: "0",
    hmv2CloseTime: "1261929600",
    config_url: "/api/manor/flash/config/load_main_v_20120209.xml",
    config_data: "/api/manor/flash/config/data_zh_CN_v_20120209.xml",
    config_addon: "/api/manor/flash/config/addon_v_20120209.xml",
    loadingUrl: `${MODULE_ROOT}/loading2_v_3.swf`,
    mode: "1",
    pageDomain: window.location.hostname,
    useflag: "11111111",
    usercheck: "party-games-account",
    app_status_bitmap: "000000000000000f",
    app_request_num: "0"
  };
}

function pastureParameters(): Record<string, string> {
  return {
    config_url_qz: "/api/manor/flash/config/mcini_main_v_20120209.xml",
    config_url_xy: "/api/manor/flash/config/mcini_main_v_20120209.xml",
    cardConfig_url_qz: "/api/manor/flash/config/mccard_zh_CN_v_20120209.xml",
    cardConfig_url_xy: "/api/manor/flash/config/mccard_zh_CN_v_20120209.xml",
    animalConfig_url_qz: "/api/manor/flash/config/mcdata_zh_CN_v_20120209.xml",
    animalConfig_url_xy: "/api/manor/flash/config/mcdata_zh_CN_v_20120209.xml",
    loadingUrl: `${MODULE_ROOT}/loading2_v_3.swf`,
    mode: "1",
    pageDomain: window.location.hostname,
    pasture_friend_list_mod_qz: "1000",
    pasture_friend_list_mod_xy: "1000",
    pasture_friend_list_qz: "1001-1002",
    pasture_friend_list_xy: "1001-1002",
    pasture_enter: "1000",
    pasture_enter_mod: "1000",
    pasture_steal: "1000",
    pasture_steal_mod: "1000",
    useflag: "11111111",
    usercheck: "party-games-account",
    app_status_bitmap: "000000000000000f",
    app_request_num: "0"
  };
}

function loadRuffleScript(): Promise<void> {
  if (window.RufflePlayer?.newest) return Promise.resolve();
  if (ruffleScriptPromise) return ruffleScriptPromise;

  const bootstrap = window.RufflePlayer ?? ({} as NonNullable<Window["RufflePlayer"]>);
  window.RufflePlayer = bootstrap;
  bootstrap.config = {
    autoplay: "on",
    unmuteOverlay: "hidden",
    allowScriptAccess: true,
    splashScreen: false,
    warnOnUnsupportedContent: false,
    logLevel: "error"
  };

  ruffleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RUFFLE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Ruffle 运行时加载失败")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = RUFFLE_SCRIPT;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Ruffle 运行时加载失败")), { once: true });
    document.head.appendChild(script);
  });
  return ruffleScriptPromise;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
