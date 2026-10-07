import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeaderBar } from '@/components/detail-header-bar';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { LiquidSurface } from '@/components/liquid-surface';

import { inputCaretProps, latinTextInputContentStyle } from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { changePasswordApi } from '@/services/auth-api';
import { getUserFacingError } from '@/services/auth-error';
import { isLiquidUiEnabled, liquidGlassBorder } from '@/utils/liquid-ui';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { token, signOut } = useAuth();
  const { t, fs, lh } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      setError(t('changePassword.errorNotSignedIn'));
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('changePassword.errorRequired'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('changePassword.errorLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('changePassword.errorMismatch'));
      return;
    }

    if (newPassword === currentPassword) {
      setError(t('changePassword.errorSameAsCurrent'));
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await changePasswordApi(token, currentPassword, newPassword);
      // Password changed: end the session and send the user back to login.
      await signOut();
      router.replace('/login' as Href);
    } catch (err) {
      const message = getUserFacingError(err, t('changePassword.errorFailed'));
      if (message) {
        if (/current password is incorrect/i.test(message)) {
          setError(t('changePassword.errorIncorrect'));
        } else {
          setError(message);
        }
      }
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={liquid ? ['bottom'] : ['top', 'bottom']}>
      <DetailHeaderBar title={t('changePassword.title')} />

      <KeyboardAwareScrollView
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}>
          <LiquidSurface
            style={[styles.card, { borderColor: cardBorder }]}
            backgroundColor={colors.card}
            cornerRadius={16}
            glassStyle="regular"
            interactive>
            <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
              {t('changePassword.subtitle')}
            </Text>

            <TextInput
              label={t('changePassword.currentPassword')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              mode="outlined"
              dense
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              contentStyle={latinTextInputContentStyle}
              right={<TextInput.Icon icon={showCurrent ? 'eye-off' : 'eye'} onPress={() => setShowCurrent((v) => !v)} />}
              style={styles.input}
              {...inputCaretProps(isDark)}
            />

            <TextInput
              label={t('changePassword.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              mode="outlined"
              dense
              secureTextEntry={!showNew}
              autoCapitalize="none"
              contentStyle={latinTextInputContentStyle}
              right={<TextInput.Icon icon={showNew ? 'eye-off' : 'eye'} onPress={() => setShowNew((v) => !v)} />}
              style={styles.input}
              {...inputCaretProps(isDark)}
            />

            <TextInput
              label={t('changePassword.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              dense
              secureTextEntry={!showNew}
              autoCapitalize="none"
              contentStyle={latinTextInputContentStyle}
              style={styles.input}
              {...inputCaretProps(isDark)}
            />

            {error ? (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              contentStyle={styles.submitButtonContent}
              style={styles.submitButton}>
              {t('changePassword.submit')}
            </Button>
          </LiquidSurface>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  subtitle: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 12,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
});
