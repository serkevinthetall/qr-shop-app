export type ProductFoodInfo = {
  enabled: boolean;
  ingredientsEn?: string;
  ingredientsMy?: string;
  allergen?: string;
  nutritionServing?: string;
  nutritionEnergy?: string;
  nutritionFat?: string;
  nutritionSodium?: string;
  storage?: string;
};

export function parseProductFoodInfo(raw: unknown): ProductFoodInfo | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (o.enabled !== true) return undefined;
  const info: ProductFoodInfo = {
    enabled: true,
    ingredientsEn: String(o.ingredientsEn ?? '').trim() || undefined,
    ingredientsMy: String(o.ingredientsMy ?? '').trim() || undefined,
    allergen: String(o.allergen ?? '').trim() || undefined,
    nutritionServing: String(o.nutritionServing ?? '').trim() || undefined,
    nutritionEnergy: String(o.nutritionEnergy ?? '').trim() || undefined,
    nutritionFat: String(o.nutritionFat ?? '').trim() || undefined,
    nutritionSodium: String(o.nutritionSodium ?? '').trim() || undefined,
    storage: String(o.storage ?? '').trim() || undefined,
  };
  const hasContent =
    info.ingredientsEn ||
    info.ingredientsMy ||
    info.allergen ||
    info.nutritionServing ||
    info.nutritionEnergy ||
    info.nutritionFat ||
    info.nutritionSodium ||
    info.storage;
  return hasContent ? info : undefined;
}
