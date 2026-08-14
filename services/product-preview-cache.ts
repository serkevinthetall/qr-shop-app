import type { Product } from '@/types/product';

const cache = new Map<number, Product>();

export function rememberProductPreview(product: Product) {
  cache.set(product.id, product);
}

export function getProductPreview(id: number) {
  return cache.get(id) ?? null;
}

export function clearProductPreview(id: number) {
  cache.delete(id);
}

export function clearProductPreviewCache() {
  cache.clear();
}
