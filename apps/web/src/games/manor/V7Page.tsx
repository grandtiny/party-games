import type { ManorTestResource } from "@party-games/shared";
import { FastForward, FlaskConical, Gift, PawPrint, Sprout, X } from "lucide-react";
import { useEffect, useState } from "react";
import { advanceManorTestTime, grantManorTestResource } from "../../api";
import { useAccount } from "../../platform/AccountContext";
import { AppShell } from "../../platform/AppShell";
import { ManorRufflePlayer, type ManorRuffleScene } from "./ManorRufflePlayer";
import "./ruffle.css";

export function ManorV7Page() {
  const { status: accountStatus } = useAccount();
  const [scene, setScene] = useState<ManorRuffleScene>("farm");
  const [refreshToken, setRefreshToken] = useState(0);
  const [testToolsOpen, setTestToolsOpen] = useState(false);
  const [resource, setResource] = useState<ManorTestResource>("coins");
  const [amount, setAmount] = useState(100_000);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const isOwner = accountStatus?.user?.role === "owner";

  useEffect(() => installLegacyNavigationBridge(setScene), []);

  const runTestMutation = async (mutation: () => Promise<{ message: string }>) => {
    setBusy(true);
    setNotice(undefined);
    try {
      const result = await mutation();
      setNotice(result.message);
      setRefreshToken((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "测试操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell scope="manor" title={`QQ${scene === "farm" ? "农场" : "牧场"} 7.0`} backTo="/">
      <div className="manor-flash-page">
        <div className="manor-scene-tabs" role="group" aria-label="农牧场与测试工具">
          <button type="button" aria-pressed={scene === "farm"} onClick={() => setScene("farm")}>
            <Sprout size={17} />
            农场
          </button>
          <button type="button" aria-pressed={scene === "pasture"} onClick={() => setScene("pasture")}>
            <PawPrint size={17} />
            牧场
          </button>
          {isOwner ? (
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
        {isOwner && testToolsOpen ? (
          <section className="manor-test-tools" aria-label="庄园测试工具">
            <div className="manor-test-tools__group">
              <strong><FastForward size={16} />推进时间</strong>
              <div className="manor-test-tools__actions">
                {TEST_DURATIONS.map((duration) => (
                  <button
                    key={duration.seconds}
                    type="button"
                    disabled={busy}
                    onClick={() => void runTestMutation(() => advanceManorTestTime({ seconds: duration.seconds }))}
                  >
                    +{duration.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="manor-test-tools__group manor-test-tools__resources">
              <strong><Gift size={16} />发放资源</strong>
              <label>
                <span>资源</span>
                <select
                  value={resource}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value as ManorTestResource;
                    setResource(next);
                    setAmount(TEST_RESOURCE_DEFAULTS[next]);
                  }}
                >
                  {TEST_RESOURCES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>数量</span>
                <input
                  type="number"
                  min={1}
                  max={10_000_000}
                  step={1}
                  value={amount}
                  disabled={busy}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </label>
              <button
                className="manor-test-tools__submit"
                type="button"
                disabled={busy || !Number.isInteger(amount) || amount < 1 || amount > 10_000_000}
                onClick={() => void runTestMutation(() => grantManorTestResource({ resource, amount }))}
              >
                <Gift size={16} />
                发放
              </button>
            </div>
            {notice ? <output className="manor-test-tools__notice">{notice}</output> : null}
            <button
              className="manor-test-tools__close"
              type="button"
              aria-label="关闭测试工具"
              title="关闭测试工具"
              onClick={() => setTestToolsOpen(false)}
            >
              <X size={17} />
            </button>
          </section>
        ) : null}
        <ManorRufflePlayer scene={scene} refreshToken={refreshToken} />
      </div>
    </AppShell>
  );
}

const TEST_DURATIONS = [
  { label: "1 小时", seconds: 60 * 60 },
  { label: "1 天", seconds: 24 * 60 * 60 },
  { label: "7 天", seconds: 7 * 24 * 60 * 60 }
] as const;

const TEST_RESOURCES = [
  { value: "coins", label: "金币" },
  { value: "farm-experience", label: "农场经验" },
  { value: "pasture-experience", label: "牧场经验" },
  { value: "fertilizer", label: "普通化肥" },
  { value: "pasture-feed", label: "牧场饲料" }
] as const satisfies ReadonlyArray<{ value: ManorTestResource; label: string }>;

const TEST_RESOURCE_DEFAULTS: Record<ManorTestResource, number> = {
  coins: 100_000,
  "farm-experience": 10_000,
  "pasture-experience": 10_000,
  fertilizer: 20,
  "pasture-feed": 100
};

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
