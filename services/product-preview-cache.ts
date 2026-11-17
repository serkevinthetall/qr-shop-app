import type { Product } from '@/types/product';

const cache = new Map<string, Product>();

export function rememberProductPreview(product: Product) {
  cache.set(String(product.id), product);
}

export function getProductPreview(id: string | number) {
  return cache.get(String(id)) ?? null;
}

export function clearProductPreview(id: string | number) {
  cache.delete(String(id));
}

export function clearProductPreviewCache() {
  cache.clear();
}
