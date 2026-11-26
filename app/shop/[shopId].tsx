import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard, ProductListItem } from '@/components/products/product-card';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { getUserFacingError } from '@/services/auth-error';
import {
  fetchShopStorefront,
  type ShopStorefront,
} from '@/services/product-api';
import { rememberProductPreview } from '@/services/product-preview-cache';
import type { Product } from '@/types/product';
import { getCategoryId, getCategoryName } from '@/types/product';
import { inputCaretProps } from '@/constants/text-input';

type TabId = 'shop' | 'about';
type ViewMode = 'grid' | 'list';

const BROWSE_THRESHOLD = 10;

export default function ShopCatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { token } = useAuth();
  const { t, fs, lh } = useLanguage();
  const { horizontalPadding, contentMaxWidth, gridGap, width, isWebsiteLayout } =
    useResponsive();
  const params = useLocalSearchParams<{ shopId: string; name?: string; logo?: string }>();
  const shopId = typeof params.shopId === 'string' ? decodeURIComponent(params.shopId) : '';
  const nameParam = typeof params.name === 'string' ? decodeURIComponent(params.name) : '';
  const logoParam = typeof params.logo === 'string' ? decodeURIComponent(params.logo) : '';

  const [shop, setShop] = useState<ShopStorefront | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { shop: nextShop, products } = await fetchShopStorefront(shopId, token);
      setShop({
        ...nextShop,
        name: nextShop.name || nameParam || t('messages.shopFallback'),
        logoUrl: nextShop.logoUrl || logoParam,
      });
      setAllProducts(products);
      setError('');
    } catch (err) {
      const message = getUserFacingError(err, t('errors.loadProducts'), t);
      if (message) setError(message);
      setShop({
        id: shopId,
        name: nameParam || t('messages.shopFallback'),
        tagline: '',
        logoUrl: logoParam,
        coverUrl: '',
        phone: '',
        location: '',
        township: '',
        aboutText: '',
        websitePublished: false,
      });
    } finally {
      setLoading(false);
    }
  }, [shopId, token, t, nameParam, logoParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allProducts) {
      const id = getCategoryId(p.categ_id);
      const name = getCategoryName(p.categ_id);
      if (id && name && !map.has(id)) map.set(id, name);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [allProducts]);

  const showBrowse = allProducts.length > BROWSE_THRESHOLD;

  const products = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (categoryId !== 'all') {
        if (getCategoryId(p.categ_id) !== categoryId) return false;
      }
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [allProducts, searchQuery, categoryId]);

  const bodyPad = isWebsiteLayout ? Math.max(horizontalPadding, 24) : 16;
  const coverH = isWebsiteLayout ? 240 : 140;
  const logoPx = isWebsiteLayout ? 72 : 56;
  const gridCols = isWebsiteLayout ? 3 : 2;
  const usable =
    (isWebsiteLayout ? Math.min(width, contentMaxWidth) : width) - bodyPad * 2;
  const cardWidth =
    viewMode === 'list'
      ? usable
      : Math.floor((usable - gridGap * (gridCols - 1)) / gridCols);

  const openDetail = (item: Product) => {
    rememberProductPreview(item);
    router.push(`/product/${encodeURIComponent(item.id)}` as Href);
  };

  const displayName = shop?.name || nameParam || t('messages.shopFallback');
  const logoUrl = shop?.logoUrl || logoParam;
  const coverUrl = shop?.coverUrl || '';
  const tagline = shop?.tagline || '';

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 28) }}
        keyboardShouldPersistTaps="handled">
        {/* Cover / brand strip — same idea as Marketplace /s/:shopId */}
        {coverUrl ? (
          <View style={{ width: '100%', height: coverH }}>
            <Image source={{ uri: coverUrl }} style={{ width: '100%', height: coverH }} contentFit="cover" />
            <View
              pointerEvents="none"
              style={[styles.coverFade, { backgroundColor: colors.background }]}
            />
          </View>
        ) : (
          <View style={{ height: isWebsiteLayout ? 88 : 56, backgroundColor: colors.primary }} />
        )}

        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            {
              top: insets.top + 8,
              backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.92)',
            },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <View style={{ marginTop: -logoPx / 2, paddingHorizontal: bodyPad }}>
          <View
            style={[
              styles.logoWrap,
              {
                width: logoPx,
                height: logoPx,
                borderRadius: isWebsiteLayout ? 18 : 14,
                borderColor: colors.card,
                backgroundColor: colors.primaryMuted,
              },
            ]}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: fs(14) }}>
                {displayName.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <Text
            style={{
              marginTop: 8,
              color: colors.text,
              fontWeight: '800',
              fontSize: fs(isWebsiteLayout ? 26 : 18),
              lineHeight: lh(isWebsiteLayout ? 26 : 18),
            }}
            numberOfLines={2}>
            {displayName}
          </Text>
          {tagline ? (
            <Text
              style={{ marginTop: 2, color: colors.textMuted, fontSize: fs(isWebsiteLayout ? 14 : 12) }}
              numberOfLines={2}>
              {tagline}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.tabs,
            {
              marginTop: isWebsiteLayout ? 18 : 12,
              paddingHorizontal: bodyPad,
              maxWidth: isWebsiteLayout ? 360 : undefined,
            },
          ]}>
          {(['shop', 'about'] as const).map((id) => {
            const active = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[
                  styles.tabChip,
                  {
                    flex: isWebsiteLayout ? undefined : 1,
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: colors.border,
                    borderWidth: active ? 0 : StyleSheet.hairlineWidth,
                    paddingHorizontal: isWebsiteLayout ? 22 : 12,
                  },
                ]}>
                <Text
                  style={{
                    color: active ? colors.onPrimary : colors.text,
                    fontWeight: '700',
                    fontSize: fs(isWebsiteLayout ? 13 : 11),
                  }}>
                  {id === 'shop' ? t('messages.tabShop') : t('messages.tabAbout')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'about' ? (
          <View style={{ paddingHorizontal: bodyPad, marginTop: 16, gap: 10 }}>
            {shop?.aboutText ? (
              <Text style={{ color: colors.text, fontSize: fs(14), lineHeight: lh(14) }}>
                {shop.aboutText}
              </Text>
            ) : null}
            {shop?.phone ? (
              <Text style={{ color: colors.textMuted, fontSize: fs(13) }}>
                {t('messages.shopPhone')}: {shop.phone}
              </Text>
            ) : null}
            {shop?.location || shop?.township ? (
              <Text style={{ color: colors.textMuted, fontSize: fs(13) }}>
                {[shop.township, shop.location].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {!shop?.aboutText && !shop?.phone && !shop?.location ? (
              <Text style={{ color: colors.textMuted, fontSize: fs(13) }}>
                {t('messages.shopAboutEmpty')}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: isWebsiteLayout ? 20 : 12, paddingHorizontal: bodyPad }}>
            {error ? (
              <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>
            ) : null}

            {showBrowse ? (
              <>
                <View
                  style={[
                    styles.searchBox,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}>
                  <MaterialIcons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={(v) => {
                      setSearchQuery(v);
                      if (tab !== 'shop') setTab('shop');
                    }}
                    placeholder={t('messages.searchThisShop')}
                    placeholderTextColor={colors.textMuted}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: fs(14),
                      paddingVertical: 0,
                    }}
                    {...inputCaretProps(isDark)}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 8, paddingTop: 4 }}>
                  <Chip
                    label={t('messages.categoryAll')}
                    active={categoryId === 'all'}
                    onPress={() => setCategoryId('all')}
                  />
                  {categories.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.label}
                      active={categoryId === c.id}
                      onPress={() => setCategoryId(c.id)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <View style={styles.countRow}>
              <Text style={{ color: colors.textMuted, fontSize: fs(11), fontWeight: '700' }}>
                {t('messages.productsCount', { n: String(products.length) })}
              </Text>
              <View style={[styles.viewToggle, { borderColor: colors.border }]}>
                <Pressable
                  onPress={() => setViewMode('grid')}
                  style={[
                    styles.viewToggleBtn,
                    { backgroundColor: viewMode === 'grid' ? colors.primary : colors.card },
                  ]}>
                  <Text
                    style={{
                      color: viewMode === 'grid' ? colors.onPrimary : colors.text,
                      fontSize: 10,
                      fontWeight: '700',
                    }}>
                    {t('messages.grid')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setViewMode('list')}
                  style={[
                    styles.viewToggleBtn,
                    { backgroundColor: viewMode === 'list' ? colors.primary : colors.card },
                  ]}>
                  <Text
                    style={{
                      color: viewMode === 'list' ? colors.onPrimary : colors.text,
                      fontSize: 10,
                      fontWeight: '700',
                    }}>
                    {t('messages.list')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {products.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 32 }}>
                {t('messages.shopEmpty')}
              </Text>
            ) : viewMode === 'list' ? (
              <View style={{ gap: 10 }}>
                {products.map((item) => (
                  <ProductListItem
                    key={item.id}
                    product={item}
                    onPressCard={() => openDetail(item)}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.grid, { gap: gridGap }]}>
                {products.map((item) => (
                  <View key={item.id} style={{ width: cardWidth }}>
                    <ProductCard
                      product={item}
                      width={cardWidth}
                      onPressCard={() => openDetail(item)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: active ? colors.primary : colors.card,
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}>
      <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
    opacity: 0.55,
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoWrap: {
    overflow: 'hidden',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%' },
  tabs: { flexDirection: 'row', gap: 8 },
  tabChip: {
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  viewToggleBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
