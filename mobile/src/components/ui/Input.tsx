import React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../../theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  error?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  editable?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  error,
  icon,
  multiline = false,
  numberOfLines = 1,
  style,
  editable = true,
}: InputProps) {
  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.container, error && styles.error, !editable && styles.disabled]}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          style={[styles.input, multiline && styles.multiline]}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.gray[700],
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  error: {
    borderColor: colors.red[500],
  },
  disabled: {
    backgroundColor: colors.gray[50],
    opacity: 0.7,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.gray[900],
    paddingVertical: spacing.md,
  },
  multiline: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  errorText: {
    ...typography.caption,
    color: colors.red[600],
    marginTop: spacing.xs,
  },
});
