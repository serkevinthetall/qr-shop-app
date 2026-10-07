import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { getUserFacingError } from '@/services/auth-error';
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
  const { t } = useLanguage();
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
      } catch (err) {
        const message = getUserFacingError(err, t('errors.reorderFailed'));
        if (message) {
          Alert.alert(t('orders.reorder'), message);
        }
      } finally {
        setReorderingId(null);
      }
    },
    [token, reorderingId, addToCart, router, t],
  );

  return { reorder, reorderingId };
}
