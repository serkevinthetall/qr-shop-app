import { getApiBaseUrl } from '@/constants/api';
import { resolvePlatformMediaUrl } from '@/services/platform-envelope';

export type CategoryRef = [string, string] | false;

export type ProductRibbon = {
  name: string;
  bg_color: string;
  text_color: string;
  position: 'left' | 'right';
  style: 'ribbon' | 'tag';
};

export type Product = {
  /** Mall composite id: shopId__productId */
  id: string;
  /** Underlying SKU id (without shop prefix). */
  productId?: string;
  shopId?: string;
  shopName?: string;
  name: string;
  list_price: number;
  /** Retail unit when API also exposes wholesale for this viewer. */
  priceB2cKs?: number | null;
  priceB2bKs?: number | null;
  wholesaleMinQty?: number | null;
  stock?: number;
  canOrder?: boolean;
  description_sale?: string | false;
  description?: string | false;
  description_ecommerce?: string | false;
  website_description?: string | false;
  categ_id: CategoryRef;
  public_categ_ids?: string[];
  /** Unused on Platform — kept for older UI helpers. */
  tags?: string[];
  image_url?: string | false;
  image_1920?: string | false;
  write_date?: string | false;
  ribbon?: ProductRibbon | null;
  compare_at?: number | null;
};

/** Sentinel for the Just for you category chip (hidden without membership). */
export const JUST_FOR_YOU = 'just_for_you' as const;
export type CategorySelection = string | null | typeof JUST_FOR_YOU;

export type Category = {
  id: string;
  name: string;
  parent_id: CategoryRef;
};

export function productMatchesPartnerTags(product: Pick<Product, 'tags'>, partnerTags: string[]) {
  if (!partnerTags.length) {
    return false;
  }

  const productTags = (product.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);

  if (!productTags.length) {
    return false;
  }

  return partnerTags.some((tag) => productTags.includes(tag.trim().toLowerCase()));
}

export function getCategoryName(categId: CategoryRef) {
  return Array.isArray(categId) ? categId[1] : '';
}

export function getCategoryId(categId: CategoryRef) {
  return Array.isArray(categId) ? categId[0] : null;
}

export function formatPrice(price: number) {
  return `${price.toLocaleString()} Ks`;
}

type PricedProduct = Pick<
  Product,
  'list_price' | 'priceB2cKs' | 'priceB2bKs' | 'wholesaleMinQty'
>;

export function retailKs(product: PricedProduct): number | null {
  if (product.priceB2cKs != null && product.priceB2cKs > 0) {
    return Math.floor(product.priceB2cKs);
  }
  if (product.priceB2bKs == null || product.priceB2bKs <= 0) {
    return product.list_price > 0 ? Math.floor(product.list_price) : null;
  }
  return null;
}

export function wholesaleKs(product: PricedProduct): number | null {
  if (product.priceB2bKs != null && product.priceB2bKs > 0) {
    return Math.floor(product.priceB2bKs);
  }
  return null;
}

/** Min qty to unlock wholesale; null when not qty-gated. */
export function wholesaleMinQtyOf(product: PricedProduct): number | null {
  if (wholesaleKs(product) == null) return null;
  if (product.wholesaleMinQty != null && product.wholesaleMinQty > 1) {
    return Math.floor(product.wholesaleMinQty);
  }
  return null;
}

/**
 * Wholesale only when qty ≥ min (matches Platform resolveUnitPrice).
 * No min + wholesale access → wholesale unit. Else retail.
 */
export function unitPriceForQty(product: PricedProduct, qty: number): number {
  const q = Math.max(1, Math.floor(Number(qty) || 1));
  const wholesale = wholesaleKs(product);
  const min = wholesaleMinQtyOf(product);
  const retail = retailKs(product);

  if (wholesale != null && min != null && q >= min) return wholesale;
  if (wholesale != null && min == null) return wholesale;
  if (retail != null) return retail;
  return wholesale ?? Math.max(0, Math.floor(product.list_price || 0));
}

/** Active channel label for the current qty. */
export function priceChannelLabel(
  product: PricedProduct,
  t: (key: string, params?: Record<string, string | number>) => string,
  qty = 1,
): string {
  const wholesale = wholesaleKs(product);
  const min = wholesaleMinQtyOf(product);
  const q = Math.max(1, Math.floor(Number(qty) || 1));

  if (wholesale != null && min != null && q >= min) {
    return t('products.wholesaleAndAbove', { n: min });
  }
  if (wholesale != null && min == null) {
    return t('products.wholesale');
  }
  return t('products.retail');
}

/** Hint when wholesale exists but qty is below the min. */
export function wholesaleQtyHint(
  product: PricedProduct,
  qty: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  const wholesale = wholesaleKs(product);
  const min = wholesaleMinQtyOf(product);
  if (wholesale == null || min == null) return null;
  const q = Math.max(0, Math.floor(Number(qty) || 0));
  if (q >= min) return t('products.wholesaleApplied', { n: min });
  return t('products.wholesaleBuyMore', { n: min });
}

function getImageVersion(writeDate?: string | false) {
  if (!writeDate || typeof writeDate !== 'string') {
    return '0';
  }

  return encodeURIComponent(writeDate.replace(/[^0-9]/g, '') || '0');
}

export function getProductImageUri(
  product: Pick<Product, 'id' | 'image_url' | 'image_1920' | 'write_date'>,
) {
  if (product.image_url) {
    const url = String(product.image_url).trim();
    return resolvePlatformMediaUrl(getApiBaseUrl(), url);
  }

  if (product.image_1920) {
    return `data:image/png;base64,${product.image_1920}`;
  }

  return '';
}

export function getProductImageCacheKey(product: Pick<Product, 'id' | 'write_date'>) {
  return `product-${product.id}-${getImageVersion(product.write_date)}`;
}
