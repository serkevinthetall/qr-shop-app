import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useKeyboardBottomPadding(extra = 24) {
  const insets = useSafeAreaInsets();
  const [padding, setPadding] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setPadding(Math.max(0, event.endCoordinates.height - insets.bottom + extra));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setPadding(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [extra, insets.bottom]);

  return padding;
}
