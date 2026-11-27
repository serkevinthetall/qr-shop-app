import { Platform } from 'react-native';

import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import {
  platformErrorMessage,
  unwrapPlatformData,
} from '@/services/platform-envelope';

export type AppNotification = {
  id: string;
  type?: 'product' | 'coupon' | 'message' | 'order' | string;
  title?: string;
  body?: string;
  product_id?: string;
  product_name?: string;
  ribbon_name?: string;
  coupon_code?: string;
  amount?: number;
  /** Shop chat (merchant reply) — open `/chat/[shopId]`. */
  shop_id?: string;
  thread_id?: string;
  order_id?: string;
  order_code?: string;
  read?: boolean;
  date?: string;
  create_date?: string;
};

type NotificationsPayload = {
  notifications?: AppNotification[];
  success?: boolean;
};

export function notificationDateToMs(value?: string | number | null) {
  if (value == null || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchNotifications(token: string) {
  const { response, data } = await apiRequest<unknown>('/api/app/notifications', {
    token,
  });

  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(
      platformErrorMessage(data, getApiFallbackMessage('loadNotifications')),
    );
  }

  const payload = unwrapPlatformData<NotificationsPayload | AppNotification[]>(data);
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload?.notifications || [];
}

export async function registerPushToken(
  token: string,
  expoPushToken: string | null,
  languageOrTimeout?: string | number,
) {
  const expo = String(expoPushToken || '').trim();
  if (!expo) return;

  const language =
    typeof languageOrTimeout === 'string' ? languageOrTimeout : 'my';

  const { response, data } = await apiRequest<unknown>(
    '/api/app/notifications/register-token',
    {
      method: 'POST',
      token,
      body: {
        expo_push_token: expo,
        language,
        platform: Platform.OS,
      },
    },
  );

  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('generic')));
  }
}

export async function unregisterPushToken(
  token: string,
  expoPushToken: string | null,
  _languageOrTimeout?: string | number,
) {
  const { response, data } = await apiRequest<unknown>(
    '/api/app/notifications/register-token',
    {
      method: 'DELETE',
      token,
      body: expoPushToken ? { expo_push_token: expoPushToken } : {},
    },
  );

  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('generic')));
  }
}

export async function sendTestPush(token: string) {
  const { response, data } = await apiRequest<unknown>(
    '/api/app/notifications/test-push',
    {
      method: 'POST',
      token,
    },
  );

  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('generic')));
  }
  return { ok: true as const };
}

export async function fetchPushStatus(token: string) {
  const { response, data } = await apiRequest<unknown>(
    '/api/app/notifications/push-status',
    { token },
  );

  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('generic')));
  }

  const payload = unwrapPlatformData<{
    registered?: boolean;
    partner_id?: number;
  }>(data);

  return {
    registered: Boolean(payload?.registered),
    partner_id: Number(payload?.partner_id) || 0,
  };
}
