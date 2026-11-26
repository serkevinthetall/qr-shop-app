import { getApiBaseUrl } from '@/constants/api';
import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import {
  platformErrorMessage,
  resolvePlatformMediaUrl,
  unwrapPlatformData,
} from '@/services/platform-envelope';
import { parseProductFoodInfo } from '@/lib/product-food-info';
import {
  JUST_FOR_YOU,
  type Category,
  type CategorySelection,
  type Product,
} from '@/types/product';

/**
 * QR App product API — dedicated Platform routes under /api/app/catalog.
 * Retail by default; wholesale unit price when merchant allowed this user.
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

  const priceB2cKs =
    row.priceB2cKs != null && Number(row.priceB2cKs) > 0
      ? Number(row.priceB2cKs)
      : null;
  const priceB2bKs =
    row.priceB2bKs != null && Number(row.priceB2bKs) > 0
      ? Number(row.priceB2bKs)
      : null;
  const wholesaleMinQty =
    row.wholesaleMinQty != null && Number(row.wholesaleMinQty) > 1
      ? Number(row.wholesaleMinQty)
      : null;
  /** Prefer retail as list baseline when wholesale is qty-gated. */
  const listPrice =
    priceB2bKs != null && wholesaleMinQty != null && priceB2cKs != null
      ? priceB2cKs
      : priceKs;

  return {
    id,
    productId: productId || undefined,
    shopId: shopId || undefined,
    shopName: shopName || undefined,
    name,
    list_price: listPrice,
    priceB2cKs,
    priceB2bKs,
    wholesaleMinQty,
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
    foodInfo: parseProductFoodInfo(row.foodInfo),
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
  shopId?: string;
  token?: string | null;
}) {
  const qs = new URLSearchParams();
  qs.set('limit', String(params.limit));
  qs.set('page', String(params.page));
  if (params.q) qs.set('q', params.q);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.shopId) qs.set('shopId', params.shopId);

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

export async function fetchProductsForShop(
  shopId: string,
  token?: string | null,
  limit = 80,
) {
  const id = String(shopId || '').trim();
  if (!id) return [];
  return fetchAppCatalogPage({ limit, page: 1, shopId: id, token });
}

export type ShopStorefront = {
  id: string;
  name: string;
  tagline: string;
  logoUrl: string;
  coverUrl: string;
  phone: string;
  location: string;
  township: string;
  aboutText: string;
  websitePublished: boolean;
};

function mapShopMeta(row: MallRow, fallbackId: string): ShopStorefront {
  const id = String(row.id || fallbackId);
  return {
    id,
    name: String(row.name || ''),
    tagline: String(row.tagline || ''),
    logoUrl: resolvePlatformMediaUrl(getApiBaseUrl(), String(row.logoUrl || '')),
    coverUrl: resolvePlatformMediaUrl(getApiBaseUrl(), String(row.coverUrl || '')),
    phone: String(row.phone || row.phone2 || ''),
    location: String(row.location || ''),
    township: String(row.township || ''),
    aboutText: String(row.aboutText || ''),
    websitePublished: Boolean(row.websitePublished),
  };
}

/**
 * Shop page chrome from public shop meta; products from QR App catalog
 * so retail/wholesale follows allowed-buyer rules (not Marketplace website SKUs).
 */
export async function fetchShopStorefront(
  shopId: string,
  token?: string | null,
): Promise<{ shop: ShopStorefront; products: Product[] }> {
  const id = String(shopId || '').trim();
  if (!id) {
    return {
      shop: {
        id: '',
        name: '',
        tagline: '',
        logoUrl: '',
        coverUrl: '',
        phone: '',
        location: '',
        township: '',
        aboutText: '',
        websitePublished: false,
      },
      products: [],
    };
  }

  const [metaRes, products] = await Promise.all([
    apiRequest<unknown>(`/api/shops/${encodeURIComponent(id)}`),
    fetchProductsForShop(id, token, 200),
  ]);
  const meta = unwrapPlatformData<MallRow>(metaRes.data);
  const shop = mapShopMeta(meta || {}, id);
  return { shop, products };
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
