import { StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '@/contexts/language-context';
import type { Address } from '@/types/address';
import { formatAddressMultiline, getAddressLabel } from '@/types/address';

type AddressDisplayTextProps = {
  address: Address;
  nameSize?: number;
  metaSize?: number;
  textColor: string;
  mutedColor: string;
  showPhone?: boolean;
};

export function AddressDisplayText({
  address,
  nameSize = 15,
  metaSize = 13,
  textColor,
  mutedColor,
  showPhone = true,
}: AddressDisplayTextProps) {
  const { fs, lh } = useLanguage();
  // Address data (township/state) is Burmese, so shrink it slightly and use a
  // generous line height to keep the tall upper diacritics from clipping.
  return (
    <View style={styles.container}>
      <Text style={[styles.name, { color: textColor, fontSize: fs(nameSize), lineHeight: lh(nameSize) }]} numberOfLines={2}>
        {getAddressLabel(address)}
      </Text>
      {showPhone && address.phone ? (
        <Text style={[styles.meta, { color: mutedColor, fontSize: fs(metaSize), lineHeight: lh(metaSize) }]} numberOfLines={1}>
          {String(address.phone)}
        </Text>
      ) : null}
      <Text style={[styles.body, { color: mutedColor, fontSize: fs(metaSize), lineHeight: lh(metaSize) }]}>
        {formatAddressMultiline(address)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
    marginBottom: 6,
  },
  meta: {
    marginBottom: 4,
  },
  body: {
    flexShrink: 1,
  },
});
