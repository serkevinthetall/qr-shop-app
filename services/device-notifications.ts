import Constants from 'expo-constants';
import { Platform } from 'react-native';

const ANDROID_CHANNEL_ID = 'default';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;

/** True when running inside the Expo Go app (no remote push on SDK 53+). */
export function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

/** Remote push and native notification APIs need a development or store build. */
export function isRemotePushAvailable() {
  return !isExpoGo();
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo()) {
    return null;
  }

  if (notificationsModule !== undefined) {
    return notificationsModule;
  }

  try {
    notificationsModule = await import('expo-notifications');

    if (!handlerConfigured) {
      handlerConfigured = true;
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }

    return notificationsModule;
  } catch {
    notificationsModule = null;
    return null;
  }
}

async function ensureAndroidChannel(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await loadNotifications();

  if (!Notifications) {
    return false;
  }

  await ensureAndroidChannel(Notifications);

  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;

  if (status !== 'granted' && settings.canAskAgain !== false) {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  return status === 'granted';
}

function getEasProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!isRemotePushAvailable()) {
    return null;
  }

  const Notifications = await loadNotifications();

  if (!Notifications) {
    return null;
  }

  const granted = await ensureNotificationPermissions();

  if (!granted) {
    return null;
  }

  const projectId = getEasProjectId();

  if (!projectId) {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function presentLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  const Notifications = await loadNotifications();

  if (!Notifications) {
    return false;
  }

  const granted = await ensureNotificationPermissions();

  if (!granted) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null,
  });

  return true;
}

type NotificationRouteHandler = (href: string) => void;

function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) {
    return null;
  }

  if (data.type === 'product' && data.productId) {
    return `/product/${data.productId}`;
  }

  if (data.type === 'coupon') {
    return '/notifications';
  }

  if (data.type === 'test') {
    return '/notifications';
  }

  return null;
}

function handleNotificationNavigation(
  data: Record<string, unknown> | undefined,
  navigate: NotificationRouteHandler,
) {
  const href = routeFromNotificationData(data);

  if (href) {
    navigate(href);
  }
}

export function addNotificationReceivedListener(
  onReceived: (data: Record<string, unknown> | undefined) => void,
) {
  let active = true;
  let removeListener: (() => void) | null = null;

  loadNotifications()
    .then((Notifications) => {
      if (!active || !Notifications) {
        return;
      }

      const subscription = Notifications.addNotificationReceivedListener((notification) => {
        onReceived(notification.request.content.data as Record<string, unknown>);
      });

      removeListener = () => {
        subscription.remove();
      };
    })
    .catch(() => {
      // Notifications unavailable in Expo Go.
    });

  return () => {
    active = false;
    removeListener?.();
  };
}

export function addNotificationNavigationListeners(navigate: NotificationRouteHandler) {
  let active = true;
  let removeListener: (() => void) | null = null;

  loadNotifications()
    .then((Notifications) => {
      if (!active || !Notifications) {
        return;
      }

      const responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          handleNotificationNavigation(
            response.notification.request.content.data as Record<string, unknown>,
            navigate,
          );
        },
      );

      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (!response) {
            return;
          }

          handleNotificationNavigation(
            response.notification.request.content.data as Record<string, unknown>,
            navigate,
          );
        })
        .catch(() => {
          // Ignore cold-start navigation errors.
        });

      removeListener = () => {
        responseSubscription.remove();
      };
    })
    .catch(() => {
      // Notifications unavailable in Expo Go.
    });

  return () => {
    active = false;
    removeListener?.();
  };
}
