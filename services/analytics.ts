import { NativeModules, Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';
/** Present only in custom native builds (EAS/dev client), not Expo Go. */
const HAS_NATIVE_FIREBASE = !IS_WEB && Boolean(NativeModules.RNFBAppModule);

type AnalyticsModule = {
  (): {
    setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
    logEvent: (name: string, params?: Record<string, string>) => Promise<void>;
  };
};

let analyticsModule: AnalyticsModule | null | undefined;
let didInit = false;

function getAnalytics(): AnalyticsModule | null {
  if (!HAS_NATIVE_FIREBASE) {
    return null;
  }

  if (analyticsModule !== undefined) {
    return analyticsModule;
  }

  try {
    // Lazy require so Expo Go / web never load the native Firebase package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    analyticsModule = require('@react-native-firebase/analytics').default as AnalyticsModule;
  } catch {
    analyticsModule = null;
  }

  return analyticsModule;
}

async function safe(fn: () => Promise<void>) {
  try {
    await fn();
  } catch {
    // Analytics must never block app startup/login.
  }
}

export async function initAppAnalytics() {
  if (!HAS_NATIVE_FIREBASE || didInit) {
    return;
  }

  const analytics = getAnalytics();
  if (!analytics) {
    return;
  }

  await safe(async () => {
    await analytics().setAnalyticsCollectionEnabled(true);
    didInit = true;
  });
}

export async function trackAppOpen() {
  const analytics = getAnalytics();
  if (!analytics) {
    return;
  }

  await safe(async () => {
    await analytics().logEvent('app_open');
  });
}

export async function trackLoginSuccess(params: {
  userId: number;
  loginType: 'email' | 'phone';
}) {
  const analytics = getAnalytics();
  if (!analytics) {
    return;
  }

  await safe(async () => {
    await analytics().logEvent('login_success', {
      user_id: String(params.userId),
      login_type: params.loginType,
    });
  });
}
