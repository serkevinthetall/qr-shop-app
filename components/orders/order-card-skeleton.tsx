import { StyleSheet, View } from 'react-native';

import { SkeletonBox } from '@/components/skeleton';
import { useAppColors } from '@/contexts/theme-context';

const CARD_GAP = 40;

export function OrderCardSkeleton() {
  const colors = useAppColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}>
      {/* Date + badge · order number */}
      <View style={styles.topRow}>
        <View style={styles.leftMeta}>
          <SkeletonBox style={styles.calendarDot} borderRadius={4} />
          <SkeletonBox style={styles.dateLine} borderRadius={6} />
          <SkeletonBox style={styles.badge} borderRadius={999} />
        </View>
        <SkeletonBox style={styles.orderNo} borderRadius={6} />
      </View>

      {/* Address */}
      <View style={styles.addressRow}>
        <SkeletonBox style={styles.pinDot} borderRadius={4} />
        <View style={styles.addressLines}>
          <SkeletonBox style={styles.addressLine} borderRadius={6} />
          <SkeletonBox style={styles.addressLineShort} borderRadius={6} />
        </View>
      </View>

      {/* Items · price */}
      <View style={styles.bottomRow}>
        <View style={styles.itemsWrap}>
          <View style={styles.avatarStack}>
            <SkeletonBox style={[styles.avatar, { borderColor: colors.card }]} borderRadius={12} />
            <SkeletonBox
              style={[styles.avatar, styles.avatarOverlap, { borderColor: colors.card }]}
              borderRadius={12}
            />
          </View>
          <SkeletonBox style={styles.itemsText} borderRadius={6} />
        </View>

        <View style={styles.rightCol}>
          <SkeletonBox style={styles.price} borderRadius={6} />
          <SkeletonBox style={styles.viewDetails} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}

export function OrdersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <View key={`order-skel-${index}`} style={index > 0 ? { marginTop: CARD_GAP } : undefined}>
          <OrderCardSkeleton />
        </View>
      ))}
    </View>
  );
}

/** @deprecated Prefer OrdersListSkeleton under the real search/chips chrome. */
export function OrdersScreenSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <SkeletonBox style={styles.searchbar} borderRadius={28} />
        <SkeletonBox style={styles.dateButton} borderRadius={14} />
      </View>

      <View style={styles.chipsRow}>
        <SkeletonBox style={[styles.chip, { width: 56 }]} borderRadius={999} />
        <SkeletonBox style={[styles.chip, { width: 84 }]} borderRadius={999} />
        <SkeletonBox style={[styles.chip, { width: 96 }]} borderRadius={999} />
        <SkeletonBox style={[styles.chip, { width: 90 }]} borderRadius={999} />
      </View>

      <OrdersListSkeleton count={count} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  searchbar: {
    flex: 1,
    height: 48,
  },
  dateButton: {
    width: 56,
    height: 48,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chip: {
    height: 40,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  calendarDot: {
    width: 14,
    height: 14,
  },
  dateLine: {
    width: 118,
    height: 12,
  },
  badge: {
    width: 58,
    height: 22,
  },
  orderNo: {
    width: 78,
    height: 16,
  },
  addressRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  pinDot: {
    width: 14,
    height: 14,
    marginTop: 1,
  },
  addressLines: {
    flex: 1,
    gap: 6,
  },
  addressLine: {
    width: '92%',
    height: 11,
  },
  addressLineShort: {
    width: '64%',
    height: 11,
  },
  bottomRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemsWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderWidth: 2,
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  itemsText: {
    width: 52,
    height: 12,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  price: {
    width: 96,
    height: 18,
  },
  viewDetails: {
    width: 78,
    height: 12,
  },
});
