import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HelperText, IconButton, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Township } from '@/constants/townships';
import { searchTownships } from '@/constants/townships';
import { searchbarInputStyle } from '@/constants/text-input';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

type TownshipPickerProps = {
  label?: string;
  value: string;
  selectedTownship: Township | null;
  onChangeText: (value: string) => void;
  onSelect: (township: Township) => void;
  error?: string;
};

export function TownshipPicker({
  label,
  value,
  selectedTownship,
  onChangeText,
  onSelect,
  error,
}: TownshipPickerProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const resolvedLabel = label ?? t('township.label');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const results = useMemo(() => searchTownships(searchQuery), [searchQuery]);
  const displayValue = selectedTownship ? selectedTownship.name : value;

  const openPicker = () => {
    setSearchQuery(selectedTownship?.name ?? value);
    setIsOpen(true);
  };

  const handleSelect = (township: Township) => {
    onSelect(township);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.selectLabel,
          { color: error ? colors.danger : colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) },
        ]}>
        {resolvedLabel}
      </Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel="Select township"
        style={[
          styles.selectField,
          {
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.card,
          },
        ]}>
        <View style={styles.selectRow}>
          <Text
            style={[
              styles.selectValue,
              {
                color: displayValue ? colors.text : colors.textMuted,
                fontSize: fs(rs(15)),
                lineHeight: lh(15),
              },
            ]}>
            {displayValue || t('township.tapToSelect')}
          </Text>
          <Text style={[styles.selectChevron, { color: colors.textMuted }]}>▾</Text>
        </View>
      </Pressable>

      {error ? <HelperText type="error">{error}</HelperText> : null}

      <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsOpen(false)}>
        <SafeAreaView style={[styles.modalScreen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <IconButton icon="arrow-left" onPress={() => setIsOpen(false)} accessibilityLabel={t('common.back')} />
              <Text style={[styles.modalTitle, { color: colors.text, fontSize: fs(rs(18)), lineHeight: lh(18) }]}>{t('township.select')}</Text>
              <IconButton icon="close" onPress={() => setIsOpen(false)} />
            </View>

            <Searchbar
              placeholder={t('township.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchbar, { backgroundColor: colors.inputBg }]}
              inputStyle={searchbarInputStyle}
              autoFocus
            />

            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item.name}-${item.zip}-${index}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textMuted, lineHeight: lh(14) }]}>{t('township.notFound')}</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={[styles.option, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                  <Text style={[styles.optionName, { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) }]}>{item.name}</Text>
                  <Text style={[styles.optionMeta, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                    {item.state} · {item.zip}
                  </Text>
                </Pressable>
              )}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  selectField: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    justifyContent: 'center',
    minHeight: 56,
  },
  selectLabel: {
    marginBottom: 4,
    fontWeight: '600',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectValue: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 22,
  },
  selectChevron: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  modalScreen: {
    flex: 1,
  },
  modalFlex: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  searchbar: {
    margin: 12,
    elevation: 0,
  },
  listContent: {
    paddingBottom: 24,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionName: {
    fontWeight: '600',
    lineHeight: 22,
  },
  optionMeta: {
    marginTop: 4,
    lineHeight: 18,
  },
  emptyText: {
    textAlign: 'center',
    padding: 24,
  },
});
