/**
 * Local emergency override only. Prefer backend `GET /api/app-config`
 * → `maintenance` (toggled via API / Redis). Keep this `false` in releases.
 */
export const MAINTENANCE_MODE_ENABLED = false;

export function isLocalMaintenanceOverride(): boolean {
  return MAINTENANCE_MODE_ENABLED;
}
