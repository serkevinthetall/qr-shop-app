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
      // Foreground display only. Background/killed uses the OS + FCM channel.
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

  // MAX importance is required for heads-up banners while the app is backgrounded.
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'QR Shop Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    enableLights: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

/** Call once at app start so the Android channel exists before background pushes arrive. */
export async function prepareNotificationChannels() {
  const Notifications = await loadNotifications();

  if (!Notifications) {
    return false;
  }

  await ensureAndroidChannel(Notifications);
  return true;
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
    console.warn('Push token skipped: Expo Go does not support remote push.');
    return null;
  }

  const Notifications = await loadNotifications();

  if (!Notifications) {
    console.warn('Push token skipped: expo-notifications unavailable.');
    return null;
  }

  const granted = await ensureNotificationPermissions();

  if (!granted) {
    console.warn('Push token skipped: notification permission not granted.');
    return null;
  }

  const projectId = getEasProjectId();

  if (!projectId) {
    console.warn('Push token skipped: missing EAS projectId.');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (err) {
    console.warn('getExpoPushTokenAsync failed:', err);
    return null;
  }
}

const PUSH_TOKEN_RETRY_DELAYS_MS = [0, 1000, 3000, 8000, 15000];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * iOS often fails the first getExpoPushTokenAsync right after login / permission.
 * Retry with backoff so background push can register without needing a foreground event.
 */
export async function getExpoPushTokenWithRetry(
  delaysMs: number[] = PUSH_TOKEN_RETRY_DELAYS_MS,
): Promise<string | null> {
  for (let index = 0; index < delaysMs.length; index += 1) {
    const delay = delaysMs[index];

    if (delay > 0) {
      await wait(delay);
    }

    const token = await getExpoPushToken();

    if (token) {
      return token;
    }
  }

  return null;
}

export async function getPushDiagnostics() {
  const available = isRemotePushAvailable();
  const granted = available ? await ensureNotificationPermissions() : false;
  const projectId = getEasProjectId();
  let token: string | null = null;
  let tokenError = '';

  if (!available) {
    tokenError = 'Expo Go cannot receive Play Store push. Install the Play Store / APK build.';
  } else if (!granted) {
    tokenError = 'Notification permission is not granted.';
  } else if (!projectId) {
    tokenError = 'Missing EAS project id.';
  } else {
    try {
      token = await getExpoPushToken();
      if (!token) {
        tokenError = 'Could not create an Expo push token.';
      }
    } catch (err) {
      tokenError = err instanceof Error ? err.message : 'Token request failed.';
    }
  }

  return {
    available,
    granted,
    projectId,
    token,
    tokenError,
  };
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
