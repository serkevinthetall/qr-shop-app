import { Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';

const LANG_EN_TO_MY_LIGHT = require('@/assets/images/lang-en-to-my-light.png');
const LANG_EN_TO_MY_DARK = require('@/assets/images/lang-en-to-my-dark.png');
const LANG_MY_TO_EN_LIGHT = require('@/assets/images/lang-my-to-en-light.png');
const LANG_MY_TO_EN_DARK = require('@/assets/images/lang-my-to-en-dark.png');

type LanguageToggleChipProps = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function LanguageToggleChip({ onPress, style }: LanguageToggleChipProps) {
  const colors = useAppColors();
  const { t, language, setLanguage } = useLanguage();

  const handlePress = onPress ?? (() => setLanguage(language === 'my' ? 'en' : 'my'));
  const iconSource =
    language === 'my'
      ? colors.isDark
        ? LANG_MY_TO_EN_DARK
        : LANG_MY_TO_EN_LIGHT
      : colors.isDark
        ? LANG_EN_TO_MY_DARK
        : LANG_EN_TO_MY_LIGHT;

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.button,
        { backgroundColor: colors.inputBg, borderColor: colors.border },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        language === 'my' ? t('products.switchToEn') : t('products.switchToMy')
      }>
      <Image source={iconSource} style={styles.icon} resizeMode="contain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  icon: {
    width: 34,
    height: 34,
  },
});
