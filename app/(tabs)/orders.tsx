import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { takeOrdersBootstrap } from '@/services/catalog-bootstrap';
import { searchbarInputStyle } from '@/constants/text-input';
import { fetchOrderById, fetchOrders, getOrderShippingLabel, getStatusLabel, type Order } from '@/services/order-api';
import { formatPrice } from '@/types/product';

type AppColors = ReturnType<typeof useAppColors>;
type Language = ReturnType<typeof useLanguage>;

type StatusFilter = 'all' | 'pending' | 'completed' | 'cancelled';

const STATUS_FILTERS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'orders.filterAll' },
  { key: 'pending', labelKey: 'orders.filterPending' },
  { key: 'completed', labelKey: 'orders.filterCompleted' },
  { key: 'cancelled', labelKey: 'orders.filterCancelled' },
];

const STATUS_GROUPS: Record<Exclude<StatusFilter, 'all'>, string[]> = {
  pending: ['draft', 'sent'],
  completed: ['sale', 'done'],
  cancelled: ['cancel'],
};

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year';

const DATE_FILTERS: { key: DateFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'orders.filterAll' },
  { key: 'today', labelKey: 'orders.filterToday' },
  { key: 'week', labelKey: 'orders.filterWeek' },
  { key: 'month', labelKey: 'orders.filterMonth' },
  { key: 'year', labelKey: 'orders.filterYear' },
];

// Start (epoch ms, device local time) of the selected range, or null for "all".
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

const MAX_AVATARS = 2;
const CARD_GAP = 40;

