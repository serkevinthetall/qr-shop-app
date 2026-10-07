import {
  clearPreferredApiBase,
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
import { notifySessionExpired } from '@/services/session-expired';
import { Platform } from 'react-native';

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  /** Override default request timeout (ms). */
  timeoutMs?: number;
  /**
   * When true, an authenticated 401 is returned to the caller instead of
   * forcing logout (e.g. wrong current password on change-password).
   */
  skipSessionExpireOn401?: boolean;
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

/** Host is alive but unusable (quota / platform pause) — try the next API base. */
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

  // Platform gateway outages — skip to the next candidate when one exists.
  return status === 502 || status === 503 || status === 504;
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
  let lastUnauthorized: ApiResult<T> | null = null;

  for (let i = 0; i < bases.length; i += 1) {
    const baseUrl = bases[i];
    const remaining = bases.length - i;
    const attemptTimeout = timeoutForApiBase(baseUrl, timeoutMs, remaining);
    // Only retry same host when it is the last candidate (no failover left).
    const canRetrySameHost = remaining <= 1 && (method === 'GET' || method === 'HEAD');

    try {
      const result = await fetchOnce<T>(baseUrl, path, options, attemptTimeout);

      // Authenticated 401: wrong/stuck host or dead session — try other bases
      // before forcing logout. Anonymous 401 (e.g. bad login) returns as-is.
      if (result.response.status === 401 && options.token) {
        if (options.skipSessionExpireOn401) {
          return result;
        }
        clearPreferredApiBase();
        lastUnauthorized = result;
        if (i < bases.length - 1) {
          continue;
        }
        notifySessionExpired();
        return result;
      }

      // Netlify/Vercel quota pause, etc. — drop this host and try the next base.
      if (isUnusableApiHostResponse(result.response.status, result.data) && i < bases.length - 1) {
        clearPreferredApiBase();
        continue;
      }

      return result;
    } catch (error) {
      lastError = error;

      if (!isRetriableNetworkError(error)) {
        break;
      }

      if (canRetrySameHost) {
        try {
          const retryResult = await fetchOnce<T>(baseUrl, path, options, timeoutMs);
          if (retryResult.response.status === 401 && options.token) {
            if (options.skipSessionExpireOn401) {
              return retryResult;
            }
            clearPreferredApiBase();
            lastUnauthorized = retryResult;
            if (i < bases.length - 1) {
              continue;
            }
            notifySessionExpired();
            return retryResult;
          }
          return retryResult;
        } catch (retryError) {
          lastError = retryError;
          if (!isRetriableNetworkError(retryError)) {
            break;
          }
        }
      }
    }
  }

  if (lastUnauthorized) {
    notifySessionExpired();
    return lastUnauthorized;
  }

  if (shouldEmitServerDownFromError(lastError)) {
    emitServerDown();
  }
  throw new Error(getNetworkErrorMessage(lastError));
}
