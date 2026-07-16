import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, IconButton } from 'react-native-paper';

import { AddressDisplayText } from '@/components/address/address-display-text';
import { AddressFormModal } from '@/components/address/address-form-modal';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { fetchAddresses } from '@/services/address-api';
import type { Address } from '@/types/address';
import { canEditAddress, getDeliveryAddresses, getMainAddress } from '@/types/address';

export type AddressCheckoutHandle = {
  resolveAddressId: () => Promise<number>;
};

type AddressCheckoutSectionProps = {
  token: string;
  onError: (message: string) => void;
  onSelectionChange?: (addressId: number | null) => void;
};

function isSameAddressId(a: number | null, b: number) {
  return a !== null && Number(a) === Number(b);
}

export const AddressCheckoutSection = forwardRef<AddressCheckoutHandle, AddressCheckoutSectionProps>(
  function AddressCheckoutSection({ token, onError, onSelectionChange }, ref) {
    const colors = useAppColors();
    const { rs } = useResponsive();
    const { t, fs, lh } = useLanguage();

    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
    const selectedAddressIdRef = useRef<number | null>(null);
    const onErrorRef = useRef(onError);

    onErrorRef.current = onError;

    const selectAddressId = useCallback((addressId: number | null) => {
      selectedAddressIdRef.current = addressId;
      setSelectedAddressId(addressId);
      onSelectionChange?.(addressId);
    }, [onSelectionChange]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);

    const loadAddresses = useCallback(async () => {
      const list = await fetchAddresses(token);
      return getDeliveryAddresses(list);
    }, [token]);

    const refreshAddresses = useCallback(
      async (preferredId?: number) => {
        const checkoutAddresses = await loadAddresses();
        setAddresses(checkoutAddresses);

        if (preferredId && checkoutAddresses.some((item) => item.id === preferredId)) {
          selectAddressId(preferredId);
        } else if (!checkoutAddresses.some((item) => item.id === selectedAddressIdRef.current)) {
          selectAddressId(checkoutAddresses[0]?.id ?? null);
        }

        setLoadError('');
      },
      [loadAddresses, selectAddressId],
    );

    useEffect(() => {
      let cancelled = false;

      setIsLoading(true);

      loadAddresses()
        .then((checkoutAddresses) => {
          if (cancelled) {
            return;
          }

          setAddresses(checkoutAddresses);

          const currentId = selectedAddressIdRef.current;

          if (currentId && checkoutAddresses.some((item) => item.id === currentId)) {
            setSelectedAddressId(currentId);
            onSelectionChange?.(currentId);
          } else {
            selectAddressId(checkoutAddresses[0]?.id ?? null);
          }

          setLoadError('');
        })
        .catch((err) => {
          if (cancelled) {
            return;
          }

          const message = err instanceof Error ? err.message : 'Could not load saved addresses.';
          setLoadError(message);
          onErrorRef.current(message);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [loadAddresses, onSelectionChange, selectAddressId]);

    const selectedAddress = addresses.find((address) => isSameAddressId(selectedAddressId, address.id)) ?? null;
    const mainAddress = getMainAddress(addresses);

    useImperativeHandle(
      ref,
      () => ({
        resolveAddressId: async () => {
          const addressId = selectedAddressIdRef.current;

          if (!addressId) {
            throw new Error(t('addressSection.markToContinue'));
          }

          return addressId;
        },
      }),
      [t],
    );

    const openAddModal = () => {
      setEditingAddress(null);
      setFormMode('add');
    };

    const openEditModal = (address: Address) => {
      setEditingAddress(address);
      setFormMode('edit');
    };

    const closeFormModal = () => {
      setFormMode(null);
      setEditingAddress(null);
    };

    const handleAddressSaved = async (addressId: number) => {
      closeFormModal();

      try {
        await refreshAddresses(addressId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Address saved but list refresh failed.';
        setLoadError(message);
      }
    };

    return (
      <>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>{t('addressSection.deliveryAddress')}</Text>

          <Button
            mode="contained-tonal"
            icon="plus"
            onPress={openAddModal}
            style={styles.addButton}
            contentStyle={styles.addButtonContent}>
            {t('addressSection.addBranch')}
          </Button>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textMuted, marginLeft: 10, lineHeight: lh(14) }}>{t('addressSection.loadingAddresses')}</Text>
            </View>
          ) : (
            <>
              {loadError ? <HelperText type="info">{loadError}</HelperText> : null}

              {!addresses.length ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[styles.emptyTitle, { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) }]}>
                    {t('addressSection.noBranchYet')}
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                    {t('addressSection.noBranchHint')}
                  </Text>
                </View>
              ) : (
                <>
                  {selectedAddress ? (
                    <View
                      style={[
                        styles.currentCard,
                        {
                          backgroundColor: colors.primaryMuted,
                          borderColor: colors.primary,
                        },
                      ]}>
                      <Text style={[styles.selectedBadge, { color: colors.primary, lineHeight: lh(12) }]}>{t('addressSection.selected')}</Text>
                      <AddressDisplayText
                        address={selectedAddress}
                        nameSize={rs(16)}
                        metaSize={rs(13)}
                        textColor={colors.text}
                        mutedColor={colors.textMuted}
                      />
                    </View>
                  ) : (
                    <HelperText type="error" visible>
                      {t('addressSection.markOne')}
                    </HelperText>
                  )}

                  <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>
                    {t('addressSection.selectBranch')}
                  </Text>

                  {addresses.map((address) => {
                    const isSelected = isSameAddressId(selectedAddressId, address.id);
                    const editable = canEditAddress(address, mainAddress);

                    return (
                      <View
                        key={address.id}
                        style={[
                          styles.branchCard,
                          {
                            backgroundColor: isSelected ? colors.primaryMuted : colors.inputBg,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => selectAddressId(address.id)}
                          style={styles.branchSelectable}>
                          <View
                            style={[
                              styles.radioOuter,
                              { borderColor: isSelected ? colors.primary : colors.border },
                            ]}>
                            {isSelected ? (
                              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                            ) : null}
                          </View>

                          <View style={styles.branchContent}>
                            <AddressDisplayText
                              address={address}
                              nameSize={rs(15)}
                              metaSize={rs(13)}
                              textColor={colors.text}
                              mutedColor={colors.textMuted}
                            />
                          </View>
                        </TouchableOpacity>

                        {editable ? (
                          <IconButton
                            icon="pencil"
                            size={20}
                            onPress={() => openEditModal(address)}
                            accessibilityLabel={`Edit ${address.name}`}
                            style={styles.editButton}
                          />
                        ) : null}
                      </View>
                    );
                  })}

                  {!selectedAddressId ? (
                    <HelperText type="error" visible>
                      {t('addressSection.markToContinue')}
                    </HelperText>
                  ) : null}
                </>
              )}
            </>
          )}
        </View>

        <AddressFormModal
          visible={formMode !== null}
          mode={formMode === 'edit' ? 'edit' : 'add'}
          token={token}
          address={editingAddress}
          onDismiss={closeFormModal}
          onSaved={handleAddressSaved}
        />
      </>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 10,
  },
  addButton: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  addButtonContent: {
    paddingHorizontal: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 4,
  },
  currentCard: {
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
  emptyBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    lineHeight: 18,
  },
  branchCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  branchSelectable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingLeft: 12,
    minWidth: 0,
  },
  branchContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    paddingTop: 4,
    paddingRight: 8,
  },
  editButton: {
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexShrink: 0,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
