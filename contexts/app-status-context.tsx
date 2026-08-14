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
import {
  isServerDownSuppressed,
  subscribeServerDown,
  suppressServerDownFor,
} from '@/services/server-status-events';
import { isVersionBelow } from '@/utils/version';

type AppStatusContextValue = {
  forceUpdateRequired: boolean;
  serverDown: boolean;
  isChecking: boolean;
  storeUrl: string;
  installedVersion: string;
  minVersion: string;
  simulateServerDown: boolean;
  simulateForceUpdate: boolean;
  setSimulateServerDown: (value: boolean) => void;
  setSimulateForceUpdate: (value: boolean) => void;
  clearStatusSimulations: () => void;
  dismissServerDown: () => void;
  dismissForceUpdate: () => void;
  refreshStatus: () => Promise<void>;
  openStore: () => Promise<void>;
  reportServerDown: () => void;
};

const AppStatusContext = createContext<AppStatusContextValue | null>(null);

const CHECK_INTERVAL_MS = 60000;
const FOREGROUND_GRACE_MS = 3000;
const RESUME_REFRESH_DELAY_MS = 800;
const STATUS_RETRY_DELAY_MS = 1200;

export function AppStatusProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetwork();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const [simulateServerDown, setSimulateServerDown] = useState(false);
  const [simulateForceUpdate, setSimulateForceUpdate] = useState(false);
  const [forceUpdateDismissed, setForceUpdateDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);
  const resumeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOnlineRef = useRef(isOnline);
  const installedVersion = getInstalledAppVersion();

  const markServerDown = useCallback(() => {
    if (isOnline && !isServerDownSuppressed()) {
      setServerDown(true);
    }
  }, [isOnline]);

  const clearStatusSimulations = useCallback(() => {
    setSimulateServerDown(false);
    setSimulateForceUpdate(false);
  }, []);

  const enableForceUpdateSimulation = useCallback((value: boolean) => {
    if (value) {
      setForceUpdateDismissed(false);
    }
    setSimulateForceUpdate(value);
  }, []);

  const dismissServerDown = useCallback(() => {
    setServerDown(false);
    setSimulateServerDown(false);
  }, []);

  const dismissForceUpdate = useCallback(() => {
    setSimulateForceUpdate(false);
    setForceUpdateDismissed(true);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    setIsChecking(true);
    setSimulateServerDown(false);

    const maxAttempts = isServerDownSuppressed() ? 2 : 1;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, STATUS_RETRY_DELAY_MS));
          if (!mountedRef.current) {
            return;
          }
        }

        try {
          const next = await fetchAppConfig();

          if (!mountedRef.current) {
            return;
          }

          setConfig(next);
          setServerDown(false);
          return;
        } catch {
          // Retry once while the app/network is still waking up.
        }
      }

      if (!mountedRef.current) {
        return;
      }

      markServerDown();
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [markServerDown]);

  const reportServerDown = useCallback(() => {
    markServerDown();
  }, [markServerDown]);

  useEffect(() => {
    mountedRef.current = true;
    refreshStatus().catch(() => {});

    const interval = setInterval(() => {
      refreshStatus().catch(() => {});
    }, CHECK_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }

      // Clear stale modal and ignore transient resume failures.
      setServerDown(false);
      suppressServerDownFor(FOREGROUND_GRACE_MS);

      if (resumeRefreshTimerRef.current) {
        clearTimeout(resumeRefreshTimerRef.current);
      }

      resumeRefreshTimerRef.current = setTimeout(() => {
        refreshStatus().catch(() => {});
      }, RESUME_REFRESH_DELAY_MS);
    });

    const unsubscribeServerDown = subscribeServerDown(() => {
      reportServerDown();
    });

    return () => {
      mountedRef.current = false;

      if (resumeRefreshTimerRef.current) {
        clearTimeout(resumeRefreshTimerRef.current);
      }

      clearInterval(interval);
      subscription.remove();
      unsubscribeServerDown();
    };
  }, [refreshStatus, reportServerDown]);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (!isOnline || wasOnline) {
      return;
    }

    suppressServerDownFor(FOREGROUND_GRACE_MS);
    setServerDown(false);

    const timer = setTimeout(() => {
      refreshStatus().catch(() => {});
    }, RESUME_REFRESH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isOnline, refreshStatus]);

  const minVersion = config ? getPlatformMinVersion(config) : '0.0.0';
  const forceUpdateRequired =
    !forceUpdateDismissed &&
    (simulateForceUpdate || (config ? isVersionBelow(installedVersion, minVersion) : false));
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
      serverDown: (serverDown || simulateServerDown) && isOnline && !forceUpdateRequired,
      isChecking,
      storeUrl,
      installedVersion,
      minVersion,
      simulateServerDown,
      simulateForceUpdate,
      setSimulateServerDown,
      setSimulateForceUpdate: enableForceUpdateSimulation,
      clearStatusSimulations,
      dismissServerDown,
      dismissForceUpdate,
      refreshStatus,
      openStore,
      reportServerDown,
    }),
    [
      forceUpdateRequired,
      serverDown,
      simulateServerDown,
      simulateForceUpdate,
      isOnline,
      isChecking,
      storeUrl,
      installedVersion,
      minVersion,
      enableForceUpdateSimulation,
      clearStatusSimulations,
      dismissServerDown,
      dismissForceUpdate,
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
