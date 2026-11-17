import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import {
  isDeliveryCartProduct,
} from '@/services/delivery-fee-api';
import type { Product } from '@/types/product';

const CART_KEY = 'qr-app-cart';

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  /** Product lines only (Delivery is shown in the cart summary, not the list). */
  productItems: CartItem[];
  totalItems: number;
  totalAmount: number;
  deliveryFeeAmount: number;
  /** True while a delivery-fee quote request is in flight. */
  isDeliveryFeeLoading: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string | number) => void;
  updateQuantity: (productId: string | number, quantity: number) => void;
  clearCart: () => void;
  syncPricesFromProducts: (products: Product[]) => void;
  /** Refresh Delivery line from main address or a specific checkout branch. */
  syncDeliveryFee: (options?: {
    addressId?: string | null;
    zip?: string;
    /** When pickup, strip Delivery line (fee always free). */
    mode?: 'delivery' | 'pickup';
  }) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function withoutDelivery(items: CartItem[]) {
  return items.filter((item) => !isDeliveryCartProduct(item.product));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isDeliveryFeeLoading, setIsDeliveryFeeLoading] = useState(false);
  const wasLoggedIn = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then((stored) => {
        if (stored) {
          setItems(JSON.parse(stored) as CartItem[]);
        }
      })
      .finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (wasLoggedIn.current && !user) {
      setItems([]);
    }

    wasLoggedIn.current = !!user;
  }, [user, isReady]);

  const syncDeliveryFee = useCallback(
    async (
      options: {
        addressId?: string | null;
        zip?: string;
        mode?: 'delivery' | 'pickup';
      } = {},
    ) => {
      void options;
      setIsDeliveryFeeLoading(false);
      setItems((current) => withoutDelivery(current));
    },
    [],
  );

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      if (isDeliveryCartProduct(product)) {
        return;
      }

      let shouldSyncFee = false;

      setItems((current) => {
        const existing = current.find(
          (item) => String(item.product.id) === String(product.id),
        );
        const next = existing
          ? current.map((item) =>
              String(item.product.id) === String(product.id)
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            )
          : [...current, { product, quantity }];

        shouldSyncFee = withoutDelivery(next).length > 0;
        return next;
      });

      if (shouldSyncFee) {
        void syncDeliveryFee();
      }
    },
    [syncDeliveryFee],
  );

  const removeFromCart = useCallback((productId: string | number) => {
    setItems((current) => {
      const next = current.filter(
        (item) => String(item.product.id) !== String(productId),
      );
      const productsLeft = withoutDelivery(next);

      // If user removed the last real product, drop delivery too.
      if (!productsLeft.length) {
        return [];
      }

      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string | number, quantity: number) => {
    setItems((current) => {
      const target = current.find(
        (item) => String(item.product.id) === String(productId),
      );

      if (target && isDeliveryCartProduct(target.product)) {
        // Delivery qty is always 1; quantity <= 0 removes it (user dismissed preview).
        if (quantity <= 0) {
          return current.filter(
            (item) => String(item.product.id) !== String(productId),
          );
        }

        return current;
      }

      if (quantity <= 0) {
        const next = current.filter(
          (item) => String(item.product.id) !== String(productId),
        );
        return withoutDelivery(next).length ? next : [];
      }

      return current.map((item) =>
        String(item.product.id) === String(productId) ? { ...item, quantity } : item,
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const syncPricesFromProducts = useCallback((products: Product[]) => {
    if (!products.length) {
      return;
    }

    const priceById = new Map(products.map((product) => [product.id, product]));

    setItems((current) => {
      let changed = false;

      const next = current.map((item) => {
        if (isDeliveryCartProduct(item.product)) {
          return item;
        }

        const updated = priceById.get(item.product.id);

        if (!updated || updated.list_price === item.product.list_price) {
          return item;
        }

        changed = true;
        return {
          ...item,
          product: {
            ...item.product,
            list_price: updated.list_price,
          },
        };
      });

      return changed ? next : current;
    });
  }, []);

  const totalItems = useMemo(
    () =>
      items.reduce(
        (sum, item) => (isDeliveryCartProduct(item.product) ? sum : sum + item.quantity),
        0,
      ),
    [items],
  );

  const productItems = useMemo(() => withoutDelivery(items), [items]);

  const deliveryFeeAmount = useMemo(() => {
    const delivery = items.find((item) => isDeliveryCartProduct(item.product));
    if (!delivery) {
      return 0;
    }
    return Number(delivery.product.list_price) * Number(delivery.quantity || 1) || 0;
  }, [items]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.product.list_price * item.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      productItems,
      totalItems,
      totalAmount,
      deliveryFeeAmount,
      isDeliveryFeeLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      syncPricesFromProducts,
      syncDeliveryFee,
    }),
    [
      items,
      productItems,
      totalItems,
      totalAmount,
      deliveryFeeAmount,
      isDeliveryFeeLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      syncPricesFromProducts,
      syncDeliveryFee,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}
