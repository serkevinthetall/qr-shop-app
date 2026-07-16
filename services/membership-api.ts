import { apiRequest } from '@/services/api-client';
import type { Membership, MembershipCoupon } from '@/types/membership';

type ApiErrorResponse = {
  success: false;
  message: string;
};

type MembershipResponse = {
  success: true;
  membership: Membership | null;
  member_code?: string;
};

type CouponsResponse = {
  success: true;
  coupons: MembershipCoupon[];
};

function getApiError(data: { success: boolean; message?: string } | null, fallback: string) {
  if (data && 'message' in data && data.message) {
    return data.message;
  }

  return fallback;
}

export async function fetchMembership(token: string) {
  const { response, data } = await apiRequest<MembershipResponse | ApiErrorResponse>(
    '/api/membership',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load membership.'));
  }

  return {
    membership: data.membership,
    memberCode: data.member_code?.trim() || '',
  };
}

export async function fetchMembershipCoupons(token: string) {
  const { response, data } = await apiRequest<CouponsResponse | ApiErrorResponse>(
    '/api/membership/coupons',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load coupons.'));
  }

  return data.coupons;
}
