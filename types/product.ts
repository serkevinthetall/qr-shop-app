import { API_BASE_URL } from '@/constants/api';

export type CategoryRef = [number, string] | false;

export type ProductRibbon = {
  name: string;
  bg_color: string;
  text_color: string;
  position: 'left' | 'right';
  style: 'ribbon' | 'tag';
};

export type Product = {
  id: number;
  name: string;
  list_price: number;
  description_sale?: string | false;
  description?: string | false;
  description_ecommerce?: string | false;
  website_description?: string | false;
  categ_id: CategoryRef;
  public_categ_ids?: number[];
  /** Personalization tag names (excludes the app gate tag "QR App"). */
  tags?: string[];
  image_url?: string | false;
  image_1920?: string | false;
  write_date?: string | false;
  ribbon?: ProductRibbon | null;
};

/** Sentinel for the Just for you category chip (not an Odoo public category id). */
export const JUST_FOR_YOU = 'just_for_you' as const;
export type CategorySelection = number | null | typeof JUST_FOR_YOU;

export type Category = {
  id: number;
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

export function getProductImageUri(product: Pick<Product, 'id' | 'image_url' | 'image_1920' | 'write_date'>) {
  if (product.image_url) {
    const url = product.image_url.trim();

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('/')) {
      if (url.includes('?v=')) {
        return `${API_BASE_URL}${url}`;
      }

      const version = getImageVersion(product.write_date);
      return `${API_BASE_URL}${url}?v=${version}`;
    }

    return url;
  }

  if (product.image_1920) {
    return `data:image/png;base64,${product.image_1920}`;
  }

  const version = getImageVersion(product.write_date);
  return `${API_BASE_URL}/api/products/${product.id}/image?v=${version}`;
}

export function getProductImageCacheKey(product: Pick<Product, 'id' | 'write_date'>) {
  return `product-${product.id}-${getImageVersion(product.write_date)}`;
}
