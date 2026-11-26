import { getApiBaseUrl } from '@/constants/api';
import { apiRequest } from '@/services/api-client';
import {
  platformErrorMessage,
  resolvePlatformMediaUrl,
  unwrapPlatformData,
} from '@/services/platform-envelope';

export type ShopPaymentMethodId =
  | 'cod'
  | 'kpay'
  | 'uabpay'
  | 'ayapay'
  | 'cbpay'
  | 'mmqr'
  | string;

export type ShopPaymentMethod = {
  id: ShopPaymentMethodId;
  enabled: boolean;
  qrUrl: string | null;
  label: string;
  shortLabel: string;
  needsQr: boolean;
};

const WALLET_IDS = new Set(['kpay', 'uabpay', 'ayapay', 'cbpay', 'mmqr']);

export function isWalletPayment(id: string) {
  return WALLET_IDS.has(String(id || '').toLowerCase());
}

/** Turn /uploads/… into an absolute URL for Image. */
export function resolvePaymentMediaUrl(url: string | null | undefined): string | null {
  const resolved = resolvePlatformMediaUrl(getApiBaseUrl(), url);
  return resolved || null;
}

/** Public — enabled shop payment methods (+ wallet QR). */
export async function fetchShopPayments(shopId: string): Promise<ShopPaymentMethod[]> {
  const { response, data } = await apiRequest<unknown>(
    `/api/shops/${encodeURIComponent(shopId)}/payments`,
  );
  const row = unwrapPlatformData<{ methods?: unknown }>(data);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, 'Could not load payment methods.'));
  }

  const raw = Array.isArray(row?.methods) ? row.methods : [];
  const methods: ShopPaymentMethod[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const id = String(m.id || '').trim().toLowerCase();
    if (!id) continue;
    methods.push({
      id,
      enabled: m.enabled !== false,
      qrUrl: m.qrUrl ? String(m.qrUrl) : null,
      label: String(m.label || id),
      shortLabel: String(m.shortLabel || m.label || id),
      needsQr: m.needsQr !== false,
    });
  }

  if (!methods.length) {
    return [
      {
        id: 'cod',
        enabled: true,
        qrUrl: null,
        label: 'Cash on delivery',
        shortLabel: 'COD',
        needsQr: false,
      },
    ];
  }

  return methods;
}
