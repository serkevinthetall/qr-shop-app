import { fetchMembership, fetchMembershipCoupons } from '@/services/membership-api';
import { fetchOrders, type Order } from '@/services/order-api';
import { fetchCategories, fetchProducts } from '@/services/product-api';
import type { Membership, MembershipCoupon } from '@/types/membership';
import type { Category, Product } from '@/types/product';

const INITIAL_PRODUCT_LIMIT = 50;

export type CatalogBootstrap = {
  products: Product[];
  categories: Category[];
};

export type AccountBootstrap = {
  membership: Membership | null;
  memberCode: string;
  coupons: MembershipCoupon[];
};

type SessionBootstrap = {
  catalog: CatalogBootstrap | null;
  account: AccountBootstrap | null;
  orders: Order[] | null;
};

let bootstrap: SessionBootstrap | null = null;
let inflight: Promise<SessionBootstrap> | null = null;

export function takeCatalogBootstrap(): CatalogBootstrap | null {
  if (!bootstrap?.catalog) {
    return null;
  }

  const catalog = bootstrap.catalog;
  bootstrap = { ...bootstrap, catalog: null };
  return catalog;
}

export function takeAccountBootstrap(): AccountBootstrap | null {
  if (!bootstrap?.account) {
    return null;
  }

  const account = bootstrap.account;
  bootstrap = { ...bootstrap, account: null };
  return account;
}

export function takeOrdersBootstrap(): Order[] | null {
  if (!bootstrap?.orders) {
    return null;
  }

  const orders = bootstrap.orders;
  bootstrap = { ...bootstrap, orders: null };
  return orders;
}

export function clearSessionBootstrap() {
  bootstrap = null;
  inflight = null;
}

/** @deprecated Prefer clearSessionBootstrap */
export function clearCatalogBootstrap() {
  clearSessionBootstrap();
}

export async function prefetchSessionBootstrap(token: string): Promise<SessionBootstrap> {
  if (bootstrap?.catalog || bootstrap?.account || bootstrap?.orders) {
    return bootstrap;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    const [products, categories, membershipResult, coupons, orders] = await Promise.all([
      fetchProducts(INITIAL_PRODUCT_LIMIT, 0, null),
      fetchCategories().catch(() => [] as Category[]),
      fetchMembership(token).catch(() => ({ membership: null as Membership | null, memberCode: '' })),
      fetchMembershipCoupons(token).catch(() => [] as MembershipCoupon[]),
      fetchOrders(token).catch(() => [] as Order[]),
    ]);

    bootstrap = {
      catalog: { products, categories },
      account: {
        membership: membershipResult.membership,
        memberCode: membershipResult.memberCode,
        coupons,
      },
      orders,
    };

    return bootstrap;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** @deprecated Prefer prefetchSessionBootstrap */
export async function prefetchCatalog(token?: string) {
  if (token) {
    const session = await prefetchSessionBootstrap(token);
    return session.catalog ?? { products: [], categories: [] };
  }

  const [products, categories] = await Promise.all([
    fetchProducts(INITIAL_PRODUCT_LIMIT, 0, null),
    fetchCategories().catch(() => [] as Category[]),
  ]);

  const catalog = { products, categories };
  bootstrap = {
    catalog,
    account: null,
    orders: null,
  };
  return catalog;
}
