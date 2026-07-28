import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { IconButton, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard, ProductListItem } from '@/components/products/product-card';
import { ProductCardSkeleton, ProductListItemSkeleton } from '@/components/products/product-card-skeleton';
import { SkeletonBox } from '@/components/skeleton';
import { CategoryList } from '@/components/products/category-list';
import { TabAppToast } from '@/components/app-toast';
import { searchbarInputStyle } from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { takeCatalogBootstrap } from '@/services/catalog-bootstrap';
import { onCatalogRefreshRequested } from '@/services/catalog-events';
import { fetchPartnerTags } from '@/services/customer-api';
import { rememberProductPreview } from '@/services/product-preview-cache';
import { fetchCategories, fetchProducts, searchProducts } from '@/services/product-api';
import {
  JUST_FOR_YOU,
  productMatchesPartnerTags,
  type Category,
  type CategorySelection,
  type Product,
} from '@/types/product';
import { mergeProductsIfChanged } from '@/utils/product-sync';

type ViewMode = 'grid' | 'list';
const VIEW_MODE_KEY = 'qr-app-products-view-mode';
const INITIAL_PRODUCT_LIMIT = 50;
const SKELETON_LIST_COUNT = 6;
// Gentle background sync while the products tab is open — updates ribbons/new items
// without hammering the API or re-rendering when nothing changed.
const CATALOG_POLL_INTERVAL_MS = 45000;

function readBootstrapSeed() {
  const seed = takeCatalogBootstrap();
  return {
    products: seed?.products ?? [],
    categories: seed?.categories ?? [],
  };
}

