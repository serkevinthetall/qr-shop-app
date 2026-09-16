import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Checkbox, HelperText, Text, TextInput } from 'react-native-paper';
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
import { LoginApiError } from '@/services/auth-api';
import { prefetchSessionBootstrap } from '@/services/catalog-bootstrap';
import {
  clearSavedLoginCredentials,
  loadSavedLoginCredentials,
  saveLoginCredentials,
} from '@/services/saved-login';

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
  const [savePassword, setSavePassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'login' | 'password' | null>(null);
  const [lockUntilMs, setLockUntilMs] = useState(0);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  /** User toggled the checkbox — never let async restore overwrite that choice. */
  const savePreferenceTouchedRef = useRef(false);
  const savePasswordRef = useRef(false);

  const logoSource = isDark ? LOGO_DARK : LOGO_LIGHT;
  const logoSize = rs(148);
  const keyboardOpen = keyboardPadding > 0 || focusedField !== null;
  const inputContainerStyle =
    language === 'my' ? paperTextInputContainerStyle(language) : undefined;
  const isLocked = lockSecondsLeft > 0;

  useEffect(() => {
    savePasswordRef.current = savePassword;
  }, [savePassword]);

  useEffect(() => {
    if (lockUntilMs <= 0) {
      setLockSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockUntilMs - Date.now()) / 1000));
      setLockSecondsLeft(remaining);

      if (remaining <= 0) {
        setLockUntilMs(0);
        setError('');
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [lockUntilMs]);

  // Restore saved credentials on every focus (incl. after Sign Out).
  // Sign Out never clears storage — only unchecking Save password does.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      savePreferenceTouchedRef.current = false;

      loadSavedLoginCredentials()
        .then((result) => {
          if (cancelled) {
            return;
          }

          if (result.status === 'found') {
            setLogin(result.credentials.login);
            setPassword(result.credentials.password);
            if (!savePreferenceTouchedRef.current) {
              setSavePassword(true);
            }
            return;
          }

          // Do NOT force-uncheck here — that raced with the user ticking the box
          // before load finished and caused "Save password" to silently fail.
        })
        .catch(() => {
          // Keep current form state if restore fails.
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const setSavePasswordEnabled = useCallback((enabled: boolean) => {
    savePreferenceTouchedRef.current = true;
    setSavePassword(enabled);
    savePasswordRef.current = enabled;

    if (!enabled) {
      clearSavedLoginCredentials().catch(() => undefined);
    }
  }, []);

  if (user && !isPreparingSession) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    if (isLocked || isSubmitting || isPreparingSession) {
      return;
    }

    Keyboard.dismiss();
    setError('');

    const trimmedLogin = login.trim();
    const passwordValue = password;
    const shouldSavePassword = savePasswordRef.current;

    if (!trimmedLogin || !passwordValue) {
      setError(t('login.requiredFields'));
      return;
    }

    if (trimmedLogin.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedLogin)) {
      setError(t('login.invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    // Block Redirect while signIn sets `user` — otherwise this screen can
    // unmount before Save password is written, so Sign Out looks "forgotten".
    setIsPreparingSession(true);

    try {
      const sessionToken = await signIn(trimmedLogin, passwordValue);

      if (shouldSavePassword) {
        try {
          await saveLoginCredentials(trimmedLogin, passwordValue);
        } catch {
          await saveLoginCredentials(trimmedLogin, passwordValue);
        }
      } else {
        await clearSavedLoginCredentials();
      }

      await prefetchSessionBootstrap(sessionToken).catch(() => {
        // Tabs will retry if splash prefetch fails.
      });
      setIsPreparingSession(false);
    } catch (err) {
      setIsPreparingSession(false);

      if (err instanceof LoginApiError) {
        if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
          setLockUntilMs(Date.now() + err.retryAfterSeconds * 1000);
          setError(t('login.tooManyAttempts', { seconds: err.retryAfterSeconds }));
        } else if (
          err.code === 'LOGIN_WARNING' &&
          err.remainingAttemptsBeforeLock &&
          err.nextLockMinutes
        ) {
          setError(
            t('login.loginWarning', {
              remaining: err.remainingAttemptsBeforeLock,
              minutes: err.nextLockMinutes,
            }),
          );
        } else {
          setError(t('login.invalidCredentials'));
        }
      } else {
        setError(t('login.failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const lockMessage = isLocked
    ? t('login.tooManyAttempts', { seconds: lockSecondsLeft })
    : error;

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
            editable={!isLocked && !isSubmitting && !isPreparingSession}
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
            placeholder={t('login.passwordPlaceholder')}
            editable={!isLocked && !isSubmitting && !isPreparingSession}
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

          <Pressable
            onPress={() => setSavePasswordEnabled(!savePassword)}
            style={styles.saveRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: savePassword }}>
            {/* Android checkbox keeps an outline when unchecked (iOS Paper hides it). */}
            <Checkbox.Android
              status={savePassword ? 'checked' : 'unchecked'}
              onPress={() => setSavePasswordEnabled(!savePassword)}
              color={colors.primary}
              uncheckedColor={colors.textMuted}
            />
            <Text style={{ color: colors.text, fontSize: fs(14), lineHeight: lh(14), flex: 1 }}>
              {t('login.savePassword')}
            </Text>
          </Pressable>

          {lockMessage ? (
            <HelperText type="error" visible>
              {lockMessage}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isSubmitting || isPreparingSession}
            disabled={isSubmitting || isPreparingSession || isLocked}
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
  saveRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: -4,
  },
  button: {
    marginTop: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
});
