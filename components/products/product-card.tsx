import { Image } from 'expo-image';
import { useRef } from 'react';
import { Animated, LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { MYANMAR_FONTS } from '@/constants/fonts';
import { ProductRibbonBadge } from '@/components/products/product-ribbon';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import type { Product } from '@/types/product';
import { formatPrice, getProductImageCacheKey, getProductImageUri } from '@/types/product';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function addToCartLabelStyle(language: string, rs: (n: number) => number) {
  if (language === 'my') {
    return {
      fontSize: rs(10),
      lineHeight: undefined,
      fontFamily: MYANMAR_FONTS.medium,
      marginVertical: 0,
    };
  }

  return {
    fontSize: rs(12),
    fontWeight: '600' as const,
  };
}

function createAddToCartIcon(rs: (n: number) => number) {
  const iconSize = rs(15);

  return ({ color }: { size: number; color: string }) => (
    <MaterialCommunityIcons name="cart-plus" size={iconSize} color={color} />
  );
}

export function getNameBlockHeight(language: string, fontSize: number) {
  // Burmese uses natural line metrics (no lineHeight), so reserve extra vertical space.
  const lineMultiplier = language === 'my' ? 1.52 : 1.36;
  return Math.ceil(fontSize * lineMultiplier * 2);
}

export function getProductCardMinHeight(
  cardWidth: number,
  rs: (n: number) => number,
  language: string,
  nameFontSize: number,
) {
  const imageHeight = cardWidth / 1.2;
  const nameHeight = getNameBlockHeight(language, nameFontSize);
  const contentPadding = 16;
  const priceBlock = rs(16) + 2;
  const buttonBlock = 46;

  return Math.ceil(imageHeight + contentPadding + nameHeight + priceBlock + buttonBlock);
}

type ProductCardProps = {
  product: Product;
  onAddToCart: (product: Product) => void;
  width?: number;
};

export function ProductCard({ product, onAddToCart, width }: ProductCardProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, language } = useLanguage();
  const imageUri = getProductImageUri(product);
  const imageCacheKey = getProductImageCacheKey(product);
  const nameFontSize = fs(rs(14));
  const nameHeight = getNameBlockHeight(language, nameFontSize);
  const cardMinHeight =
    width != null ? getProductCardMinHeight(width, rs, language, nameFontSize) : undefined;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          width: width ?? '48%',
          minHeight: cardMinHeight,
        },
      ]}>
      <View style={[styles.imageWrap, { backgroundColor: colors.inputBg }]}>
        <Image
          source={{ uri: imageUri }}
          cacheKey={imageCacheKey}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        {product.ribbon ? <ProductRibbonBadge ribbon={product.ribbon} /> : null}
      </View>

      <View style={styles.content}>
        <View style={[styles.nameWrap, { height: nameHeight }]}>
          <Text
            style={[styles.name, { color: colors.text, fontSize: nameFontSize }]}
            numberOfLines={2}>
            {product.name}
          </Text>
        </View>
        <Text style={[styles.price, { color: colors.primary, fontSize: rs(16) }]}>
          {formatPrice(product.list_price)}
        </Text>

        <Button
          mode="contained"
          icon={createAddToCartIcon(rs)}
          onPress={() => onAddToCart(product)}
          style={styles.addButton}
          contentStyle={styles.addButtonContent}
          labelStyle={[styles.addButtonLabel, addToCartLabelStyle(language, rs)]}>
          {t('products.addToCart')}
        </Button>
      </View>
    </View>
  );
}

type ProductListItemProps = {
  product: Product;
  onAddToCart: (product: Product) => void;
};

export function ProductListItem({ product, onAddToCart }: ProductListItemProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh, language } = useLanguage();
  const imageUri = getProductImageUri(product);
  const imageCacheKey = getProductImageCacheKey(product);

  return (
    <View style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.listImageWrap, { backgroundColor: colors.inputBg }]}>
        <Image
          source={{ uri: imageUri }}
          cacheKey={imageCacheKey}
          style={styles.listImage}
          contentFit="cover"
          transition={200}
        />
        {product.ribbon ? <ProductRibbonBadge ribbon={product.ribbon} /> : null}
      </View>

      <View style={styles.listContent}>
        <Text style={[styles.cartName, { color: colors.text, fontSize: fs(rs(14)), lineHeight: lh(14) }]} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={[styles.cartPrice, { color: colors.primary, fontSize: rs(15) }]}>
          {formatPrice(product.list_price)}
        </Text>

        <Button
          mode="contained"
          icon={createAddToCartIcon(rs)}
          onPress={() => onAddToCart(product)}
          style={styles.listAddButton}
          contentStyle={styles.addButtonContent}
          labelStyle={[styles.addButtonLabel, addToCartLabelStyle(language, rs)]}>
          {t('products.addToCart')}
        </Button>
      </View>
    </View>
  );
}

type CartLineItemProps = {
  product: Product;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

export function CartLineItem({
  product,
  quantity,
  onIncrease,
  onDecrease,
  onRemove,
}: CartLineItemProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { fs, lh } = useLanguage();
  const imageUri = getProductImageUri(product);
  const imageCacheKey = getProductImageCacheKey(product);
  const opacity = useRef(new Animated.Value(1)).current;

  const animateAndRemove = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      // Collapse the gap left behind so the rows below slide up smoothly.
      LayoutAnimation.configureNext(
        LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
      );
      onRemove();
    });
  };

  const handleDecrease = () => {
    if (quantity <= 1) {
      animateAndRemove();
    } else {
      onDecrease();
    }
  };

  return (
    <Animated.View style={[styles.cartItem, { opacity }]}>
      <View style={[styles.cartImageWrap, { backgroundColor: colors.inputBg }]}>
        <Image
          source={{ uri: imageUri }}
          cacheKey={imageCacheKey}
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

          <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
            <IconButton
              icon="minus"
              size={16}
              onPress={handleDecrease}
              iconColor={colors.text}
              style={styles.stepperButton}
            />
            <Text style={[styles.stepperText, { color: colors.text, fontSize: rs(15) }]}>{quantity}</Text>
            <IconButton
              icon="plus"
              size={16}
              onPress={onIncrease}
              iconColor={colors.text}
              style={styles.stepperButton}
            />
          </View>
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
    borderRadius: 14,
    borderWidth: 1,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  name: {
    fontWeight: '600',
  },
  nameWrap: {
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  price: {
    marginTop: 2,
    fontWeight: '700',
  },
  addButton: {
    marginTop: 'auto',
    paddingTop: 6,
  },
  addButtonContent: {
    height: 40,
    paddingHorizontal: 8,
  },
  addButtonLabel: {
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
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
  listContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listAddButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
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
    marginTop: -6,
    marginRight: -6,
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  stepperButton: {
    margin: 0,
  },
  stepperText: {
    minWidth: 28,
    textAlign: 'center',
    fontWeight: '700',
  },
});
