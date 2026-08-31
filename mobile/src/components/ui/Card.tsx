import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, shadows, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, style, padded = true, variant = 'default' }: CardProps) {
  return (
    <View style={[styles.base, styles[variant], padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  default: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    ...shadows.sm,
  },
  elevated: {
    ...shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  padded: {
    padding: spacing.lg,
  },
});
