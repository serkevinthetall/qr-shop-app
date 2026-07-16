import { StyleSheet, Text, View } from 'react-native';

import { useResponsive } from '@/hooks/use-responsive';
import type { ProductRibbon } from '@/types/product';

type ProductRibbonBadgeProps = {
  ribbon: ProductRibbon;
};

export function ProductRibbonBadge({ ribbon }: ProductRibbonBadgeProps) {
  const { rs } = useResponsive();
  const isRight = ribbon.position === 'right';
  const isTag = ribbon.style === 'tag';

  if (isTag) {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.tag,
          isRight ? styles.tagRight : styles.tagLeft,
          {
            backgroundColor: ribbon.bg_color,
            paddingHorizontal: rs(8),
            paddingVertical: rs(4),
            borderRadius: rs(4),
          },
        ]}>
        <Text
          style={[
            styles.tagText,
            {
              color: ribbon.text_color,
              fontSize: rs(10),
            },
          ]}
          numberOfLines={1}>
          {ribbon.name}
        </Text>
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.ribbonWrap, isRight ? styles.ribbonWrapRight : styles.ribbonWrapLeft]}>
      <View
        style={[
          styles.ribbon,
          isRight ? styles.ribbonRight : styles.ribbonLeft,
          {
            backgroundColor: ribbon.bg_color,
            paddingHorizontal: rs(28),
            paddingVertical: rs(5),
          },
        ]}>
        <Text
          style={[
            styles.ribbonText,
            {
              color: ribbon.text_color,
              fontSize: rs(10),
            },
          ]}
          numberOfLines={1}>
          {ribbon.name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbonWrap: {
    position: 'absolute',
    top: 0,
    zIndex: 2,
    overflow: 'hidden',
    width: 88,
    height: 88,
  },
  ribbonWrapLeft: {
    left: 0,
  },
  ribbonWrapRight: {
    right: 0,
  },
  ribbon: {
    position: 'absolute',
    top: 14,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonLeft: {
    left: -34,
    transform: [{ rotate: '-45deg' }],
  },
  ribbonRight: {
    right: -34,
    transform: [{ rotate: '45deg' }],
  },
  ribbonText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  tag: {
    position: 'absolute',
    top: 8,
    zIndex: 2,
    maxWidth: '72%',
  },
  tagLeft: {
    left: 8,
  },
  tagRight: {
    right: 8,
  },
  tagText: {
    fontWeight: '700',
  },
});
