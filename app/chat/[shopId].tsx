import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidSurface } from '@/components/liquid-surface';
import { inputCaretProps } from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useChat } from '@/contexts/chat-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { getUserFacingError } from '@/services/auth-error';
import {
  openChatWithShop,
  sendChatMessage,
  type ChatMessage,
  type PendingChatProduct,
} from '@/services/chat-api';
import {
  clearPendingChatProduct,
  takePendingChatProduct,
} from '@/services/chat-pending';
import { fetchProductsForShop } from '@/services/product-api';
import { rememberProductPreview } from '@/services/product-preview-cache';
import type { Product } from '@/types/product';
import {
  formatPrice,
  getProductImageUri,
  unitPriceForQty,
} from '@/types/product';
import {
  isLiquidUiEnabled,
  liquidDetailHeaderTint,
  liquidGlassBorder,
  liquidGlassFill,
} from '@/utils/liquid-ui';

function formatBubbleTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || 'SH').toUpperCase();
}

function productToPending(p: Product): PendingChatProduct {
  return {
    /** SKU id (not mall composite) so Merchant can open the same product. */
    productId: p.productId || p.id,
    name: p.name,
    priceLabel: formatPrice(unitPriceForQty(p, 1)),
    imageUrl: getProductImageUri(p) || undefined,
  };
}

function mallProductHref(productId: string, shopId: string) {
  const id = String(productId || '').trim();
  if (!id) return null;
  if (id.includes('__')) return `/product/${encodeURIComponent(id)}`;
  if (shopId) return `/product/${encodeURIComponent(`${shopId}__${id}`)}`;
  return `/product/${encodeURIComponent(id)}`;
}

