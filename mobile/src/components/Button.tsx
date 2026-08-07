import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const palette = variantPalette(variant);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && !isDisabled ? { opacity: 0.9 } : null,
        isDisabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={palette.text} /> : null}
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function variantPalette(variant: NonNullable<Props['variant']>) {
  switch (variant) {
    case 'secondary':
      return { background: theme.colors.surfaceElevated, border: theme.colors.borderStrong, text: theme.colors.textPrimary };
    case 'ghost':
      return { background: 'transparent', border: theme.colors.borderStrong, text: theme.colors.textSecondary };
    case 'danger':
      return { background: theme.colors.danger, border: theme.colors.danger, text: '#FFFFFF' };
    default:
      return { background: theme.colors.accent, border: theme.colors.accent, text: '#0B1220' };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
});