function getStatusBadgeColors(state: string, colors: AppColors) {
  switch (state) {
    case 'done':
      return { bg: colors.successBg, text: colors.success, border: colors.success };
    case 'cancel':
      return { bg: colors.dangerBg, text: colors.danger, border: colors.danger };
    case 'sale':
      return { bg: colors.primaryMuted, text: colors.primary, border: colors.primary };
    case 'draft':
    case 'sent':
    default:
      return { bg: colors.inputBg, text: colors.textMuted, border: colors.border };
  }
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

function ItemAvatars({ count, cardBg, colors }: { count: number; cardBg: string; colors: AppColors }) {
  const palette = [colors.primary, colors.textMuted, colors.success];
  const visible = Math.min(count, MAX_AVATARS);
  const overflow = count - visible;

  return (
    <View style={styles.avatarStack}>
      {Array.from({ length: visible }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.avatar,
            {
              backgroundColor: palette[index % palette.length],
              borderColor: cardBg,
              marginLeft: index === 0 ? 0 : -8,
            },
          ]}
        />
      ))}
      {overflow > 0 ? (
        <View
          style={[
            styles.avatar,
            styles.avatarMore,
            { backgroundColor: colors.border, borderColor: cardBg, marginLeft: visible === 0 ? 0 : -8 },
          ]}>
          <Text style={[styles.avatarMoreText, { color: colors.textMuted }]}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

function OrderCard({
  order,
  itemCount,
  colors,
  lang,
  onPress,
}: {
  order: Order;
  itemCount: number | undefined;
  colors: AppColors;
  lang: Language;
  onPress: () => void;
}) {
  // Visible tinted card — clearly colored, not invisible grey on white.
  const cardBg = colors.primaryMuted;
  const itemsLabel =
    itemCount === undefined
      ? '—'
      : itemCount === 1
        ? lang.t('orders.itemCountOne')
        : lang.t('orders.itemsCount', { count: itemCount });
  const statusBadge = getStatusBadgeColors(order.state, colors);
  const shippingLabel = getOrderShippingLabel(order);
  const shippingPreview = shippingLabel.split('\n').filter(Boolean).slice(0, 2).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: colors.primary,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      {/* Row 1 — date + status badge left, sale order number right */}
      <View style={styles.row}>
        <View style={styles.dateWrap}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={14} color={colors.textMuted} />
          <Text
            numberOfLines={1}
            style={[styles.dateText, { color: colors.textMuted, fontSize: lang.fs(13), lineHeight: lang.lh(13) }]}>
            {new Date(order.date_order).toLocaleString()}
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
              numberOfLines={1}
              style={[
                styles.statusBadgeText,
                { color: statusBadge.text, fontSize: lang.fs(11), lineHeight: lang.lh(11) },
              ]}>
              {getStatusLabel(order.state, lang.t)}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.orderNo, { color: colors.text, fontSize: lang.fs(16), lineHeight: lang.lh(16) }]}>
          {order.name}
        </Text>
      </View>

      {shippingPreview ? (
        <View style={[styles.row, styles.addressRow]}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textMuted} />
          <Text
            numberOfLines={2}
            style={[styles.addressText, { color: colors.textMuted, fontSize: lang.fs(12), lineHeight: lang.lh(12) }]}>
            {shippingPreview}
          </Text>
        </View>
      ) : null}

      {/* Row 2 — items left, price + view details stacked on the right */}
      <View style={[styles.row, styles.rowGap]}>
        <View style={styles.itemsWrap}>
          {itemCount !== undefined && itemCount > 0 ? (
            <ItemAvatars count={itemCount} cardBg={cardBg} colors={colors} />
          ) : null}
          <Text style={[styles.itemsText, { color: colors.textMuted, fontSize: lang.fs(13), lineHeight: lang.lh(13) }]}>
            {itemsLabel}
          </Text>
        </View>

        <View style={styles.rightCol}>
          <Text style={[styles.price, { color: colors.text, fontSize: lang.fs(18), lineHeight: lang.lh(18) }]}>
            {formatPrice(order.amount_total)}
          </Text>
          <View style={styles.viewDetails}>
            <Text style={[styles.viewDetailsText, { color: colors.primary, fontSize: lang.fs(13), lineHeight: lang.lh(13) }]}>
              {lang.t('orders.viewDetails')}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={14} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const lang = useLanguage();
  const { token } = useAuth();

  const [ordersSeed] = useState(() => takeOrdersBootstrap());
  const [orders, setOrders] = useState<Order[]>(ordersSeed ?? []);
  const [itemCounts, setItemCounts] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(!ordersSeed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [dateMenuVisible, setDateMenuVisible] = useState(false);

  const enrichItemCounts = useCallback((list: Order[], authToken: string) => {
    list.forEach(async (order) => {
      try {
        const detail = await fetchOrderById(authToken, order.id);
        setItemCounts((prev) => ({ ...prev, [order.id]: detail.lines.length }));
      } catch {
        // Keep showing "—" for this order.
      }
    });
  }, []);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    const list = await fetchOrders(token);
    setOrders(list);
    setItemCounts({});
    enrichItemCounts(list, token);
  }, [token, enrichItemCounts]);

  useEffect(() => {
    if (ordersSeed && token) {
      enrichItemCounts(ordersSeed, token);
      setIsLoading(false);
      return;
    }

    loadOrders()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load orders.'))
      .finally(() => setIsLoading(false));
  }, [loadOrders, ordersSeed, token, enrichItemCounts]);

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
      if (query && !order.name.toLowerCase().includes(query)) return false;
      if (statusFilter !== 'all' && !STATUS_GROUPS[statusFilter].includes(order.state)) return false;
      if (threshold !== null && new Date(order.date_order).getTime() < threshold) return false;
      return true;
    });
  }, [orders, search, statusFilter, dateFilter]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          style={[styles.searchbar, styles.searchbarFlex, { backgroundColor: colors.card, borderColor: colors.border }]}
          inputStyle={[searchbarInputStyle, styles.searchInput, { color: colors.text }]}
          placeholderTextColor={colors.textMuted}
          iconColor={colors.textMuted}
          elevation={0}
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
        data={filteredOrders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: CARD_GAP }} />}
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
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            itemCount={itemCounts[item.id]}
            colors={colors}
            lang={lang}
            onPress={() => router.push(`/order/${item.id}` as Href)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  searchbar: { borderWidth: 1, borderRadius: 14, height: 48 },
  searchbarFlex: { flex: 1 },
  searchInput: { alignSelf: 'center' },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    maxWidth: 150,
  },
  dateButtonText: { fontWeight: '700', flexShrink: 1 },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 16,
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
  listContent: { paddingHorizontal: 16, paddingBottom: 28 },

  // Each order = its own grey block, NOT one continuous list
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowGap: {
    marginTop: 12,
  },
  addressRow: {
    marginTop: 10,
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontWeight: '500',
  },
  dateWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  dateText: { fontWeight: '500', flexShrink: 1 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontWeight: '700',
  },
  orderNo: { fontWeight: '800', flexShrink: 0 },
  itemsWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  itemsText: { fontWeight: '600' },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  viewDetailsText: { fontWeight: '700' },
  price: { fontWeight: '800' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  avatarMore: { alignItems: 'center', justifyContent: 'center' },
  avatarMoreText: { fontWeight: '800', fontSize: 9 },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16 },
  errorText: { marginBottom: 12, marginHorizontal: 16, textAlign: 'center' },
});
