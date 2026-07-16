import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_LANGUAGE, translate, type Language } from '@/constants/translations';
import { setApiClientLanguage } from '@/services/network-error';

const LANGUAGE_KEY = 'qr-app-language-preference';

// Burmese glyphs render visually larger than Latin at the same point size, so
// we shrink them slightly. We never force a line height (see `lh` below).
const MY_FONT_SCALE = 0.9;

type LanguageContextValue = {
  language: Language;
  isReady: boolean;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  fs: (fontSize: number) => number;
  // Always returns undefined. Any explicit lineHeight clips/overlaps Burmese
  // glyphs on iOS — including product names that mix Burmese with Latin — so we
  // rely entirely on the font's natural metrics.
  lh: (fontSize: number) => number | undefined;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then(async (stored) => {
        if (stored === 'en' || stored === 'my') {
          setLanguageState(stored);
          setApiClientLanguage(stored);
          return;
        }

        setLanguageState(DEFAULT_LANGUAGE);
        setApiClientLanguage(DEFAULT_LANGUAGE);
        await AsyncStorage.setItem(LANGUAGE_KEY, DEFAULT_LANGUAGE);
      })
      .finally(() => setIsReady(true));
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    setApiClientLanguage(next);
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  const fs = useCallback(
    (fontSize: number) => (language === 'my' ? Math.round(fontSize * MY_FONT_SCALE) : fontSize),
    [language],
  );

  // Intentionally always undefined: never impose a line height on any text.
  const lh = useCallback((_fontSize: number): number | undefined => undefined, []);

  const value = useMemo(
    () => ({ language, isReady, setLanguage, t, fs, lh }),
    [language, isReady, setLanguage, t, fs, lh],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
}
