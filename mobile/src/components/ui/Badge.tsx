import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../../theme';

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  style?: ViewStyle;
}

const variantConfig: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: colors.brand[100], text: colors.brand[700], dot: colors.brand[500] },
  warning: { bg: colors.amber[100], text: colors.amber[700], dot: colors.amber[500] },
  danger: { bg: colors.red[100], text: colors.red[700], dot: colors.red[500] },
  info: { bg: colors.blue[100], text: colors.blue[700], dot: colors.blue[500] },
  neutral: { bg: colors.gray[100], text: colors.gray[600], dot: colors.gray[400] },
  primary: { bg: colors.brand[50], text: colors.brand[700], dot: colors.brand[500] },
};

export function Badge({ label, variant = 'neutral', size = 'sm', dot = false, style }: BadgeProps) {
  const config = variantConfig[variant];

  return (
    <View
      style={[
        styles.base,
        size === 'md' && styles.md,
        { backgroundColor: config.bg },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: config.dot }]} />}
      <Text style={[styles.text, size === 'md' && styles.textMd, { color: config.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  text: {
    ...typography.badge,
  },
  textMd: {
    fontSize: 11,
  },
});
