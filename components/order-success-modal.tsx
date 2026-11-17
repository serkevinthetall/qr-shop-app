import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { LiquidSurface } from '@/components/liquid-surface';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { isLiquidUiEnabled, liquidGlassBorder } from '@/utils/liquid-ui';

type OrderSuccessModalProps = {
  visible: boolean;
  onDone: () => void;
};

/** Rounded order-success dialog (native Alert is a sharp rectangle on Android). */
export function OrderSuccessModal({ visible, onDone }: OrderSuccessModalProps) {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(15,23,42,0.55)' },
        ]}>
        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive
          cornerRadius={20}>
          <Text
            style={[
              styles.title,
              { color: colors.text, fontSize: fs(rs(18)), lineHeight: lh(18) },
            ]}>
            {t('checkout.successTitle')}
          </Text>

          <Text
            style={[
              styles.body,
              { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) },
            ]}>
            {t('checkout.successMessage')}
          </Text>

          <Pressable
            onPress={onDone}
            style={[styles.button, { backgroundColor: colors.primary }]}
            accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.onPrimary, fontSize: fs(14) }]}>
              {t('common.done')}
            </Text>
          </Pressable>
        </LiquidSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 22,
    alignItems: 'stretch',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontWeight: '500',
    textAlign: 'left',
    marginBottom: 22,
  },
  button: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '700',
  },
});
