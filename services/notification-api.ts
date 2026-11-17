/** Push / in-app notifications left out of Platform API cutover. */

export type AppNotification = {
  id: string;
  type?: 'product' | 'coupon' | string;
  title?: string;
  body?: string;
  product_id?: string;
  product_name?: string;
  ribbon_name?: string;
  coupon_code?: string;
  amount?: number;
  read?: boolean;
  date?: string;
  create_date?: string;
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

export async function fetchNotifications(_token: string) {
  return [] as AppNotification[];
}

export async function registerPushToken(
  _token: string,
  _expoPushToken: string | null,
  _languageOrTimeout?: string | number,
) {
  return;
}

export async function unregisterPushToken(
  _token: string,
  _expoPushToken: string | null,
  _languageOrTimeout?: string | number,
) {
  return;
}

export async function sendTestPush(_token: string) {
  return { ok: false as const };
}

export async function fetchPushStatus(_token: string) {
  return {
    registered: false,
    partner_id: 0,
  };
}
