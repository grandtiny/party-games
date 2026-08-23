import { FlaskConical, PawPrint, Sprout } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { getPlatformStatus } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { AppShell } from "../../platform/AppShell";
import { ManorRufflePlayer, type ManorRuffleScene } from "./ManorRufflePlayer";
import "./ruffle.css";

const ManorTestTools = lazy(async () => {
  const module = await import("./ManorTestTools");
  return { default: module.ManorTestTools };
});

export function ManorV7Page() {
  const { status: accountStatus } = useAccount();
  const [scene, setScene] = useState<ManorRuffleScene>("farm");
  const [refreshToken, setRefreshToken] = useState(0);
  const [testToolsAvailable, setTestToolsAvailable] = useState(false);
  const [testToolsOpen, setTestToolsOpen] = useState(false);
  const canUseTestTools = testToolsAvailable && accountStatus?.user?.role === "owner";

  useEffect(() => installLegacyNavigationBridge(setScene), []);
  useEffect(() => {
    let active = true;
    void getPlatformStatus()
      .then((status) => {
        if (active) setTestToolsAvailable(status.manorTestToolsEnabled);
      })
      .catch(() => {
        if (active) setTestToolsAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell scope="manor" title={`QQ${scene === "farm" ? "农场" : "牧场"} 7.0`} backTo="/">
      <div className="manor-flash-page">
        <div className="manor-scene-tabs" role="group" aria-label="农牧场场景">
          <button type="button" aria-pressed={scene === "farm"} onClick={() => setScene("farm")}>
            <Sprout size={17} />
            农场
          </button>
          <button type="button" aria-pressed={scene === "pasture"} onClick={() => setScene("pasture")}>
            <PawPrint size={17} />
            牧场
          </button>
          {canUseTestTools ? (
            <button
              className="manor-test-toggle"
              type="button"
              aria-expanded={testToolsOpen}
              onClick={() => setTestToolsOpen((value) => !value)}
            >
              <FlaskConical size={17} />
              测试
            </button>
          ) : null}
        </div>
        {canUseTestTools && testToolsOpen ? (
          <Suspense fallback={null}>
            <ManorTestTools
              onClose={() => setTestToolsOpen(false)}
              onMutated={() => setRefreshToken((value) => value + 1)}
            />
          </Suspense>
        ) : null}
        <ManorRufflePlayer scene={scene} refreshToken={refreshToken} />
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
