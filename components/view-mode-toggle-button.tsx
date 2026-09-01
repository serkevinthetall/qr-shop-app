import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet } from 'react-native';

import { useAppColors } from '@/contexts/theme-context';

type ViewMode = 'grid' | 'list';

type ViewModeToggleButtonProps = {
  viewMode: ViewMode;
  onPress: () => void;
  accessibilityLabel: string;
};

export function ViewModeToggleButton({
  viewMode,
  onPress,
  accessibilityLabel,
}: ViewModeToggleButtonProps) {
  const colors = useAppColors();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: colors.inputBg, borderColor: colors.border },
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
});
