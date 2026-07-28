import { apiRequest } from '@/services/api-client';

type ApiErrorResponse = {
  success: false;
  message: string;
};

type ProfileResponse = {
  success: true;
  profile: {
    id: number;
    tags?: string[];
  } | null;
};

function getApiError(data: { success: boolean; message?: string } | null, fallback: string) {
  if (data && 'message' in data && data.message) {
    return data.message;
  }

  return fallback;
}

export async function fetchPartnerTags(token: string) {
  const { response, data } = await apiRequest<ProfileResponse | ApiErrorResponse>(
    '/api/customer/profile',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load profile tags.'));
  }

  return Array.isArray(data.profile?.tags) ? data.profile.tags : [];
}
