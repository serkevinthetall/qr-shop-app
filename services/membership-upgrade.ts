import type { UpgradePlan } from '@/components/membership-upgrade-modal';

/** Membership left out of Platform API cutover — stubs keep Account compiling. */

export type MembershipUpgradePending = {
  plan: UpgradePlan;
  requestedAt: string;
};

export async function getMembershipUpgradePending(): Promise<MembershipUpgradePending | null> {
  return null;
}

export async function setMembershipUpgradePending(_plan: UpgradePlan) {
  return;
}

export async function clearMembershipUpgradePending() {
  return;
}

export function isMembershipApplicationPending(_status: string | null | undefined) {
  return false;
}

export async function fetchMembershipApplication(_token: string) {
  return null;
}

export async function submitMembershipUpgradeRequest(_input: {
  token: string;
  plan: UpgradePlan;
  name: string;
  phone: string;
  email: string;
}) {
  throw new Error('Membership is not available yet.');
}

export async function resolveMembershipUpgradePending(_token: string) {
  return null;
}
