import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Menu, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrdersListSkeleton } from '@/components/orders/order-card-skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { takeOrdersBootstrap } from '@/services/catalog-bootstrap';
import { searchbarInputStyle } from '@/constants/text-input';
import {
  fetchOrders,
  getDeliveryProgressLabel,
  getOrderDeliveryStatus,
  type DeliveryStatus,
  type Order,
} from '@/services/order-api';
import { formatPrice } from '@/types/product';

type AppColors = ReturnType<typeof useAppColors>;
type Language = ReturnType<typeof useLanguage>;

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

const STATUS_FILTERS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'orders.filterAll' },
  { key: 'pending', labelKey: 'orders.filterPending' },
  { key: 'in_progress', labelKey: 'orders.filterInProgress' },
  { key: 'completed', labelKey: 'orders.filterCompleted' },
  { key: 'cancelled', labelKey: 'orders.filterCancelled' },
];

const STATUS_GROUPS: Record<Exclude<StatusFilter, 'all'>, DeliveryStatus[]> = {
  pending: ['pending'],
  in_progress: ['preparing', 'out_for_delivery', 'partial', 'delivered'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year';

const DATE_FILTERS: { key: DateFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'orders.filterAll' },
  { key: 'today', labelKey: 'orders.filterToday' },
  { key: 'week', labelKey: 'orders.filterWeek' },
  { key: 'month', labelKey: 'orders.filterMonth' },
  { key: 'year', labelKey: 'orders.filterYear' },
];

function getDateThreshold(filter: DateFilter): number | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return startOfToday.getTime();
    case 'week': {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const monday = new Date(startOfToday);
      monday.setDate(startOfToday.getDate() - daysSinceMonday);
      return monday.getTime();
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case 'year':
      return new Date(now.getFullYear(), 0, 1).getTime();
    default:
      return null;
  }
}

/** Odoo returns `YYYY-MM-DD HH:mm:ss` — normalize so RN Date parsing is reliable. */
function parseOrderDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function dayKey(date: Date) {
  return `${monthKey(date)}-${pad2(date.getDate())}`;
}

