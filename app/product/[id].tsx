import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';

import { AppToast } from '@/components/app-toast';
import { InlineErrorBanner } from '@/components/inline-error-banner';
import { LiquidSurface } from '@/components/liquid-surface';
import { ProductCard } from '@/components/products/product-card';
import { ProductDetailSkeleton, SimilarProductsSkeleton } from '@/components/products/product-card-skeleton';
import { QuantityStepper } from '@/components/quantity-stepper';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import { ProductRibbonBadge } from '@/components/products/product-ribbon';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { onCatalogRefreshRequested } from '@/services/catalog-events';
import { getUserFacingError } from '@/services/auth-error';
import { fetchProductById } from '@/services/product-api';
import { getProductPreview, rememberProductPreview } from '@/services/product-preview-cache';
import type { Product } from '@/types/product';
import { formatPrice, getProductImageUri } from '@/types/product';
import { hapticSuccess } from '@/utils/haptics';
import { isLiquidUiEnabled, liquidDetailHeaderTint, liquidGlassFill } from '@/utils/liquid-ui';
import { getProductDescription, getProductDescriptionSections } from '@/utils/product-text';

export default function ProductDetailScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { rs } = useResponsive();
  const { fs, lh, language, t } = useLanguage();
  const { token } = useAuth();
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
          loadingDescription: 'ဖော်ပြချက် ရယူနေသည်…',
          similar: 'ဆင်တူ ပစ္စည်းများ',
          addToCart: 'ခြင်းထဲ ထည့်ရန်',
          notFound: t('errors.productNotFound'),
          added: 'စျေးခြင်းထဲ ထည့်ပြီးပါပြီ',
        }
      : {
          back: 'Back',
          description: 'Description',
          longDescription: 'Long Description',
          internalNotes: 'Internal Notes',
          noDescription: 'No description available.',
          loadingDescription: 'Loading description…',
          similar: 'Similar Products',
          addToCart: 'Add to Cart',
          notFound: t('errors.productNotFound'),
          added: 'Added to cart',
        };

  const languageRef = useRef(language);
  const requestGenerationRef = useRef(0);
  const [product, setProduct] = useState<Product | null>(() =>
    Number.isFinite(productId) ? getProductPreview(productId) : null,
  );
  const [similar, setSimilar] = useState<Product[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(() => !getProductPreview(productId));
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

      const generation = ++requestGenerationRef.current;
      const preview = getProductPreview(productId);
      const hasPreview = !!preview;

      if (!options?.silent && !hasPreview) {
        setIsLoading(true);
        setError('');
        setSimilar([]);
      }

      setSimilarLoading(true);

      try {
        // Phase 1: product only (skip similar) so the screen can open quickly.
        const fast = await fetchProductById(productId, token, { similarLimit: 0 });

        if (generation !== requestGenerationRef.current) {
          return;
        }

        if (fast.product) {
          rememberProductPreview(fast.product);
          setProduct(fast.product);
          setDetailsLoaded(true);
          setIsLoading(false);
        } else if (!options?.silent && !hasPreview) {
          setProduct(null);
          setError(t('errors.productNotFound'));
          setDetailsLoaded(true);
          setIsLoading(false);
          setSimilarLoading(false);
          return;
        } else {
          setDetailsLoaded(true);
          setIsLoading(false);
        }

        // Phase 2: similar products in the background.
        const full = await fetchProductById(productId, token, { similarLimit: 6 });

        if (generation !== requestGenerationRef.current) {
          return;
        }

        if (full.product) {
          rememberProductPreview(full.product);
          setProduct(full.product);
        }

        setSimilar(full.similarProducts.filter((item) => item.id !== full.product?.id));
      } catch (err) {
        if (generation !== requestGenerationRef.current) {
          return;
        }

        if (!options?.silent && !hasPreview && !getProductPreview(productId)) {
          const message = getUserFacingError(err, t('errors.loadProduct'), t);
          if (message) setError(message);
        }
      } finally {
        if (generation === requestGenerationRef.current) {
          setIsLoading(false);
          setSimilarLoading(false);
          setDetailsLoaded(true);
        }
      }
    },
    [productId, token, t],
  );

  useEffect(() => {
    setQuantity(1);
    setSimilar([]);
    setSimilarLoading(true);
    setDetailsLoaded(false);

    const preview = getProductPreview(productId);

    if (preview) {
      setProduct(preview);
      setIsLoading(false);
    } else {
      setProduct(null);
      setIsLoading(true);
    }

    loadProduct({ silent: !!preview }).catch(() => {});
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

    Keyboard.dismiss();
    hapticSuccess();
    addToCart(product, quantity);
    setSnackbar(labels.added);
  };

  const openSimilarProduct = (item: Product) => {
    rememberProductPreview(item);
    router.push(`/product/${item.id}` as Href);
  };

  if (isLoading && !product) {
    return <ProductDetailSkeleton onBack={() => router.back()} />;
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
          {error ? (
            <InlineErrorBanner
              message={error}
              onRetry={() => {
                void loadProduct();
              }}
              onDismiss={() => setError('')}
              style={{ marginHorizontal: 0, alignSelf: 'stretch' }}
            />
          ) : (
            <Text style={[styles.errorText, { color: colors.danger, lineHeight: lh(14) }]}>
              {labels.notFound}
            </Text>
          )}
          <Button onPress={() => router.back()}>{labels.back}</Button>
        </View>
      </SafeAreaView>
    );
  }

  const description = getProductDescription(product);
  const { longDescription, internalNotes } = getProductDescriptionSections(product);
  const liquid = isLiquidUiEnabled();
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={liquid ? [] : ['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <LiquidSurface
          style={[
            styles.headerBar,
            {
              borderBottomWidth: liquid ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: liquid ? 'transparent' : colors.border,
              // Glass under status bar — avoids a floating mint strip.
              paddingTop: (liquid ? insets.top : 0) + 10,
            },
          ]}
          backgroundColor={colors.surface}
          tintColor={liquid ? liquidDetailHeaderTint(isDark) : undefined}
          glassStyle="regular">
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={24} color={liquid && !isDark ? '#111827' : colors.text} />
          </Pressable>
          <Text
            style={[
              styles.headerTitle,
              { color: liquid && !isDark ? '#111827' : colors.text, fontSize: fs(18), lineHeight: lh(18) },
            ]}
            numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.headerSpacer} />
        </LiquidSurface>

        <View style={styles.body}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
          <View style={[styles.imageWrap, { backgroundColor: colors.inputBg }]}>
            <Image
              source={{ uri: getProductImageUri(product) }}
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
              {description ||
                (!detailsLoaded ? labels.loadingDescription : labels.noDescription)}
            </Text>
          )}

          {similarLoading || similar.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>
                {labels.similar}
              </Text>
              {similarLoading && similar.length === 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.similarRow}
                  scrollEnabled={false}>
                  <SimilarProductsSkeleton count={3} />
                </ScrollView>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.similarRow}
                  keyboardShouldPersistTaps="handled">
                  {similar.map((item) => (
                    <ProductCard
                      key={item.id}
                      product={item}
                      width={150}
                      onPressCard={() => openSimilarProduct(item)}
                      onCartFeedback={(p) =>
                        setSnackbar(t('products.addedToCart', { name: p.name }))
                      }
                    />
                  ))}
                </ScrollView>
              )}
            </>
          ) : null}
          </ScrollView>
        </View>

        <LiquidSurface
          style={[
            styles.bottomBar,
            {
              borderTopWidth: liquid ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: liquid ? 'transparent' : colors.border,
              // Glass into the home-indicator area.
              paddingBottom: (liquid ? Math.max(insets.bottom, 10) : 10) + 2,
            },
          ]}
          backgroundColor={colors.surface}
          glassStyle="regular">
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            fontSize={rs(16)}
            iconSize={18}
            borderColor={liquid ? liquidGlassFill(isDark) : colors.border}
            backgroundColor={liquid ? liquidGlassFill(isDark) : colors.inputBg}
            textColor={colors.text}
          />

          <Button
            mode="contained"
            icon="cart-plus"
            onPress={handleAddToCart}
            style={styles.addButton}
            contentStyle={styles.addButtonContent}
            labelStyle={{ fontSize: fs(15), lineHeight: lh(15), fontWeight: '700' }}>
            {labels.addToCart}
          </Button>
        </LiquidSurface>
      </KeyboardAvoidingView>

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
    paddingBottom: 10,
    overflow: 'hidden',
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
  body: {
    flex: 1,
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
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
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
