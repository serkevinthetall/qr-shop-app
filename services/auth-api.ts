import { apiRequest } from '@/services/api-client';

type ApiErrorResponse = {
  success: false;
  message: string;
  details?: {
    code?: string;
    retry_after_seconds?: number;
    remaining_attempts_before_lock?: number;
    next_lock_minutes?: number;
    lock_minutes?: number;
  };
};

export type LoginUser = {
  id: number;
  name: string;
  login: string;
  partner_id: number | null;
};

type LoginSuccessResponse = {
  success: true;
  message: string;
  token: string;
  user: LoginUser;
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

export async function loginWithApi(login: string, password: string) {
  const { response, data } = await apiRequest<LoginSuccessResponse | ApiErrorResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: { login, password },
    },
  );

  if (!response.ok || !data?.success) {
    const details = data && 'details' in data ? data.details : undefined;
    const retryAfterSeconds = Number(details?.retry_after_seconds || 0);
    const remainingAttemptsBeforeLock = Number(details?.remaining_attempts_before_lock || 0);
    const nextLockMinutes = Number(details?.next_lock_minutes || 0);
    const lockMinutes = Number(details?.lock_minutes || 0);

    throw new LoginApiError(
      data && 'message' in data && data.message
        ? data.message
        : 'Email or password is incorrect.',
      {
        status: response.status,
        code: details?.code,
        retryAfterSeconds:
          response.status === 429 && retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
        remainingAttemptsBeforeLock:
          remainingAttemptsBeforeLock > 0 ? remainingAttemptsBeforeLock : undefined,
        nextLockMinutes: nextLockMinutes > 0 ? nextLockMinutes : undefined,
        lockMinutes: lockMinutes > 0 ? lockMinutes : undefined,
      },
    );
  }

  return data;
}

export async function logoutFromApi(token: string) {
  await apiRequest('/api/auth/logout', {
    method: 'POST',
    token,
  });
}

export async function changePasswordApi(
  token: string,
  currentPassword: string,
  newPassword: string,
) {
  const { response, data } = await apiRequest<{ success: boolean; message?: string }>(
    '/api/auth/change-password',
    {
      method: 'POST',
      token,
      body: { current_password: currentPassword, new_password: newPassword },
    },
  );

  if (!response.ok || !data?.success) {
    throw new Error(
      data && 'message' in data && data.message
        ? data.message
        : 'Failed to change password.',
    );
  }

  return data;
}
