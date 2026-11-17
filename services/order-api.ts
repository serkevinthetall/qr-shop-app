import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import {
  platformErrorMessage,
  unwrapPlatformData,
} from '@/services/platform-envelope';

export type DeliveryStatus =
  | 'pending'
  | 'preparing'
  | 'partial'
  | 'delivered'
  | 'completed'
  | 'cancelled';

const KNOWN_ORDER_STATES = ['draft', 'sent', 'sale', 'done', 'cancel'];
const KNOWN_DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending',
  'preparing',
  'partial',
  'delivered',
  'completed',
  'cancelled',
];

export type OrderShippingAddress = {
  id: string;
  name: string;
  phone: string;
  street: string;
  street2: string;
  city: string;
  zip: string;
  state: string;
  country: string;
  label: string;
};

export type DeliveryBucketItem = {
  id: string;
  product_id?: [string, string] | false;
  name: string;
  qty: number;
};

export type Order = {
  id: string;
  name: string;
  state: string;
  invoice_status?: string;
  amount_total: number;
  date_order: string;
  partner_id: [string, string];
  partner_shipping_id?: [string, string] | false;
  shipping_address?: OrderShippingAddress | null;
  order_line?: string[];
  x_studio_preferred_delivery_date?: string | false;
  x_studio_delivery_notes?: string | false;
  note?: string | false;
  fulfillment_method?: 'delivery' | 'pickup' | string;
  pickup_point?: {
    id: string;
    name: string;
    address?: string;
    township?: string | null;
  } | null;
  delivery_status?: DeliveryStatus;
  delivering_now_count?: number;
  coming_later_count?: number;
  shop_name?: string;
};

export type OrderLine = {
  id: string;
  product_id: [string, string];
  name: string;
  product_uom_qty: number;
  qty_ordered?: number;
  qty_delivered?: number;
  qty_pending?: number;
  price_unit: number;
  price_subtotal: number;
};

export type CheckoutItem = {
  product_id: string;
  quantity: number;
  shop_id?: string;
  sku_id?: string;
};

export type CheckoutPayload = {
  paymentMethod: 'cod' | 'wire_transfer' | string;
  preferredDeliveryDate?: string;
  deliveryNotes?: string;
  note?: string;
  addressId?: string;
  addressText?: string;
  townshipId?: string;
  buyerName?: string;
  buyerPhone?: string;
  fulfillmentMethod?: 'delivery' | 'pickup' | 'express';
  pickupPointId?: string;
  couponCode?: string;
  items: CheckoutItem[];
  paymentScreenshot?: {
    uri: string;
    name: string;
    type: string;
  };
};

type PlatformOrderLine = {
  id?: string;
  productId?: string;
  productName?: string;
  qty?: number;
  unitKs?: number;
  lineTotalKs?: number;
};

type PlatformOrder = {
  id: string;
  code?: string | null;
  shopId?: string;
  shop?: { id?: string; name?: string } | null;
  stage?: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  address?: string | null;
  fulfillment?: string | null;
  payment?: string | null;
  totalKs?: number;
  deliveryFeeKs?: number;
  createdAt?: string;
  lines?: PlatformOrderLine[];
  townshipId?: string | null;
  townshipName?: string | null;
};

function stageToState(stage: string | undefined): string {
  switch (String(stage || '')) {
    case 'completed':
      return 'done';
    case 'cancelled':
      return 'cancel';
    case 'request':
      return 'sent';
    default:
      return 'sale';
  }
}

function stageToDeliveryStatus(stage: string | undefined): DeliveryStatus {
  switch (String(stage || '')) {
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'out_for_delivery':
    case 'delivery':
      return 'delivered';
    case 'ready_pickup':
    case 'pickup':
    case 'approved':
      return 'preparing';
    case 'request':
    default:
      return 'pending';
  }
}

