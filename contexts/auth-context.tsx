import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loginWithApi, logoutFromApi } from '@/services/auth-api';
import { clearSessionBootstrap } from '@/services/catalog-bootstrap';
import { unregisterPushToken } from '@/services/notification-api';
import { getExpoPushToken } from '@/services/device-notifications';
import { registerPushForAuthSession } from '@/services/push-registration';
import { trackLoginSuccess } from '@/services/analytics';
import { useLanguage } from '@/contexts/language-context';

const SESSION_KEY = 'qr-app-session';
const TOKEN_KEY = 'qr-app-token';
const CART_KEY = 'qr-app-cart';

export type User = {
  id: number;
  name: string;
  login: string;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = useCallback(async (session: Session | null) => {
    if (session) {
      await AsyncStorage.multiSet([
        [SESSION_KEY, JSON.stringify(session)],
        [TOKEN_KEY, session.token],
      ]);
      setToken(session.token);
      setUser(session.user);
      return;
    }

    await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY, CART_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_KEY);

        if (!stored) {
          return;
        }

        const session = JSON.parse(stored) as Session;

        if (!session.token || !session.user) {
          await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY]);
          return;
        }

        setToken(session.token);
        setUser(session.user);
      } catch {
        await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY]);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

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

      // Finish push setup during login loading so background alerts work
      // before the user reaches the home screen.
      await registerPushForAuthSession(data.token, language);

      // Track native app analytics only (Vercel Analytics is web-only).
      // Do not block login if analytics fails.
      await trackLoginSuccess({
        userId: data.user.id,
        loginType: trimmedLogin.includes('@') ? 'email' : 'phone',
      });

      return data.token;
    },
    [persistSession, language],
  );

  const signOut = useCallback(async () => {
    if (token) {
      try {
        const expoPushToken = await getExpoPushToken();
        await unregisterPushToken(token, expoPushToken);
      } catch {
        // Continue logout even if push token cleanup fails.
      }

      try {
        await logoutFromApi(token);
      } catch {
        // Clear local session even if logout API fails.
      }
    }

    await persistSession(null);
    clearSessionBootstrap();
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
