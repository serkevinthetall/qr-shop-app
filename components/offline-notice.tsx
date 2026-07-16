import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppToast } from '@/components/app-toast';
import { useLanguage } from '@/contexts/language-context';
import { useNetwork } from '@/contexts/network-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

/**
 * Minimal offline notice: internet icon + short note. Light/dark aware.
 */
export function OfflineNotice() {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const { isOnline, isChecking, refresh } = useNetwork();

  const [visible, setVisible] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setVisible(true);
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setVisible(false);
      setSnackbar(t('network.backOnline'));
    }
  }, [isOnline, t]);

  const handleTryAgain = async () => {
    const online = await refresh();
    if (online) {
      setVisible(false);
      setSnackbar(t('network.backOnline'));
      return;
    }
    setSnackbar(t('network.stillOffline'));
  };

  const iconColor = colors.isDark ? colors.primary : colors.primary;
  const iconBg = colors.primaryMuted;

  return (
    <>
      <Modal
        visible={visible && !isOnline}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}>
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
            <Pressable
              onPress={() => setVisible(false)}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <MaterialCommunityIcons name="close" size={rs(22)} color={colors.textMuted} />
            </Pressable>

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

            <Pressable
              onPress={handleTryAgain}
              disabled={isChecking}
              style={[
                styles.retry,
                {
                  backgroundColor: colors.primary,
                  opacity: isChecking ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button">
              <Text style={[styles.retryText, { color: colors.onPrimary, fontSize: fs(14) }]}>
                {isChecking ? '...' : t('network.tryAgain')}
              </Text>
            </Pressable>
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
  closeButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
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
  retry: {
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  retryText: {
    fontWeight: '700',
  },
});
