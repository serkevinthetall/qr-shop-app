import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import type { Township } from '@/constants/townships';
import { formatTownshipLabel, searchTownships } from '@/constants/townships';
import { textInputContentStyle } from '@/constants/text-input';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

type TownshipSearchProps = {
  value: string;
  selectedTownship: Township | null;
  onChangeText: (value: string) => void;
  onSelect: (township: Township) => void;
  error?: string;
};

export function TownshipSearch({
  value,
  selectedTownship,
  onChangeText,
  onSelect,
  error,
}: TownshipSearchProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => searchTownships(value), [value]);
  const showResults = isFocused && value.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      <TextInput
        label="Township *"
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
        }}
        mode="outlined"
        dense
        placeholder="Search township..."
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => setIsFocused(false), 200);
        }}
        style={styles.input}
        contentStyle={textInputContentStyle}
      />

      {error ? <HelperText type="error">{error}</HelperText> : null}

      {selectedTownship ? (
        <View style={[styles.selectedBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Text style={[styles.selectedTitle, { color: colors.textMuted, fontSize: rs(12) }]}>
            Selected township
          </Text>
          <Text style={[styles.selectedValue, { color: colors.text, fontSize: rs(14) }]}>
            {formatTownshipLabel(selectedTownship)}
          </Text>
        </View>
      ) : null}

      {showResults ? (
        <View style={[styles.results, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {results.length ? (
            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item.name}-${item.zip}-${index}`}
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
              nestedScrollEnabled
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    setIsFocused(false);
                  }}
                  style={[styles.option, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.optionName, { color: colors.text, fontSize: rs(14) }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.optionMeta, { color: colors.textMuted, fontSize: rs(12) }]}>
                    {item.state} · {item.zip}
                  </Text>
                </Pressable>
              )}
            />
          ) : (
            <Text style={[styles.noResult, { color: colors.textMuted, fontSize: rs(14) }]}>
              No township found
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 20,
    marginBottom: 8,
  },
  input: {
    marginBottom: 4,
  },
  selectedBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  selectedTitle: {
    marginBottom: 4,
  },
  selectedValue: {
    fontWeight: '600',
  },
  results: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 4,
    maxHeight: 260,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  resultsList: {
    maxHeight: 260,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionName: {
    fontWeight: '600',
    lineHeight: 20,
  },
  optionMeta: {
    marginTop: 2,
  },
  noResult: {
    padding: 12,
  },
});
