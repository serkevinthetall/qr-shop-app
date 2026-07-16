import type { Product } from '@/types/product';

function getProductSyncKey(product: Product) {
  const ribbon = product.ribbon
    ? [
        product.ribbon.name,
        product.ribbon.bg_color,
        product.ribbon.text_color,
        product.ribbon.position,
        product.ribbon.style,
      ].join('|')
    : '';

  return [product.id, product.write_date || '', product.list_price, product.name, ribbon].join(':');
}

export function haveProductsChanged(previous: Product[], next: Product[]) {
  if (previous.length !== next.length) {
    return true;
  }

  const previousKeys = new Map(previous.map((product) => [product.id, getProductSyncKey(product)]));

  for (const product of next) {
    if (previousKeys.get(product.id) !== getProductSyncKey(product)) {
      return true;
    }
  }

  return false;
}

export function mergeProductsIfChanged(previous: Product[], next: Product[]) {
  return haveProductsChanged(previous, next) ? next : previous;
}
