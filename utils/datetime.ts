/** Myanmar standard time (no DST). Matches backend NOTIFY_TZ_OFFSET_MINUTES default. */
export const MYANMAR_TIME_ZONE = 'Asia/Yangon';

/**
 * Odoo datetimes usually arrive as "YYYY-MM-DD HH:MM:SS" in UTC with no zone.
 * Parse them as UTC so display can shift into Asia/Yangon.
 */
export function parseOdooUtcDate(value: string): Date | null {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized);
  const ms = Date.parse(hasZone ? normalized : `${normalized}Z`);

  if (Number.isNaN(ms)) {
    return null;
  }

  return new Date(ms);
}

export function formatMyanmarDateTime(value: string): string {
  const date = parseOdooUtcDate(value);

  if (!date) {
    return String(value || '').trim();
  }

  return date.toLocaleString('en-GB', {
    timeZone: MYANMAR_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
