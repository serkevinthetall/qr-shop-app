import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';

import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  if (!value) return null;

  const parts = value.split('-').map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [year, month, day] = parts;

  return new Date(year, month - 1, day);
}

function formatDisplay(value: string) {
  const date = parseIsoDate(value);

  if (!date) return '';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Tap to select date',
  minimumDate,
  maximumDate,
}: DatePickerFieldProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseIsoDate(value) ?? new Date());

  const displayValue = formatDisplay(value);

  const openPicker = () => {
    setTempDate(parseIsoDate(value) ?? new Date());
    setIsOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setIsOpen(false);

    if (event.type === 'set' && selected) {
      onChange(toIsoDate(selected));
    }
  };

  const handleIosChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      setTempDate(selected);
    }
  };

  const confirmIos = () => {
    onChange(toIsoDate(tempDate));
    setIsOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>{label}</Text>
        <View style={styles.row}>
          <Text
            style={[
              styles.value,
              { color: displayValue ? colors.text : colors.textMuted, fontSize: fs(rs(15)), lineHeight: lh(15) },
            ]}>
            {displayValue || placeholder}
          </Text>
          <Text style={[styles.icon, { color: colors.textMuted }]}>📅</Text>
        </View>
      </Pressable>

      {Platform.OS === 'android' && isOpen ? (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
            <Pressable
              style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(event) => event.stopPropagation()}>
              <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
                {label}
              </Text>

              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                themeVariant={colors.isDark ? 'dark' : 'light'}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleIosChange}
                style={styles.iosPicker}
              />

              <View style={styles.actions}>
                <Button mode="outlined" onPress={() => setIsOpen(false)} style={styles.actionButton}>
                  {t('common.cancel')}
                </Button>
                <Button mode="contained" onPress={confirmIos} style={styles.actionButton}>
                  {t('common.done')}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  field: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    minHeight: 56,
  },
  label: {
    marginBottom: 6,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 22,
  },
  icon: {
    fontSize: 16,
    lineHeight: 22,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  sheetTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  iosPicker: {
    alignSelf: 'stretch',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
});
