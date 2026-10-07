import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { MYANMAR_FONTS } from '@/constants/fonts';
import type { Language } from '@/constants/translations';

/** Keeps the iOS/Android text caret proportional to the typed characters. */
export const TEXT_INPUT_FONT_SIZE = 16;
export const TEXT_INPUT_LINE_HEIGHT = 20;

/**
 * Avoid Paper's brand teal on Android text-selection handles (the big teardrop).
 * Light: dark slate. Dark: light slate so the caret stays visible on dark fields.
 */
export const INPUT_CURSOR_COLOR = '#334155';
export const INPUT_SELECTION_COLOR = 'rgba(51, 65, 85, 0.28)';
export const INPUT_CURSOR_COLOR_DARK = '#E2E8F0';
export const INPUT_SELECTION_COLOR_DARK = 'rgba(226, 232, 240, 0.35)';

export function inputCaretProps(isDark = false) {
  return {
    cursorColor: isDark ? INPUT_CURSOR_COLOR_DARK : INPUT_CURSOR_COLOR,
    selectionColor: isDark ? INPUT_SELECTION_COLOR_DARK : INPUT_SELECTION_COLOR,
  } as const;
}

const LATIN_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

/** Shared metrics so EN and MY carets match (Myanmar fonts otherwise stretch the handle). */
const CARET_SAFE_METRICS: TextStyle = {
  lineHeight: TEXT_INPUT_LINE_HEIGHT,
  paddingTop: 0,
  paddingBottom: 0,
  ...(Platform.OS === 'android'
    ? { includeFontPadding: false, textAlignVertical: 'center' as const }
    : null),
};

/**
 * Paper TextInput content style — caps line metrics so the blinking caret
 * does not stretch the full outlined field height (especially with Myanmar fonts).
 */
export const textInputContentStyle: TextStyle = {
  fontSize: TEXT_INPUT_FONT_SIZE,
  ...CARET_SAFE_METRICS,
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
 * Paper TextInput content — same caret metrics as English; Myanmar only swaps fontFamily.
 */
export function paperTextInputContentStyle(
  language: Language,
  fs: (fontSize: number) => number,
): TextStyle {
  if (language === 'my') {
    return {
      fontSize: fs(TEXT_INPUT_FONT_SIZE),
      ...CARET_SAFE_METRICS,
      fontFamily: MYANMAR_FONTS.regular,
    };
  }

  return latinTextInputContentStyle;
}

/** Keep container height stable — overflow:visible made Android handles stick out of the field. */
export function paperTextInputContainerStyle(language: Language): TextStyle {
  return language === 'my' ? { minHeight: 58 } : {};
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

/**
 * Search fields.
 * Myanmar: give the input a mid-height box centered in the pill.
 * Do NOT use Latin lineHeight / tiny height — that clips Burmese marks.
 */
export const searchbarInputStyle: TextStyle = {
  fontSize: 15,
  minHeight: 0,
  ...CARET_SAFE_METRICS,
  fontFamily: LATIN_FONT_FAMILY,
};

export function searchbarInputStyleFor(language: Language): TextStyle {
  if (language === 'my') {
    return {
      fontSize: 15,
      fontFamily: MYANMAR_FONTS.regular,
      // Tall enough for ascenders/descenders; short enough to sit mid-pill.
      // (height:22 + lineHeight:20 was clipping and shoving glyphs to the top.)
      height: 30,
      maxHeight: 30,
      minHeight: 30,
      paddingTop: 0,
      paddingBottom: 0,
      alignSelf: 'center',
      ...(Platform.OS === 'android'
        ? { includeFontPadding: false, textAlignVertical: 'center' as const }
        : null),
    };
  }

  return searchbarInputStyle;
}
