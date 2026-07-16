export type OdooRef = [number, string] | false;

export type MembershipLevel = 'Pro' | 'Premium' | string;

export const COUPON_MIN_AMOUNT_PRO = 100000;
export const COUPON_MIN_AMOUNT_PREMIUM = 10000;

export type Membership = {
  id: number;
  x_name: string;
  x_studio_customer: OdooRef;
  x_studio_membership_level: MembershipLevel;
  x_studio_start_date: string;
  x_studio_end_date: string;
  x_studio_status: string;
  x_studio_monthly_coupon_amount: number;
  x_studio_total_tickets: number;
  x_studio_used_tickets: number;
  x_studio_missed_tickets: string;
  x_studio_remaining_tickets: number;
  x_studio_benefits_summary: string;
};

export type MembershipCoupon = {
  id: number;
  x_studio_coupon_code: string;
  x_studio_status: string;
  x_studio_coupon_amount: number;
  x_studio_ticket_month: string;
  x_studio_customer: OdooRef;
  x_studio_used_sale_order: OdooRef | false;
  x_studio_membership: OdooRef;
};

export function normalizeMembershipLevel(level: string | undefined) {
  return (level ?? '').trim().toLowerCase();
}

// Odoo can return label variants (e.g. "Premium Member", "Pro Plan"), so we match
// by substring rather than exact equality. Premium is checked first because it is
// the stricter tier and "premium" never contains "pro".
function resolveMembershipTier(level: string | undefined): 'premium' | 'pro' | 'unknown' {
  const normalizedLevel = normalizeMembershipLevel(level);

  if (normalizedLevel.includes('premium')) {
    return 'premium';
  }

  if (normalizedLevel.includes('pro')) {
    return 'pro';
  }

  return 'unknown';
}

export function isOrderTotalEligibleForCoupon(orderTotal: number, couponAmount: number) {
  const total = Math.round(Number(orderTotal) || 0);
  const amount = Math.round(Number(couponAmount) || 0);

  if (amount <= 0) {
    return true;
  }

  return total >= amount;
}

export function isCouponAmountEligibleForLevel(amount: number, level: string | undefined) {
  const tier = resolveMembershipTier(level);

  if (tier === 'premium') {
    return amount >= COUPON_MIN_AMOUNT_PREMIUM;
  }

  if (tier === 'pro') {
    return amount >= COUPON_MIN_AMOUNT_PRO;
  }

  return amount >= COUPON_MIN_AMOUNT_PREMIUM;
}

export function getCouponEligibilityMessage(level: string | undefined) {
  const tier = resolveMembershipTier(level);

  if (tier === 'premium') {
    return `Premium members can use coupons of ${COUPON_MIN_AMOUNT_PREMIUM.toLocaleString()} Ks or more.`;
  }

  if (tier === 'pro') {
    return `Pro members can use coupons of ${COUPON_MIN_AMOUNT_PRO.toLocaleString()} Ks or more.`;
  }

  return 'Coupon eligibility depends on your membership level.';
}

export function getMemberId(memberCode?: string | null) {
  const code = memberCode?.trim();
  return code || '-';
}

export function isCouponStatusAvailable(coupon: MembershipCoupon) {
  return coupon.x_studio_status === 'Currently Available' && !coupon.x_studio_used_sale_order;
}

export function isCouponAvailable(coupon: MembershipCoupon, membership: Membership | null) {
  if (!isCouponStatusAvailable(coupon)) {
    return false;
  }

  if (!membership) {
    return false;
  }

  return isCouponAmountEligibleForLevel(
    coupon.x_studio_coupon_amount,
    membership.x_studio_membership_level,
  );
}

// Only the current month's coupon is ever shown. Coupons arrive newest ticket
// month first, so the head of the list is this month's coupon. Once it's used,
// its status reads "Used" until next month's coupon is created — we never fall
// back to an older still-available coupon.
export function getCurrentCoupon(coupons: MembershipCoupon[], _membership?: Membership | null) {
  return coupons[0] ?? null;
}
