import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { IconButton } from 'react-native-paper';

import { inputCaretProps } from '@/constants/text-input';
import { useThemeMode } from '@/contexts/theme-context';
import { hapticLight } from '@/utils/haptics';

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  onDecreaseAtMin?: () => void;
  fontSize?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  onDecreaseAtMin,
  fontSize = 16,
  iconSize = 18,
  style,
  borderColor,
  backgroundColor,
  textColor,
}: QuantityStepperProps) {
  const { isDark } = useThemeMode();
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const resolveDraftValue = () => {
    const parsed = Number.parseInt(draft, 10);
    return Number.isFinite(parsed) ? parsed : value;
  };

  const commitDraft = () => {
    const parsed = resolveDraftValue();

    if (parsed < min) {
      if (onDecreaseAtMin) {
        onDecreaseAtMin();
        return;
      }

      onChange(min);
      setDraft(String(min));
      return;
    }

    const next = max != null ? Math.min(parsed, max) : parsed;
    onChange(next);
    setDraft(String(next));
  };

  const handleDecrease = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    hapticLight();

    const current = resolveDraftValue();
    if (current <= min) {
      onDecreaseAtMin?.();
      return;
    }

    onChange(current - 1);
  };

  const handleIncrease = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    hapticLight();

    const current = resolveDraftValue();
    const next = max != null ? Math.min(current + 1, max) : current + 1;
    onChange(next);
  };

  return (
    <View style={[styles.stepper, { borderColor, backgroundColor }, style]}>
      <IconButton
        icon="minus"
        size={iconSize}
        onPress={handleDecrease}
        iconColor={textColor}
        style={styles.stepperButton}
      />
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={(text) => setDraft(text.replace(/\D/g, ''))}
        onBlur={commitDraft}
        onSubmitEditing={() => {
          commitDraft();
          inputRef.current?.blur();
          Keyboard.dismiss();
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={6}
        style={[styles.input, { color: textColor, fontSize, lineHeight: Math.round(fontSize * 1.25) }]}
        {...inputCaretProps(isDark)}
      />
      <IconButton
        icon="plus"
        size={iconSize}
        onPress={handleIncrease}
        iconColor={textColor}
        style={styles.stepperButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  stepperButton: {
    margin: 0,
  },
  input: {
    minWidth: 36,
    paddingHorizontal: 4,
    paddingVertical: 0,
    textAlign: 'center',
    fontWeight: '700',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : null),
  },
});
