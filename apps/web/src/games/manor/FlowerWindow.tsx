import type {
  ManorFlowerCatalogView,
  ManorReceivedFlowerView
} from "@party-games/shared";
import { Flower2, Gift, Inbox, Send, X } from "lucide-react";
import { useEffect, useState } from "react";

export function ManorFlowerWindow({
  basket,
  catalog,
  recipientName,
  busy,
  onClose,
  onSend
}: {
  basket: ManorReceivedFlowerView[];
  catalog?: ManorFlowerCatalogView[];
  recipientName?: string;
  busy: boolean;
  onClose: () => void;
  onSend?: (flowerId: ManorFlowerCatalogView["id"], message: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"send" | "basket">(catalog ? "send" : "basket");
  const [selectedId, setSelectedId] = useState<ManorFlowerCatalogView["id"]>(1);
  const [message, setMessage] = useState("");
  const selected = catalog?.find((flower) => flower.id === selectedId) ?? catalog?.[0];

  useEffect(() => {
    if (catalog && !catalog.some((flower) => flower.id === selectedId)) {
      setSelectedId(catalog[0]?.id ?? 1);
    }
  }, [catalog, selectedId]);

  const send = async () => {
    if (!selected || !onSend) return;
    if (await onSend(selected.id, message)) setMessage("");
  };

  return (
    <div className="manor-window-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="manor-flower-window"
        role="dialog"
        aria-modal="true"
        aria-label="花束与花篮"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <strong><Flower2 size={19} />花束与花篮</strong>
          <button type="button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} /></button>
        </header>
        {catalog ? (
          <div className="manor-flower-tabs" role="tablist">
            <button className={tab === "send" ? "is-active" : ""} type="button" onClick={() => setTab("send")}><Gift size={15} />赠送花束</button>
            <button className={tab === "basket" ? "is-active" : ""} type="button" onClick={() => setTab("basket")}><Inbox size={15} />{recipientName}的花篮</button>
          </div>
        ) : null}

        {tab === "send" && catalog && selected ? (
          <div className="manor-flower-send">
            <div className="manor-flower-catalog">
              {catalog.map((flower) => (
                <button
                  className={flower.id === selected.id ? "is-selected" : ""}
                  key={flower.id}
                  type="button"
                  onClick={() => setSelectedId(flower.id)}
                >
                  <img src={flower.assetUrl} alt="" />
                  <span><strong>{flower.name}</strong><small>{flower.canSend ? "材料充足" : "材料不足"}</small></span>
                </button>
              ))}
            </div>
            <article className="manor-flower-card">
              <img src={selected.assetUrl} alt={selected.name} />
              <div>
                <strong>{selected.name}</strong>
                <p>{selected.description}</p>
                <ul>
                  {selected.requirements.map((requirement) => (
                    <li className={requirement.available >= requirement.quantity ? "is-ready" : ""} key={requirement.cropId}>
                      {requirement.cropName} {requirement.available} / {requirement.quantity}
                    </li>
                  ))}
                </ul>
              </div>
              <label>
                <span>卡片赠言</span>
                <textarea maxLength={120} placeholder="写给好友的话（可不填）" value={message} onChange={(event) => setMessage(event.target.value)} />
                <small>{message.length} / 120</small>
              </label>
              <button type="button" disabled={busy || !selected.canSend} onClick={() => void send()}><Send size={15} />赠送给 {recipientName}</button>
            </article>
          </div>
        ) : (
          <FlowerBasket basket={basket} />
        )}
      </section>
    </div>
  );
}

function FlowerBasket({ basket }: { basket: ManorReceivedFlowerView[] }) {
  if (basket.length === 0) {
    return <div className="manor-flower-empty"><Flower2 size={30} /><span>花篮还是空的</span></div>;
  }
  return (
    <div className="manor-flower-basket">
      {basket.map((receipt) => (
        <article key={receipt.id}>
          <img src={receipt.assetUrl} alt={receipt.name} />
          <span>
            <strong>{receipt.name}</strong>
            <small>{receipt.description}</small>
            <p>{receipt.message || "没有留下赠言"}</p>
            <em>{receipt.senderDisplayName} · {formatDate(receipt.createdAt)}</em>
          </span>
        </article>
      ))}
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
