import {
  clearPreferredApiBase,
  getApiBaseCandidates,
  hydratePreferredApiBase,
  noteApiBaseSuccess,
  timeoutForApiBase,
} from '@/constants/api';
import { getInvalidResponseMessage, getNetworkErrorMessage } from '@/services/network-error';
import { notifySessionExpired } from '@/services/session-expired';

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

function isUnusableApiHostResponse(status: number, data: unknown) {
  const record =
    data && typeof data === 'object' ? (data as { error?: unknown; message?: unknown }) : null;
  const errorCode = typeof record?.error === 'string' ? record.error : '';
  const message = typeof record?.message === 'string' ? record.message : '';
  const usageExceeded =
    /usage[_ ]?exceeded/i.test(errorCode) || /usage[_ ]?exceeded/i.test(message);

  if (usageExceeded) {
    return true;
  }

  return status === 502 || status === 503 || status === 504;
}

export async function orderRequest<T>(path: string, options: OrderRequestOptions) {
  await hydratePreferredApiBase();

  const bases = getApiBaseCandidates();
  let lastError: unknown;
  let lastUnauthorized: { response: Response; data: T | null } | null = null;

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

      if (response.status === 401) {
        clearPreferredApiBase();
        lastUnauthorized = { response, data };
        if (i < bases.length - 1) {
          continue;
        }
        notifySessionExpired();
        return { response, data };
      }

      if (isUnusableApiHostResponse(response.status, data) && i < bases.length - 1) {
        clearPreferredApiBase();
        continue;
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

  if (lastUnauthorized) {
    notifySessionExpired();
    return lastUnauthorized;
  }

  throw new Error(getNetworkErrorMessage(lastError));
}
