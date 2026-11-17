import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type WebNavContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const WebNavContext = createContext<WebNavContextValue | null>(null);

/** Website hamburger state only — unused on native (provider is a no-op shell). */
export function WebNavProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);

  return <WebNavContext.Provider value={value}>{children}</WebNavContext.Provider>;
}

export function useWebNav() {
  const ctx = useContext(WebNavContext);
  if (!ctx) {
    throw new Error('useWebNav must be used within WebNavProvider');
  }
  return ctx;
}
