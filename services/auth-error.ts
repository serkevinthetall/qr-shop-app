/**
 * Authenticated 401s are handled in api-client / order-client
 * (failover → notifySessionExpired → logout → login).
 * Domain APIs throw this instead of surfacing "Unauthorized".
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

export function throwIfUnauthorized(response: { status: number }): void {
  if (response.status === 401) {
    throw new SessionExpiredError();
  }
}

/** True when the error is a forced re-login (do not show in the UI). */
export function isUnauthorizedError(err: unknown): boolean {
  if (err instanceof SessionExpiredError) {
    return true;
  }

  if (!(err instanceof Error)) {
    return false;
  }

  return /unauthorized|session expired|SESSION_EXPIRED/i.test(err.message);
}

/**
 * Expo/React Native canceled fetches (tab switch, remount, superseded request).
 * Not a real network failure — never show these to users.
 */
export function isRequestCanceledError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  return /FetchRequestCanceledException|Fetch request has been canceled|Fetch request has been cancelled|The operation was aborted|The user aborted a request/i.test(
    err.message,
  );
}

/**
 * Generic English service/API fallbacks — prefer the localized `fallback`
 * so Myanmar users are not stuck with "Failed to load…".
 */
function isGenericEnglishApiMessage(message: string): boolean {
  const trimmed = message.trim();
  return (
    /^(Failed to |Checkout failed\.?|Search failed\.?|Could not |Reorder failed|Unauthorized|SESSION_EXPIRED|Please sign in|Something went wrong)/i.test(
      trimmed,
    ) ||
    /Address saved but list refresh failed/i.test(trimmed) ||
    /Could not load saved addresses/i.test(trimmed)
  );
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/** Network-ish errors that login should show instead of generic "Login failed". */
export function isLikelyNetworkErrorMessage(message: string): boolean {
  return /cannot connect|timed out|timeout|internet|network|offline|unavailable|ECONN|ENOTFOUND|ETIMEDOUT|ချိတ်ဆက်|အင်တာနက်|အချိန်ကုန်/i.test(
    message,
  );
}

function isTimeoutMessage(message: string): boolean {
  return /timed?\s*out|timeout|ETIMEDOUT|အချိန်ကုန်/i.test(message);
}

/**
 * Message safe to show in the UI, or `null` if session expiry already
 * signed the user out (caller should skip setError).
 *
 * Prefer `fallback` (pass a `t('errors.*')` string) when the API/service
 * only returned a generic English message.
 * Pass `t` so network failures use clear localized copy.
 */
export function getUserFacingError(
  err: unknown,
  fallback: string,
  t?: TranslateFn,
): string | null {
  if (isUnauthorizedError(err) || isRequestCanceledError(err)) {
    return null;
  }

  const raw = err instanceof Error ? err.message.trim() : '';

  if (raw && isLikelyNetworkErrorMessage(raw)) {
    if (t) {
      return isTimeoutMessage(raw) ? t('network.timedOut') : t('network.cannotConnect');
    }
    return fallback;
  }

  if (!raw || isGenericEnglishApiMessage(raw)) {
    return fallback;
  }

  return raw;
}
