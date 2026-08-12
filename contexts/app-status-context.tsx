import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Linking } from 'react-native';

import { useNetwork } from '@/contexts/network-context';
import {
  fetchAppConfig,
  getInstalledAppVersion,
  getPlatformMinVersion,
  getStoreUrl,
  type AppConfig,
} from '@/services/app-config';
import { subscribeServerDown } from '@/services/server-status-events';
import { isVersionBelow } from '@/utils/version';

type AppStatusContextValue = {
  forceUpdateRequired: boolean;
  serverDown: boolean;
  isChecking: boolean;
  storeUrl: string;
  installedVersion: string;
  minVersion: string;
  refreshStatus: () => Promise<void>;
  openStore: () => Promise<void>;
  reportServerDown: () => void;
};

const AppStatusContext = createContext<AppStatusContextValue | null>(null);

const CHECK_INTERVAL_MS = 60000;

export function AppStatusProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetwork();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);
  const installedVersion = getInstalledAppVersion();

  const refreshStatus = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    setIsChecking(true);

    try {
      const next = await fetchAppConfig();

      if (!mountedRef.current) {
        return;
      }

      setConfig(next);
      setServerDown(false);
    } catch {
      if (!mountedRef.current) {
        return;
      }

      // Only treat as server-down when the device thinks it is online.
      if (isOnline) {
        setServerDown(true);
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [isOnline]);

  const reportServerDown = useCallback(() => {
    if (isOnline) {
      setServerDown(true);
    }
  }, [isOnline]);

  useEffect(() => {
    mountedRef.current = true;
    refreshStatus().catch(() => {});

    const interval = setInterval(() => {
      refreshStatus().catch(() => {});
    }, CHECK_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshStatus().catch(() => {});
      }
    });

    const unsubscribeServerDown = subscribeServerDown(() => {
      reportServerDown();
    });

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      subscription.remove();
      unsubscribeServerDown();
    };
  }, [refreshStatus, reportServerDown]);

  useEffect(() => {
    if (isOnline) {
      refreshStatus().catch(() => {});
    }
  }, [isOnline, refreshStatus]);

  const minVersion = config ? getPlatformMinVersion(config) : '0.0.0';
  const forceUpdateRequired = config
    ? isVersionBelow(installedVersion, minVersion)
    : false;
  const storeUrl = config ? getStoreUrl(config) : '';

  const openStore = useCallback(async () => {
    const url = storeUrl;

    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('Failed to open store URL:', err);
    }
  }, [storeUrl]);

  const value = useMemo(
    () => ({
      forceUpdateRequired,
      serverDown: serverDown && isOnline && !forceUpdateRequired,
      isChecking,
      storeUrl,
      installedVersion,
      minVersion,
      refreshStatus,
      openStore,
      reportServerDown,
    }),
    [
      forceUpdateRequired,
      serverDown,
      isOnline,
      isChecking,
      storeUrl,
      installedVersion,
      minVersion,
      refreshStatus,
      openStore,
      reportServerDown,
    ],
  );

  return <AppStatusContext.Provider value={value}>{children}</AppStatusContext.Provider>;
}

export function useAppStatus() {
  const context = useContext(AppStatusContext);

  if (!context) {
    throw new Error('useAppStatus must be used within an AppStatusProvider');
  }

  return context;
}
