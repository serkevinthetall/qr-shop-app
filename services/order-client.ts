import {
  getApiBaseCandidates,
  hydratePreferredApiBase,
  noteApiBaseSuccess,
  timeoutForApiBase,
} from '@/constants/api';
import { getInvalidResponseMessage, getNetworkErrorMessage } from '@/services/network-error';

type OrderRequestOptions = {
  method?: string;
  token: string;
  body?: FormData;
};

const DEFAULT_TIMEOUT_MS = 60000;

function isRetriableNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'AbortError' ||
    error.message === 'Network request failed' ||
    error.message.includes('Network Error') ||
    error.message.includes('Failed to fetch')
  );
}

export async function orderRequest<T>(path: string, options: OrderRequestOptions) {
  await hydratePreferredApiBase();

  const bases = getApiBaseCandidates();
  let lastError: unknown;

  for (let i = 0; i < bases.length; i += 1) {
    const baseUrl = bases[i];
    const remaining = bases.length - i;
    const attemptTimeout = timeoutForApiBase(baseUrl, DEFAULT_TIMEOUT_MS, remaining);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeout);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
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

      if (response.ok) {
        noteApiBaseSuccess(baseUrl);
      }

      return { response, data };
    } catch (error) {
      lastError = error;
      if (!isRetriableNetworkError(error)) {
        throw new Error(getNetworkErrorMessage(error));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(getNetworkErrorMessage(lastError));
}
