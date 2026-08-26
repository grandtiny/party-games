import type { ManorTestResource, ManorTestSetLevelRequest } from "@party-games/shared";
import { Database, FastForward, Gauge, Gift, X } from "lucide-react";
import { useState } from "react";
import {
  advanceManorTestTime,
  grantManorTestResource,
  prepareManorTestAcceptanceData,
  setManorTestLevel
} from "../../api";

export function ManorTestTools({
  onClose,
  onMutated
}: {
  onClose: () => void;
  onMutated: () => void;
}) {
  const [resource, setResource] = useState<ManorTestResource>("coins");
  const [amount, setAmount] = useState(100_000);
  const [levelArea, setLevelArea] = useState<ManorTestSetLevelRequest["area"]>("farm");
  const [level, setLevel] = useState(28);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const runMutation = async (mutation: () => Promise<{ message: string }>) => {
    setBusy(true);
    setNotice(undefined);
    try {
      const result = await mutation();
      setNotice(result.message);
      onMutated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "测试操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="manor-test-tools" aria-label="庄园测试工具">
      <div className="manor-test-tools__group">
        <strong><FastForward size={16} />推进时间</strong>
        <div className="manor-test-tools__actions">
          {TEST_DURATIONS.map((duration) => (
            <button
              key={duration.seconds}
              type="button"
              disabled={busy}
              onClick={() => void runMutation(() => advanceManorTestTime({ seconds: duration.seconds }))}
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
          onClick={() => void runMutation(() => grantManorTestResource({ resource, amount }))}
        >
          <Gift size={16} />
          发放
        </button>
      </div>
      <div className="manor-test-tools__group manor-test-tools__levels">
        <strong><Gauge size={16} />设置等级</strong>
        <label>
          <span>区域</span>
          <select
            value={levelArea}
            disabled={busy}
            onChange={(event) => setLevelArea(event.target.value as ManorTestSetLevelRequest["area"])}
          >
            <option value="farm">农场</option>
            <option value="pasture">牧场</option>
          </select>
        </label>
        <label>
          <span>目标等级</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={level}
            disabled={busy}
            onChange={(event) => setLevel(Number(event.target.value))}
          />
        </label>
        <button
          className="manor-test-tools__submit"
          type="button"
          disabled={busy || !Number.isInteger(level) || level < 0 || level > 100}
          onClick={() => void runMutation(() => setManorTestLevel({ area: levelArea, level }))}
        >
          <Gauge size={16} />
          设置
        </button>
      </div>
      <div className="manor-test-tools__group">
        <strong><Database size={16} />巡检数据</strong>
        <button
          className="manor-test-tools__submit"
          type="button"
          disabled={busy}
          onClick={() => void runMutation(prepareManorTestAcceptanceData)}
        >
          <Database size={16} />
          准备数据
        </button>
      </div>
      {notice ? <output className="manor-test-tools__notice">{notice}</output> : null}
      <button
        className="manor-test-tools__close"
        type="button"
        aria-label="关闭测试工具"
        title="关闭测试工具"
        onClick={onClose}
      >
        <X size={17} />
      </button>
    </section>
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
