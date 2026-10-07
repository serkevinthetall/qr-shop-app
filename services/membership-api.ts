import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import type { Membership, MembershipCoupon } from '@/types/membership';
import { getApiFallbackMessage } from '@/services/network-error';

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

  throwIfUnauthorized(response);
  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, getApiFallbackMessage('loadMembership')));
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

  throwIfUnauthorized(response);
  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, getApiFallbackMessage('loadCoupons')));
  }

  return data.coupons;
}
