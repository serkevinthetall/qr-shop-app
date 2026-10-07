import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { QuantityStepper } from '@/components/quantity-stepper';
import { IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { LiquidSurface } from '@/components/liquid-surface';
import { ProductRibbonBadge } from '@/components/products/product-ribbon';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import type { Product } from '@/types/product';
import { formatPrice, getProductImageUri } from '@/types/product';
import { inputCaretProps } from '@/constants/text-input';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import {
  isLiquidUiEnabled,
  liquidGlassBorder,
  liquidGlassFill,
} from '@/utils/liquid-ui';

export function getNameBlockHeight(language: string, fontSize: number) {
  // Grid card title is a single truncated line.
  const lineMultiplier = language === 'my' ? 1.85 : 1.35;
  return Math.ceil(fontSize * lineMultiplier) + 2;
}

export function getProductCardMinHeight(
  cardWidth: number,
  rs: (n: number) => number,
  language: string,
  nameFontSize: number,
) {
  const imageHeight = cardWidth;
  const nameHeight = getNameBlockHeight(language, nameFontSize);
  const contentPadding = 16;
  const bottomRow = Math.max(rs(34), 34);

  return Math.ceil(imageHeight + contentPadding + nameHeight + bottomRow);
}

type CartFeedback = (product: Product) => void;

type ProductCardProps = {
  product: Product;
  onCartFeedback?: CartFeedback;
  onPressCard?: () => void;
  width?: number;
};

function useProductCartQty(productId: number) {
  const { productItems } = useCart();
  return productItems.find((item) => item.product.id === productId)?.quantity ?? 0;
}

function CardQtyControl({
  product,
  onCartFeedback,
}: {
  product: Product;
  onCartFeedback?: CartFeedback;
}) {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs } = useResponsive();
  const { addToCart, updateQuantity, removeFromCart } = useCart();
  const quantity = useProductCartQty(product.id);
  const btnSize = Math.max(rs(32), 32);
  const [draft, setDraft] = useState(String(quantity));
  const inputRef = useRef<TextInput>(null);
  const liquid = isLiquidUiEnabled();

  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  const bumpFeedback = () => {
    onCartFeedback?.(product);
  };

  const applyQuantity = (next: number) => {
    if (next <= 0) {
      removeFromCart(product.id);
      return;
    }

    updateQuantity(product.id, next);
  };

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);

    if (!Number.isFinite(parsed)) {
      setDraft(String(quantity));
      return;
    }

    applyQuantity(parsed);
    setDraft(String(Math.max(parsed, 0)));
  };

  const handlePlus = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();

    if (quantity <= 0) {
      hapticSuccess();
      addToCart(product, 1);
      bumpFeedback();
      return;
    }

    hapticLight();
    updateQuantity(product.id, quantity + 1);
  };

  const handleMinus = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    hapticLight();

    if (quantity <= 1) {
      removeFromCart(product.id);
      return;
    }
    updateQuantity(product.id, quantity - 1);
  };

  if (quantity <= 0) {
    const radius = btnSize / 2;
    const solidPrimary = colors.primary.length === 7 ? colors.primary : '#2A9D98';

    return (
      <Pressable
        onPress={handlePlus}
        accessibilityRole="button"
        accessibilityLabel="Add to cart"
        style={[
          styles.plusOnly,
          {
            width: btnSize,
            height: btnSize,
            borderRadius: radius,
            backgroundColor: solidPrimary,
          },
        ]}>
        {/* Fake glass over the full button — solid teal stays underneath. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.plusGlassCover,
            { borderRadius: radius },
          ]}
        />
        <MaterialCommunityIcons name="plus" size={rs(22)} color="#FFFFFF" />
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.qtyPill,
        {
          backgroundColor: liquid ? liquidGlassFill(isDark) : colors.inputBg,
        },
      ]}>
      <Pressable
        onPress={handleMinus}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        style={[
          styles.pillSideBtn,
          {
            width: btnSize - 4,
            height: btnSize - 4,
            borderRadius: (btnSize - 4) / 2,
            backgroundColor: colors.card,
          },
        ]}>
        <MaterialCommunityIcons name="minus" size={rs(18)} color={colors.text} />
      </Pressable>

      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={(text) => setDraft(text.replace(/\D/g, ''))}
        onBlur={commitDraft}
        onSubmitEditing={() => {
          commitDraft();
          inputRef.current?.blur();
          Keyboard.dismiss();
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={6}
        accessibilityLabel="Quantity"
        style={[styles.qtyInput, { color: colors.text, fontSize: rs(14), lineHeight: rs(18) }]}
        {...inputCaretProps(isDark)}
      />

      <Pressable
        onPress={handlePlus}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        style={[
          styles.pillSideBtn,
          {
            width: btnSize - 4,
            height: btnSize - 4,
            borderRadius: (btnSize - 4) / 2,
            backgroundColor: colors.primary,
          },
        ]}>
        <MaterialCommunityIcons name="plus" size={rs(18)} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

export function ProductCard({ product, onCartFeedback, onPressCard, width }: ProductCardProps) {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs } = useResponsive();
  const { fs, language } = useLanguage();
  const imageUri = getProductImageUri(product);
  const nameFontSize = fs(rs(14));
  const cardMinHeight =
    width != null ? getProductCardMinHeight(width, rs, language, nameFontSize) : undefined;
  const liquid = isLiquidUiEnabled();

  return (
    <LiquidSurface
      remountKey={product.id}
      contentMode="backdrop"
      style={[
        styles.card,
        {
          borderColor: liquid ? liquidGlassBorder(isDark) : colors.border,
          width: width ?? '48%',
          minHeight: cardMinHeight,
          backgroundColor: liquid ? undefined : colors.card,
          // Don't clip GlassView — use cornerRadius on the effect instead.
          overflow: liquid ? 'visible' : 'hidden',
        },
      ]}
      backgroundColor={colors.card}
      cornerRadius={16}
      glassStyle="regular">
      <Pressable onPress={onPressCard} disabled={!onPressCard}>
        <View style={[styles.imageWrap, { backgroundColor: colors.inputBg }]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {product.ribbon ? <ProductRibbonBadge ribbon={product.ribbon} /> : null}
        </View>

        <View style={styles.nameWrap}>
          <Text
            style={[styles.name, { color: colors.text, fontSize: nameFontSize }]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {product.name}
          </Text>
        </View>
      </Pressable>

      <View style={styles.bottomRow}>
        <Text style={[styles.price, { color: colors.text, fontSize: rs(15) }]} numberOfLines={1}>
          {formatPrice(product.list_price)}
        </Text>
        <CardQtyControl product={product} onCartFeedback={onCartFeedback} />
      </View>
    </LiquidSurface>
  );
}

type ProductListItemProps = {
  product: Product;
  onCartFeedback?: CartFeedback;
  onPressCard?: () => void;
};

export function ProductListItem({ product, onCartFeedback, onPressCard }: ProductListItemProps) {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs } = useResponsive();
  const { fs } = useLanguage();
  const imageUri = getProductImageUri(product);
  const liquid = isLiquidUiEnabled();

  return (
    <LiquidSurface
      remountKey={`list-${product.id}`}
      contentMode="backdrop"
      style={[
        styles.listItem,
        {
          borderColor: liquid ? liquidGlassBorder(isDark) : colors.border,
          backgroundColor: liquid ? undefined : colors.card,
          overflow: liquid ? 'visible' : 'hidden',
        },
      ]}
      backgroundColor={colors.card}
      cornerRadius={16}
      glassStyle="regular">
      <Pressable
        onPress={onPressCard}
        disabled={!onPressCard}
        style={styles.listMainPress}>
        <View style={[styles.listImageWrap, { backgroundColor: colors.inputBg }]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.listImage}
            contentFit="cover"
            transition={200}
          />
          {product.ribbon ? <ProductRibbonBadge ribbon={product.ribbon} /> : null}
        </View>

        <View style={styles.listTextCol}>
          <Text
            style={[styles.listName, { color: colors.text, fontSize: fs(rs(14)) }]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {product.name}
          </Text>
          <Text style={[styles.price, { color: colors.text, fontSize: rs(15) }]} numberOfLines={1}>
            {formatPrice(product.list_price)}
          </Text>
        </View>
      </Pressable>

      <View style={styles.listQtyWrap}>
        <CardQtyControl product={product} onCartFeedback={onCartFeedback} />
      </View>
    </LiquidSurface>
  );
}

type CartLineItemProps = {
  product: Product;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function CartLineItem({
  product,
  quantity,
  onQuantityChange,
  onRemove,
}: CartLineItemProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { fs, lh } = useLanguage();
  const imageUri = getProductImageUri(product);
  const opacity = useRef(new Animated.Value(1)).current;

  const animateAndRemove = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
      );
      onRemove();
    });
  };

  const handleDecreaseAtMin = () => {
    animateAndRemove();
  };

  return (
    <Animated.View style={[styles.cartItem, { opacity }]}>
      <View style={[styles.cartImageWrap, { backgroundColor: colors.inputBg }]}>
        <Image
          source={{ uri: imageUri }}
          style={styles.cartImage}
          contentFit="cover"
          transition={200}
        />
      </View>

      <View style={styles.cartContent}>
        <View style={styles.cartTopRow}>
          <Text
            style={[styles.cartName, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}
            numberOfLines={2}>
            {product.name}
          </Text>
          <IconButton
            icon="trash-can-outline"
            size={20}
            iconColor={colors.danger}
            onPress={animateAndRemove}
            style={styles.trashButton}
          />
        </View>

        <View style={styles.cartBottomRow}>
          <Text style={[styles.cartPrice, { color: colors.primary, fontSize: rs(16) }]}>
            {formatPrice(product.list_price * quantity)}
          </Text>

          <QuantityStepper
            value={quantity}
            onChange={onQuantityChange}
            onDecreaseAtMin={handleDecreaseAtMin}
            fontSize={rs(15)}
            iconSize={16}
            borderColor={colors.border}
            backgroundColor={colors.inputBg}
            textColor={colors.text}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  nameWrap: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  name: {
    fontWeight: '700',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  price: {
    flexShrink: 1,
    fontWeight: '700',
  },
  plusOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  /** Full-button fake frost on top of solid primary. */
  plusGlassCover: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 3,
    paddingVertical: 3,
    gap: 2,
  },
  pillSideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    minWidth: 28,
    paddingHorizontal: 4,
    paddingVertical: 0,
    textAlign: 'center',
    fontWeight: '700',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : { includeFontPadding: false }),
  },
  listItem: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  listMainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  listImageWrap: {
    width: 90,
    height: 90,
    overflow: 'hidden',
    borderRadius: 12,
    position: 'relative',
  },
  listImage: {
    width: '100%',
    height: '100%',
  },
  listTextCol: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
    justifyContent: 'center',
    gap: 8,
  },
  listName: {
    fontWeight: '700',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  listQtyWrap: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 2,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  cartImageWrap: {
    width: 68,
    height: 68,
    overflow: 'hidden',
    borderRadius: 16,
  },
  cartImage: {
    width: '100%',
    height: '100%',
  },
  cartContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  cartTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cartName: {
    flex: 1,
    marginRight: 8,
    fontWeight: '700',
  },
  trashButton: {
    margin: 0,
    marginTop: -4,
    width: 36,
    height: 36,
  },
  cartPrice: {
    fontWeight: '700',
  },
  cartBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
