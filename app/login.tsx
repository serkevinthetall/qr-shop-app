import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { latinTextInputContentStyle } from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useKeyboardBottomPadding } from '@/hooks/use-keyboard-bottom-padding';
import { useResponsive } from '@/hooks/use-responsive';
import { prefetchSessionBootstrap } from '@/services/catalog-bootstrap';

const LOGO_LIGHT = require('@/assets/images/icon.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

const LATIN_BUTTON_FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: undefined,
});

export default function LoginScreen() {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs, contentMaxWidth, horizontalPadding } = useResponsive();
  const { user, signIn } = useAuth();
  const keyboardPadding = useKeyboardBottomPadding(32);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'login' | 'password' | null>(null);

  const logoSource = isDark ? LOGO_DARK : LOGO_LIGHT;
  const logoSize = rs(148);
  const keyboardOpen = keyboardPadding > 0 || focusedField !== null;

  if (user && !isPreparingSession) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError('');
    setIsSubmitting(true);

    try {
      const sessionToken = await signIn(login, password);
      setIsPreparingSession(true);
      await prefetchSessionBootstrap(sessionToken).catch(() => {
        // Tabs will retry if splash prefetch fails.
      });
      setIsPreparingSession(false);
    } catch (err) {
      setIsPreparingSession(false);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        extraBottomPadding={48}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            justifyContent: keyboardOpen ? 'flex-start' : 'center',
            paddingTop: keyboardOpen ? rs(20) : 32,
          },
        ]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              maxWidth: contentMaxWidth,
            },
          ]}>
          <Image
            source={logoSource}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
            accessibilityLabel="QR Shop Myanmar"
          />

          <Text style={[styles.title, { color: colors.text, fontSize: rs(24) }]}>Welcome back</Text>

          <TextInput
            label="Email or Phone"
            value={login}
            onChangeText={setLogin}
            mode="outlined"
            dense
            autoCapitalize="none"
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType="next"
            placeholder="customer@email.com or 09420103001"
            style={styles.input}
            contentStyle={latinTextInputContentStyle}
            onFocus={() => setFocusedField('login')}
            onBlur={() => setFocusedField((current) => (current === 'login' ? null : current))}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            dense
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            style={styles.input}
            contentStyle={latinTextInputContentStyle}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword((prev) => !prev)}
              />
            }
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField((current) => (current === 'password' ? null : current))}
          />

          {error ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isSubmitting || isPreparingSession}
            disabled={isSubmitting || isPreparingSession}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}>
            {isPreparingSession ? 'Loading your shop...' : 'Sign In'}
          </Button>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  logo: {
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  input: {
    marginBottom: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  button: {
    marginTop: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
  buttonContent: {
    minHeight: 48,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginVertical: 0,
    includeFontPadding: false,
    fontFamily: LATIN_BUTTON_FONT,
  },
});
