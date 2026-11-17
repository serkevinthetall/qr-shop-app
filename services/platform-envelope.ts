/**
 * Platform API responses: { ok: true, data } | { ok: false, error: { message, code } }
 */

export type PlatformFail = {
  ok: false;
  error?: { message?: string; code?: string };
};

export type PlatformOk<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
};

export function isPlatformOk<T>(data: unknown): data is PlatformOk<T> {
  return Boolean(data && typeof data === 'object' && (data as PlatformOk<T>).ok === true);
}

export function platformErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const fail = data as PlatformFail & { message?: string };
    if (fail.error?.message) return fail.error.message;
    if (typeof fail.message === 'string' && fail.message) return fail.message;
  }
  return fallback;
}

export function platformErrorCode(data: unknown): string | undefined {
  if (data && typeof data === 'object') {
    const fail = data as PlatformFail;
    return fail.error?.code;
  }
  return undefined;
}

export function unwrapPlatformData<T>(data: unknown): T | null {
  if (isPlatformOk<T>(data)) return data.data;
  return null;
}

/** Absolute URL for /uploads/… paths on the Platform API host. */
export function resolvePlatformMediaUrl(baseUrl: string, uri: string | null | undefined): string {
  const raw = String(uri || '').trim();
  if (!raw) return '';
  if (raw.startsWith('blob:') || raw.startsWith('data:') || raw.startsWith('file:')) {
    return raw;
  }
  if (raw.startsWith('/uploads/')) return `${baseUrl.replace(/\/$/, '')}${raw}`;
  try {
    const u = new URL(raw);
    if (u.pathname.startsWith('/uploads/')) {
      return `${baseUrl.replace(/\/$/, '')}${u.pathname}${u.search}`;
    }
  } catch {
    /* ignore */
  }
  return raw;
}
