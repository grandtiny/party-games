import { PawPrint, Sprout } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "../../platform/AppShell";
import { ManorRufflePlayer, type ManorRuffleScene } from "./ManorRufflePlayer";
import "./ruffle.css";

export function ManorV7Page() {
  const [scene, setScene] = useState<ManorRuffleScene>("farm");

  useEffect(() => installLegacyNavigationBridge(setScene), []);

  return (
    <AppShell scope="manor" title={`QQ${scene === "farm" ? "农场" : "牧场"} 7.0`} backTo="/">
      <div className="manor-flash-page">
        <div className="manor-scene-tabs" role="group" aria-label="农场与牧场">
          <button type="button" aria-pressed={scene === "farm"} onClick={() => setScene("farm")}>
            <Sprout size={17} />
            农场
          </button>
          <button type="button" aria-pressed={scene === "pasture"} onClick={() => setScene("pasture")}>
            <PawPrint size={17} />
            牧场
          </button>
        </div>
        <ManorRufflePlayer scene={scene} />
      </div>
    </AppShell>
  );
}

type LegacyManorWindow = Window & {
  C?: { util?: Record<string, unknown> };
  QZONE?: { FP?: Record<string, unknown> };
  switchToFarm?: () => void;
};

function installLegacyNavigationBridge(setScene: (scene: ManorRuffleScene) => void): () => void {
  const legacyWindow = window as LegacyManorWindow;
  const host = legacyWindow.C ?? {};
  const util = host.util ?? {};
  const qzone = legacyWindow.QZONE ?? {};
  const fp = qzone.FP ?? {};
  const previousToApp = util.toApp;
  const previousQzoneToApp = fp.toApp;
  const previousSwitchToFarm = legacyWindow.switchToFarm;
  let navigationTimer: number | undefined;
  const navigate = (scene: ManorRuffleScene) => {
    if (navigationTimer !== undefined) window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => {
      navigationTimer = undefined;
      setScene(scene);
    }, 0);
  };
  const toApp = (appId: unknown) => {
    if (Number(appId) === 353) navigate("farm");
    if (Number(appId) === 358) navigate("pasture");
  };
  const switchToFarm = () => navigate("farm");

  host.util = util;
  qzone.FP = fp;
  legacyWindow.C = host;
  legacyWindow.QZONE = qzone;
  util.toApp = toApp;
  fp.toApp = toApp;
  legacyWindow.switchToFarm = switchToFarm;

  return () => {
    if (navigationTimer !== undefined) window.clearTimeout(navigationTimer);
    if (util.toApp === toApp) {
      if (previousToApp === undefined) delete util.toApp;
      else util.toApp = previousToApp;
    }
    if (fp.toApp === toApp) {
      if (previousQzoneToApp === undefined) delete fp.toApp;
      else fp.toApp = previousQzoneToApp;
    }
    if (legacyWindow.switchToFarm === switchToFarm) {
      if (previousSwitchToFarm === undefined) delete legacyWindow.switchToFarm;
      else legacyWindow.switchToFarm = previousSwitchToFarm;
    }
  };
}
