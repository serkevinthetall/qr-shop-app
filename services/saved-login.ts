import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Saved login credentials for "Save password".
 *
 * SecureStore is the source of truth for the password (encrypted keychain/keystore).
 * AsyncStorage may keep a login hint only — never the password.
 * Sign Out does not clear these — only unchecking Save password does.
 */
const BUNDLE_KEY = 'qr-app-saved-login-bundle';
const LOGIN_HINT_KEY = 'qr-app-saved-login-hint';

export type SavedLoginCredentials = {
  login: string;
  password: string;
};

type SavedBundle = {
  enabled: true;
  login: string;
  password: string;
};

export type LoadSavedLoginResult =
  | { status: 'found'; credentials: SavedLoginCredentials }
  | { status: 'empty' }
  | { status: 'error' };

function parseBundle(raw: string | null | undefined): SavedLoginCredentials | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SavedBundle>;

    if (
      parsed?.enabled === true &&
      typeof parsed.login === 'string' &&
      parsed.login.trim() &&
      typeof parsed.password === 'string' &&
      parsed.password
    ) {
      return {
        login: parsed.login.trim(),
        password: parsed.password,
      };
    }
  } catch {
    // Ignore corrupt payloads.
  }

  return null;
}

async function readFromSecureStore(): Promise<SavedLoginCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(BUNDLE_KEY);
    return parseBundle(raw);
  } catch {
    return null;
  }
}

async function readLegacyAsyncStorageBundle(): Promise<SavedLoginCredentials | null> {
  try {
    const raw = await AsyncStorage.getItem(BUNDLE_KEY);
    return parseBundle(raw);
  } catch {
    return null;
  }
}

async function writeSecureStore(raw: string): Promise<void> {
  await SecureStore.setItemAsync(BUNDLE_KEY, raw);
}

async function deleteSecureStore(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BUNDLE_KEY);
  } catch {
    // Ignore.
  }
}

async function scrubLegacyAsyncPassword(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BUNDLE_KEY);
  } catch {
    // Ignore.
  }
}

export async function loadSavedLoginCredentials(): Promise<LoadSavedLoginResult> {
  try {
    const fromSecure = await readFromSecureStore();

    if (fromSecure) {
      await scrubLegacyAsyncPassword();
      await AsyncStorage.setItem(LOGIN_HINT_KEY, fromSecure.login).catch(() => undefined);
      return { status: 'found', credentials: fromSecure };
    }

    // Migrate older AsyncStorage password bundles into SecureStore once.
    const fromLegacy = await readLegacyAsyncStorageBundle();

    if (fromLegacy) {
      await saveLoginCredentials(fromLegacy.login, fromLegacy.password);
      return { status: 'found', credentials: fromLegacy };
    }

    return { status: 'empty' };
  } catch {
    return { status: 'error' };
  }
}

export async function saveLoginCredentials(login: string, password: string): Promise<void> {
  const trimmedLogin = login.trim();
  const bundle: SavedBundle = {
    enabled: true,
    login: trimmedLogin,
    password,
  };
  const raw = JSON.stringify(bundle);

  await writeSecureStore(raw);

  const verified = await readFromSecureStore();

  if (!verified || verified.login !== trimmedLogin || verified.password !== password) {
    await writeSecureStore(raw);
    const retry = await readFromSecureStore();

    if (!retry || retry.login !== trimmedLogin || retry.password !== password) {
      throw new Error('Failed to save login credentials');
    }
  }

  await scrubLegacyAsyncPassword();
  await AsyncStorage.setItem(LOGIN_HINT_KEY, trimmedLogin).catch(() => undefined);
}

export async function clearSavedLoginCredentials(): Promise<void> {
  await Promise.all([
    scrubLegacyAsyncPassword(),
    AsyncStorage.removeItem(LOGIN_HINT_KEY).catch(() => undefined),
    deleteSecureStore(),
  ]);
}
