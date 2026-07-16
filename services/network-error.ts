import { DEFAULT_LANGUAGE, translate, type Language } from '@/constants/translations';

let currentLanguage: Language = DEFAULT_LANGUAGE;

/** Keep API error copy in sync with the app language. */
export function setApiClientLanguage(language: Language) {
  currentLanguage = language;
}

export function getNetworkErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return translate(currentLanguage, 'network.cannotConnect');
  }

  if (error.name === 'AbortError') {
    return translate(currentLanguage, 'network.timedOut');
  }

  if (
    error.message === 'Network request failed' ||
    error.message.includes('Network Error') ||
    error.message.includes('Failed to fetch')
  ) {
    return translate(currentLanguage, 'network.cannotConnect');
  }

  return error.message;
}

export function getInvalidResponseMessage() {
  return translate(currentLanguage, 'network.invalidResponse');
}
