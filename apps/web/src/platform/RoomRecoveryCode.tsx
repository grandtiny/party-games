import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";

export function RoomRecoveryCode({ recoveryCode }: { recoveryCode: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    let succeeded = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(recoveryCode);
        succeeded = true;
      }
    } catch {
      // HTTP addresses may not expose the Clipboard API, so use the legacy fallback below.
    }
    if (!succeeded) succeeded = copyWithFallback(recoveryCode);
    setCopied(succeeded);
  };

  return (
    <section className="session-strip" aria-label="身份恢复码">
      <KeyRound size={18} />
      <span>
        身份恢复码 <strong>{recoveryCode}</strong>
      </span>
      <button
        className="icon-button session-strip__copy"
        type="button"
        onClick={() => void copy()}
        title={copied ? "恢复码已复制" : "复制恢复码"}
        aria-label={copied ? "恢复码已复制" : "复制恢复码"}
      >
        {copied ? <Check size={17} /> : <Copy size={17} />}
      </button>
    </section>
  );
}

function copyWithFallback(value: string): boolean {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}
