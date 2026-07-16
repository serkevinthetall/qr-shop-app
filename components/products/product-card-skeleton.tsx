import { StyleSheet, View } from 'react-native';

import { SkeletonBox } from '@/components/skeleton';
import { getNameBlockHeight, getProductCardMinHeight } from '@/components/products/product-card';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

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
