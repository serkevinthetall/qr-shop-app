import type { Membership, MembershipCoupon } from '@/types/membership';

/** Membership left out of Platform API cutover — stubs keep imports compiling. */

export async function fetchMembership(_token: string) {
  return {
    membership: null as Membership | null,
    memberCode: '',
  };
}

export async function fetchMembershipCoupons(_token: string) {
  return [] as MembershipCoupon[];
}
