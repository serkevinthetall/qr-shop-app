import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/services/api-client';

export function useAuthenticatedApi() {
  const { token } = useAuth();

  return {
    token,
    request: <T,>(path: string, options: { method?: string; body?: unknown } = {}) => {
      if (!token) {
        throw new Error('You are not signed in.');
      }

      return apiRequest<T>(path, {
        ...options,
        token,
      });
    },
  };
}
