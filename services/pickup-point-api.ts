import type { PickupPoint } from '@/types/pickup-point';

/** Platform checkout uses shop pickup without a separate points list. */
export async function fetchPickupPoints(_token: string): Promise<PickupPoint[]> {
  return [];
}
