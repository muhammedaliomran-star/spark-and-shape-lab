import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface PrivacyCtx {
  privacy: boolean;
  toggle: () => void;
  setPrivacy: (v: boolean) => void;
}

const Ctx = createContext<PrivacyCtx>({ privacy: false, toggle: () => {}, setPrivacy: () => {} });

const KEY = "segilly:privacy";

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacy, setPrivacyState] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, privacy ? "1" : "0"); } catch { /* noop */ }
  }, [privacy]);
  const setPrivacy = useCallback((v: boolean) => setPrivacyState(v), []);
  const toggle = useCallback(() => setPrivacyState((p) => !p), []);
  return <Ctx.Provider value={{ privacy, toggle, setPrivacy }}>{children}</Ctx.Provider>;
}

export function usePrivacy() {
  return useContext(Ctx);
}