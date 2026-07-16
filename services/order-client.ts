import { API_BASE_URL } from '@/constants/api';
import { getInvalidResponseMessage, getNetworkErrorMessage } from '@/services/network-error';

type OrderRequestOptions = {
  method?: string;
  token: string;
  body?: FormData;
};

export async function orderRequest<T>(path: string, options: OrderRequestOptions) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${options.token}`,
      },
      body: options.body,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data: T | null = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText) as T;
      } catch {
        throw new Error(getInvalidResponseMessage());
      }
    }

    return { response, data };
  } catch (error) {
    throw new Error(getNetworkErrorMessage(error));
  } finally {
    clearTimeout(timeoutId);
  }
}
