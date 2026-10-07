import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonBox } from '@/components/skeleton';
import { useLanguage } from '@/contexts/language-context';
import { useThemeMode } from '@/contexts/theme-context';
import { JUST_FOR_YOU, type Category, type CategorySelection } from '@/types/product';
import { withHapticPress } from '@/utils/haptics';

/** Faux glass — see-through a little (~55%). */
function chipFill(isDark: boolean, selected: boolean): string {
  if (selected) {
    // Solid brand green when selected
    return isDark ? '#0d9488' : '#0d9488';
  }
  return isDark ? 'rgba(40, 48, 48, 0.90)' : 'rgba(255, 255, 255, 0.90)';
}

function chipBorder(isDark: boolean, selected: boolean): string {
  if (selected) {
    return '#0d9488';
  }
  return isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.12)';
}

function chipTextColor(isDark: boolean, selected: boolean): string {
  if (selected) {
    return '#FFFFFF';
  }
  // Unselected: black on light, white on dark
  return isDark ? '#FFFFFF' : '#111827';
}

/** Shared chip height in Myanmar — match native All / Just-for-you size. */
const MY_CHIP_HEIGHT = 40;

const SKELETON_CHIP_WIDTHS = [56, 72, 88, 64, 80];

type CategoryListProps = {
  categories: Category[];
  selectedCategoryId: CategorySelection;
  isLoading?: boolean;
  horizontalPadding?: number;
  showJustForYou?: boolean;
  onSelect: (categoryId: CategorySelection) => void;
};

type CategoryChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  fontSize: number;
  lineHeight: number | undefined;
  isMyanmar: boolean;
};

/**
 * Soft frosted-look chips — solid 80% white/gray, no real glass effect.
 */
function CategoryChip({
  label,
  selected,
  onPress,
  fontSize,
  lineHeight,
  isMyanmar,
}: CategoryChipProps) {
  const { isDark } = useThemeMode();
  const myanmarChipStyle = isMyanmar ? styles.chipMyanmar : null;
  const myanmarTextStyle = isMyanmar ? styles.chipTextMyanmar : null;
  const textColor = chipTextColor(isDark, selected);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        myanmarChipStyle,
        {
          backgroundColor: chipFill(isDark, selected),
          borderColor: chipBorder(isDark, selected),
        },
      ]}>
      <Text
        style={[
          styles.chipText,
          myanmarTextStyle,
          {
            color: textColor,
            fontSize,
            lineHeight,
            opacity: 1,
          },
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function CategoryChipSkeleton({ width, isMyanmar }: { width: number; isMyanmar: boolean }) {
  const { isDark } = useThemeMode();
  const myanmarChipStyle = isMyanmar ? styles.chipMyanmar : null;

  return (
    <View
      style={[
        styles.chip,
        styles.skeletonFrostChip,
        myanmarChipStyle,
        {
          width,
          backgroundColor: chipFill(isDark, false),
          borderColor: chipBorder(isDark, false),
        },
      ]}>
      <SkeletonBox style={styles.skeletonFrostLabel} borderRadius={4} />
    </View>
  );
}

export function CategoryList({
  categories,
  selectedCategoryId,
  isLoading = false,
  horizontalPadding = 16,
  showJustForYou = false,
  onSelect,
}: CategoryListProps) {
  const { t, fs, lh, language } = useLanguage();
  const selectWithHaptic = withHapticPress(onSelect);
  const isMyanmar = language === 'my';
  const fontSize = fs(13);
  const lineHeight = isMyanmar ? undefined : lh(13);
  const showOdooSkeletons = isLoading && categories.length === 0;

  return (
    <View style={styles.wrap} collapsable={false}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
        ]}>
        {showJustForYou ? (
          <CategoryChip
            label={t('products.justForYou')}
            selected={selectedCategoryId === JUST_FOR_YOU}
            onPress={() => selectWithHaptic(JUST_FOR_YOU)}
            fontSize={fontSize}
            lineHeight={lineHeight}
            isMyanmar={isMyanmar}
          />
        ) : null}

        <CategoryChip
          label={t('products.all')}
          selected={selectedCategoryId == null}
          onPress={() => selectWithHaptic(null)}
          fontSize={fontSize}
          lineHeight={lineHeight}
          isMyanmar={isMyanmar}
        />

        {showOdooSkeletons
          ? SKELETON_CHIP_WIDTHS.map((width, index) => (
              <CategoryChipSkeleton
                key={`cat-skel-${index}`}
                width={width}
                isMyanmar={isMyanmar}
              />
            ))
          : categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                selected={selectedCategoryId === category.id}
                onPress={() => selectWithHaptic(category.id)}
                fontSize={fontSize}
                lineHeight={lineHeight}
                isMyanmar={isMyanmar}
              />
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  scroll: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 6,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 180,
  },
  chipMyanmar: {
    height: MY_CHIP_HEIGHT,
    minHeight: MY_CHIP_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontWeight: '600',
  },
  chipTextMyanmar: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    ...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : null),
  },
  skeletonFrostChip: {
    height: MY_CHIP_HEIGHT,
    paddingVertical: 0,
    justifyContent: 'center',
    maxWidth: undefined,
  },
  skeletonFrostLabel: {
    height: 10,
    width: '70%',
    alignSelf: 'center',
  },
});
