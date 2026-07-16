import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { addNotificationNavigationListeners, addNotificationReceivedListener } from '@/services/device-notifications';
import { requestCatalogRefresh } from '@/services/catalog-events';

export function NotificationBootstrap() {
  const router = useRouter();

  useEffect(() => {
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
