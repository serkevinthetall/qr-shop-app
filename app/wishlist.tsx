import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeaderBar } from '@/components/detail-header-bar';
import { ProductCard } from '@/components/products/product-card';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useWishlist } from '@/contexts/wishlist-context';
import { useResponsive } from '@/hooks/use-responsive';
import { rememberProductPreview } from '@/services/product-preview-cache';
import type { Product } from '@/types/product';

export default function WishlistScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { t, fs, lh } = useLanguage();
  const { items, count, hasItems, clear } = useWishlist();
  const { horizontalPadding, contentMaxWidth, gridGap, width, isWebsiteLayout } =
    useResponsive();

  const cols = isWebsiteLayout ? 3 : 2;
  const usable =
    (isWebsiteLayout ? Math.min(width, contentMaxWidth) : width) - horizontalPadding * 2;
  const cardWidth = Math.floor((usable - gridGap * (cols - 1)) / cols);

  const openDetail = (item: Product) => {
    rememberProductPreview(item);
    router.push(`/product/${encodeURIComponent(item.id)}` as Href);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <DetailHeaderBar title={t('wishlist.title')} />
      {!hasItems ? (
        <View style={styles.empty}>
          <MaterialIcons name="favorite-border" size={40} color={colors.textMuted} />
          <Text
            style={{
              marginTop: 12,
              color: colors.text,
              fontWeight: '800',
              fontSize: fs(18),
              lineHeight: lh(18),
            }}>
            {t('wishlist.empty')}
          </Text>
          <Text
            style={{
              marginTop: 6,
              color: colors.textMuted,
              textAlign: 'center',
              fontSize: fs(13),
              lineHeight: lh(13),
              paddingHorizontal: 24,
            }}>
            {t('wishlist.emptyHint')}
          </Text>
          <Button
            mode="contained"
            onPress={() => router.push('/(tabs)' as Href)}
            style={{ marginTop: 20, alignSelf: 'center' }}>
            {t('wishlist.browseProducts')}
          </Button>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 12,
            paddingBottom: 28,
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          }}>
          <View style={styles.countRow}>
            <Text style={{ color: colors.textMuted, fontSize: fs(13) }}>
              {count === 1
                ? t('wishlist.savedOne', { n: count })
                : t('wishlist.savedMany', { n: count })}
            </Text>
            <Pressable onPress={clear} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: fs(12) }}>
                {t('wishlist.clearAll')}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.grid, { gap: gridGap }]}>
            {items.map((item) => (
              <View key={item.id} style={{ width: cardWidth }}>
                <ProductCard
                  product={item}
                  width={cardWidth}
                  onPressCard={() => openDetail(item)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
