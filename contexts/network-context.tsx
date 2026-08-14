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
  /** True when offline is forced by the Account status-test panel. */
  simulateOffline: boolean;
  setSimulateOffline: (value: boolean) => void;
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
  const [realOnline, setRealOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const apply = (state: NetInfoState) => {
      if (!mountedRef.current) {
        return;
      }
      setRealOnline(resolveOnline(state));
    };

    NetInfo.fetch().then(apply).catch(() => {
      if (mountedRef.current) {
        setRealOnline(false);
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
      // Clear test override so Try Again can recover during status testing.
      setSimulateOffline(false);
      const state = await NetInfo.fetch();
      const online = resolveOnline(state);
      setRealOnline(online);
      return online;
    } catch {
      setRealOnline(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const isOnline = realOnline && !simulateOffline;

  const value = useMemo(
    () => ({
      isOnline,
      isChecking,
      simulateOffline,
      setSimulateOffline,
      refresh,
    }),
    [isOnline, isChecking, simulateOffline, refresh],
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
