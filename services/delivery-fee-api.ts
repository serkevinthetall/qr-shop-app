import type { Product } from '@/types/product';

const DELIVERY_FEE_TAG = '__delivery_fee__';

export type DeliveryFeeQuote = {
  waived: boolean;
  waive_reason: string | null;
  zip: string | null;
  fee: {
    template_id: string;
    product_id: string;
    name: string;
    list_price: number;
    postal: string;
    default_code?: string | null;
  } | null;
};

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
    id: String(fee.template_id),
    name: fee.name || 'Delivery',
    list_price: Number(fee.list_price) || 0,
    categ_id: false,
    tags: [DELIVERY_FEE_TAG],
  };
}

export async function fetchDeliveryFeeQuote(
  _token: string,
  _options: { zip?: string; addressId?: string | null } = {},
): Promise<DeliveryFeeQuote> {
  return {
    waived: true,
    waive_reason: 'quoted_at_checkout',
    zip: null,
    fee: null,
  };
}
