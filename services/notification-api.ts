import { apiRequest } from '@/services/api-client';

export type ProductNotification = {
  id: string;
  type: 'product';
  product_id: number;
  product_name: string;
  ribbon_name?: string;
  date: string;
};

export type CouponNotification = {
  id: string;
  type: 'coupon';
  coupon_code: string;
  amount: number;
  status: string;
  date: string;
};

export type AppNotification = ProductNotification | CouponNotification;

type ApiErrorResponse = {
  success: false;
  message: string;
};

type NotificationsResponse = {
  success: true;
  notifications: AppNotification[];
};

function getApiError(data: { success: boolean; message?: string } | null, fallback: string) {
  if (data && 'message' in data && data.message) {
    return data.message;
  }

  return fallback;
}

export async function fetchNotifications(token: string) {
  const { response, data } = await apiRequest<NotificationsResponse | ApiErrorResponse>(
    '/api/notifications',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load notifications.'));
  }

  return data.notifications;
}

export async function registerPushToken(token: string, expoPushToken: string, language: 'my' | 'en') {
  const { response, data } = await apiRequest<{ success: boolean; message?: string } | ApiErrorResponse>(
    '/api/notifications/register-token',
    {
      method: 'POST',
      token,
      body: { expo_push_token: expoPushToken, language },
    },
  );

  if (!response.ok || !data?.success) {
    throw new Error(getApiError(data, 'Failed to register push token.'));
  }
}

export async function unregisterPushToken(token: string, expoPushToken?: string | null) {
  const { response, data } = await apiRequest<{ success: boolean; message?: string } | ApiErrorResponse>(
    '/api/notifications/register-token',
    {
      method: 'DELETE',
      token,
      body: expoPushToken ? { expo_push_token: expoPushToken } : {},
    },
  );

  if (!response.ok || !data?.success) {
    throw new Error(getApiError(data, 'Failed to remove push token.'));
  }
}

export async function sendTestPush(token: string) {
  const { response, data } = await apiRequest<{ success: boolean; message?: string } | ApiErrorResponse>(
    '/api/notifications/test-push',
    {
      method: 'POST',
      token,
    },
  );

  if (!response.ok || !data?.success) {
    throw new Error(getApiError(data, 'Failed to send test push.'));
  }
}

export type PushStatus = {
  partner_id: number;
  saved_on_server: boolean;
  token_count: number;
  token_preview: string | null;
  webhook_secret_configured: boolean;
};

export async function fetchPushStatus(token: string): Promise<PushStatus> {
  const { response, data } = await apiRequest<
    | ({
        success: true;
        partner_id: number;
        saved_on_server: boolean;
        token_count: number;
        token_preview: string | null;
        webhook_secret_configured: boolean;
      })
    | ApiErrorResponse
  >('/api/notifications/push-status', { token });

  if (!response.ok || !data || data.success !== true) {
    throw new Error(getApiError(data, 'Failed to load push status.'));
  }

  return {
    partner_id: data.partner_id,
    saved_on_server: data.saved_on_server,
    token_count: data.token_count,
    token_preview: data.token_preview,
    webhook_secret_configured: data.webhook_secret_configured,
  };
}

// Odoo datetimes arrive as "YYYY-MM-DD HH:MM:SS" in UTC. Convert to epoch ms so
// the app can compare against the locally stored "last seen" timestamp.
export function notificationDateToMs(date: string) {
  if (!date) {
    return 0;
  }

  const ms = Date.parse(`${date.replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? 0 : ms;
}