function mapPlatformOrder(raw: PlatformOrder): Order {
  const id = String(raw.id);
  const name = String(raw.code || raw.id);
  const buyer = String(raw.buyerName || 'Buyer');
  const fulfillment = String(raw.fulfillment || 'delivery');
  return {
    id,
    name,
    state: stageToState(raw.stage),
    amount_total: Number(raw.totalKs) || 0,
    date_order: String(raw.createdAt || new Date().toISOString()),
    partner_id: [String(raw.shopId || '0'), buyer],
    partner_shipping_id: raw.address ? ['0', String(raw.address)] : false,
    shipping_address: raw.address
      ? {
          id: '0',
          name: buyer,
          phone: String(raw.buyerPhone || ''),
          street: String(raw.address),
          street2: '',
          city: String(raw.townshipName || ''),
          zip: String(raw.townshipId || ''),
          state: '',
          country: '',
          label: '',
        }
      : null,
    fulfillment_method: fulfillment,
    pickup_point:
      fulfillment === 'pickup'
        ? {
            id: 'pickup',
            name: 'Pickup',
            address: String(raw.address || ''),
            township: raw.townshipName ?? null,
          }
        : null,
    delivery_status: stageToDeliveryStatus(raw.stage),
    shop_name: raw.shop?.name,
    x_studio_delivery_notes: false,
    note: false,
  };
}

function mapPlatformLines(raw: PlatformOrder): OrderLine[] {
  return (raw.lines || []).map((line, index) => {
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    const unit = Number(line.unitKs) || 0;
    const pid = String(line.productId || index);
    const pname = String(line.productName || 'Item');
    return {
      id: String(line.id || `${pid}-${index}`),
      product_id: [pid, pname],
      name: pname,
      product_uom_qty: qty,
      qty_ordered: qty,
      qty_delivered: 0,
      qty_pending: qty,
      price_unit: unit,
      price_subtotal: Number(line.lineTotalKs) || unit * qty,
    };
  });
}

export function getOrderShippingLabel(order: Pick<Order, 'shipping_address' | 'partner_shipping_id'>) {
  return formatOrderShippingAddress(order);
}

export function orderHasPickupNotice(
  order: Pick<Order, 'x_studio_delivery_notes' | 'fulfillment_method' | 'note'>,
) {
  if (order.fulfillment_method === 'pickup') {
    return true;
  }

  const notes = [order.x_studio_delivery_notes, order.note]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n');

  return /self\s*pickup|လာယူမည်/i.test(notes);
}

export function getPickupPlaceLabel(
  order: Pick<Order, 'pickup_point'>,
  genericLabel: string,
) {
  const name = String(order.pickup_point?.name || '').trim();
  const address = String(order.pickup_point?.address || '').trim();
  const isGeneric =
    !name ||
    /^self\s*pickup$/i.test(name) ||
    name === genericLabel ||
    name === 'လာယူမည်';

  return [isGeneric ? null : name, address].filter(Boolean).join('\n');
}

export function formatOrderShippingAddress(
  order: Pick<Order, 'shipping_address' | 'partner_shipping_id'>,
) {
  const address = order.shipping_address;

  if (address) {
    const lines = [
      address.name,
      address.phone,
      [address.street, address.street2].filter(Boolean).join(', '),
      [address.city, address.zip].filter(Boolean).join(' '),
      address.state,
      address.country,
    ].filter(Boolean);

    return lines.join('\n');
  }

  if (Array.isArray(order.partner_shipping_id) && order.partner_shipping_id[1]) {
    return order.partner_shipping_id[1];
  }

  return '';
}

function fallbackDeliveryStatus(state: string): DeliveryStatus {
  switch (state) {
    case 'cancel':
      return 'cancelled';
    case 'done':
      return 'completed';
    case 'sale':
      return 'preparing';
    case 'draft':
    case 'sent':
    default:
      return 'pending';
  }
}

export function getOrderDeliveryStatus(order: Pick<Order, 'state' | 'delivery_status'>): DeliveryStatus {
  if (order.delivery_status && KNOWN_DELIVERY_STATUSES.includes(order.delivery_status)) {
    return order.delivery_status;
  }

  return fallbackDeliveryStatus(order.state);
}

export function getStatusLabel(
  stateOrStatus: string,
  t: (key: string) => string,
  deliveryStatus?: DeliveryStatus,
) {
  const status =
    deliveryStatus ||
    (KNOWN_DELIVERY_STATUSES.includes(stateOrStatus as DeliveryStatus)
      ? (stateOrStatus as DeliveryStatus)
      : null);

  if (status) {
    return t(`deliveryStatus.${status}`);
  }

  return KNOWN_ORDER_STATES.includes(stateOrStatus) ? t(`orderStatus.${stateOrStatus}`) : stateOrStatus;
}

