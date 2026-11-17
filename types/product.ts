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
