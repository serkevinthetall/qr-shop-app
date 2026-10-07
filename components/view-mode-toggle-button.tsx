import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useAppColors } from '@/contexts/theme-context';
import { withHapticPress } from '@/utils/haptics';

type ViewMode = 'grid' | 'list';

type ViewModeToggleButtonProps = {
  viewMode: ViewMode;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function ViewModeToggleButton({
  viewMode,
  onPress,
  accessibilityLabel,
  style,
}: ViewModeToggleButtonProps) {
  const colors = useAppColors();

  return (
    <Pressable
      onPress={withHapticPress(onPress)}
      style={[
        styles.button,
        { backgroundColor: colors.inputBg, borderColor: colors.border },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <MaterialCommunityIcons
        name={viewMode === 'grid' ? 'view-grid' : 'format-list-bulleted'}
        size={20}
        color={colors.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
});
