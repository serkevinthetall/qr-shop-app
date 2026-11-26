import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeaderBar } from '@/components/detail-header-bar';
import { LiquidSurface } from '@/components/liquid-surface';
import { useChat } from '@/contexts/chat-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import type { ChatThread } from '@/services/chat-api';
import { isLiquidUiEnabled, liquidGlassBorder } from '@/utils/liquid-ui';

function formatThreadTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || 'SH').toUpperCase();
}

export default function MessagesScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { t, fs, lh } = useLanguage();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { threads, isLoading, refresh } = useChat();
  const liquid = isLiquidUiEnabled();
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const openThread = (thread: ChatThread) => {
    if (!thread.shopId) return;
    router.push(`/chat/${encodeURIComponent(thread.shopId)}` as Href);
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={liquid ? ['bottom'] : ['top', 'bottom']}>
      <DetailHeaderBar title={t('messages.title')} />
      {isLoading && threads.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primaryMuted }]}>
            <MaterialIcons name="chat-bubble" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>
            {t('messages.empty')}
          </Text>
          <Text
            style={[
              styles.emptyBody,
              { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13), maxWidth: contentMaxWidth },
            ]}>
            {t('messages.emptyBody')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 12,
            paddingBottom: 28,
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
            gap: 10,
          }}
          renderItem={({ item }) => {
            const unread = Number(item.unread) || 0;
            const title = item.shopName?.trim() || t('messages.shopFallback');
            return (
              <Pressable onPress={() => openThread(item)}>
                <LiquidSurface
                  style={[styles.row, { borderColor: cardBorder }]}
                  backgroundColor={colors.card}
                  glassStyle="regular"
                  interactive>
                  <View style={[styles.avatar, { backgroundColor: colors.primaryMuted }]}>
                    {item.shopLogoUrl ? (
                      <Image
                        source={{ uri: item.shopLogoUrl }}
                        style={styles.avatarImage}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={[styles.avatarText, { color: colors.primary, fontSize: fs(rs(13)) }]}>
                        {initialsFromName(title)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Text
                        style={[styles.rowTitle, { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) }]}
                        numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={[styles.rowTime, { color: colors.textMuted, fontSize: fs(11) }]}>
                        {formatThreadTime(item.lastAt)}
                      </Text>
                    </View>
                    <View style={styles.rowTop}>
                      <Text
                        style={[
                          styles.rowPreview,
                          {
                            color: unread > 0 ? colors.text : colors.textMuted,
                            fontWeight: unread > 0 ? '600' : '400',
                            fontSize: fs(13),
                          },
                        ]}
                        numberOfLines={1}>
                        {item.lastMessage?.trim() || t('messages.noMessagesYet')}
                      </Text>
                      {unread > 0 ? (
                        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                          <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                            {unread > 9 ? '9+' : unread}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </LiquidSurface>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontWeight: '700', textAlign: 'center' },
  emptyBody: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontWeight: '800' },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontWeight: '700' },
  rowTime: {},
  rowPreview: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
