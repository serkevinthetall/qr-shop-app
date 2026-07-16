export type OdooRef = [number, string] | false;

export type Address = {
  id: number;
  name: string;
  phone: string | false;
  street: string | false;
  street2: string | false;
  city: string | false;
  zip: string | false;
  state_id: OdooRef;
  country_id: OdooRef;
  type?: string;
  parent_id: OdooRef;
};

export function isDeliveryChild(address: Address) {
  return Array.isArray(address.parent_id) && !!address.parent_id[0];
}

export function isBranchAddress(address: Address, mainAddress: Address | null) {
  if (!mainAddress) {
    return true;
  }

  return address.id !== mainAddress.id;
}

export function getAddressLabel(address: Address) {
  if (address.type === 'invoice') {
    return `${address.name} (Invoice)`;
  }

  if (address.type === 'other') {
    return `${address.name} (Other)`;
  }

  return isDeliveryChild(address) ? address.name : `${address.name} (Main)`;
}

export function canEditAddress(address: Address, mainAddress?: Address | null) {
  const main = mainAddress ?? null;

  if (!main) {
    return isDeliveryChild(address);
  }

  return address.id !== main.id;
}

export type AddressState = {
  id: number;
  name: string;
  code?: string | false;
};

export type AddressMeta = {
  country_id: number;
  states: AddressState[];
};

export type CreateAddressPayload = {
  name: string;
  phone: string;
  street: string;
  street2?: string;
  city: string;
  zip: string;
  country_id: number;
  state_id?: number;
  state?: string;
};

export function formatAddressLine(address: Address) {
  const parts = [
    address.street || '',
    address.street2 || '',
    address.city || '',
    address.zip || '',
  ].filter(Boolean);

  return parts.join(', ');
}

export function formatAddressMultiline(address: Address) {
  const lines: string[] = [];

  if (address.street) {
    lines.push(String(address.street));
  }

  if (address.street2) {
    lines.push(String(address.street2));
  }

  const cityZip = [address.city, address.zip].filter(Boolean).join(', ');
  if (cityZip) {
    lines.push(cityZip);
  }

  if (Array.isArray(address.state_id) && address.state_id[1]) {
    lines.push(String(address.state_id[1]));
  }

  return lines.join('\n');
}

export function formatAddressDetails(address: Address) {
  const lines = [
    address.name,
    address.phone ? String(address.phone) : '',
    address.street ? String(address.street) : '',
    address.street2 ? String(address.street2) : '',
    [address.city, address.zip].filter(Boolean).join(' '),
    Array.isArray(address.state_id) ? address.state_id[1] : '',
    Array.isArray(address.country_id) ? address.country_id[1] : '',
  ].filter(Boolean);

  return lines;
}

export function getMainAddress(addresses: Address[]) {
  return (
    addresses.find((address) => !Array.isArray(address.parent_id) || !address.parent_id[0]) ??
    null
  );
}

export function getDeliveryAddresses(addresses: Address[]) {
  if (!addresses.length) {
    return [];
  }

  const mainAddress = getMainAddress(addresses);
  const rest = addresses.filter((address) => !mainAddress || address.id !== mainAddress.id);

  return mainAddress ? [mainAddress, ...rest] : addresses;
}
