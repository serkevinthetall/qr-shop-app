import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, HelperText } from 'react-native-paper';

import {
  AddressCheckoutSection,
  type AddressCheckoutHandle,
} from '@/components/checkout/address-section';
import { LiquidSurface } from '@/components/liquid-surface';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { fetchAddresses } from '@/services/address-api';
import { getUserFacingError } from '@/services/auth-error';
import { fetchPickupPoints } from '@/services/pickup-point-api';
import { getDeliveryAddresses, getMainAddress } from '@/types/address';
import type { FulfillmentMethod, PickupPoint } from '@/types/pickup-point';
import {
  isLiquidUiEnabled,
  liquidGlassBorder,
  liquidGlassFill,
} from '@/utils/liquid-ui';

export type FulfillmentCheckoutHandle = {
  resolveSelection: () => Promise<
    | { fulfillmentMethod: 'pickup'; pickupPointId: string; addressId: string }
    | { fulfillmentMethod: 'delivery'; addressId: string }
  >;
};

type FulfillmentCheckoutSectionProps = {
  token: string;
  onError: (message: string) => void;
  onFulfillmentChange: (method: FulfillmentMethod) => void;
  onAddressSelectionChange?: (addressId: string | null) => void;
};

function MethodSegment({
  label,
  selected,
  onPress,
  colors,
  fontSize,
  liquid,
  idleFill,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
  fontSize: number;
  liquid: boolean;
  idleFill: string;
}) {
  const selectedBg = liquid ? colors.primaryContainer : colors.primary;
  const selectedFg = liquid ? colors.onPrimaryContainer : colors.onPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segment,
        {
          backgroundColor: selected ? selectedBg : idleFill,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text
        style={[
          styles.segmentLabel,
          {
            color: selected ? selectedFg : colors.textMuted,
            fontSize,
            fontWeight: selected ? '700' : '600',
          },
        ]}
        numberOfLines={2}>
        {label}
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
  const { isDark } = useThemeMode();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const trackBorder = liquid ? liquidGlassBorder(isDark) : colors.border;
  const idleFill = liquid ? liquidGlassFill(isDark) : 'transparent';
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;

  const addressRef = useRef<AddressCheckoutHandle>(null);
  const [method, setMethod] = useState<FulfillmentMethod>('delivery');
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<number | null>(null);
  const selectedPickupIdRef = useRef<number | null>(null);
  /** Silent Odoo contact (partner_shipping_id) — not shown in Self Pickup UI. */
  const selectedContactIdRef = useRef<string | null>(null);
  const [isLoadingPickup, setIsLoadingPickup] = useState(true);
  const [pickupError, setPickupError] = useState('');
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const selectPickupId = useCallback((id: number | null) => {
    selectedPickupIdRef.current = id;
    setSelectedPickupId(id);
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

  const resolveMainContactId = useCallback(async () => {
    const list = getDeliveryAddresses(await fetchAddresses(token));
    const main = getMainAddress(list);
    const contactId = main?.id ?? list[0]?.id ?? null;
    selectedContactIdRef.current = contactId;
    return contactId;
  }, [token]);

  const loadContactAddresses = useCallback(async () => {
    try {
      await resolveMainContactId();
    } catch {
      selectedContactIdRef.current = null;
    }
  }, [resolveMainContactId]);

  useEffect(() => {
    void loadPickupPoints();
    void loadContactAddresses();
  }, [loadContactAddresses, loadPickupPoints]);

  useEffect(() => {
    onFulfillmentChange('delivery');
  }, [onFulfillmentChange]);

  useImperativeHandle(
    ref,
    () => ({
      resolveSelection: async () => {
        if (method === 'pickup') {
          // Platform shop pickup has no separate points list — allow empty.
          const pickupPointId = selectedPickupIdRef.current
            ? String(selectedPickupIdRef.current)
            : pickupPoints.length
              ? ''
              : 'shop';
          if (!pickupPointId) {
            throw new Error(t('checkout.errorSelectPickup'));
          }

          // Still attach a buyer address for contact / order context.
          let addressId = selectedContactIdRef.current;
          if (!addressId) {
            try {
              addressId = await resolveMainContactId();
            } catch {
              addressId = null;
            }
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
    [method, pickupPoints.length, resolveMainContactId, t],
  );

  const selectedPickup =
    pickupPoints.find((point) => Number(point.id) === Number(selectedPickupId)) ?? null;

  const segmentFontSize = fs(rs(14)) ?? rs(14);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
        {t('fulfillment.howToFulfill')}
      </Text>

      <LiquidSurface
        style={[styles.segmentTrack, { borderColor: trackBorder }]}
        backgroundColor={colors.inputBg}
        glassStyle="regular"
        interactive
        cornerRadius={14}>
        <MethodSegment
          label={t('fulfillment.selfPickup')}
          selected={method === 'pickup'}
          onPress={() => setFulfillment('pickup')}
          colors={colors}
          fontSize={segmentFontSize}
          liquid={liquid}
          idleFill={idleFill}
        />
        <MethodSegment
          label={t('fulfillment.delivery')}
          selected={method === 'delivery'}
          onPress={() => setFulfillment('delivery')}
          colors={colors}
          fontSize={segmentFontSize}
          liquid={liquid}
          idleFill={idleFill}
        />
      </LiquidSurface>

      <LiquidSurface
        style={[styles.card, { borderColor: cardBorder }]}
        backgroundColor={colors.card}
        glassStyle="regular"
        interactive
        cornerRadius={16}>
        {method === 'pickup' ? (
          <View>
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
                      {t('fulfillment.selfPickup')}
                    </Text>
                    <Text
                      style={{ color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }}>
                      {t('fulfillment.choosePickup')}
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
          </View>
        ) : (
          <AddressCheckoutSection
            ref={addressRef}
            token={token}
            onError={onError}
            onSelectionChange={onAddressSelectionChange}
            embedded
          />
        )}
      </LiquidSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    paddingVertical: 2,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    textAlign: 'center',
    paddingVertical: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  hintLabel: {
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 12,
    paddingVertical: 2,
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
});
