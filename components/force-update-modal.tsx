import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStatus } from '@/contexts/app-status-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

/** Blocking update dialog — Update only, no dismiss / Later. */
export function ForceUpdateModal() {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const { forceUpdateRequired, openStore, storeUrl, isChecking } = useAppStatus();

  return (
    <Modal
      visible={forceUpdateRequired}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Hard update: ignore Android back.
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

          <Pressable
            onPress={() => {
              openStore().catch(() => {});
            }}
            disabled={isChecking || !storeUrl}
            style={[
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: !storeUrl ? 0.55 : 1,
              },
            ]}
            accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.onPrimary, fontSize: fs(15) }]}>
              {t('update.button')}
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
    marginBottom: 22,
  },
  button: {
    minWidth: 160,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '700',
  },
});
