import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppToast } from '@/components/app-toast';
import { useAppStatus } from '@/contexts/app-status-context';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useNetwork } from '@/contexts/network-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

/** Expo Go / iOS cannot kill the process; leave the session instead. */
async function quitSession(signOut: () => Promise<void>, goLogin: () => void) {
  try {
    await signOut();
  } catch {
    // Continue navigation even if logout API fails.
  }

  goLogin();

  const inExpoGo = Constants.appOwnership === 'expo';

  if (Platform.OS === 'android' && !inExpoGo) {
    BackHandler.exitApp();
  }
}

/**
 * Minimal offline notice: internet icon + short note. Light/dark aware.
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

  const handleRetry = async () => {
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
      await quitSession(signOut, () => {
        router.replace('/login' as Href);
      });
    } finally {
      setIsQuitting(false);
    }
  };

  const iconColor = colors.isDark ? colors.primary : colors.primary;
  const iconBg = colors.primaryMuted;
  const showModal = visible && !isOnline && !forceUpdateRequired;

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
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialCommunityIcons name="wifi-off" size={rs(36)} color={iconColor} />
            </View>

            <Text
              style={[
                styles.note,
                { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) },
              ]}>
              {t('network.shortNote')}
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={handleRetry}
                disabled={isChecking || isQuitting}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: isChecking || isQuitting ? 0.7 : 1,
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
    paddingTop: 36,
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
  note: {
    fontWeight: '600',
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
