import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStatus } from '@/contexts/app-status-context';
import { useLanguage } from '@/contexts/language-context';
import { useNetwork } from '@/contexts/network-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

/** Shown when the device is online but the QR Shop API is unreachable. */
export function ServerDownNotice() {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const { isOnline } = useNetwork();
  const { serverDown, forceUpdateRequired, isChecking, refreshStatus } = useAppStatus();

  const visible = serverDown && isOnline && !forceUpdateRequired;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Keep visible until the server responds again.
      }}>
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
            <MaterialCommunityIcons name="server-network-off" size={rs(36)} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text, fontSize: fs(rs(17)), lineHeight: lh(17) }]}>
            {t('network.serverDownTitle')}
          </Text>

          <Text
            style={[styles.body, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
            {t('network.serverDownBody')}
          </Text>

          <Pressable
            onPress={() => {
              refreshStatus().catch(() => {});
            }}
            disabled={isChecking}
            style={[
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: isChecking ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.onPrimary, fontSize: fs(14) }]}>
              {isChecking ? '...' : t('network.tryAgain')}
            </Text>
          </Pressable>
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
    marginBottom: 20,
  },
  button: {
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '700',
  },
});
