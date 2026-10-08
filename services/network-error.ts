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

  // Expo cancel (not our timeout abort) — keep message recognizable so
  // getUserFacingError can hide it instead of showing a scary banner.
  if (
    /FetchRequestCanceledException|Fetch request has been canceled|Fetch request has been cancelled/i.test(
      error.message,
    )
  ) {
    return error.message;
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

/** Localized fallback for domain API failures (keeps services language-aware). */
export function getApiFallbackMessage(
  key:
    | 'loadProducts'
    | 'refreshProducts'
    | 'searchProducts'
    | 'loadCategories'
    | 'loadProduct'
    | 'productNotFound'
    | 'loadOrders'
    | 'refreshOrders'
    | 'loadOrder'
    | 'reorderFailed'
    | 'loadAccount'
    | 'refreshAccount'
    | 'upgradeFailed'
    | 'signInAgain'
    | 'loadAddresses'
    | 'deleteAddress'
    | 'loadAddressList'
    | 'addressRefreshFailed'
    | 'checkoutFailed'
    | 'changePasswordFailed'
    | 'loadNotifications'
    | 'loadMembership'
    | 'loadCoupons'
    | 'loadDeliveryFee'
    | 'loadPickupPoints'
    | 'loadProfile'
    | 'generic',
) {
  return translate(currentLanguage, `errors.${key}`);
}
