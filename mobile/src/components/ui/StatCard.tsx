import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, borderRadius, spacing, typography, shadows } from '../../theme';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  gradient?: string[];
  compact?: boolean;
  style?: ViewStyle;
}

export function StatCard({
  title,
  value,
  icon,
  gradient,
  compact = false,
  style,
}: StatCardProps) {
  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, compact && styles.compact, shadows.md, style]}
      >
        <View style={styles.gradientContent}>
          <Text style={[styles.gradientValue, compact && styles.compactValue]}>
            {value}
          </Text>
          <Text style={styles.gradientTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {icon && <View style={styles.watermarkIcon}>{icon}</View>}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.flat, compact && styles.compact, style]}>
      <Text style={[styles.flatValue, compact && styles.compactValue]}>
        {value}
      </Text>
      <Text style={styles.flatTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 90,
    justifyContent: 'flex-end',
  },
  compact: {
    minHeight: 72,
    padding: spacing.md,
  },
  gradientContent: {
    zIndex: 1,
  },
  gradientValue: {
    ...typography.stat,
    color: colors.white,
    marginBottom: 2,
  },
  compactValue: {
    ...typography.statSmall,
  },
  gradientTitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  watermarkIcon: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    opacity: 0.15,
  },
  flat: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    minHeight: 90,
    justifyContent: 'flex-end',
  },
  flatValue: {
    ...typography.stat,
    color: colors.gray[900],
    marginBottom: 2,
  },
  flatTitle: {
    ...typography.caption,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
