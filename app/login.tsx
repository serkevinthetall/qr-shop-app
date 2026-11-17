import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Checkbox, HelperText, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { LanguageToggleChip } from '@/components/language-toggle-chip';
import { LiquidSurface } from '@/components/liquid-surface';
import {
  inputCaretProps,
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
import {
  fetchPublishedTownships,
  type PublishedTownship,
} from '@/services/address-api';
import { isLikelyNetworkErrorMessage } from '@/services/auth-error';
import { LoginApiError } from '@/services/auth-api';
import { prefetchSessionBootstrap } from '@/services/catalog-bootstrap';
import {
  clearSavedLoginCredentials,
  loadSavedLoginCredentials,
  saveLoginCredentials,
} from '@/services/saved-login';
import { consumeSessionExpiredLoginHint } from '@/services/session-expired';
import { withHapticPress } from '@/utils/haptics';
import { isLiquidUiEnabled, liquidGlassBorder, liquidGlassFill } from '@/utils/liquid-ui';

const LOGO_LIGHT = require('@/assets/images/icon.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs, contentMaxWidth, horizontalPadding } = useResponsive();
  const { t, fs, lh, language } = useLanguage();
  const { user, signIn, signUp } = useAuth();
  const keyboardPadding = useKeyboardBottomPadding(32);
  const [mode, setMode] = useState<AuthMode>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [stateKey, setStateKey] = useState('');
  const [townshipId, setTownshipId] = useState('');
  const [townships, setTownships] = useState<PublishedTownship[]>([]);
  const [stateOpen, setStateOpen] = useState(false);
  const [townshipOpen, setTownshipOpen] = useState(false);
  const [townshipQuery, setTownshipQuery] = useState('');
  const [savePassword, setSavePassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
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
  const liquid = isLiquidUiEnabled();
  const isRegister = mode === 'register';

  const cleanState = useCallback((value: string) => {
    return String(value || '')
      .replace(/\s*\(MM\)\s*$/i, '')
      .trim();
  }, []);

  const allStates = useMemo(() => {
    const set = new Set<string>();
    for (const row of townships) {
      const key = cleanState(row.state);
      if (key) set.add(key);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [townships, cleanState]);

  const selectedTownship = useMemo(
    () => townships.find((row) => row.id === townshipId) || null,
    [townships, townshipId],
  );

  const townshipsInState = useMemo(() => {
    if (!stateKey) return [];
    return townships.filter((row) => cleanState(row.state) === stateKey);
  }, [townships, stateKey, cleanState]);

  const filteredTownships = useMemo(() => {
    const q = townshipQuery.trim().toLowerCase();
    if (!q) return townshipsInState.slice(0, 80);
    return townshipsInState
      .filter((row) => {
        const hay = `${row.name} ${row.nameMm || ''} ${row.postalCode || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 80);
  }, [townshipsInState, townshipQuery]);

  const pickState = useCallback(
    (next: string) => {
      setStateKey(next);
      setStateOpen(false);
      setTownshipOpen(false);
      setTownshipQuery('');
      if (next !== stateKey) {
        setTownshipId('');
      }
    },
    [stateKey],
  );

  const pickTownship = useCallback((row: PublishedTownship) => {
    setTownshipId(row.id);
    setTownshipOpen(false);
    setTownshipQuery('');
  }, []);

  useEffect(() => {
    savePasswordRef.current = savePassword;
  }, [savePassword]);

  useEffect(() => {
    if (!isRegister) return;
    let cancelled = false;
    void fetchPublishedTownships()
      .then((rows) => {
        if (!cancelled) setTownships(rows);
      })
      .catch(() => {
        if (!cancelled) setTownships([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isRegister]);

  useFocusEffect(
    useCallback(() => {
      if (consumeSessionExpiredLoginHint()) {
        setError(t('login.sessionExpired'));
      }
    }, [t]),
  );

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

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setConfirmPassword('');
    setStateOpen(false);
    setTownshipOpen(false);
    if (next === 'register' && login.trim()) {
      if (login.includes('@')) {
        setEmail(login.trim());
      } else {
        setPhone(login.trim());
      }
    }
  };

  if (user && !isPreparingSession) {
    return <Redirect href="/(tabs)" />;
  }

  const finishSession = async (sessionToken: string, saveLogin: string, savePass: string) => {
    // Never fail login because "Save password" storage failed (common on web).
    try {
      if (savePasswordRef.current) {
        try {
          await saveLoginCredentials(saveLogin, savePass);
        } catch {
          await saveLoginCredentials(saveLogin, savePass).catch(() => undefined);
        }
      } else {
        await clearSavedLoginCredentials().catch(() => undefined);
      }
    } catch {
      // Ignore credential-store errors after a successful API login.
    }
    await prefetchSessionBootstrap(sessionToken).catch(() => {
      // Tabs will retry if splash prefetch fails.
    });
    setIsPreparingSession(false);
  };

  const handleLogin = async () => {
    if (isLocked || isSubmitting || isPreparingSession) {
      return;
    }

    Keyboard.dismiss();
    setError('');

    const trimmedLogin = login.trim();
    const passwordValue = password;

    if (!trimmedLogin || !passwordValue) {
      setError(t('login.requiredFields'));
      return;
    }

    if (trimmedLogin.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedLogin)) {
      setError(t('login.invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    setIsPreparingSession(true);

    try {
      const sessionToken = await signIn(trimmedLogin, passwordValue);
      await finishSession(sessionToken, trimmedLogin, passwordValue);
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
        } else if (
          err.code === 'wrong_role' ||
          /not a buyer|not buyer|is merchant|is admin/i.test(err.message)
        ) {
          setError(t('login.wrongRole'));
        } else if (
          err.code === 'one_time_account' ||
          /one-time account/i.test(err.message)
        ) {
          setError(t('login.oneTimeAccount'));
        } else {
          setError(t('login.invalidCredentials'));
        }
      } else if (err instanceof Error && isLikelyNetworkErrorMessage(err.message)) {
        setError(err.message);
      } else {
        setError(t('login.failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (isSubmitting || isPreparingSession) {
      return;
    }

    Keyboard.dismiss();
    setError('');

    const nameValue = fullName.trim();
    const phoneValue = phone.trim();
    const emailValue = email.trim().toLowerCase();
    const streetValue = street.trim();
    const passwordValue = password;
    const confirmValue = confirmPassword;

    if (
      !nameValue ||
      !phoneValue ||
      !emailValue ||
      !streetValue ||
      !townshipId ||
      !passwordValue
    ) {
      setError(t('login.registerRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError(t('login.invalidEmail'));
      return;
    }
    if (passwordValue.length < 4) {
      setError(t('login.passwordShort'));
      return;
    }
    if (passwordValue !== confirmValue) {
      setError(t('login.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    setIsPreparingSession(true);

    try {
      const sessionToken = await signUp({
        name: nameValue,
        phone: phoneValue,
        email: emailValue,
        street: streetValue,
        townshipId,
        password: passwordValue,
      });
      await finishSession(sessionToken, emailValue || phoneValue, passwordValue);
    } catch (err) {
      setIsPreparingSession(false);
      if (err instanceof LoginApiError) {
        if (err.status === 409 || /already registered/i.test(err.message)) {
          setError(
            /email/i.test(err.message) ? t('login.emailTaken') : t('login.phoneTaken'),
          );
        } else {
          setError(err.message || t('login.registerFailed'));
        }
      } else if (err instanceof Error) {
        setError(err.message || t('login.registerFailed'));
      } else {
        setError(t('login.registerFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const lockMessage = isLocked
    ? t('login.tooManyAttempts', { seconds: lockSecondsLeft })
    : error;

  const busy = isSubmitting || isPreparingSession;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        extraBottomPadding={48}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            justifyContent: keyboardOpen || isRegister ? 'flex-start' : 'center',
            paddingTop: keyboardOpen || isRegister ? rs(20) : 32,
          },
        ]}>
        <LiquidSurface
          style={[
            styles.card,
            {
              borderColor: liquid ? liquidGlassBorder(isDark) : colors.border,
              maxWidth: contentMaxWidth,
            },
          ]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <LanguageToggleChip
            style={[
              styles.languageChip,
              {
                backgroundColor: liquid ? liquidGlassFill(isDark) : colors.card,
                borderWidth: 0,
              },
            ]}
          />

          <Image
            source={logoSource}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
            accessibilityLabel="QR Shop Myanmar"
          />

          {isRegister ? (
            <>
              <Text
                style={{
                  alignSelf: 'stretch',
                  marginBottom: 12,
                  fontSize: fs(18),
                  lineHeight: lh(18),
                  fontWeight: '700',
                  color: colors.text,
                }}>
                {t('login.registerTitle')}
              </Text>

              <TextInput
                label={t('login.fullName')}
                value={fullName}
                onChangeText={setFullName}
                mode="outlined"
                dense={language !== 'my'}
                autoCapitalize="words"
                placeholder={t('login.fullNamePlaceholder')}
                editable={!busy}
                style={[styles.input, inputContainerStyle]}
                contentStyle={latinTextInputContentStyle}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField((current) => (current === 'name' ? null : current))}
                {...inputCaretProps(isDark)}
              />

              <TextInput
                label={t('login.phone')}
                value={phone}
                onChangeText={setPhone}
                mode="outlined"
                dense={language !== 'my'}
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder={t('login.phonePlaceholder')}
                editable={!busy}
                style={[styles.input, inputContainerStyle]}
                contentStyle={latinTextInputContentStyle}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField((current) => (current === 'phone' ? null : current))}
                {...inputCaretProps(isDark)}
              />

              <TextInput
                label={t('login.email')}
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                dense={language !== 'my'}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder={t('login.emailPlaceholder')}
                editable={!busy}
                style={[styles.input, inputContainerStyle]}
                contentStyle={latinTextInputContentStyle}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField((current) => (current === 'email' ? null : current))}
                {...inputCaretProps(isDark)}
              />

              <TextInput
                label={t('login.street')}
                value={street}
                onChangeText={setStreet}
                mode="outlined"
                dense={language !== 'my'}
                placeholder={t('login.streetPlaceholder')}
                editable={!busy}
                style={[styles.input, inputContainerStyle]}
                contentStyle={latinTextInputContentStyle}
                onFocus={() => setFocusedField('street')}
                onBlur={() => setFocusedField((current) => (current === 'street' ? null : current))}
                {...inputCaretProps(isDark)}
              />

              <View style={styles.dropdownBlock}>
                <Text style={{ color: colors.textMuted, fontSize: fs(12), marginBottom: 6 }}>
                  {t('login.state')}
                </Text>
                <Pressable
                  onPress={() => {
                    setStateOpen((open) => !open);
                    setTownshipOpen(false);
                  }}
                  style={[
                    styles.dropdownTrigger,
                    {
                      borderColor: stateKey ? colors.primary : colors.border,
                      backgroundColor: stateKey ? colors.primaryMuted : colors.card,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: stateOpen }}
                  accessibilityLabel={t('login.state')}>
                  <Text
                    style={{
                      color: stateKey ? colors.text : colors.textMuted,
                      fontSize: fs(15),
                      flex: 1,
                    }}
                    numberOfLines={1}>
                    {stateKey || t('login.statePlaceholder')}
                  </Text>
                  <MaterialCommunityIcons
                    name={stateOpen ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={colors.textMuted}
                  />
                </Pressable>
                {stateOpen ? (
                  <View
                    style={[
                      styles.dropdownPanel,
                      { borderColor: colors.border, backgroundColor: colors.card },
                    ]}>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={styles.dropdownScroll}>
                      {allStates.map((item) => {
                        const on = item === stateKey;
                        return (
                          <Pressable
                            key={item}
                            onPress={() => pickState(item)}
                            style={[
                              styles.dropdownRow,
                              {
                                borderBottomColor: colors.border,
                                backgroundColor: on ? colors.primaryMuted : colors.card,
                              },
                            ]}>
                            <Text
                              style={{
                                color: on ? colors.primary : colors.text,
                                fontSize: fs(14),
                                fontWeight: on ? '700' : '500',
                              }}
                              numberOfLines={1}>
                              {item}
                            </Text>
                          </Pressable>
                        );
                      })}
                      {allStates.length === 0 ? (
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontSize: fs(13),
                            padding: 12,
                            textAlign: 'center',
                          }}>
                          {t('products.empty')}
                        </Text>
                      ) : null}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View style={[styles.dropdownBlock, { opacity: stateKey ? 1 : 0.55 }]}>
                <Text style={{ color: colors.textMuted, fontSize: fs(12), marginBottom: 6 }}>
                  {t('login.township')}
                </Text>
                <Pressable
                  onPress={() => {
                    if (!stateKey) {
                      setError(t('login.townshipNeedState'));
                      return;
                    }
                    setError('');
                    setTownshipOpen((open) => !open);
                    setStateOpen(false);
                  }}
                  style={[
                    styles.dropdownTrigger,
                    {
                      borderColor: selectedTownship ? colors.primary : colors.border,
                      backgroundColor: selectedTownship ? colors.primaryMuted : colors.card,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: townshipOpen, disabled: !stateKey }}
                  accessibilityLabel={t('login.township')}>
                  <Text
                    style={{
                      color: selectedTownship ? colors.text : colors.textMuted,
                      fontSize: fs(15),
                      flex: 1,
                    }}
                    numberOfLines={1}>
                    {selectedTownship
                      ? selectedTownship.name
                      : stateKey
                        ? t('login.townshipPlaceholder')
                        : t('login.townshipNeedState')}
                  </Text>
                  <MaterialCommunityIcons
                    name={townshipOpen ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={colors.textMuted}
                  />
                </Pressable>
                {townshipOpen && stateKey ? (
                  <View
                    style={[
                      styles.dropdownPanel,
                      { borderColor: colors.border, backgroundColor: colors.card },
                    ]}>
                    <TextInput
                      value={townshipQuery}
                      onChangeText={setTownshipQuery}
                      mode="outlined"
                      dense
                      placeholder={t('login.townshipPlaceholder')}
                      style={styles.dropdownSearch}
                      contentStyle={latinTextInputContentStyle}
                      {...inputCaretProps(isDark)}
                    />
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={styles.dropdownScroll}>
                      {filteredTownships.map((item) => {
                        const on = item.id === townshipId;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => pickTownship(item)}
                            style={[
                              styles.dropdownRow,
                              {
                                borderBottomColor: colors.border,
                                backgroundColor: on ? colors.primaryMuted : colors.card,
                              },
                            ]}>
                            <Text
                              style={{
                                color: on ? colors.primary : colors.text,
                                fontSize: fs(14),
                                fontWeight: on ? '700' : '500',
                              }}
                              numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.postalCode ? (
                              <Text
                                style={{
                                  color: colors.textMuted,
                                  fontSize: fs(11),
                                  marginTop: 2,
                                }}>
                                {item.postalCode}
                              </Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                      {filteredTownships.length === 0 ? (
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontSize: fs(13),
                            padding: 12,
                            textAlign: 'center',
                          }}>
                          {t('products.empty')}
                        </Text>
                      ) : null}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <TextInput
                label={t('login.password')}
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                dense={language !== 'my'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder={t('login.passwordPlaceholder')}
                editable={!busy}
                style={[styles.input, inputContainerStyle]}
                contentStyle={latinTextInputContentStyle}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword((prev) => !prev)}
                  />
                }
                onFocus={() => setFocusedField('password')}
                onBlur={() =>
                  setFocusedField((current) => (current === 'password' ? null : current))
                }
                {...inputCaretProps(isDark)}
              />

              <TextInput
                label={t('login.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                mode="outlined"
                dense={language !== 'my'}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                placeholder={t('login.passwordPlaceholder')}
                editable={!busy}
                style={[styles.input, inputContainerStyle]}
                contentStyle={latinTextInputContentStyle}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                  />
                }
                onFocus={() => setFocusedField('confirm')}
                onBlur={() =>
                  setFocusedField((current) => (current === 'confirm' ? null : current))
                }
                {...inputCaretProps(isDark)}
              />
            </>
          ) : (
            <>
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
                editable={!isLocked && !busy}
                style={[styles.input, inputContainerStyle]}
                contentStyle={latinTextInputContentStyle}
                onFocus={() => setFocusedField('login')}
                onBlur={() => setFocusedField((current) => (current === 'login' ? null : current))}
                {...inputCaretProps(isDark)}
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
                editable={!isLocked && !busy}
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
                onBlur={() =>
                  setFocusedField((current) => (current === 'password' ? null : current))
                }
                {...inputCaretProps(isDark)}
              />

              <Pressable
                onPress={() => setSavePasswordEnabled(!savePassword)}
                style={styles.saveRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: savePassword }}>
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
            </>
          )}

          {lockMessage ? (
            <HelperText type="error" visible>
              {lockMessage}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={withHapticPress(isRegister ? handleRegister : handleLogin, 'medium')}
            loading={busy}
            disabled={busy || (!isRegister && isLocked)}
            style={styles.button}
            contentStyle={paperButtonContentStyle(language)}
            labelStyle={paperButtonLabelStyle(language, fs, lh, 15)}>
            {isPreparingSession
              ? t('login.loadingShop')
              : isRegister
                ? t('login.register')
                : t('login.signIn')}
          </Button>

          <View style={styles.switchRow}>
            <Text style={{ color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }}>
              {isRegister ? t('login.haveAccount') : t('login.noAccount')}{' '}
            </Text>
            <Pressable
              onPress={() => switchMode(isRegister ? 'login' : 'register')}
              hitSlop={8}
              accessibilityRole="button">
              <Text
                style={{
                  color: colors.primary,
                  fontSize: fs(13),
                  lineHeight: lh(13),
                  fontWeight: '700',
                }}>
                {isRegister ? t('login.signIn') : t('login.createAccount')}
              </Text>
            </Pressable>
          </View>
        </LiquidSurface>
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
  dropdownBlock: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 12,
    zIndex: 2,
  },
  dropdownTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownPanel: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownSearch: {
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  switchRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
