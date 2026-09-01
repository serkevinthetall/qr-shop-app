import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { MYANMAR_FONTS } from '@/constants/fonts';
import type { Language } from '@/constants/translations';

/** Keeps the iOS/Android text caret proportional to the typed characters. */
export const TEXT_INPUT_FONT_SIZE = 16;
export const TEXT_INPUT_LINE_HEIGHT = 20;

const LATIN_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

/**
 * Paper TextInput content style — caps line metrics so the blinking caret
 * does not stretch the full outlined field height (especially with Myanmar fonts).
 */
export const textInputContentStyle: TextStyle = {
  fontSize: TEXT_INPUT_FONT_SIZE,
  lineHeight: TEXT_INPUT_LINE_HEIGHT,
  paddingTop: 0,
  paddingBottom: 0,
  fontFamily: LATIN_FONT_FAMILY,
};

/** Login / password fields are Latin-only — never use Myanmar font metrics. */
export const latinTextInputContentStyle: TextStyle = {
  ...textInputContentStyle,
};

/** External field label above outlined inputs — avoids border-label clipping for Myanmar. */
export function paperFieldLabelStyle(
  language: Language,
  fs: (fontSize: number) => number,
  lh: (fontSize: number) => number | undefined,
  fontSize = 13,
): TextStyle {
  return {
    marginBottom: 6,
    fontWeight: '600',
    fontSize: fs(fontSize),
    lineHeight: lh(fontSize),
    ...(language === 'my' ? { fontFamily: MYANMAR_FONTS.medium } : {}),
  };
}

/**
 * Paper TextInput content — Latin metrics for EN; natural Myanmar metrics for MY
 * (mixed-script placeholders like email + သို့မဟုတ် need room).
 */
export function paperTextInputContentStyle(
  language: Language,
  fs: (fontSize: number) => number,
): TextStyle {
  if (language === 'my') {
    return {
      fontSize: fs(TEXT_INPUT_FONT_SIZE),
      paddingTop: 0,
      paddingBottom: 0,
      fontFamily: MYANMAR_FONTS.regular,
    };
  }

  return latinTextInputContentStyle;
}

/** Extra vertical room for outlined inputs when Myanmar labels/placeholders are shown. */
export function paperTextInputContainerStyle(language: Language): TextStyle {
  // Paper TextInput `style` is StyleProp<TextStyle> — keep this as TextStyle.
  return language === 'my' ? { minHeight: 58, overflow: 'visible' } : {};
}

const LATIN_BUTTON_FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: undefined,
});

/** Paper Button label — avoid fixed lineHeight / Latin-only fonts for Myanmar. */
export function paperButtonLabelStyle(
  language: Language,
  fs: (fontSize: number) => number,
  lh: (fontSize: number) => number | undefined,
  fontSize = 15,
): TextStyle {
  return {
    fontSize: fs(fontSize),
    lineHeight: lh(fontSize),
    fontWeight: '700',
    marginVertical: 0,
    ...(language === 'my'
      ? { fontFamily: MYANMAR_FONTS.bold }
      : { fontFamily: LATIN_BUTTON_FONT, includeFontPadding: false }),
  };
}

/** Taller Paper Button content when Myanmar glyphs need vertical room. */
export function paperButtonContentStyle(language: Language): ViewStyle {
  return language === 'my'
    ? { minHeight: 52, paddingVertical: 10, justifyContent: 'center' }
    : { minHeight: 48, paddingVertical: 8, justifyContent: 'center' };
}

/** Paper Searchbar `inputStyle` — same caret fix for search fields. */
export const searchbarInputStyle: TextStyle = {
  fontSize: 15,
  lineHeight: 20,
  minHeight: 0,
  paddingTop: 0,
  paddingBottom: 0,
  fontFamily: LATIN_FONT_FAMILY,
};
