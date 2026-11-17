import {
  cleanStateName,
  MYANMAR_COUNTRY_ID,
  normalizeText,
} from '@/constants/townships';
import type { AddressMeta, AddressState } from '@/types/address';

export const DEFAULT_ADDRESS_META: AddressMeta = {
  country_id: MYANMAR_COUNTRY_ID,
  states: [],
};

export function resolveStateId(stateLabel: string, states: AddressState[]) {
  const wanted = normalizeText(cleanStateName(stateLabel));
  const wantedRaw = normalizeText(stateLabel);

  const match = states.find((state) => {
    const stateName = normalizeText(state.name);
    const stateNameClean = normalizeText(cleanStateName(state.name));

    return (
      stateName === wantedRaw ||
      stateNameClean === wanted ||
      stateName.includes(wanted) ||
      wanted.includes(stateNameClean)
    );
  });

  return match?.id;
}

export function buildAddressPayload(input: {
  name: string;
  phone: string;
  street: string;
  street2?: string;
  city: string;
  zip: string;
  stateLabel: string;
  meta?: AddressMeta | null;
}) {
  const meta = input.meta ?? DEFAULT_ADDRESS_META;
  const townshipId = resolveStateId(input.city, meta.states);

  return {
    name: input.name.trim(),
    ...(input.phone.trim() ? { phone: input.phone.trim() } : {}),
    street: input.street.trim(),
    townshipId: townshipId ?? input.zip.trim(),
  };
}
