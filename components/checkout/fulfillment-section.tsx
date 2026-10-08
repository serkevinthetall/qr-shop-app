import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, HelperText } from 'react-native-paper';

import { AddressDisplayText } from '@/components/address/address-display-text';
import {
  AddressCheckoutSection,
  type AddressCheckoutHandle,
} from '@/components/checkout/address-section';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { fetchAddresses } from '@/services/address-api';
import { getUserFacingError } from '@/services/auth-error';
import { fetchPickupPoints } from '@/services/pickup-point-api';
import type { Address } from '@/types/address';
import { getDeliveryAddresses } from '@/types/address';
import type { FulfillmentMethod, PickupPoint } from '@/types/pickup-point';

export type FulfillmentCheckoutHandle = {
  resolveSelection: () => Promise<
    | { fulfillmentMethod: 'pickup'; pickupPointId: number; addressId: number }
    | { fulfillmentMethod: 'delivery'; addressId: number }
  >;
};

type FulfillmentCheckoutSectionProps = {
  token: string;
  onError: (message: string) => void;
  onFulfillmentChange: (method: FulfillmentMethod) => void;
  onAddressSelectionChange?: (addressId: number | null) => void;
};

function AccordionHeader({
  title,
  subtitle,
  open,
  onPress,
  colors,
  titleSize,
  subtitleSize,
  chevronSize,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
  titleSize: number;
  subtitleSize: number;
  chevronSize: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.accordionHeader,
        {
          backgroundColor: open ? colors.primaryMuted : colors.inputBg,
          borderColor: open ? colors.primary : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}>
      <View style={styles.accordionHeaderText}>
        <Text style={[styles.accordionTitle, { color: colors.text, fontSize: titleSize, lineHeight: titleSize + 4 }]}>
          {title}
        </Text>
        {subtitle && !open ? (
          <Text style={{ color: colors.textMuted, fontSize: subtitleSize, lineHeight: subtitleSize + 4, marginTop: 4 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: chevronSize, lineHeight: chevronSize + 2 }}>
        {open ? '▾' : '▸'}
      </Text>
    </Pressable>
  );
}

export const FulfillmentCheckoutSection = forwardRef<
  FulfillmentCheckoutHandle,
  FulfillmentCheckoutSectionProps
>(function FulfillmentCheckoutSection(
  { token, onError, onFulfillmentChange, onAddressSelectionChange },
  ref,
) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();

  const addressRef = useRef<AddressCheckoutHandle>(null);
  const [method, setMethod] = useState<FulfillmentMethod>('pickup');
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<number | null>(null);
  const selectedPickupIdRef = useRef<number | null>(null);
  const [contactAddresses, setContactAddresses] = useState<Address[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const selectedContactIdRef = useRef<number | null>(null);
  const [isLoadingPickup, setIsLoadingPickup] = useState(true);
  const [isLoadingContact, setIsLoadingContact] = useState(true);
  const [pickupError, setPickupError] = useState('');
  const [contactError, setContactError] = useState('');
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const selectPickupId = useCallback((id: number | null) => {
    selectedPickupIdRef.current = id;
    setSelectedPickupId(id);
  }, []);

  const selectContactId = useCallback((id: number | null) => {
    selectedContactIdRef.current = id;
    setSelectedContactId(id);
  }, []);

  const setFulfillment = useCallback(
    (next: FulfillmentMethod) => {
      setMethod(next);
      onFulfillmentChange(next);
    },
    [onFulfillmentChange],
  );

  const loadPickupPoints = useCallback(async () => {
    setIsLoadingPickup(true);
    try {
      const points = await fetchPickupPoints(token);
      setPickupPoints(points);
      setPickupError('');

      if (selectedPickupIdRef.current && points.some((p) => p.id === selectedPickupIdRef.current)) {
        selectPickupId(selectedPickupIdRef.current);
      } else {
        selectPickupId(points[0]?.id ?? null);
      }
    } catch (err) {
      const message = getUserFacingError(err, t('errors.loadPickupPoints'));
      setPickupPoints([]);
      selectPickupId(null);
      if (message) {
        setPickupError(message);
        onErrorRef.current(message);
      }
    } finally {
      setIsLoadingPickup(false);
    }
  }, [selectPickupId, t, token]);

  const loadContactAddresses = useCallback(async () => {
    setIsLoadingContact(true);
    try {
      const list = getDeliveryAddresses(await fetchAddresses(token));
      setContactAddresses(list);
      setContactError('');

      if (selectedContactIdRef.current && list.some((item) => item.id === selectedContactIdRef.current)) {
        selectContactId(selectedContactIdRef.current);
      } else {
        selectContactId(list[0]?.id ?? null);
      }
    } catch (err) {
      const message = getUserFacingError(err, t('errors.loadAddressList'));
      setContactAddresses([]);
      selectContactId(null);
      if (message) {
        setContactError(message);
        onErrorRef.current(message);
      }
    } finally {
      setIsLoadingContact(false);
    }
  }, [selectContactId, t, token]);

  useEffect(() => {
    void loadPickupPoints();
    void loadContactAddresses();
  }, [loadContactAddresses, loadPickupPoints]);

  useEffect(() => {
    onFulfillmentChange('pickup');
  }, [onFulfillmentChange]);

  useImperativeHandle(
    ref,
    () => ({
      resolveSelection: async () => {
        if (method === 'pickup') {
          const pickupPointId = selectedPickupIdRef.current;
          const addressId = selectedContactIdRef.current;
          if (!pickupPointId) {
            throw new Error(t('checkout.errorSelectPickup'));
          }
          if (!addressId) {
            throw new Error(t('checkout.errorSelectContact'));
          }
          return { fulfillmentMethod: 'pickup', pickupPointId, addressId };
        }

        const addressId = await addressRef.current?.resolveAddressId();
        if (!addressId) {
          throw new Error(t('checkout.errorSelectAddress'));
        }
        return { fulfillmentMethod: 'delivery', addressId };
      },
    }),
    [method, t],
  );

  const selectedPickup =
    pickupPoints.find((point) => Number(point.id) === Number(selectedPickupId)) ?? null;
  const selectedContact =
    contactAddresses.find((address) => Number(address.id) === Number(selectedContactId)) ?? null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
        {t('fulfillment.howToFulfill')}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <AccordionHeader
          title={t('fulfillment.selfPickup')}
          subtitle={t('fulfillment.tapToPickup')}
          open={method === 'pickup'}
          onPress={() => setFulfillment('pickup')}
          colors={colors}
          titleSize={fs(rs(16)) ?? rs(16)}
          subtitleSize={fs(rs(12)) ?? rs(12)}
          chevronSize={fs(rs(18)) ?? rs(18)}
        />

        {method === 'pickup' ? (
          <View style={styles.accordionBody}>
            <Text
              style={[
                styles.hintLabel,
                { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
              ]}>
              {t('fulfillment.choosePickup')}
            </Text>

            {isLoadingPickup ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textMuted, marginLeft: 10, lineHeight: lh(14) }}>
                  {t('fulfillment.loadingPickup')}
                </Text>
              </View>
            ) : (
              <>
                {pickupError ? <HelperText type="info">{pickupError}</HelperText> : null}

                {!pickupPoints.length ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Text
                      style={[
                        styles.emptyTitle,
                        { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) },
                      ]}>
                      {t('fulfillment.noPickupYet')}
                    </Text>
                    <Text
                      style={{ color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }}>
                      {t('fulfillment.noPickupHint')}
                    </Text>
                  </View>
                ) : (
                  <>
                    {selectedPickup ? (
                      <View
                        style={[
                          styles.selectedCard,
                          {
                            backgroundColor: colors.primaryMuted,
                            borderColor: colors.primary,
                          },
                        ]}>
                        <Text style={[styles.selectedBadge, { color: colors.primary, lineHeight: lh(12) }]}>
                          {t('fulfillment.selected')}
                        </Text>
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: fs(rs(16)),
                            lineHeight: lh(16),
                            fontWeight: '600',
                          }}>
                          {selectedPickup.name}
                        </Text>
                        {selectedPickup.address ? (
                          <Text
                            style={{
                              color: colors.textMuted,
                              fontSize: fs(rs(13)),
                              lineHeight: lh(13),
                              marginTop: 4,
                            }}>
                            {selectedPickup.address}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {pickupPoints.map((point) => {
                      const isSelected = Number(selectedPickupId) === Number(point.id);

                      return (
                        <TouchableOpacity
                          key={point.id}
                          activeOpacity={0.75}
                          onPress={() => selectPickupId(point.id)}
                          style={[
                            styles.pointCard,
                            {
                              backgroundColor: isSelected ? colors.primaryMuted : colors.inputBg,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}>
                          <View
                            style={[
                              styles.radioOuter,
                              { borderColor: isSelected ? colors.primary : colors.border },
                            ]}>
                            {isSelected ? (
                              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                            ) : null}
                          </View>
                          <View style={styles.pointContent}>
                            <Text
                              style={{
                                color: colors.text,
                                fontSize: fs(rs(15)),
                                lineHeight: lh(15),
                                fontWeight: '600',
                              }}>
                              {point.name}
                            </Text>
                            {point.address ? (
                              <Text
                                style={{
                                  color: colors.textMuted,
                                  fontSize: fs(rs(13)),
                                  lineHeight: lh(13),
                                  marginTop: 4,
                                }}>
                                {point.address}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {!selectedPickupId ? (
                      <HelperText type="error" visible>
                        {t('fulfillment.markPickup')}
                      </HelperText>
                    ) : null}
                  </>
                )}
              </>
            )}

            <Text
              style={[
                styles.hintLabel,
                { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12), marginTop: 16 },
              ]}>
              {t('fulfillment.chooseContact')}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: fs(rs(12)),
                lineHeight: lh(12),
                marginBottom: 10,
              }}>
              {t('fulfillment.contactHint')}
            </Text>

            {isLoadingContact ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textMuted, marginLeft: 10, lineHeight: lh(14) }}>
                  {t('fulfillment.loadingContact')}
                </Text>
              </View>
            ) : (
              <>
                {contactError ? <HelperText type="info">{contactError}</HelperText> : null}

                {!contactAddresses.length ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Text
                      style={[
                        styles.emptyTitle,
                        { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) },
                      ]}>
                      {t('fulfillment.noContactYet')}
                    </Text>
                    <Text
                      style={{ color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }}>
                      {t('fulfillment.noContactHint')}
                    </Text>
                  </View>
                ) : (
                  <>
                    {selectedContact ? (
                      <View
                        style={[
                          styles.selectedCard,
                          {
                            backgroundColor: colors.primaryMuted,
                            borderColor: colors.primary,
                          },
                        ]}>
                        <Text style={[styles.selectedBadge, { color: colors.primary, lineHeight: lh(12) }]}>
                          {t('fulfillment.selected')}
                        </Text>
                        <AddressDisplayText
                          address={selectedContact}
                          nameSize={rs(15)}
                          metaSize={rs(13)}
                          textColor={colors.text}
                          mutedColor={colors.textMuted}
                        />
                      </View>
                    ) : null}

                    {contactAddresses.map((address) => {
                      const isSelected = Number(selectedContactId) === Number(address.id);

                      return (
                        <TouchableOpacity
                          key={address.id}
                          activeOpacity={0.75}
                          onPress={() => selectContactId(address.id)}
                          style={[
                            styles.pointCard,
                            {
                              backgroundColor: isSelected ? colors.primaryMuted : colors.inputBg,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}>
                          <View
                            style={[
                              styles.radioOuter,
                              { borderColor: isSelected ? colors.primary : colors.border },
                            ]}>
                            {isSelected ? (
                              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                            ) : null}
                          </View>
                          <View style={styles.pointContent}>
                            <AddressDisplayText
                              address={address}
                              nameSize={rs(14)}
                              metaSize={rs(12)}
                              textColor={colors.text}
                              mutedColor={colors.textMuted}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {!selectedContactId ? (
                      <HelperText type="error" visible>
                        {t('fulfillment.markContact')}
                      </HelperText>
                    ) : null}
                  </>
                )}
              </>
            )}
          </View>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 0 }]}>
        <View style={{ padding: 16, paddingBottom: method === 'delivery' ? 0 : 16 }}>
          <AccordionHeader
            title={t('fulfillment.deliveryAddress')}
            subtitle={t('fulfillment.tapToDeliver')}
            open={method === 'delivery'}
            onPress={() => setFulfillment('delivery')}
            colors={colors}
            titleSize={fs(rs(16)) ?? rs(16)}
            subtitleSize={fs(rs(12)) ?? rs(12)}
            chevronSize={fs(rs(18)) ?? rs(18)}
          />
        </View>

        {method === 'delivery' ? (
          <View style={styles.deliveryBody}>
            <AddressCheckoutSection
              ref={addressRef}
              token={token}
              onError={onError}
              onSelectionChange={onAddressSelectionChange}
              embedded
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  accordionHeader: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionHeaderText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  accordionTitle: {
    fontWeight: '600',
  },
  accordionBody: {
    marginTop: 14,
  },
  hintLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  selectedCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  selectedBadge: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  pointCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pointContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    paddingTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  deliveryBody: {
    paddingHorizontal: 0,
  },
});
