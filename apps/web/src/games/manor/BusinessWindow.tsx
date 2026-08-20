import type { ManorBusinessRecordView } from "@party-games/shared";
import { ArrowDownToLine, ArrowUpFromLine, ReceiptText, X } from "lucide-react";

export function ManorBusinessWindow({
  records,
  onClose
}: {
  records: ManorBusinessRecordView[];
  onClose: () => void;
}) {
  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section className="manor-business-window" role="dialog" aria-modal="true" aria-label="经营流水" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <strong><ReceiptText size={18} />经营流水</strong>
          <span>最近 50 条购买与出售记录</span>
          <button type="button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} /></button>
        </header>
        {records.length === 0 ? (
          <div className="manor-business-empty"><ReceiptText size={30} /><span>还没有经营记录</span></div>
        ) : (
          <div className="manor-business-list">
            {records.map((record) => (
              <article className={`is-${record.kind}`} key={record.id}>
                <i>{record.kind === "purchase" ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}</i>
                <span>
                  <strong>{record.kind === "purchase" ? "购买" : "出售"}{record.itemName}</strong>
                  <small>{record.area === "farm" ? "农场" : "牧场"} · {record.quantity} × {record.unitPrice} 金币</small>
                </span>
                <b className={record.kind === "purchase" ? "is-cost" : "is-income"}>{record.kind === "purchase" ? "-" : "+"}{record.totalCoins}</b>
                <time>{formatDate(record.createdAt)}</time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
}
