import type { ManorGuestbookMessageView, ManorGuestbookView } from "@party-games/shared";
import { MessageSquare, RefreshCw, Reply, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  clearManorGuestbook,
  createManorGuestbookMessage,
  getManorGuestbook
} from "../../api";

export function ManorGuestbookWindow({
  open,
  ownerUserId,
  ownerDisplayName,
  onClose
}: {
  open: boolean;
  ownerUserId?: string;
  ownerDisplayName?: string;
  onClose: () => void;
}) {
  const [guestbook, setGuestbook] = useState<ManorGuestbookView>();
  const [replyTo, setReplyTo] = useState<ManorGuestbookMessageView>();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      setGuestbook(await getManorGuestbook(ownerUserId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "留言板读取失败");
    } finally {
      setBusy(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    if (!open) return;
    setReplyTo(undefined);
    setContent("");
    void refresh();
  }, [open, refresh]);

  if (!open) return null;

  const submit = async () => {
    const message = content.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      setGuestbook(await createManorGuestbookMessage({
        content: message,
        ...(replyTo ? { replyToId: replyTo.id } : {})
      }, ownerUserId));
      setContent("");
      setReplyTo(undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "留言发送失败");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (busy || !window.confirm("确定清空自己的全部庄园留言吗？此操作不可撤销。")) return;
    setBusy(true);
    setError(undefined);
    try {
      setGuestbook(await clearManorGuestbook());
      setReplyTo(undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "留言清空失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="manor-social-layer" role="presentation" onMouseDown={onClose}>
      <section className="manor-guestbook-window" role="dialog" aria-modal="true" aria-label="庄园留言板" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <strong><MessageSquare size={18} />{guestbook?.ownerDisplayName ?? ownerDisplayName ?? "我的"}留言板</strong>
          {guestbook?.canClear && guestbook.messages.length > 0 ? <button type="button" disabled={busy} aria-label="清空留言" title="清空留言" onClick={() => void clear()}><Trash2 size={17} /></button> : null}
          <button type="button" disabled={busy} aria-label="刷新留言" title="刷新留言" onClick={() => void refresh()}><RefreshCw size={17} /></button>
          <button type="button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} /></button>
        </header>
        {error ? <div className="manor-guestbook-error">{error}</div> : null}
        <div className="manor-guestbook-list">
          {!error && busy && !guestbook ? <div className="manor-guestbook-empty">正在读取...</div> : null}
          {!error && guestbook && guestbook.messages.length === 0 ? <div className="manor-guestbook-empty"><MessageSquare size={28} />还没有留言</div> : null}
          {guestbook?.messages.map((message) => (
            <article key={message.id}>
              <b>{message.senderDisplayName.slice(0, 1) || "友"}</b>
              <span>
                <strong>{message.senderDisplayName}<time>{formatDate(message.createdAt)}</time></strong>
                {message.replyTo ? <small>回复 {message.replyTo.senderDisplayName}：{message.replyTo.content}</small> : null}
                <p>{message.content}</p>
              </span>
              <button type="button" aria-label={`回复${message.senderDisplayName}`} title="回复" onClick={() => setReplyTo(message)}><Reply size={16} /></button>
            </article>
          ))}
        </div>
        <footer>
          {replyTo ? <div className="manor-guestbook-reply"><span>回复 {replyTo.senderDisplayName}：{replyTo.content}</span><button type="button" aria-label="取消回复" onClick={() => setReplyTo(undefined)}><X size={14} /></button></div> : null}
          <div>
            <textarea maxLength={200} placeholder="写一条庄园留言" value={content} onChange={(event) => setContent(event.target.value)} />
            <button type="button" disabled={busy || content.trim().length === 0} onClick={() => void submit()}><Send size={17} /><span>发送</span></button>
          </div>
          <small>显示最近 50 条 · {content.length} / 200</small>
        </footer>
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
