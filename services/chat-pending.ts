import type { PendingChatProduct } from '@/services/chat-api';

const pendingByShop = new Map<string, PendingChatProduct>();

export function setPendingChatProduct(shopId: string, product: PendingChatProduct) {
  pendingByShop.set(shopId, product);
}

export function takePendingChatProduct(shopId: string) {
  const product = pendingByShop.get(shopId);
  pendingByShop.delete(shopId);
  return product ?? null;
}

export function clearPendingChatProduct(shopId: string) {
  pendingByShop.delete(shopId);
}
