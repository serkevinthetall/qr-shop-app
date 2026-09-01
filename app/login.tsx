import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { LanguageToggleChip } from '@/components/language-toggle-chip';
import {
  latinTextInputContentStyle,
  paperButtonContentStyle,
  paperButtonLabelStyle,
  paperTextInputContainerStyle,
} from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useKeyboardBottomPadding } from '@/hooks/use-keyboard-bottom-padding';
import { useResponsive } from '@/hooks/use-responsive';
import { prefetchSessionBootstrap } from '@/services/catalog-bootstrap';

const LOGO_LIGHT = require('@/assets/images/icon.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

export default function LoginScreen() {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs, contentMaxWidth, horizontalPadding } = useResponsive();
  const { t, fs, lh, language } = useLanguage();
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
  const inputContainerStyle =
    language === 'my' ? paperTextInputContainerStyle(language) : undefined;

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
      setError(err instanceof Error ? err.message : t('login.failed'));
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
          <LanguageToggleChip
            style={[styles.languageChip, { backgroundColor: colors.card, borderWidth: 0 }]}
          />

          <Image
            source={logoSource}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
            accessibilityLabel="QR Shop Myanmar"
          />

          <TextInput
            label={t('login.emailOrPhone')}
            value={login}
            onChangeText={setLogin}
            mode="outlined"
            dense={language !== 'my'}
            autoCapitalize="none"
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType="next"
            placeholder={t('login.emailOrPhonePlaceholder')}
            style={[styles.input, inputContainerStyle]}
            contentStyle={latinTextInputContentStyle}
            onFocus={() => setFocusedField('login')}
            onBlur={() => setFocusedField((current) => (current === 'login' ? null : current))}
          />

          <TextInput
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            dense={language !== 'my'}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            style={[styles.input, inputContainerStyle]}
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
            contentStyle={paperButtonContentStyle(language)}
            labelStyle={paperButtonLabelStyle(language, fs, lh, 15)}>
            {isPreparingSession ? t('login.loadingShop') : t('login.signIn')}
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
    paddingTop: 20,
    alignItems: 'center',
    position: 'relative',
  },
  languageChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  logo: {
    marginBottom: 16,
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
});
