import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { RoomView } from "@party-games/shared";

interface CtIdentityButtonProps {
  privateGame: NonNullable<RoomView["self"]["privateGame"]>;
}

export function CtIdentityButton({ privateGame }: CtIdentityButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hide = () => setVisible(false);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <span className="ct-identity-btn-wrap">
      <button
        type="button"
        className="icon-button ct-identity-btn"
        aria-label="按住查看身份"
        onPointerDown={() => setVisible(true)}
        onPointerUp={() => setVisible(false)}
        onPointerLeave={() => setVisible(false)}
        onPointerCancel={() => setVisible(false)}
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      {visible ? (
        <div className="ct-identity-popover" role="tooltip">
          <small>{privateGame.role.englishName}</small>
          <strong>{privateGame.role.name}</strong>
          <em>{privateGame.role.team === "good" ? "善良阵营" : "邪恶阵营"}</em>
          <p>{privateGame.role.ability}</p>
        </div>
      ) : null}
    </span>
  );
}
