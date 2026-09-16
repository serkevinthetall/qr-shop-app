import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStatus } from '@/contexts/app-status-context';
import { useLanguage } from '@/contexts/language-context';
import { useNetwork } from '@/contexts/network-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { exitAppProcess } from '@/utils/quit-app';

/** Shown when the device is online but the QR Shop API is unreachable. */
export function ServerDownNotice() {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const { isOnline } = useNetwork();
  const { serverDown, forceUpdateRequired, isChecking, refreshStatus } = useAppStatus();
  const [isQuitting, setIsQuitting] = useState(false);

  const visible = serverDown && isOnline && !forceUpdateRequired;
  const busy = isChecking || isQuitting;

  const handleRetry = async () => {
    if (busy) {
      return;
    }

    await refreshStatus();
  };

  const handleQuit = () => {
    if (isQuitting) {
      return;
    }

    setIsQuitting(true);

    try {
      // Exit the app only — do not sign out / clear account.
      exitAppProcess();
    } finally {
      setIsQuitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleQuit}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.45)' },
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
            <MaterialCommunityIcons name="cloud-off-outline" size={rs(36)} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text, fontSize: fs(rs(17)), lineHeight: lh(17) }]}>
            {t('network.serverDownTitle')}
          </Text>

          <Text
            style={[styles.body, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
            {t('network.serverDownBody')}
          </Text>

          <Text
            style={[
              styles.tip,
              { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
            ]}>
            {t('network.serverDownDnsTip')}
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
              onPress={handleQuit}
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
    maxWidth: 300,
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
  body: {
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  tip: {
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
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
