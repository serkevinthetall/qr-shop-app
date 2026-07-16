import { forwardRef, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useKeyboardBottomPadding } from '@/hooks/use-keyboard-bottom-padding';

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  children: ReactNode;
  /** Kept for API compatibility; iOS uses system keyboard insets instead. */
  keyboardVerticalOffset?: number;
  style?: StyleProp<ViewStyle>;
  extraBottomPadding?: number;
};

/**
 * ScrollView that keeps fields usable with the keyboard.
 * - iOS: system `automaticallyAdjustKeyboardInsets` only (no KeyboardAvoidingView
 *   padding — that was creating the empty white block above the keyboard).
 * - Android: adds keyboard height as bottom content padding.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      children,
      contentContainerStyle,
      keyboardVerticalOffset: _keyboardVerticalOffset = 0,
      extraBottomPadding = 16,
      style,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'interactive',
      ...scrollProps
    },
    ref,
  ) {
    const androidKeyboardPadding = useKeyboardBottomPadding(
      Platform.OS === 'android' ? extraBottomPadding : 0,
    );

    return (
      <ScrollView
        ref={ref}
        style={[styles.flex, style]}
        {...scrollProps}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          contentContainerStyle,
          androidKeyboardPadding > 0 ? { paddingBottom: androidKeyboardPadding } : null,
        ]}>
        {children}
      </ScrollView>
    );
  },
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