export default function ChatThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { token } = useAuth();
  const { refresh: refreshInbox } = useChat();
  const { t, fs, lh } = useLanguage();
  const { rs } = useResponsive();
  const params = useLocalSearchParams<{ shopId: string }>();
  const shopId = typeof params.shopId === 'string' ? decodeURIComponent(params.shopId) : '';

  const liquid = isLiquidUiEnabled();
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [shopName, setShopName] = useState(t('messages.shopFallback'));
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<PendingChatProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    setAttached(takePendingChatProduct(shopId));
  }, [shopId]);

  const reload = useCallback(async () => {
    if (!token || !shopId) return;
    try {
      const thread = await openChatWithShop(token, shopId);
      setShopName(thread.shopName?.trim() || t('messages.shopFallback'));
      setShopLogoUrl(thread.shopLogoUrl?.trim() || null);
      setMessages(Array.isArray(thread.messages) ? thread.messages : []);
      setError('');
      void refreshInbox();
    } catch (err) {
      const message = getUserFacingError(err, t('messages.loadFailed'), t);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, shopId, t, refreshInbox]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void reload();
      const id = setInterval(() => {
        void reload();
      }, 12000);
      return () => clearInterval(id);
    }, [reload]),
  );

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, [messages.length]);

  const openPicker = async () => {
    setPickerOpen(true);
    if (shopProducts.length || !token || !shopId) return;
    setPickerLoading(true);
    try {
      const rows = await fetchProductsForShop(shopId, token);
      setShopProducts(rows);
    } catch {
      /* empty picker */
    } finally {
      setPickerLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return shopProducts;
    return shopProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [shopProducts, pickerQuery]);

  const clearAttach = () => {
    setAttached(null);
    if (shopId) clearPendingChatProduct(shopId);
  };

  const openProduct = (productId?: string | null) => {
    const href = mallProductHref(String(productId || ''), shopId);
    if (!href) return;
    router.push(href as Href);
  };

  const openShop = () => {
    if (!shopId) return;
    const qs = new URLSearchParams();
    if (shopName) qs.set('name', shopName);
    if (shopLogoUrl) qs.set('logo', shopLogoUrl);
    const q = qs.toString();
    router.push(`/shop/${encodeURIComponent(shopId)}${q ? `?${q}` : ''}` as Href);
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !attached) || !token || !shopId || sending) return;

    const bodyText =
      text ||
      (attached ? t('messages.askAboutProduct', { name: attached.name }) : '');

    setSending(true);
    setDraft('');
    const product = attached;
    clearAttach();

    try {
      await sendChatMessage(token, shopId, {
        text: bodyText,
        productId: product?.productId,
        productName: product?.name,
        productImageUrl: product?.imageUrl,
        productPriceLabel: product?.priceLabel,
        channel: 'app',
      });
      await reload();
    } catch (err) {
      const message = getUserFacingError(err, t('messages.sendFailed'), t);
      if (message) setError(message);
    } finally {
      setSending(false);
    }
  };

  const titleColor = liquid && !isDark ? '#111827' : colors.text;
  const iconColor = liquid && !isDark ? '#111827' : colors.text;
  const canSend = Boolean(draft.trim() || attached) && !sending;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LiquidSurface
        style={[
          styles.headerBar,
          {
            borderBottomColor: liquid ? 'transparent' : colors.border,
            borderBottomWidth: liquid ? 0 : StyleSheet.hairlineWidth,
            paddingTop: insets.top + 10,
          },
        ]}
        backgroundColor={colors.surface}
        tintColor={liquid ? liquidDetailHeaderTint(isDark) : undefined}
        glassStyle="regular">
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={iconColor} />
        </Pressable>

        <Pressable onPress={openShop} style={styles.headerIdentity} hitSlop={4}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryMuted }]}>
            {shopLogoUrl ? (
              <Image source={{ uri: shopLogoUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: fs(12) }}>
                {initialsFromName(shopName)}
              </Text>
            )}
          </View>
          <View style={styles.headerText}>
            <Text
              style={[styles.headerTitle, { color: titleColor, fontSize: fs(rs(16)), lineHeight: lh(16) }]}
              numberOfLines={1}>
              {shopName}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fs(12) }}>{t('messages.shopChat')}</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={openShop}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityLabel={t('messages.openShop')}>
          <MaterialIcons name="storefront" size={22} color={colors.primary} />
        </Pressable>
      </LiquidSurface>

      {loading && messages.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            error ? (
              <Text style={[styles.error, { color: colors.danger, fontSize: fs(13) }]}>{error}</Text>
            ) : (
              <View />
            )
          }
          ListEmptyComponent={
            <Text style={[styles.emptyHint, { color: colors.textMuted, fontSize: fs(13) }]}>
              {t('messages.threadEmpty')}
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.from === 'buyer';
            const hasProduct = Boolean(item.productName?.trim());
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? colors.primary : colors.card,
                      borderColor: mine ? colors.primary : cardBorder,
                    },
                  ]}>
                  {hasProduct ? (
                    <Pressable
                      onPress={() => openProduct(item.productId)}
                      style={[
                        styles.productCard,
                        {
                          backgroundColor: mine ? 'rgba(255,255,255,0.15)' : colors.inputBg,
                        },
                      ]}>
                      {item.productImageUrl ? (
                        <Image source={{ uri: item.productImageUrl }} style={styles.productImage} />
                      ) : (
                        <View style={[styles.productImage, { alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialIcons name="inventory-2" size={18} color={mine ? colors.onPrimary : colors.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            color: mine ? colors.onPrimary : colors.text,
                            fontWeight: '700',
                            fontSize: fs(13),
                          }}
                          numberOfLines={2}>
                          {item.productName}
                        </Text>
                        {item.productPriceLabel ? (
                          <Text
                            style={{
                              color: mine ? colors.onPrimary : colors.primary,
                              fontSize: fs(12),
                              marginTop: 2,
                            }}>
                            {item.productPriceLabel}
                          </Text>
                        ) : null}
                      </View>
                      <MaterialIcons
                        name="chevron-right"
                        size={18}
                        color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted}
                      />
                    </Pressable>
                  ) : null}
                  {item.text ? (
                    <Text style={{ color: mine ? colors.onPrimary : colors.text, fontSize: fs(14) }}>
                      {item.text}
                    </Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    <Text
                      style={{
                        color: mine ? 'rgba(255,255,255,0.75)' : colors.textMuted,
                        fontSize: fs(10),
                      }}>
                      {formatBubbleTime(item.createdAt)}
                    </Text>
                    {mine ? (
                      <MaterialIcons
                        name="done-all"
                        size={14}
                        color={item.read ? '#86efac' : 'rgba(255,255,255,0.55)'}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {attached ? (
        <View
          style={[
            styles.attachBar,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}>
          {attached.imageUrl ? (
            <Image source={{ uri: attached.imageUrl }} style={styles.attachThumb} />
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: fs(13) }} numberOfLines={1}>
              {attached.name}
            </Text>
            <Text style={{ color: colors.primary, fontSize: fs(12) }}>{attached.priceLabel}</Text>
          </View>
          <Pressable onPress={clearAttach} hitSlop={8}>
            <MaterialIcons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}>
        <Pressable
          onPress={() => {
            void openPicker();
          }}
          style={[
            styles.attachBtn,
            { backgroundColor: colors.primaryMuted },
          ]}
          accessibilityLabel={t('messages.attachProduct')}>
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('messages.placeholder')}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: liquid ? liquidGlassFill(isDark) : colors.inputBg,
              borderColor: cardBorder,
              fontSize: fs(15),
            },
          ]}
          multiline
          {...inputCaretProps(isDark)}
        />
        <Pressable
          onPress={() => {
            void send();
          }}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? colors.primary : colors.border },
          ]}>
          {sending ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <MaterialIcons name="send" size={20} color={colors.onPrimary} />
          )}
        </Pressable>
      </View>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalScrim} onPress={() => setPickerOpen(false)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            <View style={styles.modalHeader}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: fs(17) }}>
                {t('messages.attachProductTitle')}
              </Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <View
              style={[
                styles.searchRow,
                { borderColor: cardBorder, backgroundColor: colors.inputBg },
              ]}>
              <MaterialIcons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={pickerQuery}
                onChangeText={setPickerQuery}
                placeholder={t('messages.searchProducts')}
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, color: colors.text, fontSize: fs(14), paddingVertical: 8 }}
                {...inputCaretProps(isDark)}
              />
            </View>
            {pickerLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
                {filteredProducts.length === 0 ? (
                  <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: 28 }}>
                    {t('messages.noProductsFound')}
                  </Text>
                ) : (
                  filteredProducts.map((p) => {
                    const card = productToPending(p);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setAttached(card);
                          rememberProductPreview(p);
                          setPickerOpen(false);
                          setPickerQuery('');
                        }}
                        style={[styles.pickerRow, { borderColor: cardBorder }]}>
                        {card.imageUrl ? (
                          <Image source={{ uri: card.imageUrl }} style={styles.pickerThumb} />
                        ) : (
                          <View style={[styles.pickerThumb, { backgroundColor: colors.primaryMuted }]} />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: fs(14) }} numberOfLines={2}>
                            {card.name}
                          </Text>
                          <Text style={{ color: colors.primary, fontSize: fs(13), marginTop: 2 }}>
                            {card.priceLabel}
                          </Text>
                        </View>
                        <MaterialIcons name="add" size={20} color={colors.primary} />
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 12, gap: 10, flexGrow: 1 },
  emptyHint: { textAlign: 'center', marginTop: 40 },
  error: { textAlign: 'center', marginBottom: 8 },
  bubbleRow: { width: '100%' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubbleRowTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  productCard: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  productImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.08)' },
  metaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  attachBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachThumb: { width: 40, height: 40, borderRadius: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: {
    width: 40,
    height: 40,
    marginBottom: 2,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    marginBottom: 2,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  pickerThumb: { width: 48, height: 48, borderRadius: 10 },
});
