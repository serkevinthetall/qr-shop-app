import 'react-native-url-polyfill/auto';
import '../global.css';

import {
  NotoSansMyanmar_400Regular,
  NotoSansMyanmar_500Medium,
  NotoSansMyanmar_600SemiBold,
  NotoSansMyanmar_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-myanmar';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, type MD3Theme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { getAppColors } from '@/constants/app-colors';
import { MYANMAR_FONTS } from '@/constants/fonts';
import { NotificationBootstrap } from '@/components/notification-bootstrap';
import { OfflineNotice } from '@/components/offline-notice';
import { AuthProvider } from '@/contexts/auth-context';
import { CartProvider } from '@/contexts/cart-context';
import { LanguageProvider, useLanguage } from '@/contexts/language-context';
import { NetworkProvider } from '@/contexts/network-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { ThemeProvider, useThemeMode } from '@/contexts/theme-context';
import { initAppAnalytics, trackAppOpen } from '@/services/analytics';

// Map the central app palette onto the React Native Paper theme so Paper
// components (buttons, inputs, switches, etc.) match the rest of the app.
// Edit colors in `constants/app-colors.ts`.
function withBrandColors(theme: MD3Theme, isDark: boolean): MD3Theme {
  const c = getAppColors(isDark);

  return {
    ...theme,
    colors: {
      ...theme.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.onPrimaryContainer,
      secondary: c.primary,
      onSecondary: c.onPrimary,
      secondaryContainer: c.primaryContainer,
      onSecondaryContainer: c.onPrimaryContainer,
      tertiary: c.primary,
      tertiaryContainer: c.primaryContainer,
      onTertiaryContainer: c.onPrimaryContainer,
      background: c.background,
      surface: c.surface,
      error: c.danger,
      outline: c.border,
    },
  };
}

function withBurmeseFonts(theme: MD3Theme): MD3Theme {
  // Apply Myanmar fontFamily only. Do NOT set a theme lineHeight — Paper
  // Snackbar / labels use body fonts, and a tight lineHeight clips Burmese
  // glyphs. TextInput caret sizing stays in `contentStyle` constants instead.
  const fonts = Object.fromEntries(
    Object.entries(theme.fonts).map(([variant, config]) => {
      if (config && typeof config === 'object' && 'fontSize' in config) {
        const typed = config as { fontSize: number; lineHeight?: number; fontWeight?: string };
        const { lineHeight: _omit, fontWeight, ...rest } = typed;

        const family =
          fontWeight === '700' || fontWeight === 'bold'
            ? MYANMAR_FONTS.bold
            : fontWeight === '600'
              ? MYANMAR_FONTS.semibold
              : fontWeight === '500'
                ? MYANMAR_FONTS.medium
                : MYANMAR_FONTS.regular;

        return [variant, { ...rest, fontFamily: family }];
      }

      return [variant, config];
    }),
  ) as MD3Theme['fonts'];

  return { ...theme, fonts };
}

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isDark } = useThemeMode();
  const { language } = useLanguage();
  const baseTheme = withBrandColors(isDark ? MD3DarkTheme : MD3LightTheme, isDark);
  const paperTheme = language === 'my' ? withBurmeseFonts(baseTheme) : baseTheme;

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <NotificationBootstrap />
        <OfflineNotice />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="addresses" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="order/[id]" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {/* Vercel Analytics only tracks the web app, not native Android/iOS. */}
        {Platform.OS === 'web' ? <Analytics /> : null}
      </NavigationThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansMyanmar_400Regular,
    NotoSansMyanmar_500Medium,
    NotoSansMyanmar_600SemiBold,
    NotoSansMyanmar_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      initAppAnalytics()
        .then(trackAppOpen)
        .catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <NetworkProvider>
            <AuthProvider>
              <NotificationProvider>
                <CartProvider>
                  <RootNavigator />
                </CartProvider>
              </NotificationProvider>
            </AuthProvider>
          </NetworkProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
