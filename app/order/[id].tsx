import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useReorder } from '@/hooks/use-reorder';
import {
  fetchOrderById,
  getOrderDeliveryStatus,
  getOrderShippingLabel,
  getStatusLabel,
  type DeliveryBucketItem,
  type DeliveryStatus,
  type Order,
  type OrderDelivery,
  type OrderLine,
} from '@/services/order-api';
import { formatPrice } from '@/types/product';

type AppColors = ReturnType<typeof useAppColors>;

function getStatusBadgeColors(status: DeliveryStatus, colors: AppColors) {
  switch (status) {
    case 'completed':
    case 'delivered':
      return { bg: colors.successBg, text: colors.success, border: colors.success };
    case 'cancelled':
      return { bg: colors.dangerBg, text: colors.danger, border: colors.danger };
    case 'out_for_delivery':
    case 'partial':
    case 'preparing':
      return { bg: colors.primaryMuted, text: colors.primary, border: colors.primary };
    case 'pending':
    default:
      return { bg: colors.inputBg, text: colors.textMuted, border: colors.border };
  }
}

function getPickingStateLabel(
  delivery: OrderDelivery,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  switch (String(delivery.state)) {
    case 'done':
      return t('orderDetail.deliveryDone');
    case 'cancel':
      return t('orderDetail.deliveryCancelled');
    case 'assigned':
      return t('orderDetail.deliveryReady');
    case 'confirmed':
    case 'waiting':
      return t('orderDetail.deliveryWaiting');
    case 'draft':
      return t('orderDetail.deliveryDraft');
    default:
      return delivery.state_label || delivery.state;
  }
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { token } = useAuth();
  const { t, fs, lh } = useLanguage();
  const { reorder, reorderingId } = useReorder();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [deliveringNow, setDeliveringNow] = useState<DeliveryBucketItem[]>([]);
  const [comingLater, setComingLater] = useState<DeliveryBucketItem[]>([]);
  const [deliveries, setDeliveries] = useState<OrderDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !id) {
      return;
    }

    fetchOrderById(token, Number(id))
      .then((data) => {
        setOrder(data.order);
        setLines(data.lines);
        setDeliveringNow(data.delivering_now);
        setComingLater(data.coming_later);
        setDeliveries(data.deliveries);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load order.');
      })
      .finally(() => setIsLoading(false));
  }, [id, token]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <OrderDetailHeader title={t('orderDetail.title')} colors={colors} fs={fs} lh={lh} onBack={() => router.back()} />
        <View style={styles.content}>
          <Text style={[styles.errorText, { color: colors.danger, lineHeight: lh(14) }]}>{error || t('orderDetail.notFound')}</Text>
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
    deliveryStatus === 'partial' ||
    deliveryStatus === 'preparing' ||
    deliveryStatus === 'out_for_delivery' ||
    deliveryStatus === 'delivered';
  const deliveryDocs = deliveries.length > 0 ? deliveries : order.deliveries || [];
  const deliveryTitle =
    deliveryDocs.length === 1
      ? t('orderDetail.deliveryCount', { count: 1 })
      : deliveryDocs.length > 1
        ? t('orderDetail.deliveryCountPlural', { count: deliveryDocs.length })
        : t('orderDetail.deliveries');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <OrderDetailHeader title={t('orderDetail.title')} colors={colors} fs={fs} lh={lh} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.orderNumberSection, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
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
              value={new Date(order.date_order).toLocaleString()}
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

            {shippingLabel ? (
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
        </View>

        {(deliveryStatus !== 'pending' && deliveryStatus !== 'cancelled') || deliveryDocs.length > 0 ? (
          <View style={[styles.deliveryDocsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.deliveryDocsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16), marginBottom: 0 }]}>
                {deliveryTitle}
              </Text>
              {deliveryDocs.length > 0 ? (
                <View style={[styles.deliveryCountPill, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
                  <Text style={{ color: colors.primary, fontSize: fs(12), lineHeight: lh(12), fontWeight: '700' }}>
                    {deliveryDocs.length}
                  </Text>
                </View>
              ) : null}
            </View>

            {deliveryDocs.length === 0 ? (
              <Text style={[styles.deliveryHint, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
                {t('orderDetail.noDeliveriesYet')}
              </Text>
            ) : (
              deliveryDocs.map((delivery) => (
                <View
                  key={delivery.id}
                  style={[styles.deliveryDocRow, { borderTopColor: colors.border }]}>
                  <View style={styles.deliveryDocMain}>
                    <Text
                      style={[styles.deliveryDocName, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}
                      numberOfLines={1}>
                      {delivery.name}
                    </Text>
                    {delivery.scheduled_date || delivery.date_done ? (
                      <Text style={{ color: colors.textMuted, fontSize: fs(12), lineHeight: lh(12) }}>
                        {delivery.date_done
                          ? new Date(String(delivery.date_done).replace(' ', 'T')).toLocaleString()
                          : new Date(String(delivery.scheduled_date).replace(' ', 'T')).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.pickingBadge,
                      {
                        backgroundColor:
                          delivery.state === 'done'
                            ? colors.successBg
                            : delivery.state === 'cancel'
                              ? colors.dangerBg
                              : colors.primaryMuted,
                        borderColor:
                          delivery.state === 'done'
                            ? colors.success
                            : delivery.state === 'cancel'
                              ? colors.danger
                              : colors.primary,
                      },
                    ]}>
                    <Text
                      style={{
                        color:
                          delivery.state === 'done'
                            ? colors.success
                            : delivery.state === 'cancel'
                              ? colors.danger
                              : colors.primary,
                        fontSize: fs(11),
                        lineHeight: lh(11),
                        fontWeight: '700',
                      }}>
                      {getPickingStateLabel(delivery, t)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

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
              />
            ) : null}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(18), lineHeight: lh(18) }]}>{t('orderDetail.items')}</Text>

        {lines.map((line) => (
          <View
            key={line.id}
            style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              {typeof line.qty_delivered === 'number' && typeof line.qty_pending === 'number' && line.qty_pending > 0
                ? ` · ${line.qty_delivered}/${line.product_uom_qty}`
                : ''}
            </Text>
          </View>
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
}: {
  title: string;
  items: DeliveryBucketItem[];
  colors: AppColors;
  fs: (size: number) => number;
  lh: (size: number) => number | undefined;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <View
      style={[
        styles.deliverySection,
        {
          backgroundColor: muted ? colors.inputBg : colors.card,
          borderColor: colors.border,
        },
      ]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16), marginBottom: 10 }]}>
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
        <Text style={[styles.deliveryHint, { color: colors.textMuted, fontSize: fs(12), lineHeight: lh(12) }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

function OrderDetailHeader({
  title,
  colors,
  fs,
  lh,
  onBack,
}: {
  title: string;
  colors: AppColors;
  fs: (size: number) => number;
  lh: (size: number) => number | undefined;
  onBack: () => void;
}) {
  return (
    <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable onPress={onBack} style={styles.headerBackButton} accessibilityRole="button" accessibilityLabel="Go back">
        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(20), lineHeight: lh(20) }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
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
      <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>{label}</Text>
      <Text
        style={[
          strong ? styles.detailValueStrong : styles.detailValue,
          { color: strong ? colors.primary : colors.text, fontSize: fs(strong ? 18 : 16), lineHeight: lh(strong ? 18 : 16) },
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
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
    borderBottomWidth: 1,
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
  deliveryDocsCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  deliveryDocsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  deliveryCountPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  deliveryDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deliveryDocMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  deliveryDocName: {
    fontWeight: '700',
  },
  pickingBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
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
