const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

if (!apiBaseUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_BASE_URL. Copy .env.example to .env and set your API URL.',
  );
}

export const API_BASE_URL = apiBaseUrl;

export const PAYMENT_CONFIG = {
  merchantName: 'QR Shop',
  kpayPhone: '09420103001',
};
