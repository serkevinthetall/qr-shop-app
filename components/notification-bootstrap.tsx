import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useChat } from '@/contexts/chat-context';
import {
  addNotificationNavigationListeners,
  addNotificationReceivedListener,
  prepareNotificationChannels,
} from '@/services/device-notifications';
import { requestCatalogRefresh } from '@/services/catalog-events';

export function NotificationBootstrap() {
  const router = useRouter();
  const { refresh: refreshChat } = useChat();

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
      if (data?.type === 'chat' || data?.kind === 'message') {
        void refreshChat();
      }
    });

    return () => {
      removeNavigation();
      removeReceived();
    };
  }, [router, refreshChat]);

  return null;
}
