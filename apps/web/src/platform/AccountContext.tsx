import type { AccountStatusResponse } from "@party-games/shared";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { getAccountStatus } from "../api";

interface AccountContextValue {
  status: AccountStatusResponse | undefined;
  loading: boolean;
  error: string | undefined;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatusResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setStatus(await getAccountStatus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账号状态读取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(
    () => ({ status, loading, error, refresh }),
    [status, loading, error]
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used within AccountProvider");
  return context;
}
