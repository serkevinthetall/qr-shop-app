import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { fetchOrderById, type OrderLine } from '@/services/order-api';
import type { Product } from '@/types/product';

// Order lines only carry product id/name/price, so we rebuild a minimal Product.
// The image resolves from the product id endpoint (see getProductImageUri fallback).
function lineToProduct(line: OrderLine): Product {
  return {
    id: line.product_id[0],
    name: Array.isArray(line.product_id) ? line.product_id[1] : line.name,
    list_price: line.price_unit,
    categ_id: false,
  };
}

export function useReorder() {
  const router = useRouter();
  const { token } = useAuth();
  const { addToCart } = useCart();
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  const reorder = useCallback(
    async (orderId: number, preloadedLines?: OrderLine[]) => {
      if (!token || reorderingId !== null) {
        return;
      }

      setReorderingId(orderId);

      try {
        const lines = preloadedLines ?? (await fetchOrderById(token, orderId)).lines;

        lines
          .filter((line) => Array.isArray(line.product_id) && line.product_uom_qty > 0)
          .forEach((line) => addToCart(lineToProduct(line), line.product_uom_qty));

        router.push('/cart' as Href);
      } finally {
        setReorderingId(null);
      }
    },
    [token, reorderingId, addToCart, router],
  );

  return { reorder, reorderingId };
}
