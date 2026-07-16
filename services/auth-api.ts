import { apiRequest } from '@/services/api-client';

type ApiErrorResponse = {
  success: false;
  message: string;
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

export async function loginWithApi(login: string, password: string) {
  const { response, data } = await apiRequest<LoginSuccessResponse | ApiErrorResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: { login, password },
    },
  );

  if (!response.ok || !data?.success) {
    throw new Error(
      data && 'message' in data ? data.message : 'Login failed. Please try again.',
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
