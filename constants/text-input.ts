import { Platform, type TextStyle } from 'react-native';

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

/** Paper Searchbar `inputStyle` — same caret fix for search fields. */
export const searchbarInputStyle: TextStyle = {
  fontSize: 15,
  lineHeight: 20,
  minHeight: 0,
  paddingTop: 0,
  paddingBottom: 0,
  fontFamily: LATIN_FONT_FAMILY,
};
