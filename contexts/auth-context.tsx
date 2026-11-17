import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearPreferredApiBase } from '@/constants/api';
import { trackLoginSuccess } from '@/services/analytics';
import { loginWithApi, logoutFromApi } from '@/services/auth-api';
import { clearSessionBootstrap } from '@/services/catalog-bootstrap';
import { registerSessionExpiredHandler } from '@/services/session-expired';

const SESSION_KEY = 'qr-app-session';
const TOKEN_KEY = 'qr-app-token';
const CART_KEY = 'qr-app-cart';

export type User = {
  id: string;
  name: string;
  login: string;
  phone?: string | null;
  email?: string | null;
  /** Legacy — unused on Platform API. */
  partner_id: number | null;
};

type Session = {
  token: string;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (login: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function scrubLegacyAsyncSession() {
  await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY]).catch(() => undefined);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = useCallback(async (session: Session | null) => {
    if (session) {
      const raw = JSON.stringify(session);
      await SecureStore.setItemAsync(SESSION_KEY, raw);
      await SecureStore.setItemAsync(TOKEN_KEY, session.token);
      // Remove plaintext JWT copies left by older builds.
      await scrubLegacyAsyncSession();
      setToken(session.token);
      setUser(session.user);
      return;
    }

    // Session/cart only — never clear saved-login (Save password survives Sign Out).
    await Promise.all([
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
      AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY, CART_KEY]).catch(() => undefined),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        let session: Session | null = null;

        try {
          const secureRaw = await SecureStore.getItemAsync(SESSION_KEY);
          if (secureRaw) {
            session = JSON.parse(secureRaw) as Session;
          }
        } catch {
          session = null;
        }

        if (!session?.token || !session?.user) {
          const legacyRaw = await AsyncStorage.getItem(SESSION_KEY);
          if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw) as Session;
            if (legacy?.token && legacy?.user) {
              await persistSession(legacy);
              return;
            }
          }
          await scrubLegacyAsyncSession();
          return;
        }

        await scrubLegacyAsyncSession();
        setToken(session.token);
        setUser(session.user);
      } catch {
        await persistSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, [persistSession]);

  useEffect(() => {
    return registerSessionExpiredHandler(async () => {
      // Token is already rejected by the API — clear local session only.
      clearPreferredApiBase();
      clearSessionBootstrap();
      await persistSession(null);
      router.replace('/login');
    });
  }, [persistSession]);

  const signIn = useCallback(
    async (login: string, password: string) => {
      const trimmedLogin = login.trim();

      if (!trimmedLogin || !password) {
        throw new Error('Email/phone and password are required.');
      }

      if (trimmedLogin.includes('@') && !isValidEmail(trimmedLogin)) {
        throw new Error('Please enter a valid email address.');
      }

      const data = await loginWithApi(trimmedLogin, password);

      await persistSession({
        token: data.token,
        user: data.user,
      });

      // Track native app analytics only (Vercel Analytics is web-only).
      await trackLoginSuccess({
        userId: data.user.id,
        loginType: trimmedLogin.includes('@') ? 'email' : 'phone',
      });

      return data.token;
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    const sessionToken = token;

    // Clear local session first so Sign Out always works when API is down.
    clearPreferredApiBase();
    clearSessionBootstrap();
    await persistSession(null);

    if (!sessionToken) {
      return;
    }

    void logoutFromApi(sessionToken, 4000).catch(() => undefined);
  }, [persistSession, token]);

  const value = useMemo(
    () => ({ user, token, isLoading, signIn, signOut }),
    [user, token, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
