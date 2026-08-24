import { apiRequest } from '@/services/api-client';
import type { Product } from '@/types/product';

const DELIVERY_FEE_TAG = '__delivery_fee__';

type ApiErrorResponse = {
  success: false;
  message: string;
};

export type DeliveryFeeQuote = {
  waived: boolean;
  waive_reason: string | null;
  zip: string | null;
  fee: {
    template_id: number;
    product_id: number;
    name: string;
    list_price: number;
    postal: string;
    default_code?: string | null;
  } | null;
};

type DeliveryFeeResponse = {
  success: true;
  message?: string;
} & DeliveryFeeQuote;

export function isDeliveryCartProduct(product: Pick<Product, 'name' | 'tags'>) {
  if ((product.tags || []).includes(DELIVERY_FEE_TAG)) {
    return true;
  }

  const raw = String(product.name || '').trim();
  const withoutCode = raw.replace(/^\[[^\]]*\]\s*/, '').trim().toLowerCase();
  return withoutCode === 'delivery';
}

export function deliveryFeeToProduct(fee: NonNullable<DeliveryFeeQuote['fee']>): Product {
  return {
    id: fee.template_id,
    name: fee.name || 'Delivery',
    list_price: Number(fee.list_price) || 0,
    categ_id: false,
    tags: [DELIVERY_FEE_TAG],
  };
}

export async function fetchDeliveryFeeQuote(
  token: string,
  options: { zip?: string; addressId?: number | null } = {},
): Promise<DeliveryFeeQuote> {
  const params = new URLSearchParams();

  if (options.zip) {
    params.set('zip', String(options.zip).trim());
  }

  if (options.addressId) {
    params.set('address_id', String(options.addressId));
  }

  const query = params.toString();
  const path = query ? `/api/delivery-fee?${query}` : '/api/delivery-fee';

  const { response, data } = await apiRequest<DeliveryFeeResponse | ApiErrorResponse>(path, {
    token,
  });

  if (!response.ok || !data || !data.success) {
    throw new Error(
      data && 'message' in data && data.message
        ? data.message
        : 'Failed to load delivery fee.',
    );
  }

  return {
    waived: !!data.waived,
    waive_reason: data.waive_reason ?? null,
    zip: data.zip ?? null,
    fee: data.fee ?? null,
  };
}
