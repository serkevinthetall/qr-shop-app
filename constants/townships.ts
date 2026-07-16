import townshipsData from '@/constants/townships.data.json';

export type Township = {
  name: string;
  state: string;
  zip: string;
  country: string;
};

export const MYANMAR_COUNTRY_ID = 156;

const TOWNSHIPS = townshipsData as Township[];

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function cleanStateName(value: string) {
  return value.replace(/\s*\(.*?\)\s*/g, '').trim();
}

export function searchTownships(query: string, limit = 80): Township[] {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return TOWNSHIPS.slice(0, limit);
  }

  return TOWNSHIPS.filter((item) => {
    return (
      normalizeText(item.name).includes(normalizedQuery) ||
      normalizeText(item.state).includes(normalizedQuery) ||
      normalizeText(item.zip).includes(normalizedQuery)
    );
  }).slice(0, limit);
}

export function findTownshipByCity(city: string) {
  const normalizedCity = normalizeText(city);

  return TOWNSHIPS.find((item) => normalizeText(item.name) === normalizedCity) ?? null;
}

export function formatTownshipLabel(township: Township) {
  return `${township.name} · ${township.state} · ${township.zip}`;
}
