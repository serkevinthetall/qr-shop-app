import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { JUST_FOR_YOU, type Category, type CategorySelection } from '@/types/product';

type CategoryListProps = {
  categories: Category[];
  selectedCategoryId: CategorySelection;
  isLoading?: boolean;
  horizontalPadding?: number;
  showJustForYou?: boolean;
  onSelect: (categoryId: CategorySelection) => void;
};

export function CategoryList({
  categories,
  selectedCategoryId,
  isLoading = false,
  horizontalPadding = 16,
  showJustForYou = false,
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
          {showJustForYou ? (
            <Pressable
              onPress={() => onSelect(JUST_FOR_YOU)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    selectedCategoryId === JUST_FOR_YOU ? colors.primaryContainer : 'transparent',
                  borderColor: selectedCategoryId === JUST_FOR_YOU ? colors.primary : colors.border,
                },
              ]}>
              <Text
                style={[
                  styles.chipText,
                  {
                    color: selectedCategoryId === JUST_FOR_YOU ? colors.primary : colors.text,
                    fontSize: fs(13),
                    lineHeight: lh(13),
                  },
                ]}
                numberOfLines={1}>
                {t('products.justForYou')}
              </Text>
            </Pressable>
          ) : null}

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
  loading: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    gap: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 180,
  },
  chipText: {
    fontWeight: '600',
  },
});
