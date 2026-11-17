import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import { platformErrorMessage, unwrapPlatformData } from '@/services/platform-envelope';
import type {
  Address,
  AddressMeta,
  CreateAddressPayload,
} from '@/types/address';

type PlatformAddress = {
  id: string;
  label: string;
  street: string;
  townshipId: string;
  location: string;
  isDefault: boolean;
};

export class AddressApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AddressApiError';
    this.code = code;
  }
}

function mapAddress(address: PlatformAddress): Address {
  return {
    id: String(address.id),
    name: String(address.label || ''),
    phone: false,
    street: address.street ? String(address.street) : false,
    street2: false,
    city: address.location ? String(address.location) : false,
    zip: address.townshipId ? String(address.townshipId) : false,
    state_id: false,
    country_id: false,
    parent_id: false,
    isDefault: Boolean(address.isDefault),
  };
}

function throwAddressApiError(data: unknown, fallback: string): never {
  const code =
    data && typeof data === 'object'
      ? (data as { error?: { code?: string } }).error?.code
      : undefined;
  throw new AddressApiError(platformErrorMessage(data, fallback), code);
}

export async function fetchAddresses(token: string) {
  const { response, data } = await apiRequest<unknown>(
    '/api/addresses',
    { token },
  );

  throwIfUnauthorized(response);
  const addresses = unwrapPlatformData<PlatformAddress[]>(data);
  if (!response.ok || !addresses) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadAddresses')));
  }

  return addresses.map(mapAddress);
}

export type PublishedTownship = {
  id: string;
  name: string;
  nameEn?: string;
  nameMm?: string;
  state: string;
  postalCode?: string;
};

/** Public — used by register (no session) and address forms. */
export async function fetchPublishedTownships(token?: string | null) {
  const { response, data } = await apiRequest<unknown>('/api/townships', {
    token: token || undefined,
  });
  if (token) throwIfUnauthorized(response);
  const townships = unwrapPlatformData<PublishedTownship[]>(data);
  if (!response.ok || !townships) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('loadAddresses')));
  }
  return (Array.isArray(townships) ? townships : []).map((row) => ({
    id: String(row.id),
    name: String(row.nameEn || row.name || ''),
    nameEn: row.nameEn ? String(row.nameEn) : undefined,
    nameMm: row.nameMm ? String(row.nameMm) : undefined,
    state: String(row.state || ''),
    postalCode: row.postalCode ? String(row.postalCode) : undefined,
  }));
}

export async function fetchAddressMeta(token: string) {
  const townships = await fetchPublishedTownships(token);

  return {
    country_id: 156,
    states: townships.map((township) => ({
      id: township.id,
      name: township.name,
    })),
  } satisfies AddressMeta;
}

export async function createAddress(token: string, payload: CreateAddressPayload) {
  const { response, data } = await apiRequest<unknown>(
    '/api/addresses',
    {
      method: 'POST',
      token,
      body: {
        label: payload.name,
        street: payload.street,
        townshipId: payload.townshipId,
        isDefault: payload.isDefault,
      },
    },
  );

  throwIfUnauthorized(response);
  const address = unwrapPlatformData<PlatformAddress>(data);
  if (!response.ok || !address) {
    throwAddressApiError(data, getApiFallbackMessage('generic'));
  }

  return String(address.id);
}

export async function updateAddress(
  token: string,
  addressId: string,
  payload: Partial<CreateAddressPayload>,
) {
  const { response, data } = await apiRequest<unknown>(
    `/api/addresses/${encodeURIComponent(addressId)}`,
    {
      method: 'PATCH',
      token,
      body: {
        ...(payload.name !== undefined ? { label: payload.name } : {}),
        ...(payload.street !== undefined ? { street: payload.street } : {}),
        ...(payload.townshipId !== undefined ? { townshipId: payload.townshipId } : {}),
        ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {}),
      },
    },
  );

  throwIfUnauthorized(response);
  const address = unwrapPlatformData<PlatformAddress>(data);
  if (!response.ok || !address) {
    throwAddressApiError(data, getApiFallbackMessage('generic'));
  }

  return mapAddress(address);
}

export async function deleteAddress(token: string, addressId: string) {
  const { response, data } = await apiRequest<unknown>(
    `/api/addresses/${encodeURIComponent(addressId)}`,
    {
      method: 'DELETE',
      token,
    },
  );

  throwIfUnauthorized(response);
  const result = unwrapPlatformData<{ deleted: boolean }>(data);
  if (!response.ok || !result) {
    throw new Error(platformErrorMessage(data, getApiFallbackMessage('deleteAddress')));
  }

  return result;
}
