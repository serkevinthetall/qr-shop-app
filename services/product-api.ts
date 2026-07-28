import { apiRequest } from '@/services/api-client';
import { JUST_FOR_YOU, type Category, type CategorySelection, type Product } from '@/types/product';

type ApiErrorResponse = {
  success: false;
  message: string;
};

type ProductsResponse = {
  success: true;
  products: Product[];
};

type ProductResponse = {
  success: true;
  product: Product | null;
  similar_products?: Product[];
};

type CategoriesResponse = {
  success: true;
  categories: Category[];
};

function getApiError(data: { success: boolean; message?: string } | null, fallback: string) {
  if (data && 'message' in data && data.message) {
    return data.message;
  }

  return fallback;
}

function buildCategoryQuery(selection?: CategorySelection) {
  if (selection === JUST_FOR_YOU) {
    return '&just_for_you=1';
  }

  if (typeof selection === 'number' && selection > 0) {
    return `&category_id=${selection}`;
  }

  return '';
}

export async function fetchProducts(
  limit = 200,
  offset = 0,
  selection?: CategorySelection,
  token?: string | null,
) {
  const { response, data } = await apiRequest<ProductsResponse | ApiErrorResponse>(
    `/api/products?limit=${limit}&offset=${offset}${buildCategoryQuery(selection)}`,
    { token: token || undefined },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load products.'));
  }

  return data.products;
}

export async function fetchProductById(id: number) {
  const { response, data } = await apiRequest<ProductResponse | ApiErrorResponse>(
    `/api/products/${id}`,
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load product.'));
  }

  return {
    product: data.product,
    similarProducts: data.similar_products ?? [],
  };
}

export async function fetchCategories() {
  const { response, data } = await apiRequest<CategoriesResponse | ApiErrorResponse>(
    '/api/categories',
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load categories.'));
  }

  return data.categories;
}

export async function searchProducts(
  query: string,
  selection?: CategorySelection,
  token?: string | null,
) {
  const { response, data } = await apiRequest<ProductsResponse | ApiErrorResponse>(
    `/api/products/search?q=${encodeURIComponent(query)}${buildCategoryQuery(selection)}`,
    { token: token || undefined },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Search failed.'));
  }

  return data.products;
}
