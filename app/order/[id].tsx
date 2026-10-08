import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeaderBar } from '@/components/detail-header-bar';
import { InlineErrorBanner } from '@/components/inline-error-banner';
import { LiquidSurface } from '@/components/liquid-surface';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useReorder } from '@/hooks/use-reorder';
import { getUserFacingError } from '@/services/auth-error';
import {
  fetchOrderById,
  getOrderDeliveryStatus,
  getOrderShippingLabel,
  getStatusLabel,
  type DeliveryBucketItem,
  type DeliveryStatus,
  type Order,
  type OrderLine,
} from '@/services/order-api';
import { formatPrice } from '@/types/product';
import { formatMyanmarDateTime } from '@/utils/datetime';
import { isLiquidUiEnabled, liquidGlassBorder, liquidGlassFill } from '@/utils/liquid-ui';

type AppColors = ReturnType<typeof useAppColors>;

function getStatusBadgeColors(status: DeliveryStatus, colors: AppColors) {
  switch (status) {
    case 'completed':
    case 'delivered':
      return { bg: colors.successBg, text: colors.success, border: colors.success };
    case 'cancelled':
      return { bg: colors.dangerBg, text: colors.danger, border: colors.danger };
    case 'partial':
    case 'preparing':
      return { bg: colors.primaryMuted, text: colors.primary, border: colors.primary };
    case 'pending':
    default:
      return { bg: colors.inputBg, text: colors.textMuted, border: colors.border };
  }
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { token } = useAuth();
  const { t, fs, lh } = useLanguage();
  const { reorder, reorderingId } = useReorder();
  const { id } = useLocalSearchParams<{ id: string }>();
  const liquid = isLiquidUiEnabled();
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;
  const safeEdges = liquid ? (['bottom'] as const) : (['top', 'bottom'] as const);

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [deliveringNow, setDeliveringNow] = useState<DeliveryBucketItem[]>([]);
  const [comingLater, setComingLater] = useState<DeliveryBucketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!token || !id) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const data = await fetchOrderById(token, Number(id));
      setOrder(data.order);
      setLines(data.lines);
      setDeliveringNow(data.delivering_now);
      setComingLater(data.coming_later);
    } catch (err) {
      const message = getUserFacingError(err, t('errors.loadOrder'), t);
      if (message) setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [id, token, t]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={safeEdges}>
        <DetailHeaderBar title={t('orderDetail.title')} />
        <View style={styles.content}>
          {error ? (
            <InlineErrorBanner
              message={error}
              onRetry={() => {
                void loadOrder();
              }}
              onDismiss={() => setError('')}
              style={{ marginHorizontal: 0 }}
            />
          ) : (
            <Text style={[styles.errorText, { color: colors.danger, lineHeight: lh(14) }]}>
              {t('orderDetail.notFound')}
            </Text>
          )}
          <Button onPress={() => router.back()}>{t('orderDetail.goBack')}</Button>
        </View>
      </SafeAreaView>
    );
  }

  const discountLines = lines.filter((line) => line.price_subtotal < 0);
  const hasDiscount = discountLines.length > 0;
  const discountTotal = discountLines.reduce((sum, line) => sum + line.price_subtotal, 0);
  const originalTotal = order.amount_total - discountTotal;
  const deliveryStatus = getOrderDeliveryStatus(order);
  const shippingLabel = getOrderShippingLabel(order);
  const statusBadge = getStatusBadgeColors(deliveryStatus, colors);
  const showDeliverySplit =
    deliveryStatus === 'partial' || deliveryStatus === 'preparing' || deliveryStatus === 'delivered';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={safeEdges}>
      <DetailHeaderBar title={t('orderDetail.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LiquidSurface
          style={[styles.summaryCard, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          cornerRadius={16}
          glassStyle="regular"
          interactive>
          <View
            style={[
              styles.orderNumberSection,
              {
                backgroundColor: liquid ? liquidGlassFill(isDark) : colors.primaryMuted,
                borderColor: liquid ? cardBorder : colors.primary,
              },
            ]}>
            <Text style={[styles.orderNumberLabel, { color: colors.textMuted, fontSize: fs(12), lineHeight: lh(12) }]}>
              {t('orderDetail.orderNumber')}
            </Text>
            <View style={styles.orderNumberRow}>
              <Text
                style={[styles.orderNumberValue, { color: colors.text, fontSize: fs(22), lineHeight: lh(22) }]}
                numberOfLines={1}>
                {order.name}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusBadge.bg,
                    borderColor: statusBadge.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: statusBadge.text, fontSize: fs(11), lineHeight: lh(11) },
                  ]}
                  numberOfLines={2}>
                  {getStatusLabel(order.state, t, deliveryStatus)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryBody}>
            <DetailRow
              label={t('orderDetail.date')}
              value={formatMyanmarDateTime(order.date_order)}
              colors={colors}
              fs={fs}
              lh={lh}
            />

            {hasDiscount ? (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
                  {t('orderDetail.total')}
                </Text>
                <Text style={[styles.detailValueStrong, { color: colors.primary, fontSize: fs(18), lineHeight: lh(18) }]}>
                  {formatPrice(order.amount_total)}
                </Text>
                <Text
                  style={[
                    styles.strikePrice,
                    { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) },
                  ]}>
                  {formatPrice(originalTotal)}
                </Text>
              </View>
            ) : (
              <DetailRow
                label={t('orderDetail.total')}
                value={formatPrice(order.amount_total)}
                colors={colors}
                fs={fs}
                lh={lh}
                strong
              />
            )}

            {order.fulfillment_method === 'pickup' && order.pickup_point ? (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
                  {t('orderDetail.pickupPoint')}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}>
                  {[order.pickup_point.name, order.pickup_point.address].filter(Boolean).join('\n')}
                </Text>
              </View>
            ) : shippingLabel ? (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
                  {t('orderDetail.deliveryAddress')}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}>
                  {shippingLabel}
                </Text>
              </View>
            ) : null}

            {order.x_studio_preferred_delivery_date ? (
              <DetailRow
                label={t('orderDetail.deliveryDate')}
                value={String(order.x_studio_preferred_delivery_date)}
                colors={colors}
                fs={fs}
                lh={lh}
              />
            ) : null}

            {order.x_studio_delivery_notes ? (
              <DetailRow
                label={t('orderDetail.deliveryNotes')}
                value={String(order.x_studio_delivery_notes)}
                colors={colors}
                fs={fs}
                lh={lh}
              />
            ) : null}
          </View>
        </LiquidSurface>

        {showDeliverySplit ? (
          <>
            {deliveringNow.length > 0 ? (
              <DeliverySection
                title={
                  deliveryStatus === 'delivered'
                    ? t('orderDetail.deliveredItems')
                    : t('orderDetail.deliveringNow')
                }
                items={deliveringNow}
                colors={colors}
                fs={fs}
                lh={lh}
                cardBorder={cardBorder}
                liquid={liquid}
                isDark={isDark}
              />
            ) : null}

            {comingLater.length > 0 ? (
              <DeliverySection
                title={t('orderDetail.comingLater')}
                items={comingLater}
                colors={colors}
                fs={fs}
                lh={lh}
                hint={
                  deliveryStatus === 'preparing' ? t('orderDetail.preparingHint') : t('orderDetail.backorderHint')
                }
                muted
                cardBorder={cardBorder}
                liquid={liquid}
                isDark={isDark}
              />
            ) : null}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(18), lineHeight: lh(18) }]}>
          {t('orderDetail.items')}
        </Text>

        {lines.map((line) => (
          <LiquidSurface
            key={line.id}
            remountKey={line.id}
            style={[styles.lineCard, { borderColor: cardBorder }]}
            backgroundColor={colors.card}
            cornerRadius={12}
            glassStyle="regular"
            interactive>
            <View style={styles.lineTopRow}>
              <Text
                style={[styles.lineName, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}
                numberOfLines={2}>
                {line.name}
              </Text>
              <Text
                style={[
                  styles.lineTotal,
                  {
                    color: line.price_subtotal < 0 ? colors.success : colors.primary,
                    fontSize: fs(15),
                    lineHeight: lh(15),
                  },
                ]}>
                {formatPrice(line.price_subtotal)}
              </Text>
            </View>
            <Text style={[styles.lineMeta, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
              {t('orderDetail.qty')}: {line.product_uom_qty} × {formatPrice(line.price_unit)}
              {typeof line.qty_delivered === 'number' &&
              typeof line.qty_pending === 'number' &&
              line.qty_pending > 0
                ? ` · ${line.qty_delivered}/${line.product_uom_qty}`
                : ''}
            </Text>
          </LiquidSurface>
        ))}

        <Button
          mode="contained"
          icon="cart-arrow-down"
          loading={reorderingId === order.id}
          disabled={reorderingId !== null || lines.length === 0}
          onPress={() => reorder(order.id, lines)}
          style={styles.reorderButton}
          contentStyle={styles.reorderButtonContent}
          labelStyle={{ fontSize: fs(15), lineHeight: lh(15), fontWeight: '700' }}>
          {reorderingId === order.id ? t('orders.reordering') : t('orders.reorder')}
        </Button>

        <Button mode="outlined" onPress={() => router.back()} style={styles.footerBackButton}>
          {t('orderDetail.backToOrders')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function DeliverySection({
  title,
  items,
  colors,
  fs,
  lh,
  hint,
  muted = false,
  cardBorder,
  liquid,
  isDark,
}: {
  title: string;
  items: DeliveryBucketItem[];
  colors: AppColors;
  fs: (size: number) => number;
  lh: (size: number) => number | undefined;
  hint?: string;
  muted?: boolean;
  cardBorder: string;
  liquid: boolean;
  isDark: boolean;
}) {
  const fill = muted
    ? liquid
      ? liquidGlassFill(isDark)
      : colors.inputBg
    : colors.card;

  return (
    <LiquidSurface
      style={[styles.deliverySection, { borderColor: cardBorder }]}
      backgroundColor={fill}
      cornerRadius={14}
      glassStyle="regular"
      interactive={!muted}>
      <Text
        style={[
          styles.sectionTitle,
          { color: colors.text, fontSize: fs(16), lineHeight: lh(16), marginBottom: 10 },
        ]}>
        {title}
      </Text>
      {items.map((item) => (
        <View key={`${item.id}-${item.qty}`} style={styles.deliveryRow}>
          <Text
            style={[styles.deliveryName, { color: colors.text, fontSize: fs(14), lineHeight: lh(14) }]}
            numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.deliveryQty, { color: colors.textMuted, fontSize: fs(14), lineHeight: lh(14) }]}>
            × {item.qty}
          </Text>
        </View>
      ))}
      {hint ? (
        <Text style={[styles.deliveryHint, { color: colors.textMuted, fontSize: fs(12), lineHeight: lh(12) }]}>
          {hint}
        </Text>
      ) : null}
    </LiquidSurface>
  );
}

function DetailRow({
  label,
  value,
  colors,
  fs,
  lh,
  strong = false,
}: {
  label: string;
  value: string;
  colors: AppColors;
  fs: (size: number) => number;
  lh: (size: number) => number | undefined;
  strong?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
        {label}
      </Text>
      <Text
        style={[
          strong ? styles.detailValueStrong : styles.detailValue,
          {
            color: strong ? colors.primary : colors.text,
            fontSize: fs(strong ? 18 : 16),
            lineHeight: lh(strong ? 18 : 16),
          },
        ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  orderNumberSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderNumberLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderNumberValue: {
    flex: 1,
    fontWeight: '800',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
    maxWidth: '48%',
  },
  statusBadgeText: {
    fontWeight: '700',
  },
  summaryBody: {
    padding: 16,
  },
  detailRow: {
    marginBottom: 14,
  },
  detailLabel: {
    marginBottom: 4,
    fontWeight: '600',
  },
  detailValue: {
    fontWeight: '600',
  },
  detailValueStrong: {
    fontWeight: '800',
  },
  strikePrice: {
    marginTop: 2,
    textDecorationLine: 'line-through',
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  deliverySection: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  deliveryName: {
    flex: 1,
    fontWeight: '600',
  },
  deliveryQty: {
    fontWeight: '700',
  },
  deliveryHint: {
    marginTop: 4,
    fontWeight: '500',
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  lineTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  lineMeta: {
    marginTop: 4,
  },
  lineTotal: {
    flexShrink: 0,
    fontWeight: '700',
    textAlign: 'right',
  },
  reorderButton: {
    marginTop: 8,
    borderRadius: 14,
  },
  reorderButtonContent: {
    paddingVertical: 6,
  },
  footerBackButton: {
    marginTop: 12,
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
  },
});
