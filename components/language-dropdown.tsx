import { Platform, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import { MYANMAR_FONTS } from '@/constants/fonts';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

const MIN_SEGMENT_HEIGHT = 52;
const ENGLISH_FONT_SIZE = 14;
/** Slightly smaller than English — Burmese glyphs read larger at the same pt size. */
const MYANMAR_FONT_SCALE = 0.85;

const ENGLISH_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: undefined,
});

export function LanguageDropdown() {
  const { language, setLanguage } = useLanguage();
  const colors = useAppColors();
  const { rs } = useResponsive();

  const burmeseFontSize = rs(Math.round(ENGLISH_FONT_SIZE * MYANMAR_FONT_SCALE));
  const englishFontSize = rs(ENGLISH_FONT_SIZE);

  const mySelected = language === 'my';
  const enSelected = language === 'en';

  return (
    <View style={[styles.track, { borderColor: colors.border }]}>
      <Button
        mode="contained-tonal"
        onPress={() => setLanguage('my')}
        buttonColor={mySelected ? colors.primaryContainer : colors.inputBg}
        textColor={mySelected ? colors.onPrimaryContainer : colors.text}
        style={styles.half}
        contentStyle={styles.content}
        labelStyle={[
          styles.label,
          styles.myanmarLabel,
          { fontSize: burmeseFontSize, fontFamily: MYANMAR_FONTS.medium },
        ]}>
        မြန်မာ
      </Button>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Button
        mode="contained-tonal"
        onPress={() => setLanguage('en')}
        buttonColor={enSelected ? colors.primaryContainer : colors.inputBg}
        textColor={enSelected ? colors.onPrimaryContainer : colors.text}
        style={styles.half}
        contentStyle={styles.content}
        labelStyle={[
          styles.label,
          {
            fontSize: englishFontSize,
            fontFamily: ENGLISH_FONT_FAMILY,
            fontWeight: '600',
          },
        ]}>
        English
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginTop: 16,
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    minHeight: MIN_SEGMENT_HEIGHT,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  half: {
    flex: 1,
    borderRadius: 0,
    margin: 0,
  },
  content: {
    minHeight: MIN_SEGMENT_HEIGHT,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  label: {
    marginVertical: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  myanmarLabel: {
    // Burmese glyphs need natural metrics — a fixed lineHeight clips them.
    lineHeight: undefined,
  },
});
