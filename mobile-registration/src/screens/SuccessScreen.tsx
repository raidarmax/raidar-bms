import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';

type Props = {
  navigation: any;
  route: { params: { ownerName: string; phone: string; plate: string; serial: string } };
};

export default function SuccessScreen({ navigation, route }: Props) {
  const { ownerName, phone, plate, serial } = route.params;
  const paddedSerial = serial.length === 11 ? '0' + serial : serial;

  const handleRegisterAnother = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Scan' }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>✅</Text>
      </View>
      <Text style={styles.title}>Registration Complete</Text>
      <Text style={styles.subtitle}>All records have been linked successfully</Text>

      <View style={styles.card}>
        <Row label="Owner" value={ownerName} />
        <View style={styles.divider} />
        <Row label="Phone" value={phone} mono />
        <View style={styles.divider} />
        <Row label="Plate" value={plate} mono />
        <View style={styles.divider} />
        <Row label="Tracker" value={paddedSerial} accent />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleRegisterAnother}>
        <Text style={styles.buttonText}>Register Another</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono, accent && styles.accent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', marginBottom: spacing.lg },
  icon: { fontSize: 56 },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.xxl,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  rowLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  rowValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  mono: { fontFamily: 'monospace' },
  accent: { color: colors.primary, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border },
  button: {
    backgroundColor: colors.primary, paddingVertical: 16,
    borderRadius: borderRadius.lg, alignItems: 'center',
  },
  buttonText: { color: colors.text, fontSize: fontSize.base, fontWeight: '700' },
});
