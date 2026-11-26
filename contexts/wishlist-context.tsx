import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Product } from '@/types/product';

const STORAGE_KEY = 'qr-app-wishlist';

type WishlistContextValue = {
  items: Product[];
  ids: string[];
  count: number;
  hasItems: boolean;
  isSaved: (productId: string) => boolean;
  toggle: (product: Product) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function normalizeItems(raw: unknown): Product[] {
  if (!Array.isArray(raw)) return [];
  const out: Product[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const id = String((row as Product).id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row as Product);
  }
  return out;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        setItems(normalizeItems(JSON.parse(raw)));
      } catch {
        /* ignore bad cache */
      }
    });
  }, []);

  const persist = useCallback((next: Product[]) => {
    setItems(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const isSaved = useCallback(
    (productId: string) => items.some((p) => String(p.id) === String(productId)),
    [items],
  );

  const toggle = useCallback(
    (product: Product) => {
      const id = String(product?.id || '').trim();
      if (!id) return;
      if (items.some((p) => String(p.id) === id)) {
        persist(items.filter((p) => String(p.id) !== id));
      } else {
        persist([product, ...items]);
      }
    },
    [items, persist],
  );

  const remove = useCallback(
    (productId: string) => {
      const id = String(productId || '').trim();
      if (!id) return;
      persist(items.filter((p) => String(p.id) !== id));
    },
    [items, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo(
    () => ({
      items,
      ids: items.map((p) => String(p.id)),
      count: items.length,
      hasItems: items.length > 0,
      isSaved,
      toggle,
      remove,
      clear,
    }),
    [items, isSaved, toggle, remove, clear],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
