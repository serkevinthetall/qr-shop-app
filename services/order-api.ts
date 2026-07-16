import { orderRequest } from '@/services/order-client';

const KNOWN_ORDER_STATES = ['draft', 'sent', 'sale', 'done', 'cancel'];

// Maps raw Odoo sale-order states to customer-friendly, translated labels.
export function getStatusLabel(state: string, t: (key: string) => string) {
  return KNOWN_ORDER_STATES.includes(state) ? t(`orderStatus.${state}`) : state;
}

type ApiErrorResponse = {
  success: false;
  message: string;
};

export type OrderShippingAddress = {
  id: number;
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

export type Order = {
  id: number;
  name: string;
  state: string;
  amount_total: number;
  date_order: string;
  partner_id: [number, string];
  partner_shipping_id?: [number, string] | false;
  shipping_address?: OrderShippingAddress | null;
  order_line?: number[];
  x_studio_preferred_delivery_date?: string | false;
  x_studio_delivery_notes?: string | false;
  note?: string | false;
};

export function getOrderShippingLabel(order: Pick<Order, 'shipping_address' | 'partner_shipping_id'>) {
  return formatOrderShippingAddress(order);
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

export type OrderLine = {
  id: number;
  product_id: [number, string];
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
};

export type CheckoutItem = {
  product_id: number;
  quantity: number;
};

export type CheckoutPayload = {
  paymentMethod: 'cod' | 'wire_transfer';
  preferredDeliveryDate?: string;
  deliveryNotes?: string;
  note?: string;
  addressId?: string;
  couponCode?: string;
  items: CheckoutItem[];
  paymentScreenshot?: {
    uri: string;
    name: string;
    type: string;
  };
};

type CheckoutSuccessResponse = {
  success: true;
  message: string;
  order: Order | null;
};

type OrdersSuccessResponse = {
  success: true;
  orders: Order[];
};

type OrderDetailSuccessResponse = {
  success: true;
  order: Order;
  lines: OrderLine[];
};

function getApiError(data: { success: boolean; message?: string } | null, fallback: string) {
  if (data && 'message' in data && data.message) {
    return data.message;
  }

  return fallback;
}

export async function checkoutOrder(token: string, payload: CheckoutPayload) {
  const formData = new FormData();

  formData.append('order_type', 'quotation_sent');
  formData.append('payment_method', payload.paymentMethod);
  formData.append('address_id', payload.addressId ?? '');
  formData.append('preferred_delivery_date', payload.preferredDeliveryDate ?? '');
  formData.append('delivery_notes', payload.deliveryNotes ?? '');
  formData.append('note', payload.note ?? '');
  formData.append('coupon_code', payload.couponCode ?? '');
  formData.append('items', JSON.stringify(payload.items));

  if (payload.paymentScreenshot) {
    formData.append('payment_screenshot', {
      uri: payload.paymentScreenshot.uri,
      name: payload.paymentScreenshot.name,
      type: payload.paymentScreenshot.type,
    } as unknown as Blob);
  }

  const { response, data } = await orderRequest<CheckoutSuccessResponse | ApiErrorResponse>(
    '/api/orders/checkout',
    {
      method: 'POST',
      token,
      body: formData,
    },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Checkout failed.'));
  }

  return data;
}

export async function fetchOrders(token: string) {
  const { response, data } = await orderRequest<OrdersSuccessResponse | ApiErrorResponse>(
    '/api/orders',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load orders.'));
  }

  return data.orders;
}

export async function fetchOrderById(token: string, orderId: number) {
  const { response, data } = await orderRequest<OrderDetailSuccessResponse | ApiErrorResponse>(
    `/api/orders/${orderId}`,
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load order.'));
  }

  return data;
}

export async function reorderPreviousOrder(token: string, orderId: number) {
  const { response, data } = await orderRequest<CheckoutSuccessResponse | ApiErrorResponse>(
    `/api/orders/${orderId}/reorder`,
    {
      method: 'POST',
      token,
    },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Reorder failed.'));
  }

  return data;
}
