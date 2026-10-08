import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import type { PickupPoint } from '@/types/pickup-point';

type ApiErrorResponse = {
  success: false;
  message: string;
};

type PickupPointsResponse = {
  success: true;
  message?: string;
  pickup_points: PickupPoint[];
};

export async function fetchPickupPoints(token: string): Promise<PickupPoint[]> {
  const { response, data } = await apiRequest<PickupPointsResponse | ApiErrorResponse>(
    '/api/pickup-points',
    { token },
  );

  throwIfUnauthorized(response);
  if (!response.ok || !data || !data.success) {
    throw new Error(
      data && 'message' in data && data.message
        ? data.message
        : getApiFallbackMessage('loadPickupPoints'),
    );
  }

  return Array.isArray(data.pickup_points) ? data.pickup_points : [];
}
