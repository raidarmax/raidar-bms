import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { formatFetchedAgo, type FetchStamp } from '../../services/data';

type Props = {
  stamp: FetchStamp | null;
  onRefresh?: () => void;
  hint?: string;
};

export function DataFooter({ stamp, onRefresh, hint }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => (n + 1) % 1000), 15000);
    return () => clearInterval(id);
  }, []);

  if (!stamp) return null;

  const ago = formatFetchedAgo(stamp.fetchedAt);
  const rows = stamp.rowCount === 1 ? '1 row' : `${stamp.rowCount} rows`;
  const err = stamp.errorMessage;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.dot, err ? styles.dotError : styles.dotOk]} />
        <Text style={styles.text} numberOfLines={1}>
          {err ? 'Live fetch failed' : 'Live data'}
          {stamp.filter ? ` · ${stamp.filter}` : ''}
          {' · '}
          {rows}
          {' · '}
          {ago}
        </Text>
        {onRefresh ? (
          <TouchableOpacity onPress={onRefresh} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.action}>Refresh</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {err ? (
        <Text style={styles.err} numberOfLines={2}>
          {err}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  dotOk: {
    backgroundColor: colors.green[500],
  },
  dotError: {
    backgroundColor: colors.red[500],
  },
  text: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.gray[600],
    fontSize: 11,
    letterSpacing: 0.2,
  },
  action: {
    ...typography.bodySmall,
    color: colors.brand[600],
    fontSize: 11,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.gray[500],
    fontSize: 10,
    marginTop: 2,
  },
  err: {
    ...typography.bodySmall,
    color: colors.red[600],
    fontSize: 10,
    marginTop: 2,
  },
});
