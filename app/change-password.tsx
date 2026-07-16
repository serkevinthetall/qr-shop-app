import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';

import { latinTextInputContentStyle } from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { changePasswordApi } from '@/services/auth-api';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { token, signOut } = useAuth();
  const { t, fs, lh } = useLanguage();

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

    setError('');
    setIsSubmitting(true);

    try {
      await changePasswordApi(token, currentPassword, newPassword);
      // Password changed: end the session and send the user back to login.
      await signOut();
      router.replace('/login' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('changePassword.errorFailed'));
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View
        style={[
          styles.headerBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingHorizontal: horizontalPadding },
        ]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(rs(20)), lineHeight: lh(20) }]} numberOfLines={1}>
          {t('changePassword.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
          </View>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
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