export function getDeliveryProgressLabel(
  order: Pick<Order, 'delivering_now_count' | 'coming_later_count' | 'delivery_status' | 'state'>,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const status = getOrderDeliveryStatus(order);

  if (status !== 'partial') {
    return '';
  }

  const nowCount = Number(order.delivering_now_count) || 0;
  const laterCount = Number(order.coming_later_count) || 0;

  if (nowCount <= 0 && laterCount <= 0) {
    return '';
  }

  return t('orders.partialProgress', { now: nowCount, later: laterCount });
}

export function getDeliveryStatusHint(
  order: Pick<Order, 'delivery_status' | 'state' | 'delivering_now_count' | 'coming_later_count'>,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const status = getOrderDeliveryStatus(order);
  const progress = getDeliveryProgressLabel(order, t);
  if (progress) {
    return progress;
  }

  return t(`deliveryStatusHint.${status}`);
}

function parseSkuId(item: CheckoutItem) {
  if (item.sku_id) return item.sku_id;
  const raw = String(item.product_id || '');
  const idx = raw.indexOf('__');
  if (idx > 0) return raw.slice(idx + 2);
  return raw;
}

function parseShopId(item: CheckoutItem) {
  if (item.shop_id) return item.shop_id;
  const raw = String(item.product_id || '');
  const idx = raw.indexOf('__');
  if (idx > 0) return raw.slice(0, idx);
  return '';
}

export async function checkoutOrder(token: string, payload: CheckoutPayload) {
  const byShop = new Map<string, CheckoutItem[]>();
  for (const item of payload.items) {
    const shopId = parseShopId(item);
    if (!shopId) {
      throw new Error('Cart items are missing shop information. Refresh the catalog.');
    }
    const list = byShop.get(shopId) || [];
    list.push(item);
    byShop.set(shopId, list);
  }

  const fulfillment = payload.fulfillmentMethod === 'pickup' ? 'pickup' : 'delivery';
  const payment =
    payload.paymentMethod === 'wire_transfer' ? 'kpay' : String(payload.paymentMethod || 'cod');

  const packages = [...byShop.entries()].map(([shopId, items]) => ({
    shopId,
    buyerName: payload.buyerName || undefined,
    fulfillment,
    payment,
    address: fulfillment === 'delivery' ? payload.addressText || undefined : undefined,
    townshipId: payload.townshipId || undefined,
    lines: items.map((item) => ({
      productId: parseSkuId(item),
      qty: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    })),
    source: 'marketplace' as const,
    clientSurface: 'app' as const,
  }));

  const { response, data } = await apiRequest<unknown>('/api/checkout', {
    method: 'POST',
    token,
    body: {
      buyerName: payload.buyerName,
      packages,
    },
  });

  throwIfUnauthorized(response);
  const payloadData = unwrapPlatformData<{ orders?: PlatformOrder[]; order?: PlatformOrder } | PlatformOrder[]>(
    data,
  );
  if (!response.ok || !payloadData) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('checkoutFailed')));
  }

  const orders = Array.isArray(payloadData)
    ? payloadData
    : Array.isArray(payloadData.orders)
      ? payloadData.orders
      : payloadData.order
        ? [payloadData.order]
        : [];

  const first = orders[0] ? mapPlatformOrder(orders[0]) : null;
  return {
    success: true as const,
    message: 'OK',
    order: first,
  };
}

export async function fetchOrders(token: string) {
  const { response, data } = await apiRequest<unknown>('/api/orders', { token });
  throwIfUnauthorized(response);
  const rows = unwrapPlatformData<PlatformOrder[]>(data);
  if (!response.ok || !rows) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadOrders')));
  }
  return (Array.isArray(rows) ? rows : []).map(mapPlatformOrder);
}

export async function fetchOrderById(token: string, orderId: string | number) {
  const { response, data } = await apiRequest<unknown>(
    `/api/orders/${encodeURIComponent(String(orderId))}`,
    { token },
  );
  throwIfUnauthorized(response);
  const raw = unwrapPlatformData<PlatformOrder>(data);
  if (!response.ok || !raw) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadOrder')));
  }

  return {
    order: mapPlatformOrder(raw),
    lines: mapPlatformLines(raw),
    delivering_now: [] as DeliveryBucketItem[],
    coming_later: [] as DeliveryBucketItem[],
  };
}

export async function reorderPreviousOrder(_token: string, _orderId: string | number) {
  throw new Error('Reorder is not available yet on the new backend.');
}
