import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingScreen } from '@/components/loading-screen';
import { hasSeenWelcome } from '@/constants/onboarding';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useThemeMode } from '@/contexts/theme-context';
import { prefetchSessionBootstrap } from '@/services/catalog-bootstrap';

const SPLASH_MIN_MS = 1200;

export default function AppEntryScreen() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { isReady: isLanguageReady } = useLanguage();
  const { isReady: isThemeReady } = useThemeMode();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    hasSeenWelcome()
      .then(setWelcomeSeen)
      .catch(() => setWelcomeSeen(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Keep splash up until products, account, and orders are prefetched for
  // signed-in users so the main tabs open with data already loaded.
  useEffect(() => {
    if (isAuthLoading || !isThemeReady || !isLanguageReady || welcomeSeen === null) {
      return;
    }

    let cancelled = false;

    const prepare = async () => {
      if (!welcomeSeen || !user || !token) {
        if (!cancelled) {
          setSessionReady(true);
        }
        return;
      }

      try {
        await prefetchSessionBootstrap(token);
      } catch {
        // Still enter the app; each tab can show its own error/retry.
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    };

    setSessionReady(false);
    prepare();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isThemeReady, isLanguageReady, welcomeSeen, user, token]);

  if (
    isAuthLoading ||
    !isThemeReady ||
    !isLanguageReady ||
    welcomeSeen === null ||
    !minTimeElapsed ||
    !sessionReady
  ) {
    const splashMessage =
      user && welcomeSeen ? 'Loading your shop...' : 'Loading...';
    return <LoadingScreen message={splashMessage} />;
  }

  if (!welcomeSeen) {
    return <Redirect href={'/welcome' as Href} />;
  }

  if (user) {
    return <Redirect href={'/(tabs)' as Href} />;
  }

  return <Redirect href={'/login' as Href} />;
}
