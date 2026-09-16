import {
  getApiBaseCandidates,
  hydratePreferredApiBase,
  noteApiBaseSuccess,
  timeoutForApiBase,
} from '@/constants/api';
import { warmCloudflareDoh } from '@/services/cloudflare-doh';
import { getInvalidResponseMessage, getNetworkErrorMessage } from '@/services/network-error';
import {
  emitServerDown,
  noteServerReachable,
  shouldEmitServerDownFromError,
  shouldEmitServerDownFromStatus,
} from '@/services/server-status-events';
import { Platform } from 'react-native';

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  /** Override default request timeout (ms). */
  timeoutMs?: number;
};

type ApiResult<T> = {
  response: Response;
  data: T;
};

const DEFAULT_TIMEOUT_MS = 60000;

const dohWarmByHost = new Map<string, Promise<void>>();

function warmDohForBase(baseUrl: string) {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }

  try {
    const host = new URL(baseUrl).hostname;
    if (!host) {
      return Promise.resolve();
    }

    let pending = dohWarmByHost.get(host);
    if (!pending) {
      pending = warmCloudflareDoh(host)
        .then(() => undefined)
        .catch(() => undefined);
      dohWarmByHost.set(host, pending);
    }

    return pending;
  } catch {
    return Promise.resolve();
  }
}

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

async function fetchOnce<T>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions,
  timeoutMs: number,
): Promise<ApiResult<T>> {
  await warmDohForBase(baseUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (shouldEmitServerDownFromStatus(response.status)) {
      emitServerDown();
    } else if (response.ok) {
      noteServerReachable();
      noteApiBaseSuccess(baseUrl);
    }

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
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  await hydratePreferredApiBase();

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = (options.method ?? 'GET').toUpperCase();
  const bases = getApiBaseCandidates();

  let lastError: unknown;

  for (let i = 0; i < bases.length; i += 1) {
    const baseUrl = bases[i];
    const remaining = bases.length - i;
    const attemptTimeout = timeoutForApiBase(baseUrl, timeoutMs, remaining);
    // Only retry same host when it is the last candidate (no failover left).
    const canRetrySameHost = remaining <= 1 && (method === 'GET' || method === 'HEAD');

    try {
      return await fetchOnce<T>(baseUrl, path, options, attemptTimeout);
    } catch (error) {
      lastError = error;

      if (!isRetriableNetworkError(error)) {
        break;
      }

      if (canRetrySameHost) {
        try {
          return await fetchOnce<T>(baseUrl, path, options, timeoutMs);
        } catch (retryError) {
          lastError = retryError;
          if (!isRetriableNetworkError(retryError)) {
            break;
          }
        }
      }
    }
  }

  if (shouldEmitServerDownFromError(lastError)) {
    emitServerDown();
  }
  throw new Error(getNetworkErrorMessage(lastError));
}
