import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { UserIcon, PhoneIcon, ShieldCheckIcon } from '../../components/icons/Icons';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen({ navigation }: any) {
  const { officer } = useAuth();

  if (!officer) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Not logged in</Text>
      </View>
    );
  }

  const rows = [
    { label: 'Full Name', value: officer.full_name },
    { label: 'Service Number', value: officer.service_number },
    { label: 'Rank', value: officer.rank },
    { label: 'Badge Number', value: officer.badge_number || '—' },
    { label: 'Phone', value: officer.phone_number || '—' },
    { label: 'Email', value: officer.email || '—' },
    { label: 'Station', value: officer.station?.station_name || '—' },
    { label: 'Last Login', value: officer.last_login_at ? new Date(officer.last_login_at).toLocaleString() : 'Never' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <UserIcon size={32} color={colors.brand[600]} />
        </View>
        <Text style={styles.name}>{officer.full_name}</Text>
        <Text style={styles.rank}>{officer.rank}</Text>
      </View>

      <View style={styles.card}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[styles.row, index < rows.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  name: {
    ...typography.h2,
  },
  rank: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  label: {
    ...typography.label,
  },
  value: {
    ...typography.body,
    flex: 1,
    textAlign: 'right',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xxxxl,
  },
});
