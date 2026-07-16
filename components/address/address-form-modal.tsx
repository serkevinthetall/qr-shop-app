import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  AddressFormFields,
  addressFormFromAddress,
  emptyAddressForm,
  type AddressFormValues,
} from '@/components/address/address-form-fields';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useKeyboardBottomPadding } from '@/hooks/use-keyboard-bottom-padding';
import { useResponsive } from '@/hooks/use-responsive';
import { createAddress, fetchAddressMeta, updateAddress, AddressApiError } from '@/services/address-api';
import type { Address, AddressMeta } from '@/types/address';
import { buildAddressPayload, DEFAULT_ADDRESS_META } from '@/utils/address';

type AddressFormModalProps = {
  visible: boolean;
  mode: 'add' | 'edit';
  token: string;
  address?: Address | null;
  onDismiss: () => void;
  onSaved: (addressId: number) => void;
};

export function AddressFormModal({
  visible,
  mode,
  token,
  address,
  onDismiss,
  onSaved,
}: AddressFormModalProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();

  const [form, setForm] = useState<AddressFormValues>(emptyAddressForm);
  const [townshipError, setTownshipError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const keyboardPadding = useKeyboardBottomPadding(32);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (mode === 'edit' && address) {
      setForm(addressFormFromAddress(address));
    } else {
      setForm(emptyAddressForm);
    }
    setTownshipError('');
    setPhoneError('');
    setFormError('');
  }, [address, mode, visible]);

  const handleDismiss = () => {
    setForm(emptyAddressForm);
    setTownshipError('');
    setPhoneError('');
    setFormError('');
    onDismiss();
  };

  const handleFormChange = (values: AddressFormValues) => {
    if (phoneError && values.phone !== form.phone) {
      setPhoneError('');
    }

    setForm(values);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.street.trim()) {
      setFormError(t('addressForm.requiredError'));
      return;
    }

    if (!form.selectedTownship) {
      setTownshipError(t('addressForm.townshipError'));
      setFormError(t('addressForm.townshipError'));
      return;
    }

    setFormError('');
    setTownshipError('');
    setPhoneError('');
    setIsSaving(true);

    try {
      let meta: AddressMeta = DEFAULT_ADDRESS_META;

      try {
        meta = await fetchAddressMeta(token);
      } catch {
        // Backend can resolve state from township label.
      }

      const payload = buildAddressPayload({
        name: form.name,
        phone: form.phone,
        street: form.street,
        street2: form.street2,
        city: form.selectedTownship.name,
        zip: form.selectedTownship.zip,
        stateLabel: form.selectedTownship.state,
        meta,
      });

      if (mode === 'edit' && address) {
        await updateAddress(token, address.id, payload);
        onSaved(address.id);
      } else {
        const addressId = await createAddress(token, payload);
        onSaved(addressId);
      }

      handleDismiss();
    } catch (err) {
      if (err instanceof AddressApiError && err.code === 'PHONE_ALREADY_USED') {
        const message = t('addressForm.phoneUsedError');
        setPhoneError(message);
        setFormError(message);
      } else {
        setFormError(err instanceof Error ? err.message : t('addressForm.saveError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleDismiss}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <IconButton icon="arrow-left" onPress={handleDismiss} accessibilityLabel={t('common.back')} />
            <Text style={[styles.title, { color: colors.text, fontSize: fs(rs(18)), lineHeight: lh(18) }]}>
              {mode === 'edit' ? t('addressForm.editTitle') : t('addressForm.addTitle')}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardPadding > 0 ? { paddingBottom: keyboardPadding } : null,
            ]}>
            <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
              {mode === 'edit' ? t('addressForm.editSubtitle') : t('addressForm.addSubtitle')}
            </Text>

            <AddressFormFields
              values={form}
              onChange={handleFormChange}
              townshipError={townshipError}
              phoneError={phoneError}
              formError={formError}
            />
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <Button mode="outlined" onPress={handleDismiss} disabled={isSaving} style={styles.actionButton}>
              {t('addressForm.cancel')}
            </Button>
            <Button mode="contained" onPress={handleSave} loading={isSaving} disabled={isSaving} style={styles.actionButton}>
              {mode === 'edit' ? t('addressForm.updateBranch') : t('addressForm.saveBranch')}
            </Button>
          </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 48,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  subtitle: {
    marginBottom: 16,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flex: 1,
  },
});