export default function ProductsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs, horizontalPadding, gridColumns, gridGap, width } = useResponsive();
  const { token } = useAuth();
  const { addToCart } = useCart();
  const { t, lh } = useLanguage();
  const [bootstrapSeed] = useState(readBootstrapSeed);
  const [products, setProducts] = useState<Product[]>(bootstrapSeed.products);
  const [allProducts, setAllProducts] = useState<Product[]>(bootstrapSeed.products);
  const [categories, setCategories] = useState<Category[]>(bootstrapSeed.categories);
  const [partnerTags, setPartnerTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>(null);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(bootstrapSeed.categories.length === 0);
  const [isLoading, setIsLoading] = useState(bootstrapSeed.products.length === 0);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const searchQueryRef = useRef(searchQuery);
  const selectedCategoryRef = useRef(selectedCategoryId);
  const allProductsRef = useRef(allProducts);
  const partnerTagsRef = useRef(partnerTags);
  const tokenRef = useRef(token);
  const initialLoadDoneRef = useRef(false);
  const skipNextCategorySyncRef = useRef(true);
  const showJustForYou = partnerTags.length > 0;

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    selectedCategoryRef.current = selectedCategoryId;
  }, [selectedCategoryId]);

  useEffect(() => {
    allProductsRef.current = allProducts;
  }, [allProducts]);

  useEffect(() => {
    partnerTagsRef.current = partnerTags;
  }, [partnerTags]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setPartnerTags([]);
      setSelectedCategoryId((current) => (current === JUST_FOR_YOU ? null : current));
      return;
    }

    fetchPartnerTags(token)
      .then((tags) => {
        if (cancelled) {
          return;
        }

        setPartnerTags(tags);

        if (!tags.length) {
          setSelectedCategoryId((current) => (current === JUST_FOR_YOU ? null : current));
          return;
        }

        // Default to Just for you when tags are available (app open / login).
        setSelectedCategoryId(JUST_FOR_YOU);
        selectedCategoryRef.current = JUST_FOR_YOU;
        // Ensure the category sync effect runs for this default selection.
        skipNextCategorySyncRef.current = false;
      })
      .catch(() => {
        if (!cancelled) {
          setPartnerTags([]);
          setSelectedCategoryId((current) => (current === JUST_FOR_YOU ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filterProductsLocally = useCallback(
    (source: Product[], selection: CategorySelection, query: string, tags: string[] = partnerTagsRef.current) => {
      const normalizedQuery = query.trim().toLowerCase();

      return source.filter((product) => {
        if (selection === JUST_FOR_YOU) {
          if (!productMatchesPartnerTags(product, tags)) {
            return false;
          }
        } else if (typeof selection === 'number') {
          const ids = product.public_categ_ids ?? [];
          if (!ids.includes(selection)) {
            return false;
          }
        }

        if (normalizedQuery && !product.name.toLowerCase().includes(normalizedQuery)) {
          return false;
        }

        return true;
      });
    },
    [],
  );

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((stored) => {
      if (stored === 'grid' || stored === 'list') {
        setViewMode(stored);
      }
    });
  }, []);

  const changeViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    AsyncStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  const numColumns = viewMode === 'list' ? 1 : gridColumns;

  const cardWidth = useMemo(() => {
    const totalHorizontalPadding = horizontalPadding * 2;
    const totalGaps = gridGap * (gridColumns - 1);
    return (width - totalHorizontalPadding - totalGaps) / gridColumns;
  }, [width, horizontalPadding, gridColumns, gridGap]);

  const skeletonCount = viewMode === 'list' ? SKELETON_LIST_COUNT : gridColumns * 3;

  const skeletonItems = useMemo(
    () => Array.from({ length: skeletonCount }, (_, index) => index),
    [skeletonCount],
  );

  const syncCatalog = useCallback(async (options?: { silent?: boolean; preferLocal?: boolean }) => {
    const selection = selectedCategoryRef.current;
    const query = searchQueryRef.current.trim();
    const authToken = tokenRef.current;

    if (!options?.silent) {
      setError('');
    }

    // Instant UI: filter already-loaded products while the network request runs.
    if (options?.preferLocal && allProductsRef.current.length > 0 && !query) {
      setProducts(filterProductsLocally(allProductsRef.current, selection, query));
      setIsSearching(false);
    }

    const productsPromise = query
      ? searchProducts(query, selection, authToken)
      : fetchProducts(INITIAL_PRODUCT_LIMIT, 0, selection, authToken);

    const productsData = await productsPromise;

    if (!query && selection == null) {
      setAllProducts(productsData);
      allProductsRef.current = productsData;
    } else if (!query && selection != null) {
      // Merge filtered page into the local cache so later switches stay instant.
      setAllProducts((previous) => {
        const byId = new Map(previous.map((product) => [product.id, product]));
        for (const product of productsData) {
          byId.set(product.id, product);
        }
        const merged = [...byId.values()];
        allProductsRef.current = merged;
        return merged;
      });
    }

    setProducts((previous) => mergeProductsIfChanged(previous, productsData));
  }, [filterProductsLocally]);

  // Keep categories warm and complete independently so the search dropdown
  // does not wait on product fetches / appear half-empty.
  const syncCategories = useCallback(async () => {
    setIsCategoriesLoading(true);
    try {
      const next = await fetchCategories();
      setCategories(next);
    } finally {
      setIsCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    syncCatalog()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load products.');
      })
      .finally(() => {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      });
  }, [syncCatalog]);

  useEffect(() => {
    syncCategories().catch(() => {});
  }, [syncCategories]);

  // Debounce text search only — category changes apply immediately.
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const query = searchQuery.trim();
    if (query) {
      setIsSearching(true);
    }

    const timeoutId = setTimeout(
      () => {
        syncCatalog({ silent: true })
          .catch(() => {
            // Keep the current list if a background sync fails.
          })
          .finally(() => setIsSearching(false));
      },
      query ? 300 : 0,
    );

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isLoading, syncCatalog]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (skipNextCategorySyncRef.current) {
      skipNextCategorySyncRef.current = false;
      return;
    }

    const query = searchQueryRef.current.trim();
    const hasLocalCache = allProductsRef.current.some((product) =>
      Array.isArray(product.public_categ_ids),
    );
    const canFilterJustForYouLocally =
      selectedCategoryId !== JUST_FOR_YOU ||
      allProductsRef.current.some((product) => Array.isArray(product.tags));

    // Category-only changes: filter instantly from cache, refresh in background.
    if (!query && hasLocalCache && canFilterJustForYouLocally) {
      setProducts(
        filterProductsLocally(allProductsRef.current, selectedCategoryId, query),
      );
      setIsSearching(false);
      syncCatalog({ silent: true, preferLocal: true }).catch(() => {});
      return;
    }

    setIsSearching(true);
    syncCatalog({ silent: true })
      .catch(() => {})
      .finally(() => setIsSearching(false));
  }, [selectedCategoryId, isLoading, syncCatalog, filterProductsLocally]);

  useEffect(() => {
    return onCatalogRefreshRequested(() => {
      syncCatalog({ silent: true }).catch(() => {});
    });
  }, [syncCatalog]);

  useFocusEffect(
    useCallback(() => {
      if (initialLoadDoneRef.current) {
        syncCatalog({ silent: true }).catch(() => {});
      }

      const intervalId = setInterval(() => {
        syncCatalog({ silent: true }).catch(() => {});
      }, CATALOG_POLL_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [syncCatalog]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncCatalog({ silent: true }).catch(() => {});
      }
    });

    return () => subscription.remove();
  }, [syncCatalog]);

  const handleCategorySelect = useCallback((categoryId: CategorySelection) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSearchQuery('');
    searchQueryRef.current = '';
    setError('');

    try {
      let nextSelection: CategorySelection = null;

      if (tokenRef.current) {
        try {
          const tags = await fetchPartnerTags(tokenRef.current);
          setPartnerTags(tags);
          nextSelection = tags.length ? JUST_FOR_YOU : null;
        } catch {
          nextSelection = partnerTagsRef.current.length ? JUST_FOR_YOU : null;
        }
      }

      setSelectedCategoryId(nextSelection);
      selectedCategoryRef.current = nextSelection;
      skipNextCategorySyncRef.current = true;

      await syncCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh products.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              paddingHorizontal: horizontalPadding,
            },
          ]}>
          <View style={styles.searchRow}>
            <SkeletonBox style={styles.searchSkeleton} borderRadius={28} />
            <SkeletonBox style={styles.viewToggleSkeleton} borderRadius={12} />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={[styles.categorySkeletonRow, { paddingHorizontal: horizontalPadding }]}>
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBox key={index} style={styles.categorySkeletonChip} borderRadius={20} />
          ))}
        </ScrollView>

        <FlatList
          data={skeletonItems}
          key={`skeleton-${viewMode}-${numColumns}`}
          keyExtractor={(item) => `skeleton-${item}`}
          numColumns={numColumns}
          scrollEnabled={false}
          style={styles.productsList}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: horizontalPadding - 4, paddingTop: rs(12) },
          ]}
          columnWrapperStyle={numColumns > 1 ? { gap: gridGap, alignItems: 'stretch' } : undefined}
          renderItem={() =>
            viewMode === 'list' ? (
              <ProductListItemSkeleton />
            ) : (
              <View style={{ width: cardWidth, flex: 1 }}>
                <ProductCardSkeleton width={cardWidth} />
              </View>
            )
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingHorizontal: horizontalPadding }]}>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder={t('products.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchbar, { backgroundColor: colors.inputBg, flex: 1 }]}
            inputStyle={searchbarInputStyle}
            iconColor={colors.textMuted}
            placeholderTextColor={colors.textMuted}
          />
          <View style={[styles.viewToggle, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <IconButton
              icon="view-grid-outline"
              size={20}
              onPress={() => changeViewMode('grid')}
              iconColor={viewMode === 'grid' ? colors.primary : colors.textMuted}
              style={styles.viewToggleButton}
              accessibilityLabel="Grid view"
            />
            <IconButton
              icon="format-list-bulleted"
              size={20}
              onPress={() => changeViewMode('list')}
              iconColor={viewMode === 'list' ? colors.primary : colors.textMuted}
              style={styles.viewToggleButton}
              accessibilityLabel="List view"
            />
          </View>
        </View>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: horizontalPadding }}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      <CategoryList
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        isLoading={isCategoriesLoading}
        horizontalPadding={horizontalPadding}
        showJustForYou={showJustForYou}
        onSelect={handleCategorySelect}
      />

      <View style={styles.listArea}>
        <FlatList
          data={products}
          key={`${viewMode}-${numColumns}`}
          keyExtractor={(item) => String(item.id)}
          numColumns={numColumns}
          style={styles.productsList}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding - 4, paddingTop: rs(12) }]}
          columnWrapperStyle={numColumns > 1 ? { gap: gridGap, alignItems: 'stretch' } : undefined}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            isSearching ? null : (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textMuted, lineHeight: lh(16) }]}>{t('products.empty')}</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const handleAdd = (product: Product) => {
              addToCart(product, 1);
              setSnackbar(t('products.addedToCart', { name: product.name }));
            };

            const openDetail = () => {
              rememberProductPreview(item);
              router.push(`/product/${item.id}` as Href);
            };

            return viewMode === 'list' ? (
              <Pressable onPress={openDetail}>
                <ProductListItem product={item} onAddToCart={handleAdd} />
              </Pressable>
            ) : (
              <Pressable onPress={openDetail} style={{ width: cardWidth, flex: 1, alignSelf: 'stretch' }}>
                <ProductCard product={item} width={cardWidth} onAddToCart={handleAdd} />
              </Pressable>
            );
          }}
        />

        {isSearching ? (
          <View style={styles.centerLoading} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}
      </View>

      <TabAppToast
        message={snackbar}
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingTop: 8,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchSkeleton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
  },
  viewToggleSkeleton: {
    width: 88,
    height: 48,
  },
  categorySkeletonRow: {
    gap: 8,
    paddingVertical: 10,
  },
  categorySkeletonChip: {
    height: 36,
    width: 88,
  },
  searchbar: {
    elevation: 0,
  },
  productsList: {
    flex: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  viewToggleButton: {
    margin: 0,
  },
  listArea: {
    flex: 1,
    position: 'relative',
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  centerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 14,
  },
});