function formatMonthLabel(date: Date, locale: string) {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function formatDayLabel(date: Date, locale: string) {
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCreationDate(date: Date, locale: string) {
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Odoo-style document type on the list row. */
function getDocumentTypeLabel(state: string, t: Language['t']) {
  switch (state) {
    case 'draft':
    case 'sent':
      return t('orders.documentQuotation');
    case 'sale':
      return t('orders.documentSalesOrder');
    case 'done':
      return t('orders.documentDone');
    case 'cancel':
      return t('orders.documentCancelled');
    default:
      return state;
  }
}

function getDocumentBadgeColors(state: string, colors: AppColors) {
  switch (state) {
    case 'sale':
    case 'done':
      return { bg: colors.successBg, text: colors.success, border: colors.success };
    case 'cancel':
      return { bg: colors.dangerBg, text: colors.danger, border: colors.danger };
    case 'draft':
    case 'sent':
    default:
      return { bg: colors.primaryMuted, text: colors.primary, border: colors.primary };
  }
}

type MonthHeaderItem = {
  kind: 'month';
  id: string;
  label: string;
  count: number;
  total: number;
};

type DayHeaderItem = {
  kind: 'day';
  id: string;
  label: string;
  count: number;
  total: number;
};

type OrderRowItem = {
  kind: 'order';
  id: string;
  order: Order;
};

type ListItem = MonthHeaderItem | DayHeaderItem | OrderRowItem;

function buildGroupedList(orders: Order[], locale: string): ListItem[] {
  const sorted = [...orders].sort((a, b) => {
    const aTime = parseOrderDate(a.date_order)?.getTime() ?? 0;
    const bTime = parseOrderDate(b.date_order)?.getTime() ?? 0;
    return bTime - aTime;
  });

  const items: ListItem[] = [];
  let currentMonth = '';
  let currentDay = '';

  const monthBuckets = new Map<string, Order[]>();
  const dayBuckets = new Map<string, Order[]>();

  for (const order of sorted) {
    const date = parseOrderDate(order.date_order) ?? new Date(0);
    const mKey = monthKey(date);
    const dKey = dayKey(date);

    if (!monthBuckets.has(mKey)) monthBuckets.set(mKey, []);
    monthBuckets.get(mKey)!.push(order);

    if (!dayBuckets.has(dKey)) dayBuckets.set(dKey, []);
    dayBuckets.get(dKey)!.push(order);
  }

  for (const order of sorted) {
    const date = parseOrderDate(order.date_order) ?? new Date(0);
    const mKey = monthKey(date);
    const dKey = dayKey(date);

    if (mKey !== currentMonth) {
      currentMonth = mKey;
      currentDay = '';
      const monthOrders = monthBuckets.get(mKey) || [];
      items.push({
        kind: 'month',
        id: `month-${mKey}`,
        label: formatMonthLabel(date, locale),
        count: monthOrders.length,
        total: monthOrders.reduce((sum, item) => sum + (Number(item.amount_total) || 0), 0),
      });
    }

    if (dKey !== currentDay) {
      currentDay = dKey;
      const dayOrders = dayBuckets.get(dKey) || [];
      items.push({
        kind: 'day',
        id: `day-${dKey}`,
        label: formatDayLabel(date, locale),
        count: dayOrders.length,
        total: dayOrders.reduce((sum, item) => sum + (Number(item.amount_total) || 0), 0),
      });
    }

    items.push({
      kind: 'order',
      id: `order-${order.id}`,
      order,
    });
  }

  return items;
}

function StatusChips({
  active,
  onChange,
  colors,
  lang,
}: {
  active: StatusFilter;
  onChange: (key: StatusFilter) => void;
  colors: AppColors;
  lang: Language;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
      contentContainerStyle={styles.chipsContent}>
      {STATUS_FILTERS.map((chip) => {
        const isActive = active === chip.key;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onChange(chip.key)}
            style={[styles.chip, { backgroundColor: isActive ? colors.primary : colors.inputBg }]}>
            <Text
              numberOfLines={1}
              style={[
                styles.chipText,
                {
                  color: isActive ? colors.onPrimary : colors.textMuted,
                  fontSize: lang.fs(14),
                },
              ]}>
              {lang.t(chip.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MonthHeader({
  item,
  colors,
  lang,
}: {
  item: MonthHeaderItem;
  colors: AppColors;
  lang: Language;
}) {
  return (
    <View style={[styles.monthHeader, { borderBottomColor: colors.border }]}>
      <Text style={[styles.monthLabel, { color: colors.text, fontSize: lang.fs(16), lineHeight: lang.lh(16) }]}>
        {item.label}
      </Text>
      <View style={styles.groupMeta}>
        <Text style={[styles.groupCount, { color: colors.textMuted, fontSize: lang.fs(13) }]}>{item.count}</Text>
        <Text style={[styles.groupTotal, { color: colors.text, fontSize: lang.fs(14), lineHeight: lang.lh(14) }]}>
          {formatPrice(item.total)}
        </Text>
      </View>
    </View>
  );
}

function DayHeader({
  item,
  colors,
  lang,
}: {
  item: DayHeaderItem;
  colors: AppColors;
  lang: Language;
}) {
  return (
    <View style={[styles.dayHeader, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Text style={[styles.dayLabel, { color: colors.text, fontSize: lang.fs(13), lineHeight: lang.lh(13) }]}>
        {item.label}
      </Text>
      <View style={styles.groupMeta}>
        <Text style={[styles.groupCount, { color: colors.textMuted, fontSize: lang.fs(12) }]}>
          {lang.t('orders.groupCount', { count: item.count })}
        </Text>
        <Text style={[styles.groupTotal, { color: colors.textMuted, fontSize: lang.fs(13), lineHeight: lang.lh(13) }]}>
          {formatPrice(item.total)}
        </Text>
      </View>
    </View>
  );
}

function OrderRow({
  order,
  colors,
  lang,
  onPress,
}: {
  order: Order;
  colors: AppColors;
  lang: Language;
  onPress: () => void;
}) {
  const locale = lang.language === 'my' ? 'my-MM' : 'en-US';
  const date = parseOrderDate(order.date_order);
  const badge = getDocumentBadgeColors(order.state, colors);
  const deliveryStatus = getOrderDeliveryStatus(order);
  const partialProgress = getDeliveryProgressLabel(order, lang.t);
  const products = Array.isArray(order.product_preview) ? order.product_preview : [];
  const extraCount = Math.max(0, (order.product_preview_count || products.length) - products.length);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.orderRow,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <View style={styles.orderMain}>
        <View style={styles.orderTop}>
          <Text
            numberOfLines={1}
            style={[styles.orderNo, { color: colors.text, fontSize: lang.fs(15), lineHeight: lang.lh(15) }]}>
            {order.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.orderTotal, { color: colors.text, fontSize: lang.fs(15), lineHeight: lang.lh(15) }]}>
            {formatPrice(order.amount_total)}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={[styles.creationDate, { color: colors.textMuted, fontSize: lang.fs(12), lineHeight: lang.lh(12) }]}>
          {date ? formatCreationDate(date, locale) : '—'}
        </Text>

        {products.length > 0 ? (
          <View style={styles.productList}>
            {products.map((product) => (
              <View key={`${order.id}-${product.id}`} style={styles.productRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.productName, { color: colors.text, fontSize: lang.fs(13), lineHeight: lang.lh(13) }]}>
                  {product.name}
                </Text>
                <Text
                  style={[styles.productQty, { color: colors.textMuted, fontSize: lang.fs(13), lineHeight: lang.lh(13) }]}>
                  {product.qty}
                </Text>
              </View>
            ))}
            {extraCount > 0 ? (
              <Text style={[styles.productMore, { color: colors.textMuted, fontSize: lang.fs(12) }]}>
                +{extraCount}
              </Text>
            ) : null}
          </View>
        ) : null}

        {partialProgress ? (
          <Text
            numberOfLines={1}
            style={[styles.partialProgress, { color: colors.primary, fontSize: lang.fs(11), lineHeight: lang.lh(11) }]}>
            {partialProgress}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: badge.bg,
            borderColor: badge.border,
          },
        ]}>
        <Text
          numberOfLines={1}
          style={[styles.statusBadgeText, { color: badge.text, fontSize: lang.fs(11), lineHeight: lang.lh(11) }]}>
          {getDocumentTypeLabel(order.state, lang.t)}
        </Text>
      </View>

      {deliveryStatus === 'partial' || deliveryStatus === 'preparing' || deliveryStatus === 'delivered' ? (
        <MaterialCommunityIcons name="truck-delivery-outline" size={16} color={colors.textMuted} />
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const lang = useLanguage();
  const { token } = useAuth();
  const locale = lang.language === 'my' ? 'my-MM' : 'en-US';

  const [ordersSeed] = useState(() => takeOrdersBootstrap());
  const [orders, setOrders] = useState<Order[]>(ordersSeed ?? []);
  const [isLoading, setIsLoading] = useState(!ordersSeed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [dateMenuVisible, setDateMenuVisible] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    const list = await fetchOrders(token);
    setOrders(list);
  }, [token]);

  useEffect(() => {
    loadOrders()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load orders.'))
      .finally(() => setIsLoading(false));
  }, [loadOrders]);

  useFocusEffect(
    useCallback(() => {
      loadOrders().catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load orders.');
      });
    }, [loadOrders]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadOrders().catch(() => {
          // Keep showing the last known list if the refresh fails.
        });
      }
    });

    return () => subscription.remove();
  }, [loadOrders]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError('');
    try {
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh orders.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const threshold = getDateThreshold(dateFilter);
    return orders.filter((order) => {
      if (query) {
        const inName = order.name.toLowerCase().includes(query);
        const inProducts = (order.product_preview || []).some((product) =>
          String(product.name || '')
            .toLowerCase()
            .includes(query),
        );
        if (!inName && !inProducts) return false;
      }
      if (statusFilter !== 'all' && !STATUS_GROUPS[statusFilter].includes(getOrderDeliveryStatus(order))) return false;
      if (threshold !== null) {
        const time = parseOrderDate(order.date_order)?.getTime();
        if (time == null || time < threshold) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, dateFilter]);

  const listItems = useMemo(() => buildGroupedList(filteredOrders, locale), [filteredOrders, locale]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.searchRow}>
          <Searchbar
            value=""
            editable={false}
            placeholder={lang.t('orders.searchPlaceholder')}
            style={[styles.searchbar, styles.searchbarFlex, { backgroundColor: colors.inputBg }]}
            inputStyle={searchbarInputStyle}
            placeholderTextColor={colors.textMuted}
            iconColor={colors.textMuted}
          />
          <View style={[styles.dateButton, { backgroundColor: 'transparent', borderColor: 'transparent' }]}>
            <MaterialCommunityIcons name="calendar-range" size={20} color={colors.primary} />
            <MaterialCommunityIcons name="chevron-down" size={14} color={colors.textMuted} />
          </View>
        </View>

        <StatusChips active="all" onChange={() => {}} colors={colors} lang={lang} />

        <OrdersListSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.searchRow}>
        <Searchbar
          value={search}
          onChangeText={setSearch}
          placeholder={lang.t('orders.searchPlaceholder')}
          style={[styles.searchbar, styles.searchbarFlex, { backgroundColor: colors.inputBg }]}
          inputStyle={searchbarInputStyle}
          placeholderTextColor={colors.textMuted}
          iconColor={colors.textMuted}
        />
        <Menu
          visible={dateMenuVisible}
          onDismiss={() => setDateMenuVisible(false)}
          anchor={
            <Pressable
              onPress={() => setDateMenuVisible(true)}
              style={[
                styles.dateButton,
                dateFilter === 'all'
                  ? { backgroundColor: 'transparent', borderColor: 'transparent' }
                  : { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}>
              <MaterialCommunityIcons name="calendar-range" size={20} color={colors.primary} />
              {dateFilter !== 'all' ? (
                <Text
                  numberOfLines={1}
                  style={[styles.dateButtonText, { color: colors.text, fontSize: lang.fs(13) }]}>
                  {lang.t(DATE_FILTERS.find((option) => option.key === dateFilter)?.labelKey ?? 'orders.filterAll')}
                </Text>
              ) : null}
              <MaterialCommunityIcons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>
          }>
          {DATE_FILTERS.map((option) => (
            <Menu.Item
              key={option.key}
              onPress={() => {
                setDateFilter(option.key);
                setDateMenuVisible(false);
              }}
              title={lang.t(option.labelKey)}
              leadingIcon={dateFilter === option.key ? 'check' : undefined}
            />
          ))}
        </Menu>
      </View>

      <StatusChips active={statusFilter} onChange={setStatusFilter} colors={colors} lang={lang} />

      {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

      <FlatList
        data={listItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={listItems
          .map((item, index) => (item.kind === 'month' ? index : -1))
          .filter((index) => index >= 0)}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="package-variant" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, lineHeight: lang.lh(16) }]}>
              {orders.length === 0 ? lang.t('orders.empty') : lang.t('orders.noMatches')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'month') {
            return (
              <View style={{ backgroundColor: colors.background }}>
                <MonthHeader item={item} colors={colors} lang={lang} />
              </View>
            );
          }

          if (item.kind === 'day') {
            return <DayHeader item={item} colors={colors} lang={lang} />;
          }

          return (
            <OrderRow
              order={item.order}
              colors={colors}
              lang={lang}
              onPress={() => router.push(`/order/${item.order.id}` as Href)}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  searchbar: { elevation: 0 },
  searchbarFlex: { flex: 1 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    maxWidth: 150,
  },
  dateButtonText: { fontWeight: '700', flexShrink: 1 },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 12,
    minHeight: 48,
  },
  chipsContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
    alignItems: 'center',
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: { fontWeight: '700' },
  listContent: { paddingBottom: 28 },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthLabel: { fontWeight: '800', flex: 1 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: { fontWeight: '700', flex: 1 },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  groupCount: { fontWeight: '600' },
  groupTotal: { fontWeight: '800' },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderNo: { fontWeight: '800', flexShrink: 1 },
  orderTotal: { fontWeight: '800', flexShrink: 0 },
  creationDate: { fontWeight: '500' },
  productList: {
    marginTop: 6,
    gap: 4,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  productName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  productQty: {
    fontWeight: '700',
    flexShrink: 0,
    minWidth: 28,
    textAlign: 'right',
  },
  productMore: { fontWeight: '600' },
  partialProgress: { fontWeight: '700', marginTop: 4 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 110,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontWeight: '700',
  },

  emptyWrap: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16 },
  errorText: { marginBottom: 12, marginHorizontal: 16, textAlign: 'center' },
});
