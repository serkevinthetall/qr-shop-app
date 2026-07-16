import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type NetworkContextValue = {
  isOnline: boolean;
  isChecking: boolean;
  refresh: () => Promise<boolean>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

function resolveOnline(state: NetInfoState) {
  if (state.isConnected === false) {
    return false;
  }

  // Some platforms report connected=true while reachability is still unknown.
  if (state.isInternetReachable === false) {
    return false;
  }

  return true;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const apply = (state: NetInfoState) => {
      if (!mountedRef.current) {
        return;
      }
      setIsOnline(resolveOnline(state));
    };

    NetInfo.fetch().then(apply).catch(() => {
      if (mountedRef.current) {
        setIsOnline(false);
      }
    });

    const unsubscribe = NetInfo.addEventListener(apply);

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    try {
      const state = await NetInfo.fetch();
      const online = resolveOnline(state);
      setIsOnline(online);
      return online;
    } catch {
      setIsOnline(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      isOnline,
      isChecking,
      refresh,
    }),
    [isOnline, isChecking, refresh],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }

  return context;
}
