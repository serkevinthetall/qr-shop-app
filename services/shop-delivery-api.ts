import { apiRequest } from '@/services/api-client';
import { platformErrorMessage, unwrapPlatformData } from '@/services/platform-envelope';

export type ShopDeliverySettings = {
  shopId: string;
  shopName?: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  expressEnabled: boolean;
  homeState?: string | null;
};

export type ShopDeliveryQuote = {
  shopId: string;
  shopName?: string;
  townshipId: string;
  canPickup: boolean;
  canDelivery: boolean;
  canExpress: boolean;
  contactShop: boolean;
  deliveryFeeKs: number | null;
  expressFeeKs: number | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  expressEnabled: boolean;
};

export type ShopContact = {
  id: string;
  name: string;
  phone: string;
};

/** Public — shop pickup / delivery / express toggles (no township). */
export async function fetchShopDeliverySettings(shopId: string): Promise<ShopDeliverySettings> {
  const { response, data } = await apiRequest<unknown>(
    `/api/shops/${encodeURIComponent(shopId)}/delivery`,
  );
  const row = unwrapPlatformData<{
    shopId?: string;
    shopName?: string;
    deliveryEnabled?: boolean;
    pickupEnabled?: boolean;
    expressEnabled?: boolean;
    homeState?: string | null;
  }>(data);
  if (!response.ok || !row) {
    throw new Error(platformErrorMessage(data, 'Could not load shop delivery settings.'));
  }
  return {
    shopId: String(row.shopId || shopId),
    shopName: row.shopName ? String(row.shopName) : undefined,
    deliveryEnabled: Boolean(row.deliveryEnabled),
    pickupEnabled: row.pickupEnabled !== false,
    expressEnabled: Boolean(row.expressEnabled),
    homeState: row.homeState ?? null,
  };
}

/** Public — options + fees for one buyer township. */
export async function fetchShopDeliveryQuote(
  shopId: string,
  townshipId: string,
): Promise<ShopDeliveryQuote> {
  const qs = new URLSearchParams({ townshipId });
  const { response, data } = await apiRequest<unknown>(
    `/api/shops/${encodeURIComponent(shopId)}/delivery-quote?${qs.toString()}`,
  );
  const row = unwrapPlatformData<{
    shopId?: string;
    shopName?: string;
    townshipId?: string;
    canPickup?: boolean;
    canDelivery?: boolean;
    canExpress?: boolean;
    contactShop?: boolean;
    deliveryFeeKs?: number | null;
    expressFeeKs?: number | null;
    deliveryEnabled?: boolean;
    pickupEnabled?: boolean;
    expressEnabled?: boolean;
  }>(data);
  if (!response.ok || !row) {
    throw new Error(platformErrorMessage(data, 'Could not quote delivery for this location.'));
  }
  return {
    shopId: String(row.shopId || shopId),
    shopName: row.shopName ? String(row.shopName) : undefined,
    townshipId: String(row.townshipId || townshipId),
    canPickup: row.canPickup !== false,
    canDelivery: Boolean(row.canDelivery),
    canExpress: Boolean(row.canExpress),
    contactShop: Boolean(row.contactShop),
    deliveryFeeKs: row.deliveryFeeKs == null ? null : Math.max(0, Math.floor(Number(row.deliveryFeeKs) || 0)),
    expressFeeKs: row.expressFeeKs == null ? null : Math.max(0, Math.floor(Number(row.expressFeeKs) || 0)),
    deliveryEnabled: Boolean(row.deliveryEnabled),
    pickupEnabled: row.pickupEnabled !== false,
    expressEnabled: Boolean(row.expressEnabled),
  };
}

/** Public — shop phone for closed-checkout contact. */
export async function fetchShopContact(shopId: string): Promise<ShopContact> {
  const { response, data } = await apiRequest<unknown>(
    `/api/shops/${encodeURIComponent(shopId)}`,
  );
  const row = unwrapPlatformData<{
    id?: string;
    name?: string;
    phone?: string | null;
    phone2?: string | null;
  }>(data);
  if (!response.ok || !row) {
    throw new Error(platformErrorMessage(data, 'Could not load shop contact.'));
  }
  const phone = String(row.phone || row.phone2 || '').trim();
  return {
    id: String(row.id || shopId),
    name: String(row.name || ''),
    phone,
  };
}
