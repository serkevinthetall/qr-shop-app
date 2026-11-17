import { getApiBaseUrl } from '@/constants/api';
import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import {
  platformErrorMessage,
  resolvePlatformMediaUrl,
  unwrapPlatformData,
} from '@/services/platform-envelope';
import {
  JUST_FOR_YOU,
  type Category,
  type CategorySelection,
  type Product,
} from '@/types/product';

/**
 * QR App product API — dedicated Platform routes under /api/app/catalog.
 * Retail-only (no wholesale). Not the shared Marketplace /api/catalog.
 */

type MallRow = Record<string, unknown>;

function mapAppProduct(row: MallRow): Product {
  const id = String(row.id || '');
  const shopId = String(row.shopId || '');
  const productId = String(row.productId || '');
  const name = String(row.name || '');
  const priceKs = Number(row.priceKs) || 0;
  const categoryId = String(row.categoryId || '').trim();
  const shopName = String(row.shopName || row.brand || '');
  const imageUrl = resolvePlatformMediaUrl(
    getApiBaseUrl(),
    String(row.imageUrl || ''),
  );
  const badge = row.badge ? String(row.badge) : '';
  const stock =
    row.stock == null ? undefined : Math.max(0, Math.floor(Number(row.stock) || 0));
  const compareAtKs =
    row.compareAtKs != null && Number(row.compareAtKs) > 0
      ? Number(row.compareAtKs)
      : null;

  return {
    id,
    productId: productId || undefined,
    shopId: shopId || undefined,
    shopName: shopName || undefined,
    name,
    list_price: priceKs,
    /** App catalog never returns wholesale — keep fields empty for type compat. */
    priceB2bKs: null,
    wholesaleMinQty: null,
    stock,
    canOrder: row.canOrder !== false,
    description_sale: false,
    categ_id: categoryId ? [categoryId, categoryId] : false,
    public_categ_ids: categoryId ? [categoryId] : [],
    tags: [],
    image_url: imageUrl || false,
    write_date: row.updatedAt ? String(row.updatedAt) : false,
    ribbon: badge
      ? {
          name: badge,
          bg_color: '#0d9488',
          text_color: '#ffffff',
          position: 'left',
          style: 'tag',
        }
      : null,
    compare_at: compareAtKs,
  };
}

function mapCategory(row: MallRow): Category {
  const id = String(row.id || '');
  const name = String(row.nameMy || row.name || id);
  return {
    id,
    name,
    parent_id: false,
  };
}

function catalogRows(data: unknown): MallRow[] {
  if (Array.isArray(data)) return data as MallRow[];
  if (data && typeof data === 'object') {
    const products = (data as { products?: unknown }).products;
    if (Array.isArray(products)) return products as MallRow[];
  }
  return [];
}

async function fetchAppCatalogPage(params: {
  limit: number;
  page: number;
  q?: string;
  categoryId?: string;
  token?: string | null;
}) {
  const qs = new URLSearchParams();
  qs.set('limit', String(params.limit));
  qs.set('page', String(params.page));
  if (params.q) qs.set('q', params.q);
  if (params.categoryId) qs.set('categoryId', params.categoryId);

  const { response, data } = await apiRequest<unknown>(
    `/api/app/catalog?${qs.toString()}`,
    { token: params.token || undefined },
  );
  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadProducts')));
  }
  const payload = unwrapPlatformData<unknown>(data);
  return catalogRows(payload).map(mapAppProduct);
}

export async function fetchProducts(
  limit = 200,
  offset = 0,
  selection?: CategorySelection,
  token?: string | null,
) {
  if (selection === JUST_FOR_YOU) {
    return [];
  }

  const page = Math.floor(offset / Math.max(1, limit)) + 1;
  const categoryId =
    typeof selection === 'string' && selection && selection !== JUST_FOR_YOU
      ? selection
      : undefined;

  return fetchAppCatalogPage({ limit, page, categoryId, token });
}

export async function fetchProductById(
  id: string | number,
  token?: string | null,
  _options?: { similarLimit?: number },
) {
  const mallId = String(id || '').trim();
  const { response, data } = await apiRequest<unknown>(
    `/api/app/catalog/${encodeURIComponent(mallId)}`,
    { token: token || undefined },
  );
  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadProduct')));
  }

  const payload = unwrapPlatformData<MallRow>(data);
  if (!payload) {
    return { product: null as Product | null, similarProducts: [] as Product[] };
  }

  const product = mapAppProduct(payload);
  return { product, similarProducts: [] as Product[] };
}

export async function fetchCategories() {
  const { response, data } = await apiRequest<unknown>('/api/app/catalog/categories');
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadCategories')));
  }
  const payload = unwrapPlatformData<unknown>(data);
  const rows = Array.isArray(payload) ? (payload as MallRow[]) : [];
  return rows.map(mapCategory);
}

export async function searchProducts(
  query: string,
  selection?: CategorySelection,
  token?: string | null,
) {
  if (selection === JUST_FOR_YOU) {
    return [];
  }
  const categoryId =
    typeof selection === 'string' && selection && selection !== JUST_FOR_YOU
      ? selection
      : undefined;
  return fetchAppCatalogPage({
    limit: 200,
    page: 1,
    q: query.trim(),
    categoryId,
    token,
  });
}

export type ProductPriceRow = {
  id: string;
  list_price: number;
};

export type ProductPricesSnapshot = {
  unchanged: boolean;
  version: string;
  prices: ProductPriceRow[];
};

/** Platform has no price-delta endpoint — return empty so callers refresh catalog instead. */
export async function fetchProductPrices(
  _token?: string | null,
  _version?: string | null,
): Promise<ProductPricesSnapshot> {
  return {
    unchanged: true,
    version: String(Date.now()),
    prices: [],
  };
}
