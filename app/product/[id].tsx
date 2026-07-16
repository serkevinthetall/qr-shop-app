import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';

import { AppToast } from '@/components/app-toast';
import { useCart } from '@/contexts/cart-context';
import { ProductRibbonBadge } from '@/components/products/product-ribbon';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { onCatalogRefreshRequested } from '@/services/catalog-events';
import { fetchProductById } from '@/services/product-api';
import { getProductPreview, rememberProductPreview } from '@/services/product-preview-cache';
import type { Product } from '@/types/product';
import { formatPrice, getProductImageCacheKey, getProductImageUri } from '@/types/product';
import { getProductDescription, getProductDescriptionSections } from '@/utils/product-text';

export default function ProductDetailScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { fs, lh, language } = useLanguage();
  const { addToCart } = useCart();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);

  const labels =
    language === 'my'
      ? {
          back: 'နောက်သို့',
          description: 'ဖော်ပြချက်',
          longDescription: 'အသေးစိတ် ဖော်ပြချက်',
          internalNotes: 'အတွင်းမှတ်ချက်',
          noDescription: 'ဖော်ပြချက် မရှိပါ။',
          similar: 'ဆင်တူ ပစ္စည်းများ',
          addToCart: 'ခြင်းထဲ ထည့်ရန်',
          notFound: 'ပစ္စည်း မတွေ့ပါ။',
          added: 'စျေးခြင်းထဲ ထည့်ပြီးပါပြီ',
        }
      : {
          back: 'Back',
          description: 'Description',
          longDescription: 'Long Description',
          internalNotes: 'Internal Notes',
          noDescription: 'No description available.',
          similar: 'Similar Products',
          addToCart: 'Add to Cart',
          notFound: 'Product not found.',
          added: 'Added to cart',
        };

  const languageRef = useRef(language);
  const [product, setProduct] = useState<Product | null>(() =>
    Number.isFinite(productId) ? getProductPreview(productId) : null,
  );
  const [similar, setSimilar] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(() => !getProductPreview(productId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const loadProduct = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!Number.isFinite(productId)) {
        return;
      }

      const hasPreview = !!getProductPreview(productId);

      if (!options?.silent && !hasPreview) {
        setIsLoading(true);
        setError('');
      } else if (options?.silent && hasPreview) {
        setIsRefreshing(true);
      }

      try {
        const data = await fetchProductById(productId);

        if (data.product) {
          rememberProductPreview(data.product);
          setProduct(data.product);
        } else if (!options?.silent && !hasPreview) {
          setProduct(null);
          setError(
            languageRef.current === 'my' ? 'ပစ္စည်း မတွေ့ပါ။' : 'Product not found.',
          );
        }

        setSimilar(data.similarProducts.filter((item) => item.id !== data.product?.id));
      } catch (err) {
        if (!options?.silent && !hasPreview) {
          setError(err instanceof Error ? err.message : 'Failed to load product.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [productId],
  );

  useEffect(() => {
    setQuantity(1);

    const preview = getProductPreview(productId);

    if (preview) {
      setProduct(preview);
      setIsLoading(false);
    } else {
      setProduct(null);
      setIsLoading(true);
    }

    loadProduct({ silent: !!preview });
  }, [productId, loadProduct]);

  useEffect(() => {
    return onCatalogRefreshRequested(() => {
      if (!Number.isFinite(productId)) {
        return;
      }

      loadProduct({ silent: true }).catch(() => {});
    });
  }, [loadProduct, productId]);

  const handleAddToCart = () => {
    if (!product) {
      return;
    }

    addToCart(product, quantity);
    setSnackbar(labels.added);
  };

  const openSimilarProduct = (item: Product) => {
    rememberProductPreview(item);
    router.push(`/product/${item.id}` as Href);
  };

  if (isLoading && !product) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(20), lineHeight: lh(20) }]}>
            {labels.back}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <Text style={[styles.errorText, { color: colors.danger, lineHeight: lh(14) }]}>
            {error || labels.notFound}
          </Text>
          <Button onPress={() => router.back()}>{labels.back}</Button>
        </View>
      </SafeAreaView>
    );
  }

  const description = getProductDescription(product);
  const { longDescription, internalNotes } = getProductDescriptionSections(product);
  const imageCacheKey = getProductImageCacheKey(product);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs(18), lineHeight: lh(18) }]}
          numberOfLines={1}>
          {product.name}
        </Text>
        <View style={styles.headerSpacer}>
          {isRefreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.imageWrap, { backgroundColor: colors.inputBg }]}>
          <Image
            source={{ uri: getProductImageUri(product) }}
            cacheKey={imageCacheKey}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {product.ribbon ? <ProductRibbonBadge ribbon={product.ribbon} /> : null}
        </View>

        <Text style={[styles.title, { color: colors.text, fontSize: fs(22), lineHeight: lh(22) }]}>
          {product.name}
        </Text>
        <Text style={[styles.price, { color: colors.primary, fontSize: fs(22) }]}>
          {formatPrice(product.list_price)}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>
          {labels.description}
        </Text>

        {longDescription || internalNotes ? (
          <>
            {longDescription ? (
              <View style={styles.descriptionBlock}>
                {internalNotes ? (
                  <Text style={[styles.descriptionSubtitle, { color: colors.text, fontSize: fs(14), lineHeight: lh(14) }]}>
                    {labels.longDescription}
                  </Text>
                ) : null}
                <Text style={[styles.description, { color: colors.textMuted, fontSize: fs(14), lineHeight: lh(14) }]}>
                  {longDescription}
                </Text>
              </View>
            ) : null}

            {internalNotes ? (
              <View style={[styles.descriptionBlock, longDescription ? styles.descriptionBlockSpaced : null]}>
                <Text style={[styles.descriptionSubtitle, { color: colors.text, fontSize: fs(14), lineHeight: lh(14) }]}>
                  {labels.internalNotes}
                </Text>
                <Text style={[styles.description, { color: colors.textMuted, fontSize: fs(14), lineHeight: lh(14) }]}>
                  {internalNotes}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.description, { color: colors.textMuted, fontSize: fs(14), lineHeight: lh(14) }]}>
            {description || labels.noDescription}
          </Text>
        )}

        {similar.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>
              {labels.similar}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarRow}>
              {similar.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => openSimilarProduct(item)}
                  style={[styles.similarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.similarImageWrap, { backgroundColor: colors.inputBg }]}>
                    <Image
                      source={{ uri: getProductImageUri(item) }}
                      cacheKey={getProductImageCacheKey(item)}
                      style={styles.image}
                      contentFit="cover"
                      transition={200}
                    />
                    {item.ribbon ? <ProductRibbonBadge ribbon={item.ribbon} /> : null}
                  </View>
                  <View style={styles.similarBody}>
                    <Text
                      style={[styles.similarName, { color: colors.text, fontSize: fs(13), lineHeight: lh(13) }]}
                      numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[styles.similarPrice, { color: colors.primary, fontSize: fs(14) }]}>
                      {formatPrice(item.list_price)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
          <IconButton
            icon="minus"
            size={18}
            onPress={() => setQuantity((value) => Math.max(1, value - 1))}
            iconColor={colors.text}
            style={styles.stepperButton}
          />
          <Text style={[styles.stepperText, { color: colors.text, fontSize: rs(16) }]}>{quantity}</Text>
          <IconButton
            icon="plus"
            size={18}
            onPress={() => setQuantity((value) => value + 1)}
            iconColor={colors.text}
            style={styles.stepperButton}
          />
        </View>

        <Button
          mode="contained"
          icon="cart-plus"
          onPress={handleAddToCart}
          style={styles.addButton}
          contentStyle={styles.addButtonContent}
          labelStyle={{ fontSize: fs(15), lineHeight: lh(15), fontWeight: '700' }}>
          {labels.addToCart}
        </Button>
      </View>

      <AppToast message={snackbar} visible={!!snackbar} onDismiss={() => setSnackbar('')} />
    </SafeAreaView>
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
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconButton: {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    marginTop: 18,
    fontWeight: '800',
  },
  price: {
    marginTop: 8,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    fontWeight: '700',
  },
  description: {
    lineHeight: 22,
  },
  descriptionBlock: {
    marginTop: 4,
  },
  descriptionBlockSpaced: {
    marginTop: 16,
  },
  descriptionSubtitle: {
    marginBottom: 6,
    fontWeight: '700',
  },
  similarRow: {
    gap: 12,
    paddingRight: 4,
    paddingVertical: 4,
  },
  similarCard: {
    width: 150,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  similarImageWrap: {
    width: '100%',
    aspectRatio: 1,
  },
  similarBody: {
    padding: 10,
  },
  similarName: {
    minHeight: 36,
    fontWeight: '600',
  },
  similarPrice: {
    marginTop: 6,
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    minWidth: 32,
    textAlign: 'center',
    fontWeight: '700',
  },
  addButton: {
    flex: 1,
    borderRadius: 14,
  },
  addButtonContent: {
    height: 48,
  },
  errorText: {
    textAlign: 'center',
  },
});
