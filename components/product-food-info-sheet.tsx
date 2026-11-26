import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ProductFoodInfo } from '@/lib/product-food-info';
import { useAppColors } from '@/contexts/theme-context';

type Labels = {
  ingredients: string;
  allergen: string;
  nutrition: string;
  serving: string;
  energy: string;
  fat: string;
  sodium: string;
  storage: string;
  disclaimer: string;
};

type Props = {
  foodInfo?: ProductFoodInfo | null;
  labels: Labels;
};

function Section({
  title,
  children,
  borderColor,
  titleColor,
}: {
  title: string;
  children: ReactNode;
  borderColor: string;
  titleColor: string;
}) {
  return (
    <View style={[styles.section, { borderTopColor: borderColor }]}>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {children}
    </View>
  );
}

/** Buyer PDP food sheet — under price/qty when merchant enabled food info. */
export function ProductFoodInfoSheet({ foodInfo, labels }: Props) {
  const colors = useAppColors();
  if (!foodInfo?.enabled) return null;

  const hasIngredients =
    Boolean(foodInfo.ingredientsEn?.trim()) ||
    Boolean(foodInfo.ingredientsMy?.trim());
  const hasAllergen = Boolean(foodInfo.allergen?.trim());
  const nutritionRows = [
    foodInfo.nutritionServing?.trim()
      ? { label: labels.serving, value: foodInfo.nutritionServing.trim() }
      : null,
    foodInfo.nutritionEnergy?.trim()
      ? { label: labels.energy, value: foodInfo.nutritionEnergy.trim() }
      : null,
    foodInfo.nutritionFat?.trim()
      ? { label: labels.fat, value: foodInfo.nutritionFat.trim() }
      : null,
    foodInfo.nutritionSodium?.trim()
      ? { label: labels.sodium, value: foodInfo.nutritionSodium.trim() }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];
  const hasStorage = Boolean(foodInfo.storage?.trim());

  if (!hasIngredients && !hasAllergen && !nutritionRows.length && !hasStorage) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {hasIngredients ? (
        <Section
          title={labels.ingredients}
          borderColor={colors.border}
          titleColor={colors.text}>
          {foodInfo.ingredientsEn?.trim() ? (
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {foodInfo.ingredientsEn.trim()}
            </Text>
          ) : null}
          {foodInfo.ingredientsMy?.trim() ? (
            <Text style={[styles.body, { color: colors.textMuted, marginTop: 4 }]}>
              {foodInfo.ingredientsMy.trim()}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {hasAllergen ? (
        <Section
          title={labels.allergen}
          borderColor={colors.border}
          titleColor={colors.text}>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {foodInfo.allergen!.trim()}
          </Text>
        </Section>
      ) : null}

      {nutritionRows.length ? (
        <Section
          title={labels.nutrition}
          borderColor={colors.border}
          titleColor={colors.text}>
          {nutritionRows.map((row) => (
            <View key={row.label} style={styles.nutritionRow}>
              <Text style={[styles.body, { color: colors.text }]}>{row.label}</Text>
              <Text
                style={[
                  styles.body,
                  styles.nutritionValue,
                  { color: colors.textMuted },
                ]}>
                {row.value}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      {hasStorage ? (
        <Section
          title={labels.storage}
          borderColor={colors.border}
          titleColor={colors.text}>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {foodInfo.storage!.trim()}
          </Text>
        </Section>
      ) : null}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        {labels.disclaimer}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  nutritionValue: {
    flex: 1,
    textAlign: 'right',
  },
  disclaimer: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
  },
});
