import { StyleSheet, Text, View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';

import { TownshipPicker } from '@/components/address/township-picker';
import type { Township } from '@/constants/townships';
import { findTownshipByCity } from '@/constants/townships';
import { textInputContentStyle } from '@/constants/text-input';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import type { Address } from '@/types/address';
export type AddressFormValues = {
  name: string;
  phone: string;
  street: string;
  street2: string;
  townshipQuery: string;
  selectedTownship: Township | null;
};

export const emptyAddressForm: AddressFormValues = {
  name: '',
  phone: '',
  street: '',
  street2: '',
  townshipQuery: '',
  selectedTownship: null,
};

type AddressFormFieldsProps = {
  values: AddressFormValues;
  onChange: (values: AddressFormValues) => void;
  townshipError?: string;
  phoneError?: string;
  formError?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  onSubmit?: () => void;
};

export function AddressFormFields({
  values,
  onChange,
  townshipError,
  phoneError,
  formError,
  submitLabel,
  isSubmitting,
  onSubmit,
}: AddressFormFieldsProps) {
  const { t, fs, lh } = useLanguage();
  const colors = useAppColors();
  const { rs } = useResponsive();
  const update = (patch: Partial<AddressFormValues>) => {
    onChange({ ...values, ...patch });
  };

  const renderLabel = (text: string) => (
    <Text style={[styles.fieldLabel, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>{text}</Text>
  );

  return (
    <View>
      <View style={styles.field}>
        {renderLabel(t('addressForm.label'))}
        <TextInput
          value={values.name}
          onChangeText={(name) => update({ name })}
          mode="outlined"
          dense
          placeholder={t('addressForm.labelPlaceholder')}
          style={styles.input}
          contentStyle={textInputContentStyle}
        />
      </View>
      <View style={styles.field}>
        {renderLabel(t('addressForm.phone'))}
        <TextInput
          value={values.phone}
          onChangeText={(phone) => update({ phone })}
          mode="outlined"
          dense
          keyboardType="phone-pad"
          error={!!phoneError}
          style={styles.input}
          contentStyle={textInputContentStyle}
        />
        {phoneError ? <HelperText type="error">{phoneError}</HelperText> : null}
      </View>
      <View style={styles.field}>
        {renderLabel(t('addressForm.street'))}
        <TextInput
          value={values.street}
          onChangeText={(street) => update({ street })}
          mode="outlined"
          dense
          style={styles.input}
          contentStyle={textInputContentStyle}
        />
      </View>
      <View style={styles.field}>
        {renderLabel(t('addressForm.apartment'))}
        <TextInput
          value={values.street2}
          onChangeText={(street2) => update({ street2 })}
          mode="outlined"
          dense
          style={styles.input}
          contentStyle={textInputContentStyle}
        />
      </View>

      <TownshipPicker
        value={values.townshipQuery}
        selectedTownship={values.selectedTownship}
        onChangeText={(townshipQuery) =>
          update({
            townshipQuery,
            selectedTownship: null,
          })
        }
        onSelect={(township) =>
          update({
            townshipQuery: township.name,
            selectedTownship: township,
          })
        }
        error={townshipError}
      />

      {formError ? <HelperText type="error">{formError}</HelperText> : null}

      {onSubmit && submitLabel ? (
        <Button mode="contained" onPress={onSubmit} loading={isSubmitting} disabled={isSubmitting}>
          {submitLabel}
        </Button>
      ) : null}
    </View>
  );
}

export function addressFormFromCityPrefill(city?: string | false) {
  if (!city || typeof city !== 'string') {
    return emptyAddressForm;
  }

  const township = findTownshipByCity(city);

  return {
    ...emptyAddressForm,
    townshipQuery: city,
    selectedTownship: township,
  };
}

export function addressFormFromAddress(address: Address): AddressFormValues {
  const city = address.city ? String(address.city) : '';
  const township = findTownshipByCity(city);

  return {
    name: String(address.name),
    phone: address.phone ? String(address.phone) : '',
    street: address.street ? String(address.street) : '',
    street2: address.street2 ? String(address.street2) : '',
    townshipQuery: city,
    selectedTownship: township,
  };
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 8,
  },
  fieldLabel: {
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    marginBottom: 0,
  },
});
