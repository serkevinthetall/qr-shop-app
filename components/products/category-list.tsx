import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import type { Category } from '@/types/product';

type CategoryListProps = {
  categories: Category[];
  selectedCategoryId: number | null;
  isLoading?: boolean;
  horizontalPadding?: number;
  onSelect: (categoryId: number | null) => void;
};

export function CategoryList({
  categories,
  selectedCategoryId,
  isLoading = false,
  horizontalPadding = 16,
  onSelect,
}: CategoryListProps) {
  const colors = useAppColors();
  const { t, fs, lh } = useLanguage();

  return (
    <View style={styles.wrap}>
      {isLoading && categories.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPadding },
          ]}>
          <Pressable
            onPress={() => onSelect(null)}
            style={[
              styles.chip,
              {
                backgroundColor: selectedCategoryId == null ? colors.primaryContainer : 'transparent',
                borderColor: selectedCategoryId == null ? colors.primary : colors.border,
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                {
                  color: selectedCategoryId == null ? colors.primary : colors.text,
                  fontSize: fs(13),
                  lineHeight: lh(13),
                },
              ]}>
              {t('products.all')}
            </Text>
          </Pressable>

          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;

            return (
              <Pressable
                key={category.id}
                onPress={() => onSelect(category.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? colors.primaryContainer : 'transparent',
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.primary : colors.text,
                      fontSize: fs(13),
                      lineHeight: lh(13),
                    },
                  ]}
                  numberOfLines={1}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  scrollContent: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
  },
});
