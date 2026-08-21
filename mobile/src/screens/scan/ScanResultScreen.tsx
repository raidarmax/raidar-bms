import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabase } from '../../services/supabase';
import type { Rider, Motorcycle, Incident, Owner } from '../../services/supabase';
import { parseQR } from '../../services/qrParser';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import {
  UserIcon,
  MotorcycleIcon,
  AlertTriangleIcon,
  QrCodeIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  PhoneIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
} from '../../components/icons/Icons';
import { KenyaPlate } from '../../components/ui/KenyaPlate';

type ResultKind = 'rider' | 'motorcycle' | 'incident' | 'unknown';

type RiderStats = {
  incidentsCount: number;
  unpaidFinesCount: number;
  unpaidFinesTotal: number;
};

type MotoStats = {
  incidentsCount: number;
  unpaidFinesTotal: number;
};

export default function ScanResultScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { scannedData } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resultType, setResultType] = useState<ResultKind>('unknown');
  const [rider, setRider] = useState<Rider | null>(null);
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [riderStats, setRiderStats] = useState<RiderStats>({
    incidentsCount: 0,
    unpaidFinesCount: 0,
    unpaidFinesTotal: 0,
  });
  const [motoStats, setMotoStats] = useState<MotoStats>({
    incidentsCount: 0,
    unpaidFinesTotal: 0,
  });

  const lookup = useCallback(async () => {
    const parsed = parseQR(scannedData);
    const supabase = getSupabase();
    setRider(null);
    setMotorcycle(null);
    setOwner(null);
    setIncident(null);

    try {
      if (parsed.kind === 'rider') {
        const { data: r } = await supabase
          .from('riders')
          .select('*')
          .eq('bms_id', parsed.identifier)
          .maybeSingle();
        if (!r) {
          setResultType('unknown');
          return;
        }
        setRider(r);
        setResultType('rider');
        if (r.motorcycle_id) {
          const { data: m } = await supabase
            .from('motorcycles')
            .select('*')
            .eq('id', r.motorcycle_id)
            .maybeSingle();
          if (m) {
            setMotorcycle(m);
            if (m.owner_id) {
              const { data: o } = await supabase
                .from('owners')
                .select('*')
                .eq('id', m.owner_id)
                .maybeSingle();
              if (o) setOwner(o);
            }
          }
        }
        const [{ count: incCount }, { data: fineRows }] = await Promise.all([
          supabase
            .from('incidents')
            .select('id', { count: 'exact', head: true })
            .eq('rider_id', r.id),
          supabase
            .from('fines')
            .select('id, fine_amount, status')
            .eq('rider_id', r.id)
            .in('status', ['issued', 'overdue']),
        ]);
        const unpaid = (fineRows || []) as { fine_amount: number }[];
        setRiderStats({
          incidentsCount: incCount || 0,
          unpaidFinesCount: unpaid.length,
          unpaidFinesTotal: unpaid.reduce((sum, f) => sum + Number(f.fine_amount || 0), 0),
        });
      } else if (parsed.kind === 'motorcycle') {
        const plate = parsed.identifier.replace(/\s+/g, '');
        const { data: candidates } = await supabase
          .from('motorcycles')
          .select('*')
          .or(
            `registration_number.eq.${parsed.identifier},registration_number.eq.${plate}`,
          )
          .limit(1);
        const m = candidates && candidates[0];
        if (!m) {
          setResultType('unknown');
          return;
        }
        setMotorcycle(m);
        setResultType('motorcycle');
        if (m.owner_id) {
          const { data: o } = await supabase
            .from('owners')
            .select('*')
            .eq('id', m.owner_id)
            .maybeSingle();
          if (o) setOwner(o);
        }
        const { data: riderRow } = await supabase
          .from('riders')
          .select('*')
          .eq('motorcycle_id', m.id)
          .maybeSingle();
        if (riderRow) setRider(riderRow);

        const [{ count: incCount }, { data: fineRows }] = await Promise.all([
          supabase
            .from('incidents')
            .select('id', { count: 'exact', head: true })
            .eq('motorcycle_id', m.id),
          supabase
            .from('fines')
            .select('id, fine_amount, status')
            .eq('motorcycle_id', m.id)
            .in('status', ['issued', 'overdue']),
        ]);
        const unpaid = (fineRows || []) as { fine_amount: number }[];
        setMotoStats({
          incidentsCount: incCount || 0,
          unpaidFinesTotal: unpaid.reduce((sum, f) => sum + Number(f.fine_amount || 0), 0),
        });
      } else if (parsed.kind === 'incident') {
        const { data: c } = await supabase
          .from('incidents')
          .select('*')
          .eq('case_number', parsed.identifier)
          .maybeSingle();
        if (c) {
          setIncident(c);
          setResultType('incident');
        } else {
          setResultType('unknown');
        }
      } else {
        setResultType('unknown');
      }
    } catch {
      setResultType('unknown');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scannedData]);

  useEffect(() => {
    setLoading(true);
    lookup();
  }, [lookup]);

  const onRefresh = () => {
    setRefreshing(true);
    lookup();
  };

  const parsedHint = React.useMemo(() => {
    const p = parseQR(scannedData);
    if (p.kind === 'rider') return `BMS ${p.identifier}`;
    if (p.kind === 'motorcycle') return `Plate ${p.identifier}`;
    if (p.kind === 'incident') return `Case ${p.identifier}`;
    return 'Scanned code';
  }, [scannedData]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <ChevronLeftIcon size={22} color={colors.gray[700]} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerHint} numberOfLines={1}>
          {parsedHint}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand[500]} size="large" />
          <Text style={styles.loadingText}>Looking up scan…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />
          }
        >
          {resultType === 'rider' && rider && (
            <RiderView
              rider={rider}
              motorcycle={motorcycle}
              owner={owner}
              stats={riderStats}
              onOpenRider={() => navigation.navigate('SearchRider', { riderId: rider.id })}
              onOpenBike={() =>
                motorcycle && navigation.navigate('SearchBike', { motorcycleId: motorcycle.id })
              }
            />
          )}

          {resultType === 'motorcycle' && motorcycle && (
            <MotorcycleView
              motorcycle={motorcycle}
              rider={rider}
              owner={owner}
              stats={motoStats}
              onOpenBike={() => navigation.navigate('SearchBike', { motorcycleId: motorcycle.id })}
              onOpenRider={() =>
                rider && navigation.navigate('SearchRider', { riderId: rider.id })
              }
            />
          )}

          {resultType === 'incident' && incident && (
            <IncidentView
              incident={incident}
              onOpen={() =>
                navigation.navigate('IncidentsTab', {
                  screen: 'IncidentDetail',
                  params: { incidentId: incident.id },
                })
              }
            />
          )}

          {resultType === 'unknown' && (
            <UnknownView raw={scannedData} onRetry={() => navigation.goBack()} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: ok ? colors.green[50] : colors.rose[50] },
      ]}
    >
      {ok ? (
        <CheckCircleIcon size={12} color={colors.green[700]} />
      ) : (
        <AlertTriangleIcon size={12} color={colors.rose[700]} />
      )}
      <Text
        style={[
          styles.pillText,
          { color: ok ? colors.green[700] : colors.rose[700] },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ComplianceRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <View style={styles.compRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {ok ? (
          <CheckCircleIcon size={16} color={colors.green[600]} />
        ) : (
          <AlertTriangleIcon size={16} color={colors.rose[600]} />
        )}
        <Text style={styles.compLabel}>{label}</Text>
      </View>
      <Text
        style={[
          styles.compDetail,
          { color: ok ? colors.gray[600] : colors.rose[600] },
        ]}
        numberOfLines={1}
      >
        {detail}
      </Text>
    </View>
  );
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return isFinite(t) && t < Date.now();
}

function dateShort(iso: string | null | undefined): string {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return 'Not set';
  }
}

