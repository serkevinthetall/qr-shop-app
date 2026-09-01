import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppToast } from '@/components/app-toast';
import { useAppStatus } from '@/contexts/app-status-context';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useNetwork } from '@/contexts/network-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { quitApp } from '@/utils/quit-app';

/**
 * Offline notice with Quit / Retry.
 * Retry re-checks connectivity. Quit leaves the app.
 */
export function OfflineNotice() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const { signOut } = useAuth();
  const { isOnline, isChecking, refresh, setSimulateOffline } = useNetwork();
  const { forceUpdateRequired } = useAppStatus();

  const [visible, setVisible] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [quitDismissed, setQuitDismissed] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      if (!quitDismissed) {
        setVisible(true);
      }
      return;
    }

    setQuitDismissed(false);

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setVisible(false);
      setSnackbar(t('network.backOnline'));
    }
  }, [isOnline, quitDismissed, t]);

  const busy = isChecking || isQuitting;
  const showModal = visible && !isOnline && !forceUpdateRequired;

  const handleRetry = async () => {
    if (busy) {
      return;
    }

    setQuitDismissed(false);
    const online = await refresh();

    if (online) {
      setVisible(false);
      setSnackbar(t('network.backOnline'));
      return;
    }

    setSnackbar(t('network.stillOffline'));
  };

  const handleQuit = async () => {
    if (isQuitting) {
      return;
    }

    setIsQuitting(true);
    setSimulateOffline(false);
    setQuitDismissed(true);
    setVisible(false);

    try {
      await quitApp(signOut, () => {
        router.replace('/login' as Href);
      });
    } finally {
      setIsQuitting(false);
    }
  };

  return (
    <>
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          handleQuit().catch(() => {});
        }}>
        <View
          style={[
            styles.backdrop,
            { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.4)' },
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
              <MaterialCommunityIcons name="wifi-off" size={rs(36)} color={colors.primary} />
            </View>

            <Text style={[styles.title, { color: colors.text, fontSize: fs(rs(17)), lineHeight: lh(17) }]}>
              {t('network.offlineTitle')}
            </Text>

            <Text
              style={[
                styles.note,
                { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) },
              ]}>
              {t('network.shortNote')}
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
                  {isChecking ? '...' : t('network.retry')}
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

      <AppToast
        message={snackbar}
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        bottomOffset={24}
      />
    </>
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
    maxWidth: 280,
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
    marginBottom: 8,
  },
  note: {
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
