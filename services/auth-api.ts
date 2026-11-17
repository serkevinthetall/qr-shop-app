import { apiRequest } from '@/services/api-client';
import { getApiFallbackMessage } from '@/services/network-error';
import {
  platformErrorCode,
  platformErrorMessage,
  unwrapPlatformData,
} from '@/services/platform-envelope';

export type LoginUser = {
  id: string;
  name: string;
  login: string;
  phone?: string | null;
  email?: string | null;
  role?: string;
  /** Legacy field — always null on Platform API. */
  partner_id: number | null;
};

type PlatformLoginData = {
  token: string;
  user: {
    id: string;
    role: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
};

export class LoginApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  remainingAttemptsBeforeLock?: number;
  nextLockMinutes?: number;
  lockMinutes?: number;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      retryAfterSeconds?: number;
      remainingAttemptsBeforeLock?: number;
      nextLockMinutes?: number;
      lockMinutes?: number;
    },
  ) {
    super(message);
    this.name = 'LoginApiError';
    this.status = options.status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.remainingAttemptsBeforeLock = options.remainingAttemptsBeforeLock;
    this.nextLockMinutes = options.nextLockMinutes;
    this.lockMinutes = options.lockMinutes;
  }
}

function mapLoginUser(user: PlatformLoginData['user']): LoginUser {
  const login = String(user.phone || user.email || user.id || '').trim();
  return {
    id: String(user.id),
    name: String(user.name || ''),
    login,
    phone: user.phone ?? null,
    email: user.email ?? null,
    role: user.role,
    partner_id: null,
  };
}

export async function loginWithApi(login: string, password: string) {
  const { response, data } = await apiRequest<unknown>('/api/auth/login', {
    method: 'POST',
    body: { login, password, role: 'buyer' },
  });

  const payload = unwrapPlatformData<PlatformLoginData>(data);
  if (!response.ok || !payload?.token || !payload.user) {
    throw new LoginApiError(
      platformErrorMessage(data, 'Email or password is incorrect.'),
      {
        status: response.status,
        code: platformErrorCode(data),
      },
    );
  }

  if (payload.user.role && payload.user.role !== 'buyer') {
    throw new LoginApiError('This account is not a buyer account.', {
      status: 403,
      code: 'wrong_role',
    });
  }

  return {
    success: true as const,
    message: 'OK',
    token: payload.token,
    user: mapLoginUser(payload.user),
  };
}

/** Platform API has no logout endpoint — client clears the JWT locally. */
export async function logoutFromApi(_token: string, _timeoutMs = 8000) {
  return;
}

export async function changePasswordApi(
  token: string,
  currentPassword: string,
  newPassword: string,
) {
  const { response, data } = await apiRequest<unknown>('/api/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword, nextPassword: newPassword },
    skipSessionExpireOn401: true,
  });

  const payload = unwrapPlatformData<{ ok?: boolean }>(data);
  if (!response.ok || !payload) {
    throw new Error(
      platformErrorMessage(data, getApiFallbackMessage('changePasswordFailed')),
    );
  }

  return { success: true as const, message: 'OK' };
}
