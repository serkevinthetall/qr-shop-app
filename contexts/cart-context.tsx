import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import {
  deliveryFeeToProduct,
  fetchDeliveryFeeQuote,
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
  totalItems: number;
  totalAmount: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  syncPricesFromProducts: (products: Product[]) => void;
  /** Refresh Delivery line from main address or a specific checkout branch. */
  syncDeliveryFee: (options?: { addressId?: number | null; zip?: string }) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function withoutDelivery(items: CartItem[]) {
  return items.filter((item) => !isDeliveryCartProduct(item.product));
}

function withDeliveryFee(items: CartItem[], feeProduct: Product | null) {
  const base = withoutDelivery(items);

  if (!feeProduct || !base.length) {
    return base;
  }

  return [...base, { product: feeProduct, quantity: 1 }];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const wasLoggedIn = useRef(false);
  const syncSeq = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

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
    async (options: { addressId?: number | null; zip?: string } = {}) => {
      const seq = ++syncSeq.current;

      if (!token) {
        setItems((current) => withoutDelivery(current));
        return;
      }

      if (!withoutDelivery(itemsRef.current).length) {
        setItems((current) => withoutDelivery(current));
        return;
      }

      try {
        const quote = await fetchDeliveryFeeQuote(token, {
          addressId: options.addressId,
          zip: options.zip,
        });

        if (seq !== syncSeq.current) {
          return;
        }

        if (quote.waived || !quote.fee?.template_id) {
          setItems((current) => withoutDelivery(current));
          return;
        }

        const feeProduct = deliveryFeeToProduct(quote.fee);
        setItems((current) => withDeliveryFee(current, feeProduct));
      } catch {
        // Keep existing cart products; checkout backend still applies the final fee.
        if (seq === syncSeq.current) {
          // Do not strip an existing fee on a transient network error.
        }
      }
    },
    [token],
  );

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      if (isDeliveryCartProduct(product)) {
        return;
      }

      let shouldSyncFee = false;

      setItems((current) => {
        const existing = current.find((item) => item.product.id === product.id);
        const next = existing
          ? current.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            )
          : [...current, { product, quantity }];

        // Keep ref in sync so fee lookup does not see an empty cart.
        itemsRef.current = next;
        shouldSyncFee = withoutDelivery(next).length > 0;
        return next;
      });

      if (shouldSyncFee) {
        void syncDeliveryFee();
      }
    },
    [syncDeliveryFee],
  );

  const removeFromCart = useCallback((productId: number) => {
    setItems((current) => {
      const next = current.filter((item) => item.product.id !== productId);
      const productsLeft = withoutDelivery(next);

      // If user removed the last real product, drop delivery too.
      if (!productsLeft.length) {
        return [];
      }

      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    setItems((current) => {
      const target = current.find((item) => item.product.id === productId);

      if (target && isDeliveryCartProduct(target.product)) {
        // Delivery qty is always 1; quantity <= 0 removes it (user dismissed preview).
        if (quantity <= 0) {
          return current.filter((item) => item.product.id !== productId);
        }

        return current;
      }

      if (quantity <= 0) {
        const next = current.filter((item) => item.product.id !== productId);
        return withoutDelivery(next).length ? next : [];
      }

      return current.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
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

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.product.list_price * item.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      totalItems,
      totalAmount,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      syncPricesFromProducts,
      syncDeliveryFee,
    }),
    [
      items,
      totalItems,
      totalAmount,
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
