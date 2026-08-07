import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { theme } from '../theme';

type Props = {
  title: string;
  value: string;
  hint?: string;
  onPress?: () => void;
  accent?: string;
  style?: ViewStyle;
};

export function StatCard({ title, value, hint, onPress, accent = theme.colors.accent, style }: Props) {
  const content = (
    <View style={[styles.card, style]}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 140,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: theme.spacing(1),
  },
  title: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing(0.5),
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  hint: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing(0.5),
    fontSize: 12,
  },
});
