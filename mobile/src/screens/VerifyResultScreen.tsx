import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { LookupResult, RiderLookup, MotorcycleLookup } from '../lib/lookup';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VerifyResult'>;
type R = RouteProp<RootStackParamList, 'VerifyResult'>;

export default function VerifyResultScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const lookup = params.lookup;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>VERIFICATION RESULT</Text>
        <ResultBody lookup={lookup} />

        <View style={styles.actions}>
          <Button label="Scan another" onPress={() => nav.navigate('Scan')} variant="secondary" />
          <Button label="Back to dashboard" onPress={() => nav.navigate('Dashboard')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultBody({ lookup }: { lookup: LookupResult }) {
  if (lookup.type === 'not_found') {
    return (
      <View style={[styles.card, styles.cardWarn]}>
        <Text style={styles.statusLabel}>No match</Text>
        <Text style={styles.title}>Nothing found for</Text>
        <Text style={styles.mono}>{lookup.identifier}</Text>
        <Text style={styles.body}>
          The identifier is not in the Raidar database. Verify the code and try again, or record it under manual lookup.
        </Text>
      </View>
    );
  }

  if (lookup.type === 'rider') return <RiderCard rider={lookup.data} />;
  if (lookup.type === 'motorcycle') return <MotorcycleCard motorcycle={lookup.data} />;

  if (lookup.type === 'incident') {
    const inc = lookup.data;
    return (
      <View style={styles.card}>
        <Text style={styles.statusLabel}>Incident case</Text>
        <Text style={styles.title}>{inc.incident_type}</Text>
        <Text style={styles.body}>{inc.description ?? 'No description on record.'}</Text>
        <MetaRow label="Location" value={inc.location_description ?? 'Unknown'} />
        <MetaRow label="Status" value={inc.police_status.replace(/_/g, ' ')} />
        <MetaRow label="Reported" value={new Date(inc.created_at).toLocaleString()} />
      </View>
    );
  }

  if (lookup.type === 'officer') {
    const off = lookup.data;
    return (
      <View style={styles.card}>
        <Text style={styles.statusLabel}>Officer</Text>
        <Text style={styles.title}>{off.full_name}</Text>
        <MetaRow label="Service #" value={off.service_number} />
        <MetaRow label="Rank" value={off.rank.replace(/_/g, ' ')} />
        <MetaRow label="Station" value={off.station ?? 'Unassigned'} />
      </View>
    );
  }

  return null;
}

function RiderCard({ rider }: { rider: RiderLookup }) {
  const compliance = rider.compliance;
  const chips: Array<[string, boolean]> = [
    ['License valid', compliance.license_valid],
    ['Insurance valid', compliance.insurance_valid],
    ['Inspection valid', compliance.inspection_valid],
    ['Bike verified', compliance.bike_verified],
  ];

  const overall = chips.every(([, ok]) => ok) && compliance.outstanding_fines === 0;

  return (
    <View style={[styles.card, overall ? styles.cardOk : styles.cardWarn]}>
      <Text style={styles.statusLabel}>{overall ? 'Compliant' : 'Action required'}</Text>
      <Text style={styles.title}>{rider.name}</Text>
      <Text style={styles.subtitle}>BMS {rider.bms_id ?? '—'}</Text>

      <View style={styles.chipsRow}>
        {chips.map(([label, ok]) => (
          <View key={label} style={[styles.chip, { backgroundColor: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
            <View
              style={[styles.chipDot, { backgroundColor: ok ? theme.colors.success : theme.colors.danger }]}
            />
            <Text style={[styles.chipText, { color: ok ? theme.colors.success : theme.colors.danger }]}>{label}</Text>
          </View>
        ))}
      </View>

      <MetaRow label="National ID" value={rider.id_number} />
      <MetaRow label="License" value={rider.license_number ?? 'Not on file'} />
      <MetaRow label="License expiry" value={formatDate(rider.license_expiry)} />
      <MetaRow label="Phone" value={rider.phone_number ?? '—'} />
      <MetaRow label="Rating" value={`${rider.rating_score ?? 0} · ${rider.rating_tier ?? 'unrated'}`} />
      <MetaRow label="Fines outstanding" value={String(compliance.outstanding_fines)} />

      {rider.motorcycle ? (
        <View style={styles.subCard}>
          <Text style={styles.subCardTitle}>Assigned motorcycle</Text>
          <MetaRow label="Registration" value={rider.motorcycle.registration_number} />
          <MetaRow
            label="Make / Model"
            value={[rider.motorcycle.make, rider.motorcycle.model].filter(Boolean).join(' ') || '—'}
          />
          <MetaRow label="Insurance expiry" value={formatDate(rider.motorcycle.insurance_expiry)} />
          <MetaRow label="Inspection expiry" value={formatDate(rider.motorcycle.inspection_expiry)} />
        </View>
      ) : (
        <View style={styles.subCard}>
          <Text style={styles.subCardTitle}>No motorcycle assigned</Text>
        </View>
      )}
    </View>
  );
}

function MotorcycleCard({ motorcycle }: { motorcycle: MotorcycleLookup }) {
  return (
    <View style={styles.card}>
      <Text style={styles.statusLabel}>Motorcycle</Text>
      <Text style={styles.title}>{motorcycle.registration_number}</Text>
      <Text style={styles.subtitle}>
        {[motorcycle.make, motorcycle.model].filter(Boolean).join(' ') || 'Make/model not on file'}
      </Text>
      <MetaRow label="Status" value={motorcycle.status} />
      <MetaRow label="Compliance" value={motorcycle.is_compliant ? 'Compliant' : 'Non-compliant'} />
      <MetaRow label="Insurance expiry" value={formatDate(motorcycle.insurance_expiry)} />
      <MetaRow label="Inspection expiry" value={formatDate(motorcycle.inspection_expiry)} />
      {motorcycle.owner ? (
        <View style={styles.subCard}>
          <Text style={styles.subCardTitle}>Registered owner</Text>
          <MetaRow label="Name" value={motorcycle.owner.full_name} />
          <MetaRow label="Phone" value={motorcycle.owner.phone_number} />
        </View>
      ) : null}
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(6) },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing(1),
  },
  cardOk: { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.06)' },
  cardWarn: { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.06)' },
  statusLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14 },
  body: { color: theme.colors.textSecondary, marginTop: theme.spacing(1), lineHeight: 21 },
  mono: { color: theme.colors.textPrimary, fontFamily: 'Menlo', fontSize: 15 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: theme.spacing(1) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  chipDot: { width: 6, height: 6, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingTop: 8,
    marginTop: 8,
  },
  metaLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  metaValue: { color: theme.colors.textPrimary, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  subCard: {
    marginTop: theme.spacing(1.5),
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
    gap: 4,
  },
  subCardTitle: { color: theme.colors.textPrimary, fontWeight: '600', marginBottom: 6 },
  actions: { gap: theme.spacing(1) },
});
