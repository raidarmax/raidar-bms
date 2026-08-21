import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { SearchIcon, XIcon } from '../icons/Icons';
import { colors, borderRadius, spacing, typography } from '../../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...', style }: SearchBarProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <SearchIcon size={18} color={colors.gray[400]} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[400]}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearButton}>
          <XIcon size={16} color={colors.gray[400]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    height: 44,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.gray[900],
    padding: 0,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});
