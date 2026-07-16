import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { translate, type Language } from '@/constants/translations';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { requestCatalogRefresh } from '@/services/catalog-events';
import { presentLocalNotification, getExpoPushToken } from '@/services/device-notifications';
import {
  fetchNotifications,
  notificationDateToMs,
  registerPushToken,
  type AppNotification,
} from '@/services/notification-api';

function describeNotification(item: AppNotification, language: Language) {
  if (item.type === 'product') {
    const ribbon = item.ribbon_name?.trim() || translate(language, 'notifications.newProductTitle');

    return {
      title: translate(language, 'notifications.productOccurredTitle', { ribbon }),
      body: `${item.product_name} — ${translate(language, 'notifications.newProductBody')}`,
    };
  }

  return {
    title: translate(language, 'notifications.newCouponTitle'),
    body: translate(language, 'notifications.newCouponBody', { code: item.coupon_code }),
  };
}

const LAST_SEEN_KEY = 'qr-app-notifications-last-seen';

// How often (ms) to poll the backend for new products / coupons while the app
// is open, so a freshly created product fires a phone notification on its own.
const POLL_INTERVAL_MS = 30000;

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
  markAllSeen: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { language, isReady: isLanguageReady } = useLanguage();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [lastSeen, setLastSeen] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Refs so the async refresh always reads the latest values without forcing
  // the refresh callback (and its effect) to re-run on every change.
  const languageRef = useRef(language);
  const isLanguageReadyRef = useRef(isLanguageReady);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    languageRef.current = language;
    isLanguageReadyRef.current = isLanguageReady;
  }, [language, isLanguageReady]);

  useEffect(() => {
    const restorePreferences = async () => {
      try {
        const storedLastSeen = await AsyncStorage.getItem(LAST_SEEN_KEY);
        setLastSeen(Number(storedLastSeen) || 0);
        await AsyncStorage.removeItem('qr-app-notifications-muted');
      } catch {
        // Fall back to defaults if storage is unavailable.
      }
    };

    restorePreferences();
  }, []);

  // `silent` polling refreshes skip the loading spinner so the list doesn't
  // flicker every interval.
  const refresh = useCallback(
    async (silent = false) => {
      if (!token) {
        setNotifications([]);
        seenIdsRef.current = null;
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }
      setError('');

      try {
        const data = await fetchNotifications(token);
        setNotifications(data);

        const incomingIds = new Set(data.map((item) => item.id));

        if (seenIdsRef.current === null) {
          // First load of this session — remember what exists, don't notify for
          // pre-existing items.
          seenIdsRef.current = incomingIds;
        } else {
          const newItems = data.filter((item) => !seenIdsRef.current!.has(item.id));
          seenIdsRef.current = incomingIds;

          let shouldRefreshCatalog = false;

          for (const item of newItems) {
            if (item.type === 'product') {
              shouldRefreshCatalog = true;
            }

            const { title, body } = describeNotification(item, languageRef.current);
            const data =
              item.type === 'product'
                ? { id: item.id, type: 'product', productId: item.product_id }
                : { id: item.id, type: 'coupon', couponCode: item.coupon_code };

            presentLocalNotification(title, body, data).catch(() => {});
          }

          if (shouldRefreshCatalog) {
            requestCatalogRefresh();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications.');
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isLanguageReady) {
      return;
    }

    refresh();
  }, [refresh, isLanguageReady]);

  const syncPushRegistration = useCallback(async () => {
    const authToken = tokenRef.current;

    if (!authToken || !isLanguageReadyRef.current) {
      return;
    }

    const expoPushToken = await getExpoPushToken();

    if (!expoPushToken) {
      return;
    }

    await registerPushToken(authToken, expoPushToken, languageRef.current);
  }, []);

  useEffect(() => {
    if (!token || !isLanguageReady) {
      return;
    }

    syncPushRegistration().catch(() => {
      // Push registration is optional; in-app notifications still work.
    });
  }, [token, isLanguageReady, language, syncPushRegistration]);

  // Poll for new products/coupons while signed in, and re-check whenever the
  // app returns to the foreground.
  useEffect(() => {
    if (!token) {
      return;
    }

    const interval = setInterval(() => {
      refresh(true);
    }, POLL_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh(true);
        syncPushRegistration().catch(() => {});
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [token, refresh, syncPushRegistration]);

  const markAllSeen = useCallback(async () => {
    const latest = notifications.reduce((max, item) => {
      const ms = notificationDateToMs(item.date);
      return ms > max ? ms : max;
    }, lastSeen);

    setLastSeen(latest);
    await AsyncStorage.setItem(LAST_SEEN_KEY, String(latest));
  }, [notifications, lastSeen]);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => notificationDateToMs(item.date) > lastSeen).length;
  }, [notifications, lastSeen]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      error,
      refresh,
      markAllSeen,
    }),
    [notifications, unreadCount, isLoading, error, refresh, markAllSeen],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return context;
}
