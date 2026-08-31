import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { registerMotorcycle } from '../services/registration';

type ExistingOwner = {
  id: string;
  full_name: string;
  phone_number: string;
  national_id: string;
  bike_count: number;
};

type Props = {
  navigation: any;
  route: {
    params: { serial: string; imei: string; plate: string; existingOwner: ExistingOwner };
  };
};

export default function DuplicateScreen({ navigation, route }: Props) {
  const { serial, imei, plate, existingOwner } = route.params;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleAddToExisting = async () => {
    setLoading(true);
    setError('');
    const result = await registerMotorcycle({
      ownerName: existingOwner.full_name,
      phone: existingOwner.phone_number,
      nationalId: existingOwner.national_id,
      plateNumber: plate,
      serial,
      imei,
      existingOwnerId: existingOwner.id,
    });
    setLoading(false);
    if (result.success) {
      navigation.reset({
        index: 0,
        routes: [{
          name: 'Success',
          params: { ownerName: existingOwner.full_name, phone: existingOwner.phone_number, plate, serial },
        }],
      });
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>⚠️</Text>
      </View>
      <Text style={styles.title}>Account Already Exists</Text>
      <Text style={styles.subtitle}>This phone number is already registered</Text>

      <View style={styles.card}>
        <Row label="Name" value={existingOwner.full_name} />
        <Row label="Phone" value={existingOwner.phone_number} mono />
        <Row label="National ID" value={existingOwner.national_id} mono />
        <Row label="Bikes on account" value={String(existingOwner.bike_count)} accent />
      </View>

      <Text style={styles.confirmText}>
        Add motorcycle <Text style={styles.highlight}>{plate.toUpperCase()}</Text> with tracker{' '}
        <Text style={styles.highlight}>{serial}</Text> to this account?
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addBtn, loading && styles.btnDisabled]}
          onPress={handleAddToExisting}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addBtnText}>Add to Account</Text>
          )}
        </TouchableOpacity>
      </View>
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
  iconWrap: { alignItems: 'center', marginBottom: spacing.md },
  icon: { fontSize: 48 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  rowValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  mono: { fontFamily: 'monospace' },
  accent: { color: colors.primary },
  confirmText: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.xl },
  highlight: { color: colors.primary, fontFamily: 'monospace', fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: spacing.md },
  backBtn: {
    flex: 1, backgroundColor: colors.surfaceLight, paddingVertical: 14,
    borderRadius: borderRadius.lg, alignItems: 'center',
  },
  backBtnText: { color: colors.text, fontSize: fontSize.base, fontWeight: '600' },
  addBtn: {
    flex: 2, backgroundColor: colors.primary, paddingVertical: 14,
    borderRadius: borderRadius.lg, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  addBtnText: { color: colors.text, fontSize: fontSize.base, fontWeight: '700' },
});
