import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/language-context';
import { useNotifications } from '@/contexts/notification-context';
import { useAppColors } from '@/contexts/theme-context';
import { notificationDateToMs, type AppNotification } from '@/services/notification-api';
import { formatPrice } from '@/types/product';

function useRelativeTime() {
  const { t } = useLanguage();

  return (date: string) => {
    const ms = notificationDateToMs(date);

    if (!ms) {
      return '';
    }

    const diff = Date.now() - ms;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
      return t('notifications.justNow');
    }

    if (minutes < 60) {
      return t('notifications.minutesAgo', { count: minutes });
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return t('notifications.hoursAgo', { count: hours });
    }

    const days = Math.floor(hours / 24);
    return t('notifications.daysAgo', { count: days });
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { t, fs, lh } = useLanguage();
  const { notifications, isLoading, error, refresh, markAllSeen } = useNotifications();
  const getRelativeTime = useRelativeTime();

  // Opening the screen clears the unread badge.
  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const isProduct = item.type === 'product';
    const title =
      item.type === 'product'
        ? t('notifications.productOccurredTitle', {
            ribbon: item.ribbon_name?.trim() || t('notifications.newProductTitle'),
          })
        : t('notifications.newCouponTitle');
    const body =
      item.type === 'product'
        ? `${item.product_name} — ${t('notifications.newProductBody')}`
        : t('notifications.newCouponBody', { code: item.coupon_code });

    const onPress = () => {
      if (item.type === 'product') {
        router.push(`/product/${item.product_id}` as Href);
      }
    };

    return (
      <Pressable
        onPress={onPress}
        style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
          <MaterialIcons
            name={isProduct ? 'local-mall' : 'confirmation-number'}
            size={22}
            color={colors.primary}
          />
        </View>
        <View style={styles.itemBody}>
          <Text style={[styles.itemTitle, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}>
            {title}
          </Text>
          <Text style={[styles.itemText, { color: colors.textMuted, fontSize: fs(13) }]}>{body}</Text>
          {item.type === 'coupon' ? (
            <Text style={[styles.itemMeta, { color: colors.primary, fontSize: fs(12), lineHeight: lh(12) }]}>
              {t('notifications.couponAmount', { amount: formatPrice(item.amount) })}
            </Text>
          ) : null}
          <Text style={[styles.itemTime, { color: colors.textMuted, fontSize: fs(11), lineHeight: lh(11) }]}>
            {getRelativeTime(item.date)}
          </Text>
        </View>
        {item.type === 'product' ? (
          <MaterialIcons name="chevron-right" size={16} color={colors.textMuted} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(20), lineHeight: lh(20) }]} numberOfLines={1}>
          {t('notifications.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onRefresh={refresh}
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[styles.empty, { color: colors.textMuted, fontSize: fs(14), lineHeight: lh(14) }]}>
              {error || t('notifications.empty')}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: '700',
  },
  itemText: {
    marginTop: 3,
  },
  itemMeta: {
    marginTop: 4,
    fontWeight: '600',
  },
  itemTime: {
    marginTop: 6,
  },
  empty: {
    textAlign: 'center',
    marginTop: 48,
  },
});
