import { Camera, FlaskConical, LoaderCircle, PawPrint, Sprout } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { getPlatformStatus } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { AppShell } from "../../platform/AppShell";
import {
  ManorRufflePlayer,
  type ManorRufflePlayerHandle,
  type ManorRuffleScene
} from "./ManorRufflePlayer";
import "./ruffle.css";

const ManorTestTools = lazy(async () => {
  const module = await import("./ManorTestTools");
  return { default: module.ManorTestTools };
});

export function ManorV7Page() {
  const { status: accountStatus } = useAccount();
  const playerRef = useRef<ManorRufflePlayerHandle>(null);
  const [scene, setScene] = useState<ManorRuffleScene>("farm");
  const [refreshToken, setRefreshToken] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [snapshotPending, setSnapshotPending] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<{ kind: "success" | "error"; message: string }>();
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

  const saveSnapshot = useCallback(async () => {
    if (!playerRef.current || snapshotPending) return;
    setSnapshotPending(true);
    setSnapshotNotice(undefined);
    try {
      const blob = await playerRef.current.capturePng();
      downloadBlob(blob, manorSnapshotFileName(scene));
      setSnapshotNotice({ kind: "success", message: "截图已保存到本地" });
    } catch (error) {
      setSnapshotNotice({ kind: "error", message: messageOf(error) });
    } finally {
      setSnapshotPending(false);
    }
  }, [scene, snapshotPending]);

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
          <button
            className="manor-snapshot-button"
            type="button"
            aria-label="保存当前场景截图"
            title="保存当前场景截图"
            disabled={!sceneReady || snapshotPending}
            onClick={() => void saveSnapshot()}
          >
            {snapshotPending ? <LoaderCircle className="is-spinning" size={18} /> : <Camera size={18} />}
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
        {snapshotNotice ? (
          <div className={`manor-snapshot-notice is-${snapshotNotice.kind}`} role="status">
            {snapshotNotice.message}
          </div>
        ) : null}
        <ManorRufflePlayer
          ref={playerRef}
          scene={scene}
          refreshToken={refreshToken}
          onReadyChange={setSceneReady}
        />
      </div>
    </AppShell>
  );
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function manorSnapshotFileName(scene: ManorRuffleScene, now = new Date()): string {
  const stamp = [
    now.getFullYear(),
    twoDigits(now.getMonth() + 1),
    twoDigits(now.getDate()),
    "-",
    twoDigits(now.getHours()),
    twoDigits(now.getMinutes()),
    twoDigits(now.getSeconds())
  ].join("");
  return `qq-${scene}-${stamp}.png`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "截图保存失败";
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
