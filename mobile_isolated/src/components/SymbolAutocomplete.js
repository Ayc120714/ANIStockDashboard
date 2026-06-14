import React, {useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {filterSymbolOptions} from '@core/utils/symbolOptions';

export function SymbolAutocomplete({
  value,
  onChange,
  options = [],
  placeholder = 'Search symbol…',
  maxVisible = 24,
  style,
  inputStyle,
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(
    () => filterSymbolOptions(options, value, maxVisible),
    [maxVisible, options, value],
  );

  const showDropdown = open && focused && filtered.length > 0;

  const pick = symbol => {
    onChange(symbol);
    setOpen(false);
    setFocused(false);
  };

  return (
    <View style={[styles.wrap, style]}>
      <TextInput
        style={[styles.input, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={AYC.textMuted}
        value={value}
        autoCapitalize="characters"
        autoCorrect={false}
        onChangeText={text => {
          onChange(String(text || '').toUpperCase());
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            setFocused(false);
            setOpen(false);
          }, 180);
        }}
      />
      {showDropdown ? (
        <View style={styles.dropdown}>
          <FlatList
            data={filtered}
            keyExtractor={item => item.symbol}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.list}
            renderItem={({item}) => (
              <Pressable
                style={styles.row}
                onPress={() => pick(item.symbol)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.symbol}`}>
                <Text style={styles.sym}>{item.symbol}</Text>
                {item.sector ? <Text style={styles.meta}>{item.sector}</Text> : null}
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {position: 'relative', zIndex: 20},
  input: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: AYC.text,
    backgroundColor: '#fff',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    overflow: 'hidden',
  },
  list: {maxHeight: 220},
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AYC.cardBorder,
  },
  sym: {fontSize: 14, fontWeight: '800', color: AYC.text},
  meta: {fontSize: 11, color: AYC.textMuted, marginTop: 2},
});
