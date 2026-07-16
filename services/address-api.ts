import { apiRequest } from '@/services/api-client';
import type {
  Address,
  AddressMeta,
  CreateAddressPayload,
} from '@/types/address';

type ApiErrorResponse = {
  success: false;
  message: string;
  details?: string | {
    code?: string;
  };
};

export class AddressApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AddressApiError';
    this.code = code;
  }
}

function throwAddressApiError(
  data: ApiErrorResponse | { success: boolean; message?: string; details?: { code?: string } } | null,
  fallback: string,
): never {
  const message = getApiError(data, fallback);
  const code =
    data && typeof data.details === 'object' && data.details ? data.details.code : undefined;
  throw new AddressApiError(message, code);
}

type AddressesResponse = {
  success: true;
  addresses: Address[];
};

type AddressMetaResponse = {
  success: true;
  country_id: number;
  states: AddressMeta['states'];
};

type CreateAddressResponse = {
  success: true;
  message: string;
  address_id: number;
};

function getApiError(
  data: { success: boolean; message?: string; details?: string | { code?: string } } | null,
  fallback: string,
) {
  if (data && 'message' in data && data.message) {
    if (typeof data.details === 'string' && data.details.trim()) {
      return `${data.message}: ${data.details}`;
    }

    return data.message;
  }

  return fallback;
}

export async function fetchAddresses(token: string) {
  const { response, data } = await apiRequest<AddressesResponse | ApiErrorResponse>(
    '/api/addresses',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load addresses.'));
  }

  return data.addresses;
}

export async function fetchAddressMeta(token: string) {
  const { response, data } = await apiRequest<AddressMetaResponse | ApiErrorResponse>(
    '/api/addresses/meta',
    { token },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to load address settings.'));
  }

  return {
    country_id: data.country_id,
    states: data.states,
  } satisfies AddressMeta;
}

export async function createAddress(token: string, payload: CreateAddressPayload) {
  const { response, data } = await apiRequest<CreateAddressResponse | ApiErrorResponse>(
    '/api/addresses',
    {
      method: 'POST',
      token,
      body: payload,
    },
  );

  if (!response.ok || !data || !data.success) {
    throwAddressApiError(data, 'Failed to create address.');
  }

  return data.address_id;
}

export async function updateAddress(
  token: string,
  addressId: number,
  payload: Partial<CreateAddressPayload>,
) {
  const { response, data } = await apiRequest<{ success: true; message: string } | ApiErrorResponse>(
    `/api/addresses/${addressId}`,
    {
      method: 'PUT',
      token,
      body: payload,
    },
  );

  if (!response.ok || !data || !data.success) {
    throwAddressApiError(data, 'Failed to update address.');
  }

  return data;
}

export async function deleteAddress(token: string, addressId: number) {
  const { response, data } = await apiRequest<{ success: true; message: string } | ApiErrorResponse>(
    `/api/addresses/${addressId}`,
    {
      method: 'DELETE',
      token,
    },
  );

  if (!response.ok || !data || !data.success) {
    throw new Error(getApiError(data, 'Failed to delete address.'));
  }

  return data;
}
