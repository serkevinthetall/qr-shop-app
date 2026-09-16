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

import { getApiBaseUrl } from '@/constants/api';

/**
 * Myanmar ISPs (Atom, some Wi‑Fi) often block NetInfo's default Google reachability
 * URL, so the OS reports "no internet" while our Vercel API still works.
 * Probe our own API instead, and only treat the device as offline when there is
 * no network interface at all.
 */
NetInfo.configure({
  reachabilityUrl: `${getApiBaseUrl()}/api/app-config`,
  reachabilityMethod: 'GET',
  reachabilityTest: async (response) => response.status >= 200 && response.status < 500,
  reachabilityShortTimeout: 8_000,
  reachabilityLongTimeout: 20_000,
  reachabilityRequestTimeout: 15_000,
  shouldFetchWiFiSSID: false,
});

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
  // Only the OS link matters. Ignore isInternetReachable — false positives are
  // common on Myanmar mobile/Wi‑Fi and blocked the whole app incorrectly.
  if (state.isConnected === false) {
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

    NetInfo.fetch()
      .then(apply)
      .catch(() => {
        // Keep assuming online — a NetInfo failure must not lock the shop.
        if (mountedRef.current) {
          setRealOnline(true);
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
      setRealOnline(true);
      return true;
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
