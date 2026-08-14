import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonBox } from '@/components/skeleton';
import { getNameBlockHeight, getProductCardMinHeight } from '@/components/products/product-card';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

type ProductDetailSkeletonProps = {
  onBack?: () => void;
};

export function ProductDetailSkeleton({ onBack }: ProductDetailSkeletonProps) {
  const colors = useAppColors();
  const { language } = useLanguage();

  return (
    <SafeAreaView style={[detailStyles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[detailStyles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={onBack}
          style={detailStyles.iconButton}
          disabled={!onBack}
          accessibilityLabel={language === 'my' ? 'နောက်သို့' : 'Back'}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <SkeletonBox style={detailStyles.headerTitleSkeleton} borderRadius={8} />
        <View style={detailStyles.headerSpacer} />
      </View>

      <View style={detailStyles.content}>
        <SkeletonBox style={detailStyles.image} borderRadius={20} />
        <SkeletonBox style={detailStyles.titleLine} borderRadius={8} />
        <SkeletonBox style={detailStyles.titleLineShort} borderRadius={8} />
        <SkeletonBox style={detailStyles.priceLine} borderRadius={8} />
        <SkeletonBox style={[detailStyles.sectionTitle, { marginTop: 24 }]} borderRadius={6} />
        <SkeletonBox style={detailStyles.descriptionLine} borderRadius={6} />
        <SkeletonBox style={detailStyles.descriptionLine} borderRadius={6} />
        <SkeletonBox style={detailStyles.descriptionLineShort} borderRadius={6} />
      </View>

      <View style={[detailStyles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <SkeletonBox style={detailStyles.stepperSkeleton} borderRadius={999} />
        <SkeletonBox style={detailStyles.addButtonSkeleton} borderRadius={14} />
      </View>
    </SafeAreaView>
  );
}

const detailStyles = StyleSheet.create({
  screen: {
    flex: 1,
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
  headerTitleSkeleton: {
    flex: 1,
    height: 20,
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  titleLine: {
    width: '88%',
    height: 24,
    marginTop: 18,
  },
  titleLineShort: {
    width: '52%',
    height: 24,
    marginTop: 8,
  },
  priceLine: {
    width: '34%',
    height: 24,
    marginTop: 8,
  },
  sectionTitle: {
    width: '38%',
    height: 18,
    marginBottom: 8,
  },
  descriptionLine: {
    width: '100%',
    height: 14,
    marginTop: 8,
  },
  descriptionLineShort: {
    width: '72%',
    height: 14,
    marginTop: 8,
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
  stepperSkeleton: {
    width: 120,
    height: 48,
  },
  addButtonSkeleton: {
    flex: 1,
    height: 48,
  },
});

export function SimilarProductsSkeleton({ count = 3 }: { count?: number }) {
  const colors = useAppColors();

  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={`similar-skel-${index}`}
          style={[similarStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonBox style={similarStyles.image} borderRadius={0} />
          <View style={similarStyles.body}>
            <SkeletonBox style={similarStyles.nameLine} borderRadius={6} />
            <SkeletonBox style={similarStyles.nameLineShort} borderRadius={6} />
            <SkeletonBox style={similarStyles.priceLine} borderRadius={6} />
          </View>
        </View>
      ))}
    </>
  );
}

const similarStyles = StyleSheet.create({
  card: {
    width: 150,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  body: {
    padding: 10,
  },
  nameLine: {
    width: '100%',
    height: 12,
  },
  nameLineShort: {
    width: '70%',
    height: 12,
    marginTop: 6,
  },
  priceLine: {
    width: '45%',
    height: 14,
    marginTop: 10,
  },
});

type ProductCardSkeletonProps = {
  width?: number;
};

export function ProductCardSkeleton({ width }: ProductCardSkeletonProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { fs, language } = useLanguage();
  const cardWidth = width ?? 160;
  const nameFontSize = fs(rs(14));
  const cardMinHeight = getProductCardMinHeight(cardWidth, rs, language, nameFontSize);
  const nameHeight = getNameBlockHeight(language, nameFontSize);

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
      <SkeletonBox style={styles.image} borderRadius={0} />
      <View style={styles.content}>
        <SkeletonBox style={[styles.nameBlock, { height: nameHeight }]} borderRadius={6} />
        <SkeletonBox style={styles.priceLine} borderRadius={6} />
        <SkeletonBox style={styles.button} borderRadius={10} />
      </View>
    </View>
  );
}

export function ProductListItemSkeleton() {
  const colors = useAppColors();

  return (
    <View style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonBox style={styles.listImage} borderRadius={12} />
      <View style={styles.listContent}>
        <SkeletonBox style={styles.listNameLine} borderRadius={6} />
        <SkeletonBox style={styles.listNameLineShort} borderRadius={6} />
        <SkeletonBox style={styles.listPriceLine} borderRadius={6} />
        <SkeletonBox style={styles.listButton} borderRadius={10} />
      </View>
    </View>
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
  image: {
    width: '100%',
    aspectRatio: 1.2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  nameBlock: {
    width: '100%',
  },
  priceLine: {
    width: '42%',
    height: 16,
    marginTop: 8,
  },
  button: {
    width: '100%',
    height: 40,
    marginTop: 'auto',
    paddingTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  listImage: {
    width: 90,
    height: 90,
  },
  listContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listNameLine: {
    width: '88%',
    height: 14,
  },
  listNameLineShort: {
    width: '55%',
    height: 14,
    marginTop: 6,
  },
  listPriceLine: {
    width: '36%',
    height: 15,
    marginTop: 8,
  },
  listButton: {
    width: '72%',
    height: 36,
    marginTop: 10,
  },
});
