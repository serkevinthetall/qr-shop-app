import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Searchbar } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard, ProductListItem } from '@/components/products/product-card';
import { ProductCardSkeleton, ProductListItemSkeleton } from '@/components/products/product-card-skeleton';
import { SkeletonBox } from '@/components/skeleton';
import { CategoryList } from '@/components/products/category-list';
import { TabAppToast } from '@/components/app-toast';
import { InlineErrorBanner } from '@/components/inline-error-banner';
import { LanguageToggleChip } from '@/components/language-toggle-chip';
import { ScrollToTopButton } from '@/components/scroll-to-top-button';
import { ViewModeToggleButton } from '@/components/view-mode-toggle-button';
import { inputCaretProps, searchbarInputStyleFor } from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import {
  useLiquidTabBarScrollProps,
  useRevealLiquidTabBar,
} from '@/contexts/liquid-tab-bar-visibility';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { isLiquidUiEnabled, liquidGlassFill } from '@/utils/liquid-ui';
import { takeCatalogBootstrap } from '@/services/catalog-bootstrap';
import { getUserFacingError } from '@/services/auth-error';
import { onCatalogRefreshRequested } from '@/services/catalog-events';
import { fetchPartnerTags } from '@/services/customer-api';
import { rememberProductPreview } from '@/services/product-preview-cache';
import { fetchCategories, fetchProductPrices, fetchProducts, searchProducts } from '@/services/product-api';
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
const INITIAL_PRODUCT_LIMIT = 75;
const SKELETON_LIST_COUNT = 6;
// Full catalog refresh only on open/pull/focus. Background price checks are cheap.
const PRICE_POLL_INTERVAL_MS = 30000;

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
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { rs, horizontalPadding, gridColumns, gridGap, width } = useResponsive();
  const { token } = useAuth();
  const { syncPricesFromProducts } = useCart();
  const { t, lh, language } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const tabBarScrollProps = useLiquidTabBarScrollProps();
  const revealTabBar = useRevealLiquidTabBar();
  const listRef = useRef<FlatList<Product>>(null);
  const scrollOffsetRef = useRef(0);
  const scrollTopRafRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollToTopEligible, setScrollToTopEligible] = useState(false);
  const [isListScrolling, setIsListScrolling] = useState(false);
  // Visible gray outline (inputBg ≈ screen bg, so theme.border is too faint).
  const searchOutline = isDark ? '#5C6868' : '#B0B5BD';
  // Myanmar glyphs need more vertical room than Latin in the search pill.
  const isMyanmar = language === 'my';
  const searchBarHeight = isMyanmar ? 54 : 48;
  const headerControlStyle = {
    backgroundColor: liquid ? liquidGlassFill(isDark) : colors.inputBg,
    borderColor: searchOutline,
    borderWidth: 1,
  };
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
  /** Height of chip row so products can scroll underneath it. */
  const [chipBarHeight, setChipBarHeight] = useState(52);
  /** List viewport height — Android pull spinner is offset to the middle. */
  const [listAreaHeight, setListAreaHeight] = useState(0);

  const searchQueryRef = useRef(searchQuery);
  const selectedCategoryRef = useRef(selectedCategoryId);
  const allProductsRef = useRef(allProducts);
  const partnerTagsRef = useRef(partnerTags);
  const tokenRef = useRef(token);
  const catalogRequestIdRef = useRef(0);
  const initialLoadDoneRef = useRef(false);
  const skipNextCategorySyncRef = useRef(true);
  const priceVersionRef = useRef('');
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

  const applyCategorySelection = useCallback(
    (selection: CategorySelection, options?: { skipSyncSkipFlag?: boolean }) => {
      // Invalidate any in-flight catalog fetch so a stale All/Just-for-you
      // response cannot overwrite the chip the user just picked.
      catalogRequestIdRef.current += 1;
      selectedCategoryRef.current = selection;
      setSelectedCategoryId(selection);
      setProducts(
        filterProductsLocally(allProductsRef.current, selection, searchQueryRef.current),
      );

      if (options?.skipSyncSkipFlag) {
        skipNextCategorySyncRef.current = false;
      }
    },
    [filterProductsLocally],
  );

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
        partnerTagsRef.current = tags;

        // Keep the user's current chip. Only leave Just for you if tags disappear.
        if (!tags.length && selectedCategoryRef.current === JUST_FOR_YOU) {
          applyCategorySelection(null, { skipSyncSkipFlag: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPartnerTags([]);
          if (selectedCategoryRef.current === JUST_FOR_YOU) {
            applyCategorySelection(null, { skipSyncSkipFlag: true });
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, applyCategorySelection]);

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

  const toggleViewMode = useCallback(() => {
    changeViewMode(viewMode === 'grid' ? 'list' : 'grid');
  }, [changeViewMode, viewMode]);

  const handleScrollToTop = useCallback(() => {
    if (scrollTopRafRef.current != null) {
      cancelAnimationFrame(scrollTopRafRef.current);
      scrollTopRafRef.current = null;
    }
    if (scrollIdleTimerRef.current) {
      clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = null;
    }
    setIsListScrolling(true);

    const startY = Math.max(0, scrollOffsetRef.current);
    if (startY <= 2) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setScrollToTopEligible(false);
      setIsListScrolling(false);
      revealTabBar();
      return;
    }

    // Luxury glide — longer, soft ease-out (not snappy).
    const durationMs = 980;
    const startTime = Date.now();

    const step = () => {
      const t = Math.min(1, (Date.now() - startTime) / durationMs);
      // easeOutQuint — fast start, long silky settle
      const eased = 1 - Math.pow(1 - t, 5);
      const nextY = startY * (1 - eased);
      listRef.current?.scrollToOffset({ offset: nextY, animated: false });
      scrollOffsetRef.current = nextY;

      if (t < 1) {
        scrollTopRafRef.current = requestAnimationFrame(step);
        return;
      }

      scrollTopRafRef.current = null;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      scrollOffsetRef.current = 0;
      setScrollToTopEligible(false);
      setIsListScrolling(false);
      revealTabBar();
    };

    scrollTopRafRef.current = requestAnimationFrame(step);
  }, [revealTabBar]);

  const numColumns = viewMode === 'list' ? 1 : gridColumns;

  const cardWidth = useMemo(() => {
    const totalHorizontalPadding = horizontalPadding * 2;
    const totalGaps = gridGap * (gridColumns - 1);
    return (width - totalHorizontalPadding - totalGaps) / gridColumns;
  }, [width, horizontalPadding, gridColumns, gridGap]);

  /** Show ↑ after ~6 product rows (not only at the bottom). */
  const scrollToTopAfterY = useMemo(() => {
    const listRowHeight = 110;
    const gridRowHeight = cardWidth + 72;
    const rowHeight = viewMode === 'list' ? listRowHeight : gridRowHeight;
    return Math.round(rowHeight * 6);
  }, [cardWidth, viewMode]);

  const handleProductsScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      scrollOffsetRef.current = contentOffset.y;
      const scrollable = contentSize.height > layoutMeasurement.height + 80;
      const pastRows = scrollable && contentOffset.y >= scrollToTopAfterY;
      setScrollToTopEligible((prev) => (prev === pastRows ? prev : pastRows));

      // Hide ↑ while scrolling; show again shortly after the finger/list settles.
      setIsListScrolling(true);
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
      }
      scrollIdleTimerRef.current = setTimeout(() => {
        setIsListScrolling(false);
        scrollIdleTimerRef.current = null;
      }, 160);
    },
    [scrollToTopAfterY],
  );

  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, []);

  const skeletonCount = viewMode === 'list' ? SKELETON_LIST_COUNT : gridColumns * 3;

  const skeletonItems = useMemo(
    () => Array.from({ length: skeletonCount }, (_, index) => index),
    [skeletonCount],
  );

  const syncCatalog = useCallback(async (options?: { silent?: boolean; preferLocal?: boolean }) => {
    const selection = selectedCategoryRef.current;
    const query = searchQueryRef.current.trim();
    const authToken = tokenRef.current;
    const requestId = ++catalogRequestIdRef.current;

    if (!options?.silent) {
      setError('');
    }

    // Instant UI: filter already-loaded products while the network request runs.
    if (options?.preferLocal && allProductsRef.current.length > 0 && !query) {
      setProducts(filterProductsLocally(allProductsRef.current, selection, query));
      setIsSearching(false);
    }

    if (query) {
      const productsData = await searchProducts(query, selection, authToken);

      if (requestId !== catalogRequestIdRef.current) {
        return;
      }

      if (selectedCategoryRef.current !== selection || searchQueryRef.current.trim() !== query) {
        return;
      }

      setProducts((previous) => mergeProductsIfChanged(previous, productsData));
      return;
    }

    // Always refresh the full All catalog with the auth token so membership
    // pricelist prices update without requiring logout. Also fetch the active
    // chip (if any) so Just for you / category pages stay complete.
    const allPromise = fetchProducts(INITIAL_PRODUCT_LIMIT, 0, null, authToken);
    const selectedPromise =
      selection == null ? allPromise : fetchProducts(INITIAL_PRODUCT_LIMIT, 0, selection, authToken);

    const [allData, selectedData] = await Promise.all([allPromise, selectedPromise]);

    if (requestId !== catalogRequestIdRef.current) {
      return;
    }

    if (searchQueryRef.current.trim()) {
      return;
    }

    setAllProducts(allData);
    allProductsRef.current = allData;
    syncPricesFromProducts(allData);

    for (const product of allData) {
      rememberProductPreview(product);
    }

    const visible =
      selectedCategoryRef.current == null
        ? allData
        : selectedCategoryRef.current === selection
          ? selectedData
          : filterProductsLocally(allData, selectedCategoryRef.current, '');

    setProducts((previous) => mergeProductsIfChanged(previous, visible));
  }, [filterProductsLocally, syncPricesFromProducts]);

  const applyPriceUpdates = useCallback(
    (prices: Array<{ id: number; list_price: number }>) => {
      if (!prices.length) {
        return;
      }

      const priceById = new Map(prices.map((row) => [row.id, row.list_price]));
      let changed = false;

      const nextAll = allProductsRef.current.map((product) => {
        if (!priceById.has(product.id)) {
          return product;
        }

        const nextPrice = priceById.get(product.id)!;
        if (nextPrice === product.list_price) {
          return product;
        }

        changed = true;
        const updated = { ...product, list_price: nextPrice };
        rememberProductPreview(updated);
        return updated;
      });

      if (!changed) {
        return;
      }

      allProductsRef.current = nextAll;
      setAllProducts(nextAll);
      syncPricesFromProducts(nextAll);
      setProducts(
        filterProductsLocally(
          nextAll,
          selectedCategoryRef.current,
          searchQueryRef.current,
        ),
      );
    },
    [filterProductsLocally, syncPricesFromProducts],
  );

  const syncPrices = useCallback(async () => {
    const snapshot = await fetchProductPrices(
      tokenRef.current,
      priceVersionRef.current || null,
    );

    priceVersionRef.current = snapshot.version;

    if (snapshot.unchanged) {
      return;
    }

    applyPriceUpdates(snapshot.prices);
  }, [applyPriceUpdates]);

  // Keep categories warm and complete independently so the search dropdown
  // does not wait on product fetches / appear half-empty.
  const syncCategories = useCallback(async () => {
    setIsCategoriesLoading(true);
    try {
      const next = await fetchCategories();
      setCategories(next);
    } catch (err) {
      const message = getUserFacingError(err, t('errors.loadCategories'), t);
      if (message) setError(message);
    } finally {
      setIsCategoriesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    syncCatalog()
      .catch((err) => {
        const message = getUserFacingError(err, t('errors.loadProducts'), t);
        if (message) setError(message);
      })
      .finally(() => {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      });
  }, [syncCatalog, t]);

  // Re-fetch with the auth token after login/logout so membership prices apply.
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      return;
    }

    syncCatalog({ silent: true }).catch(() => {});
  }, [token, syncCatalog]);

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
          .catch((err) => {
            const message = getUserFacingError(err, t('errors.searchProducts'), t);
            if (message) setError(message);
          })
          .finally(() => setIsSearching(false));
      },
      query ? 300 : 0,
    );

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isLoading, syncCatalog, t]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (skipNextCategorySyncRef.current) {
      skipNextCategorySyncRef.current = false;
      return;
    }

    const query = searchQueryRef.current.trim();

    // Always show the locally filtered list for the selected chip immediately.
    // Never keep the previous chip's products while waiting for the API.
    if (!query && allProductsRef.current.length > 0) {
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
        syncPrices().catch(() => {});
      }

      const intervalId = setInterval(() => {
        syncPrices().catch(() => {});
      }, PRICE_POLL_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [syncPrices]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncPrices().catch(() => {});
      }
    });

    return () => subscription.remove();
  }, [syncPrices]);

  const handleCategorySelect = useCallback(
    (categoryId: CategorySelection) => {
      applyCategorySelection(categoryId);
    },
    [applyCategorySelection],
  );

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setSearchQuery('');
    searchQueryRef.current = '';
    setError('');

    try {
      // Keep the current chip; only refresh partner tags in the background.
      if (tokenRef.current) {
        try {
          const tags = await fetchPartnerTags(tokenRef.current);
          setPartnerTags(tags);
          partnerTagsRef.current = tags;

          if (!tags.length && selectedCategoryRef.current === JUST_FOR_YOU) {
            applyCategorySelection(null, { skipSyncSkipFlag: true });
          }
        } catch {
          // Keep existing tags/selection if refresh fails.
        }
      }

      skipNextCategorySyncRef.current = true;
      await syncCatalog();
    } catch (err) {
      const message = getUserFacingError(err, t('errors.refreshProducts'), t);
      if (message) setError(message);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <View
          style={[
            styles.searchSection,
            {
              backgroundColor: 'transparent',
              paddingHorizontal: horizontalPadding,
              paddingTop: 8,
            },
          ]}>
          <View style={styles.searchRow}>
            <SkeletonBox style={styles.searchSkeleton} borderRadius={28} />
            <SkeletonBox style={styles.headerChipIconSkeleton} borderRadius={12} />
            <SkeletonBox style={styles.headerChipSkeleton} borderRadius={12} />
          </View>
        </View>

        <View style={[styles.chipSection, { backgroundColor: 'transparent' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={[styles.categorySkeletonRow, { paddingHorizontal: horizontalPadding }]}>
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonBox key={index} style={styles.categorySkeletonChip} borderRadius={20} />
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={skeletonItems}
          key={`skeleton-${viewMode}-${numColumns}`}
          keyExtractor={(item) => `skeleton-${item}`}
          numColumns={numColumns}
          scrollEnabled={false}
          style={styles.productsList}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: horizontalPadding - 4, paddingTop: rs(8) },
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
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={liquid ? [] : ['top']}>
      {/* 1 — Search stays fixed above; products never go under it */}
      <View
        style={[
          styles.searchSection,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: (liquid ? insets.top : 0) + 8,
            backgroundColor: colors.background,
          },
        ]}>
        <View style={[styles.searchRow, { minHeight: searchBarHeight }]}>
          <View
            style={[
              styles.searchbarShell,
              {
                height: searchBarHeight,
                borderRadius: searchBarHeight / 2,
                backgroundColor: liquid ? liquidGlassFill(isDark) : colors.inputBg,
                borderColor: searchOutline,
                borderWidth: 1,
              },
            ]}>
            <Searchbar
              placeholder={t('products.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              elevation={0}
              mode="bar"
              style={[
                styles.searchbar,
                {
                  height: searchBarHeight,
                  borderRadius: searchBarHeight / 2,
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'visible',
                },
              ]}
              inputStyle={searchbarInputStyleFor(language)}
              iconColor={colors.textMuted}
              placeholderTextColor={colors.textMuted}
              {...inputCaretProps(isDark)}
            />
          </View>
          <ViewModeToggleButton
            viewMode={viewMode}
            onPress={toggleViewMode}
            accessibilityLabel={viewMode === 'grid' ? t('products.viewList') : t('products.viewGrid')}
            style={headerControlStyle}
          />
          <LanguageToggleChip style={headerControlStyle} />
        </View>
        {error ? (
          <InlineErrorBanner
            message={error}
            onRetry={() => {
              void handleRefresh();
            }}
            onDismiss={() => setError('')}
            retrying={isRefreshing}
          />
        ) : null}
      </View>

      {/* Products fill the rest; chip bar floats on top so cards scroll under chips only */}
      <View
        style={styles.listArea}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (next > 0 && next !== listAreaHeight) {
            setListAreaHeight(next);
          }
        }}>
        <FlatList
          ref={listRef}
          data={products}
          key={`${viewMode}-${numColumns}`}
          keyExtractor={(item) => String(item.id)}
          numColumns={numColumns}
          style={styles.productsList}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: horizontalPadding - 4,
              paddingTop: chipBarHeight + rs(8),
            },
          ]}
          columnWrapperStyle={numColumns > 1 ? { gap: gridGap, alignItems: 'stretch' } : undefined}
          removeClippedSubviews={liquid ? false : undefined}
          onScroll={handleProductsScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              {...(Platform.OS === 'android'
                ? {
                    // Android cannot hide SwipeRefreshLayout — place it in the
                    // middle of the list instead of stacking a second spinner.
                    colors: [colors.primary],
                    progressBackgroundColor: colors.card,
                    progressViewOffset: Math.max(
                      0,
                      Math.round(listAreaHeight / 2) - 24,
                    ),
                  }
                : {
                    // iOS: hide native top spinner; use centered overlay below.
                    tintColor: 'transparent',
                  })}
            />
          }
          {...tabBarScrollProps}
          ListEmptyComponent={
            isSearching ? null : (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textMuted, lineHeight: lh(16) }]}>
                  {error ? t('products.emptyError') : t('products.empty')}
                </Text>
                {error ? (
                  <Pressable
                    onPress={() => {
                      void handleRefresh();
                    }}
                    style={[styles.emptyRetry, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 14 }}>
                      {t('network.retry')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
          renderItem={({ item }) => {
            const handleCartFeedback = (product: Product) => {
              setSnackbar(t('products.addedToCart', { name: product.name }));
            };

            const openDetail = () => {
              rememberProductPreview(item);
              router.push(`/product/${item.id}` as Href);
            };

            return viewMode === 'list' ? (
              <ProductListItem
                product={item}
                onPressCard={openDetail}
                onCartFeedback={handleCartFeedback}
              />
            ) : (
              <View style={{ width: cardWidth, flex: 1, alignSelf: 'stretch' }}>
                <ProductCard
                  product={item}
                  width={cardWidth}
                  onPressCard={openDetail}
                  onCartFeedback={handleCartFeedback}
                />
              </View>
            );
          }}
        />

        {/* iOS refresh + all search: centered overlay. Android refresh uses native spinner (offset to middle). */}
        {isSearching || (isRefreshing && Platform.OS !== 'android') ? (
          <View style={styles.centerLoading} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {/* 2 — Fully transparent chip bar; products scroll underneath */}
        <View
          pointerEvents="box-none"
          style={styles.chipOverlay}
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.height);
            if (next > 0 && next !== chipBarHeight) {
              setChipBarHeight(next);
            }
          }}>
          <View
            style={[
              styles.chipSection,
              {
                backgroundColor: 'transparent',
              },
            ]}>
            <CategoryList
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              isLoading={isCategoriesLoading}
              horizontalPadding={horizontalPadding}
              showJustForYou={showJustForYou}
              onSelect={handleCategorySelect}
            />
          </View>
        </View>
      </View>

      <ScrollToTopButton
        visible={scrollToTopEligible && !isListScrolling && products.length > 0}
        onPress={handleScrollToTop}
        accessibilityLabel={t('products.backToTop')}
      />

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
    borderBottomWidth: 0,
    paddingBottom: 4,
    paddingTop: 8,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  /** Search row — no divider under it */
  searchSection: {
    zIndex: 10,
    paddingBottom: 4,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  /** Chip bar — no border 2; closer under search */
  chipSection: {
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  chipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /** Outer shell — Paper Searchbar Surface often swallows border styles.
   *  Do not use overflow:'hidden' here — on Android it clips the border away.
   *  Height is set inline (48 EN / 54 MY). */
  searchbarShell: {
    flex: 1,
    justifyContent: 'center',
  },
  searchbar: {
    elevation: 0,
    backgroundColor: 'transparent',
  },
  searchSkeleton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
  },
  headerChipSkeleton: {
    width: 40,
    height: 40,
  },
  headerChipIconSkeleton: {
    width: 40,
    height: 40,
  },
  categorySkeletonRow: {
    gap: 8,
    paddingVertical: 4,
  },
  categorySkeletonChip: {
    height: 36,
    width: 88,
  },
  productsList: {
    flex: 1,
  },
  listArea: {
    flex: 1,
    position: 'relative',
    marginTop: 0,
  },
  listContent: {
    paddingBottom: 120,
    flexGrow: 1,
  },
  centerLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    // Viewport middle of the list area — never pin under search / top of scroll.
    zIndex: 15,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyRetry: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
});
