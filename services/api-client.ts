import { API_BASE_URL } from '@/constants/api';
import { getInvalidResponseMessage, getNetworkErrorMessage } from '@/services/network-error';

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};

type ApiResult<T> = {
  response: Response;
  data: T;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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

    return { response, data: data as T };
  } catch (error) {
    throw new Error(getNetworkErrorMessage(error));
  } finally {
    clearTimeout(timeoutId);
  }
}
