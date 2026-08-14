import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UpgradePlan } from '@/components/membership-upgrade-modal';
import { apiRequest } from '@/services/api-client';

const UPGRADE_PENDING_KEY = 'qr-app-membership-upgrade-pending';

export type MembershipUpgradePending = {
  plan: UpgradePlan;
  requestedAt: string;
};

type ApiErrorResponse = {
  success: false;
  message: string;
};

type ApplicationResponse = {
  success: true;
  application: {
    id: number;
    plan: string | null;
    name: string;
    phone: string;
    email: string;
    status: string | null;
    requested_at: string | null;
  } | null;
};

type CreateApplicationResponse = {
  success: true;
  message?: string;
  application_id: number;
  status: string;
  plan: string;
  reused?: boolean;
};

function getApiError(data: { success: boolean; message?: string } | null, fallback: string) {
  if (data && 'message' in data && data.message) {
    return data.message;
  }

  return fallback;
}

function mapOdooPlanToApp(plan: string | null | undefined): UpgradePlan | null {
  const normalized = String(plan || '')
    .trim()
    .toLowerCase();

  if (normalized === 'pro') {
    return 'pro';
  }

  if (normalized === 'premium') {
    return 'premium';
  }

  return null;
}

export async function getMembershipUpgradePending(): Promise<MembershipUpgradePending | null> {
  try {
    const raw = await AsyncStorage.getItem(UPGRADE_PENDING_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as MembershipUpgradePending;
    if (parsed?.plan !== 'premium' && parsed?.plan !== 'pro') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function setMembershipUpgradePending(plan: UpgradePlan) {
  const payload: MembershipUpgradePending = {
    plan,
    requestedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(UPGRADE_PENDING_KEY, JSON.stringify(payload));
}

export async function clearMembershipUpgradePending() {
  await AsyncStorage.removeItem(UPGRADE_PENDING_KEY);
}

/** True when Odoo Status is still open (app shows Processing). */
export function isMembershipApplicationPending(status: string | null | undefined) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();

  return normalized === 'requested' || normalized === 'contacting';
}

export async function fetchMembershipApplication(token: string) {
  const { response, data } = await apiRequest<ApplicationResponse | ApiErrorResponse>(
    '/api/membership/application',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load membership application.'));
  }

  return data.application;
}

/**
 * Create membership Apply in Odoo Studio model via API.
 */
export async function submitMembershipUpgradeRequest(input: {
  token: string;
  plan: UpgradePlan;
  name: string;
  phone: string;
  email: string;
}): Promise<void> {
  const { response, data } = await apiRequest<CreateApplicationResponse | ApiErrorResponse>(
    '/api/membership/application',
    {
      method: 'POST',
      token: input.token,
      body: {
        plan: input.plan,
        name: input.name,
        phone: input.phone,
        email: input.email,
      },
    },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to submit membership application.'));
  }
}

/** Prefer Odoo Requested row; fall back to local pending cache. */
export async function resolveMembershipUpgradePending(
  token: string | null | undefined,
): Promise<MembershipUpgradePending | null> {
  if (token) {
    try {
      const application = await fetchMembershipApplication(token);
      if (application && isMembershipApplicationPending(application.status)) {
        const plan = mapOdooPlanToApp(application.plan) || 'pro';
        const pending: MembershipUpgradePending = {
          plan,
          requestedAt: application.requested_at || new Date().toISOString(),
        };
        await setMembershipUpgradePending(plan);
        return pending;
      }

      // Approved/Rejected (or none) → clear local pending.
      if (application && !isMembershipApplicationPending(application.status)) {
        await clearMembershipUpgradePending();
        return null;
      }
    } catch {
      // Fall through to local cache if API/Odoo is unreachable.
    }
  }

  return getMembershipUpgradePending();
}
