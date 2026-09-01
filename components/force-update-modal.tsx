import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStatus } from '@/contexts/app-status-context';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { quitApp } from '@/utils/quit-app';

/**
 * Blocking update notice with Quit / Retry.
 * Retry opens the store (and re-checks version). Quit leaves the app.
 */
export function ForceUpdateModal() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const { signOut } = useAuth();
  const { forceUpdateRequired, isChecking, openStore, refreshStatus } = useAppStatus();
  const [isQuitting, setIsQuitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const busy = isChecking || isRetrying || isQuitting;

  const handleRetry = async () => {
    if (busy) {
      return;
    }

    setIsRetrying(true);

    try {
      await openStore();
      await refreshStatus();
    } catch {
      // Keep modal open so the user can quit or try again.
    } finally {
      setIsRetrying(false);
    }
  };

  const handleQuit = async () => {
    if (isQuitting) {
      return;
    }

    setIsQuitting(true);

    try {
      await quitApp(signOut, () => {
        router.replace('/login' as Href);
      });
    } finally {
      setIsQuitting(false);
    }
  };

  return (
    <Modal
      visible={forceUpdateRequired}
      transparent
      animationType="fade"
      onRequestClose={() => {
        handleQuit().catch(() => {});
      }}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.82)' : 'rgba(15,23,42,0.55)' },
        ]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryMuted }]}>
            <MaterialCommunityIcons name="cellphone-arrow-down" size={rs(36)} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text, fontSize: fs(rs(18)), lineHeight: lh(18) }]}>
            {t('update.title')}
          </Text>

          <Text
            style={[styles.body, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
            {t('update.body')}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                handleRetry().catch(() => {});
              }}
              disabled={busy}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.primary,
                  opacity: busy ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button">
              <Text style={[styles.actionText, { color: colors.onPrimary, fontSize: fs(14) }]}>
                {isRetrying || isChecking ? '...' : t('network.retry')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                handleQuit().catch(() => {});
              }}
              disabled={isQuitting}
              style={[
                styles.actionButton,
                styles.quitButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  opacity: isQuitting ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button">
              <Text style={[styles.actionText, { color: colors.text, fontSize: fs(14) }]}>
                {isQuitting ? '...' : t('network.quit')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  actionButton: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  quitButton: {
    borderWidth: 1,
  },
  actionText: {
    fontWeight: '700',
  },
});
