import { useRouter, type Href } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartLineItem } from '@/components/products/product-card';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { formatPrice } from '@/types/product';

export default function CartScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { items, totalAmount, totalItems, updateQuantity, removeFromCart } = useCart();
  const { t, fs, lh } = useLanguage();

  if (!items.length) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.emptyWrap, { paddingHorizontal: horizontalPadding }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: fs(rs(15)), lineHeight: lh(15) }]}>
            {t('cart.empty')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.product.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <CartLineItem
              product={item.product}
              quantity={item.quantity}
              onIncrease={() => updateQuantity(item.product.id, item.quantity + 1)}
              onDecrease={() => updateQuantity(item.product.id, item.quantity - 1)}
              onRemove={() => removeFromCart(item.product.id)}
            />
          )}
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingHorizontal: horizontalPadding,
          },
        ]}>
        <View style={[styles.footerInner, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
              {t('cart.quantity')}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
              {t('cart.itemsCount', { count: totalItems })}
            </Text>
          </View>

          <View style={[styles.divider, { borderTopColor: colors.border }]} />

          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
              {t('common.total')}
            </Text>
            <Text style={[styles.totalValue, { color: colors.primary, fontSize: rs(22) }]}>
              {formatPrice(totalAmount)}
            </Text>
          </View>

          <Button
            mode="contained"
            icon="arrow-right"
            onPress={() => router.push('/checkout' as Href)}
            style={styles.checkoutButtonWrap}
            contentStyle={styles.checkoutButton}
            labelStyle={{ fontSize: fs(rs(15)), lineHeight: lh(15), fontWeight: '700' }}>
            {t('cart.proceedToCheckout')}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  title: {
    fontWeight: '700',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  footerInner: {},
  handle: {
    alignItems: 'center',
    marginBottom: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontWeight: '500',
  },
  summaryValue: {
    fontWeight: '600',
  },
  divider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  totalLabel: {
    fontWeight: '700',
  },
  totalValue: {
    fontWeight: '800',
  },
  checkoutButtonWrap: {
    marginTop: 6,
    borderRadius: 14,
  },
  checkoutButton: {
    paddingVertical: 8,
    flexDirection: 'row-reverse',
  },
});
