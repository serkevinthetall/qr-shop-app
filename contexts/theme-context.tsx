import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import { getAppColors } from '@/constants/app-colors';

const THEME_KEY = 'qr-app-theme-preference';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeMode;

type ThemeContextValue = {
  theme: ThemeMode;
  preference: ThemePreference;
  isDark: boolean;
  isReady: boolean;
  setPreference: (preference: ThemePreference) => void;
  followSystem: boolean;
  setFollowSystem: (follow: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(preference: ThemePreference, systemScheme: ColorSchemeName): ThemeMode {
  if (preference === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }

  return preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((stored) => {
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
        }
      })
      .finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    await AsyncStorage.setItem(THEME_KEY, nextPreference);
  }, []);

  const setFollowSystem = useCallback(
    (follow: boolean) => {
      if (follow) {
        setPreference('system');
        return;
      }

      const currentTheme = resolveTheme(preference, systemScheme);
      setPreference(currentTheme);
    },
    [preference, setPreference, systemScheme],
  );

  const theme = resolveTheme(preference, systemScheme);
  const followSystem = preference === 'system';

  const value = useMemo(
    () => ({
      theme,
      preference,
      isDark: theme === 'dark',
      isReady,
      setPreference,
      followSystem,
      setFollowSystem,
    }),
    [theme, preference, isReady, setPreference, followSystem, setFollowSystem],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }

  return context;
}

export function useAppColors() {
  const { isDark } = useThemeMode();

  return { isDark, ...getAppColors(isDark) };
}
