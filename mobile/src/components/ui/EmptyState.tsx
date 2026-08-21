import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && (
        <View style={styles.iconContainer}>
          {icon}
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxxl,
    paddingHorizontal: spacing.xxl,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h4,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodySmall,
    color: colors.gray[500],
    textAlign: 'center',
    maxWidth: 260,
  },
  action: {
    marginTop: spacing.xl,
  },
});
