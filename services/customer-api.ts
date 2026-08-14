import { apiRequest } from '@/services/api-client';

type ApiErrorResponse = {
  success: false;
  message: string;
};

export type CustomerProfile = {
  id: number;
  name: string;
  email: string;
  phone: string;
  tags: string[];
};

type ProfileResponse = {
  success: true;
  profile: {
    id: number;
    name?: string | false;
    email?: string | false;
    phone?: string | false;
    tags?: string[];
  } | null;
};

function getApiError(data: { success: boolean; message?: string } | null, fallback: string) {
  if (data && 'message' in data && data.message) {
    return data.message;
  }

  return fallback;
}

function asText(value: string | false | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export async function fetchCustomerProfile(token: string): Promise<CustomerProfile | null> {
  const { response, data } = await apiRequest<ProfileResponse | ApiErrorResponse>(
    '/api/customer/profile',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load profile.'));
  }

  if (!data.profile) {
    return null;
  }

  return {
    id: data.profile.id,
    name: asText(data.profile.name),
    email: asText(data.profile.email),
    phone: asText(data.profile.phone),
    tags: Array.isArray(data.profile.tags) ? data.profile.tags : [],
  };
}

export async function fetchPartnerTags(token: string) {
  const profile = await fetchCustomerProfile(token);
  return profile?.tags ?? [];
}
