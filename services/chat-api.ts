import { apiRequest } from '@/services/api-client';
import { throwIfUnauthorized } from '@/services/auth-error';
import { getApiFallbackMessage } from '@/services/network-error';
import {
  platformErrorMessage,
  unwrapPlatformData,
} from '@/services/platform-envelope';

export type ChatMessage = {
  id: string;
  threadId: string;
  from: 'buyer' | 'merchant';
  text: string;
  productId?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  productPriceLabel?: string | null;
  createdAt: string;
  read?: boolean;
};

export type ChatThread = {
  id: string;
  shopId: string;
  shopName?: string | null;
  shopLogoUrl?: string | null;
  lastMessage?: string | null;
  lastAt?: string | null;
  unread?: number;
  messages?: ChatMessage[];
};

export type PendingChatProduct = {
  productId: string;
  name: string;
  priceLabel: string;
  imageUrl?: string;
};

function throwChatError(data: unknown, fallback: string): never {
  throw new Error(platformErrorMessage(data, fallback));
}

export async function fetchChatThreads(token: string) {
  const { response, data } = await apiRequest<unknown>('/api/chat/threads', {
    token,
  });
  throwIfUnauthorized(response);
  if (!response.ok) {
    throwChatError(data, getApiFallbackMessage('generic'));
  }
  const rows = unwrapPlatformData<ChatThread[]>(data);
  return Array.isArray(rows) ? rows : [];
}

export async function openChatWithShop(token: string, shopId: string) {
  const { response, data } = await apiRequest<unknown>(
    `/api/chat/with-shop/${encodeURIComponent(shopId)}`,
    { token },
  );
  throwIfUnauthorized(response);
  if (!response.ok) {
    throwChatError(data, getApiFallbackMessage('generic'));
  }
  const thread = unwrapPlatformData<ChatThread>(data);
  if (!thread?.id) {
    throw new Error(getApiFallbackMessage('generic'));
  }
  return thread;
}

export async function sendChatMessage(
  token: string,
  shopId: string,
  body: {
    text: string;
    productId?: string;
    productName?: string;
    productImageUrl?: string;
    productPriceLabel?: string;
    channel?: 'app' | 'website';
  },
) {
  const { response, data } = await apiRequest<unknown>(
    `/api/chat/with-shop/${encodeURIComponent(shopId)}/messages`,
    {
      method: 'POST',
      token,
      body: { ...body, channel: body.channel || 'app' },
    },
  );
  throwIfUnauthorized(response);
  if (!response.ok) {
    throwChatError(data, getApiFallbackMessage('generic'));
  }
  return unwrapPlatformData<{ threadId: string; message: ChatMessage }>(data);
}

export async function deleteChatThread(token: string, threadId: string) {
  const { response, data } = await apiRequest<unknown>(
    `/api/chat/threads/${encodeURIComponent(threadId)}`,
    { method: 'DELETE', token },
  );
  throwIfUnauthorized(response);
  if (!response.ok) {
    throwChatError(data, getApiFallbackMessage('generic'));
  }
}
