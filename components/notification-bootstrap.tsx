import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import {
  addNotificationNavigationListeners,
  addNotificationReceivedListener,
  prepareNotificationChannels,
} from '@/services/device-notifications';
import { requestCatalogRefresh } from '@/services/catalog-events';

export function NotificationBootstrap() {
  const router = useRouter();

  useEffect(() => {
    prepareNotificationChannels().catch(() => {
      // Channel setup is best-effort on unsupported runtimes (Expo Go).
    });

    const removeNavigation = addNotificationNavigationListeners((href) => {
      router.push(href as Href);
    });

    const removeReceived = addNotificationReceivedListener((data) => {
      if (data?.type === 'product') {
        requestCatalogRefresh();
      }
    });

    return () => {
      removeNavigation();
      removeReceived();
    };
  }, [router]);

  return null;
}
