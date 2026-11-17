import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import {
  platformErrorMessage,
  unwrapPlatformData,
} from '@/services/platform-envelope';

export type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Unused on Platform — kept empty for older UI. */
  tags: string[];
};

type MePayload = {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

export async function fetchCustomerProfile(token: string): Promise<CustomerProfile | null> {
  const { response, data } = await apiRequest<unknown>('/api/auth/me', { token });

  throwIfUnauthorized(response);
  if (!response.ok) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadProfile')));
  }

  const payload = unwrapPlatformData<MePayload>(data);
  const user = payload?.user;
  if (!user) {
    return null;
  }

  return {
    id: String(user.id),
    name: String(user.name || '').trim(),
    email: String(user.email || '').trim(),
    phone: String(user.phone || '').trim(),
    tags: [],
  };
}

export async function fetchPartnerTags(_token: string) {
  return [] as string[];
}