function RiderView({
  rider,
  motorcycle,
  owner,
  stats,
  onOpenRider,
  onOpenBike,
}: {
  rider: Rider;
  motorcycle: Motorcycle | null;
  owner: Owner | null;
  stats: RiderStats;
  onOpenRider: () => void;
  onOpenBike: () => void;
}) {
  const licenseOk = rider.license_verified && !isExpired(rider.license_expiry);
  const tier = (rider.rating_tier || '').toString().toUpperCase();

  return (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          {rider.photo_url ? (
            <Image source={{ uri: rider.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <UserIcon size={30} color={colors.brand[700]} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName} numberOfLines={2}>{rider.name}</Text>
            {rider.bms_id ? (
              <Text style={styles.bmsChip}>BMS {rider.bms_id}</Text>
            ) : null}
            <View style={styles.pillRow}>
              <StatusPill ok={licenseOk} label={licenseOk ? 'License OK' : 'License Issue'} />
              {tier ? (
                <View style={[styles.pill, { backgroundColor: colors.gray[100] }]}>
                  <ShieldCheckIcon size={12} color={colors.gray[700]} />
                  <Text style={[styles.pillText, { color: colors.gray[700] }]}>{tier}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {rider.phone_number ? (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => Linking.openURL(`tel:${rider.phone_number}`)}
          >
            <PhoneIcon size={16} color={colors.white} />
            <Text style={styles.primaryActionText}>Call {rider.phone_number}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.statRow}>
          <StatBox label="RATING" value={rider.rating_score != null ? String(rider.rating_score) : '—'} />
          <StatBox label="INCIDENTS" value={String(stats.incidentsCount)} />
          <StatBox label="UNPAID FINES" value={String(stats.unpaidFinesCount)} />
          <StatBox
            label="OWED"
            value={`KES ${stats.unpaidFinesTotal.toLocaleString()}`}
            small
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Compliance</Text>
      <View style={styles.card}>
        <ComplianceRow
          label="License Verified"
          ok={!!rider.license_verified}
          detail={rider.license_verified ? 'Verified' : 'Not verified'}
        />
        <ComplianceRow
          label="License Expiry"
          ok={!isExpired(rider.license_expiry)}
          detail={dateShort(rider.license_expiry)}
        />
        <ComplianceRow
          label="License Number"
          ok={!!rider.license_number}
          detail={rider.license_number || 'Not recorded'}
        />
      </View>

      <Text style={styles.sectionLabel}>Identity</Text>
      <View style={styles.card}>
        <Row label="National ID" value={rider.id_number} />
        <Row label="Phone" value={rider.phone_number || '—'} last />
      </View>

      {motorcycle ? (
        <>
          <Text style={styles.sectionLabel}>Associated Motorcycle</Text>
          <TouchableOpacity activeOpacity={0.9} style={styles.bikeCard} onPress={onOpenBike}>
            <View style={styles.bikeHeader}>
              {motorcycle.bike_photo_url ? (
                <Image source={{ uri: motorcycle.bike_photo_url }} style={styles.bikeThumb} />
              ) : (
                <View style={[styles.bikeThumb, styles.bikeThumbPlaceholder]}>
                  <MotorcycleIcon size={26} color={colors.brand[700]} />
                </View>
              )}
              <View style={{ flex: 1, gap: 6 }}>
                <KenyaPlate plate={motorcycle.registration_number} size="md" />
                <Text style={styles.bikeMakeModel}>
                  {[motorcycle.make, motorcycle.model].filter(Boolean).join(' ') || 'Motorcycle'}
                </Text>
              </View>
              <ChevronRightIcon size={18} color={colors.gray[400]} />
            </View>

            <View style={styles.divider} />

            <ComplianceRow
              label="Compliance"
              ok={!!motorcycle.is_compliant}
              detail={motorcycle.is_compliant ? 'Compliant' : 'Non-compliant'}
            />
            <ComplianceRow
              label="Insurance"
              ok={!!motorcycle.insurance_provider && !isExpired(motorcycle.insurance_expiry)}
              detail={
                motorcycle.insurance_provider
                  ? `Exp ${dateShort(motorcycle.insurance_expiry)}`
                  : 'Not recorded'
              }
            />
            <ComplianceRow
              label="Inspection"
              ok={!isExpired(motorcycle.inspection_expiry) && !!motorcycle.inspection_expiry}
              detail={
                motorcycle.inspection_expiry
                  ? `Exp ${dateShort(motorcycle.inspection_expiry)}`
                  : 'Not recorded'
              }
            />
          </TouchableOpacity>
        </>
      ) : null}

      {owner ? (
        <>
          <Text style={styles.sectionLabel}>Owner</Text>
          <View style={styles.card}>
            <Row label="Name" value={owner.full_name} />
            <Row label="Phone" value={owner.phone_number || '—'} />
            <Row label="National ID" value={owner.national_id} last />
          </View>
        </>
      ) : null}

      <TouchableOpacity style={styles.secondaryAction} onPress={onOpenRider}>
        <Text style={styles.secondaryActionText}>Open full rider profile</Text>
        <ChevronRightIcon size={18} color={colors.brand[700]} />
      </TouchableOpacity>
    </View>
  );
}

function MotorcycleView({
  motorcycle,
  rider,
  owner,
  stats,
  onOpenBike,
  onOpenRider,
}: {
  motorcycle: Motorcycle;
  rider: Rider | null;
  owner: Owner | null;
  stats: MotoStats;
  onOpenBike: () => void;
  onOpenRider: () => void;
}) {
  return (
    <View>
      <View style={styles.heroCard}>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
          <KenyaPlate plate={motorcycle.registration_number} size="lg" />
          <Text style={styles.bikeMakeModel}>
            {[motorcycle.make, motorcycle.model].filter(Boolean).join(' ') || 'Motorcycle'}
          </Text>
          <View style={styles.pillRow}>
            <StatusPill
              ok={!!motorcycle.is_compliant}
              label={motorcycle.is_compliant ? 'Compliant' : 'Non-compliant'}
            />
            <View style={[styles.pill, { backgroundColor: colors.gray[100] }]}>
              <Text style={[styles.pillText, { color: colors.gray[700] }]}>
                {(motorcycle.status || 'unknown').toString().toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          <StatBox label="INCIDENTS" value={String(stats.incidentsCount)} />
          <StatBox
            label="UNPAID FINES"
            value={`KES ${stats.unpaidFinesTotal.toLocaleString()}`}
            small
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Compliance</Text>
      <View style={styles.card}>
        <ComplianceRow
          label="Insurance"
          ok={!!motorcycle.insurance_provider && !isExpired(motorcycle.insurance_expiry)}
          detail={
            motorcycle.insurance_provider
              ? `${motorcycle.insurance_provider} · Exp ${dateShort(motorcycle.insurance_expiry)}`
              : 'Not recorded'
          }
        />
        <ComplianceRow
          label="Inspection Expiry"
          ok={!isExpired(motorcycle.inspection_expiry) && !!motorcycle.inspection_expiry}
          detail={dateShort(motorcycle.inspection_expiry)}
        />
        <ComplianceRow
          label="Overall"
          ok={!!motorcycle.is_compliant}
          detail={motorcycle.is_compliant ? 'Compliant' : 'Non-compliant'}
        />
      </View>

      {rider ? (
        <>
          <Text style={styles.sectionLabel}>Assigned Rider</Text>
          <TouchableOpacity activeOpacity={0.85} style={styles.card} onPress={onOpenRider}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {rider.photo_url ? (
                <Image source={{ uri: rider.photo_url }} style={styles.avatarSm} />
              ) : (
                <View style={[styles.avatarSm, styles.avatarPlaceholder]}>
                  <UserIcon size={20} color={colors.brand[700]} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.riderName}>{rider.name}</Text>
                {rider.bms_id ? (
                  <Text style={styles.bmsChip}>BMS {rider.bms_id}</Text>
                ) : null}
              </View>
              <ChevronRightIcon size={18} color={colors.gray[400]} />
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {owner ? (
        <>
          <Text style={styles.sectionLabel}>Owner</Text>
          <View style={styles.card}>
            <Row label="Name" value={owner.full_name} />
            <Row label="Phone" value={owner.phone_number || '—'} />
            <Row label="National ID" value={owner.national_id} last />
          </View>
        </>
      ) : null}

      <TouchableOpacity style={styles.secondaryAction} onPress={onOpenBike}>
        <Text style={styles.secondaryActionText}>Open full motorcycle profile</Text>
        <ChevronRightIcon size={18} color={colors.brand[700]} />
      </TouchableOpacity>
    </View>
  );
}

function IncidentView({ incident, onOpen }: { incident: Incident; onOpen: () => void }) {
  return (
    <View>
      <View style={styles.heroCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md }}>
          <View style={[styles.avatar, { backgroundColor: colors.rose[50] }]}>
            <AlertTriangleIcon size={26} color={colors.rose[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{incident.case_number || 'Incident'}</Text>
            <Text style={styles.bmsChip}>{(incident.incident_type || '').replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Row label="Status" value={incident.police_status} />
          <Row label="Location" value={incident.location || '—'} />
          <Row
            label="Date"
            value={dateShort(incident.incident_date || incident.created_at)}
            last
          />
        </View>
      </View>

      <TouchableOpacity style={styles.secondaryAction} onPress={onOpen}>
        <Text style={styles.secondaryActionText}>Open case</Text>
        <ChevronRightIcon size={18} color={colors.brand[700]} />
      </TouchableOpacity>
    </View>
  );
}

function UnknownView({ raw, onRetry }: { raw: string; onRetry: () => void }) {
  return (
    <View style={styles.heroCard}>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
        <View style={[styles.avatar, { backgroundColor: colors.gray[100] }]}>
          <QrCodeIcon size={30} color={colors.gray[500]} />
        </View>
        <Text style={styles.riderName}>No match found</Text>
        <Text style={styles.hintText}>
          The scanned code doesn't match a registered rider, motorcycle, or case.
        </Text>
        <View
          style={{
            backgroundColor: colors.gray[50],
            padding: spacing.md,
            borderRadius: borderRadius.md,
            alignSelf: 'stretch',
          }}
        >
          <Text style={styles.rawText}>{raw}</Text>
        </View>
        <TouchableOpacity style={styles.primaryAction} onPress={onRetry}>
          <Text style={styles.primaryActionText}>Scan again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, small && { fontSize: 13 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.gray[700] },
  headerHint: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray[700],
    letterSpacing: 0.3,
    maxWidth: '55%',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxxxl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { ...typography.bodySmall, color: colors.gray[500] },

  heroCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[50],
  },
  avatarSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[50],
  },
  avatarPlaceholder: {
    backgroundColor: colors.brand[50],
  },
  riderName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray[900],
    letterSpacing: -0.3,
  },
  bmsChip: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand[700],
    letterSpacing: 0.4,
  },
  pillRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand[600],
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  primaryActionText: { color: colors.white, fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand[50],
    marginTop: spacing.sm,
  },
  secondaryActionText: { color: colors.brand[700], fontWeight: '700', fontSize: 14 },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statBox: {
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray[500],
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.gray[900] },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.gray[500],
    marginBottom: 6,
    marginTop: spacing.sm,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  bikeCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  bikeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bikeThumb: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
  },
  bikeThumbPlaceholder: {
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeMakeModel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[700],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.md,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: spacing.md,
  },
  compLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[800],
  },
  compDetail: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.md,
  },
  rowLabel: { fontSize: 12, color: colors.gray[500], fontWeight: '600' },
  rowValue: {
    fontSize: 13,
    color: colors.gray[900],
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  rawText: {
    fontSize: 12,
    color: colors.gray[800],
    fontFamily: 'monospace',
  },
  hintText: {
    fontSize: 13,
    color: colors.gray[500],
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
