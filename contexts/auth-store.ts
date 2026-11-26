import { createContext } from 'react';

/**
 * Stable AuthContext identity — keep this file free of AuthProvider logic so
 * Fast Refresh of auth-context.tsx cannot create a second Context instance
 * (which makes NotificationProvider / CartProvider throw "useAuth must be
 * used within an AuthProvider").
 */

export type User = {
  id: string;
  name: string;
  login: string;
  phone?: string | null;
  email?: string | null;
  /** Legacy — unused on Platform API. */
  partner_id: number | null;
};

export type BuyerRegisterInput = {
  name: string;
  phone: string;
  email: string;
  street: string;
  townshipId: string;
  password: string;
};

export type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (login: string, password: string) => Promise<string>;
  /** Marketplace-style one-time identity + password → Platform buyer account. */
  signUp: (input: BuyerRegisterInput) => Promise<string>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
