import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import {
  SearchIcon,
  XIcon,
  MotorcycleIcon,
  UserIcon,
  ShieldIcon,
  AlertTriangleIcon,
  ReceiptIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
} from '../../components/icons/Icons';
import { getSupabase } from '../../services/supabase';

type Category = 'all' | 'bikes' | 'riders' | 'officers' | 'stations' | 'incidents' | 'fines';

type Result = {
  key: string;
  kind: Exclude<Category, 'all'>;
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  chip?: { label: string; color: string; bg: string };
  createdAt?: string;
};

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bikes', label: 'Bikes' },
  { key: 'riders', label: 'Riders' },
  { key: 'officers', label: 'Officers' },
  { key: 'stations', label: 'Stations' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'fines', label: 'Fines' },
];

// PostgREST `.or()` requires `*` as the wildcard because `%` collides with URL
// percent-encoding and gets dropped, which is why the previous version returned
// every row for every query. Strip anything that would break the .or() syntax.
function toStarWildcard(term: string): string {
  const cleaned = term.replace(/([*,()\\])/g, '');
  return `*${cleaned}*`;
}

export default function SearchScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<any>(null);
  const reqIdRef = useRef(0);

  const trimmed = query.trim();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    timerRef.current = setTimeout(() => runSearch(trimmed, category), 260);
    return () => timerRef.current && clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, category]);

  const runSearch = async (term: string, cat: Category) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    const supabase = getSupabase();
    const w = toStarWildcard(term);
    const buckets: Result[] = [];

    const runners: Array<PromiseLike<void>> = [];

    if (cat === 'all' || cat === 'bikes') {
      runners.push(
        supabase
          .from('motorcycles')
          .select(
            'id, registration_number, make, model, is_compliant, insurance_expiry, inspection_expiry, status, created_at',
          )
          .or(
            [
              `registration_number.ilike.${w}`,
              `make.ilike.${w}`,
              `model.ilike.${w}`,
            ].join(','),
          )
          .order('created_at', { ascending: false })
          .limit(cat === 'bikes' ? 40 : 8)
          .then(({ data }) => {
            (data || []).forEach((m: any) => {
              const compliant = m.is_compliant === true;
              buckets.push({
                key: `bike-${m.id}`,
                kind: 'bikes',
                id: m.id,
                title: m.registration_number || '—',
                subtitle:
                  [m.make, m.model].filter(Boolean).join(' ') || 'Motorcycle',
                meta: m.status
                  ? String(m.status).replace(/_/g, ' ')
                  : undefined,
                chip: {
                  label: compliant ? 'Compliant' : 'Non-compliant',
                  color: compliant ? colors.green[700] : colors.rose[700],
                  bg: compliant ? colors.green[50] : colors.rose[50],
                },
                createdAt: m.created_at,
              });
            });
          }),
      );
    }

    if (cat === 'all' || cat === 'riders') {
      runners.push(
        supabase
          .from('riders')
          .select(
            'id, name, bms_id, phone_number, national_registration_number, id_number, rating_tier, license_expiry, created_at',
          )
          .or(
            [
              `name.ilike.${w}`,
              `bms_id.ilike.${w}`,
              `phone_number.ilike.${w}`,
              `national_registration_number.ilike.${w}`,
              `id_number.ilike.${w}`,
            ].join(','),
          )
          .order('created_at', { ascending: false })
          .limit(cat === 'riders' ? 40 : 8)
          .then(({ data }) => {
            (data || []).forEach((r: any) => {
              const tier = (r.rating_tier || '').toString();
              const tierColor =
                tier === 'gold'
                  ? colors.amber[700]
                  : tier === 'silver'
                    ? colors.gray[600]
                    : tier === 'bronze'
                      ? colors.orange[700]
                      : colors.brand[700];
              buckets.push({
                key: `rider-${r.id}`,
                kind: 'riders',
                id: r.id,
                title: r.name || 'Unnamed rider',
                subtitle: r.bms_id
                  ? `BMS ${r.bms_id}`
                  : r.phone_number || '—',
                meta:
                  r.national_registration_number ||
                  r.id_number ||
                  undefined,
                chip: tier
                  ? {
                      label: tier.toUpperCase(),
                      color: tierColor,
                      bg: colors.gray[100],
                    }
                  : undefined,
                createdAt: r.created_at,
              });
            });
          }),
      );
    }

    if (cat === 'all' || cat === 'officers') {
      runners.push(
        supabase
          .from('police_officers')
          .select(
            'id, full_name, rank, service_number, badge_number, phone_number, created_at',
          )
          .or(
            [
              `full_name.ilike.${w}`,
              `service_number.ilike.${w}`,
              `badge_number.ilike.${w}`,
              `phone_number.ilike.${w}`,
            ].join(','),
          )
          .order('created_at', { ascending: false })
          .limit(cat === 'officers' ? 40 : 6)
          .then(({ data }) => {
            (data || []).forEach((o: any) => {
              buckets.push({
                key: `officer-${o.id}`,
                kind: 'officers',
                id: o.id,
                title: o.full_name || 'Officer',
                subtitle: o.rank || 'Police Officer',
                meta: o.service_number
                  ? `Service ${o.service_number}`
                  : undefined,
                createdAt: o.created_at,
              });
            });
          }),
      );
    }

    if (cat === 'all' || cat === 'stations') {
      runners.push(
        supabase
          .from('police_stations')
          .select(
            'id, station_name, station_code, station_type, phone_number, created_at',
          )
          .or(
            [
              `station_name.ilike.${w}`,
              `station_code.ilike.${w}`,
            ].join(','),
          )
          .order('created_at', { ascending: false })
          .limit(cat === 'stations' ? 40 : 6)
          .then(({ data }) => {
            (data || []).forEach((s: any) => {
              buckets.push({
                key: `station-${s.id}`,
                kind: 'stations',
                id: s.id,
                title: s.station_name || 'Station',
                subtitle:
                  [s.station_type, s.station_code].filter(Boolean).join(' · ') ||
                  '—',
                meta: s.phone_number || undefined,
                createdAt: s.created_at,
              });
            });
          }),
      );
    }

    if (cat === 'all' || cat === 'incidents') {
      runners.push(
        supabase
          .from('incidents')
          .select(
            'id, case_number, incident_type, location, police_status, created_at, reporter_name',
          )
          .or(
            [
              `case_number.ilike.${w}`,
              `location.ilike.${w}`,
              `incident_type.ilike.${w}`,
              `reporter_name.ilike.${w}`,
            ].join(','),
          )
          .order('created_at', { ascending: false })
          .limit(cat === 'incidents' ? 40 : 6)
          .then(({ data }) => {
            (data || []).forEach((i: any) => {
              buckets.push({
                key: `incident-${i.id}`,
                kind: 'incidents',
                id: i.id,
                title: i.case_number || 'Awaiting case number',
                subtitle: String(i.incident_type || '').replace(/_/g, ' '),
                meta: i.location || undefined,
                chip: {
                  label: String(i.police_status || 'open')
                    .replace(/_/g, ' ')
                    .toUpperCase(),
                  color: colors.blue[700],
                  bg: colors.blue[50],
                },
                createdAt: i.created_at,
              });
            });
          }),
      );
    }

    if (cat === 'all' || cat === 'fines') {
      runners.push(
        supabase
          .from('fines')
          .select(
            'id, fine_reference, fine_amount, status, rider_name, rider_phone, rider_national_id, location_description, created_at, issued_at',
          )
          .or(
            [
              `fine_reference.ilike.${w}`,
              `rider_name.ilike.${w}`,
              `rider_phone.ilike.${w}`,
              `rider_national_id.ilike.${w}`,
              `location_description.ilike.${w}`,
            ].join(','),
          )
          .order('issued_at', { ascending: false })
          .limit(cat === 'fines' ? 40 : 6)
          .then(({ data }) => {
            (data || []).forEach((f: any) => {
              const paid = String(f.status || '').toLowerCase() === 'paid';
              buckets.push({
                key: `fine-${f.id}`,
                kind: 'fines',
                id: f.id,
                title: f.fine_reference || 'Fine',
                subtitle: f.rider_name || 'Rider unknown',
                meta: `KES ${Number(f.fine_amount || 0).toLocaleString()}${
                  f.location_description ? ` · ${f.location_description}` : ''
                }`,
                chip: {
                  label: paid ? 'PAID' : 'UNPAID',
                  color: paid ? colors.green[700] : colors.rose[700],
                  bg: paid ? colors.green[50] : colors.rose[50],
                },
                createdAt: f.issued_at || f.created_at,
              });
            });
          }),
      );
    }

    await Promise.allSettled(runners);
    if (reqId !== reqIdRef.current) return;

    buckets.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });

    setResults(buckets);
    setLoading(false);
  };

  const grouped = useMemo(() => {
    if (category !== 'all') return { [category]: results } as Record<string, Result[]>;
    const g: Record<string, Result[]> = {};
    results.forEach((r) => {
      g[r.kind] = g[r.kind] || [];
      g[r.kind].push(r);
    });
    return g;
  }, [results, category]);

  const openResult = (r: Result) => {
    if (r.kind === 'bikes') navigation.navigate('SearchBike', { motorcycleId: r.id });
    else if (r.kind === 'riders') navigation.navigate('SearchRider', { riderId: r.id });
    else if (r.kind === 'officers') navigation.navigate('SearchOfficer', { officerId: r.id });
    else if (r.kind === 'stations') navigation.navigate('SearchStation', { stationId: r.id });
    else if (r.kind === 'incidents') {
      navigation.navigate('IncidentsTab', {
        screen: 'IncidentDetail',
        params: { incidentId: r.id },
      });
    } else if (r.kind === 'fines') {
      navigation.navigate('FinesTab', { screen: 'FineDetail', params: { fineId: r.id } });
    }
  };

  const kindMeta: Record<Result['kind'], { label: string; icon: any; color: string; bg: string }> = {
    bikes: { label: 'Bikes', icon: MotorcycleIcon, color: colors.green[700], bg: colors.green[50] },
    riders: { label: 'Riders', icon: UserIcon, color: colors.blue[700], bg: colors.blue[50] },
    officers: { label: 'Officers', icon: ShieldIcon, color: colors.brand[700], bg: colors.brand[50] },
    stations: { label: 'Stations', icon: ShieldIcon, color: colors.gray[700], bg: colors.gray[100] },
    incidents: {
      label: 'Incidents',
      icon: AlertTriangleIcon,
      color: colors.rose[700],
      bg: colors.rose[50],
    },
    fines: { label: 'Fines', icon: ReceiptIcon, color: colors.amber[700], bg: colors.amber[50] },
  };

  const renderRow = (r: Result) => {
    const meta = kindMeta[r.kind];
    const Icon = meta.icon;
    return (
      <TouchableOpacity
        key={r.key}
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => openResult(r)}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Icon size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {r.title}
            </Text>
            {r.chip ? (
              <View style={[styles.chip, { backgroundColor: r.chip.bg }]}>
                <Text style={[styles.chipText, { color: r.chip.color }]}>
                  {r.chip.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {r.subtitle}
          </Text>
          {r.meta ? (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {r.meta}
            </Text>
          ) : null}
        </View>
        <ChevronRightIcon size={18} color={colors.gray[300]} />
      </TouchableOpacity>
    );
  };

  const totalCount = results.length;
  const orderedKinds: Result['kind'][] = [
    'bikes',
    'riders',
    'incidents',
    'fines',
    'officers',
    'stations',
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <ChevronLeftIcon size={22} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <SearchIcon size={18} color={colors.gray[400]} />
          <TextInput
            style={styles.input}
            placeholder="Plate, BMS ID, name, phone, case, fine..."
            placeholderTextColor={colors.gray[400]}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <XIcon size={16} color={colors.gray[400]} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.chipRail}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCategory(c.key)}
                activeOpacity={0.85}
                style={[styles.catChip, active && styles.catChipActive]}
              >
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand[500]} size="large" />
      ) : (
        <FlatList
          data={category === 'all' ? orderedKinds.filter((k) => grouped[k]?.length) : ['single']}
          keyExtractor={(k: string) => k}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <SearchIcon size={40} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>
                {trimmed ? `No matches for "${trimmed}"` : 'Search across BMS'}
              </Text>
              <Text style={styles.emptyText}>
                {trimmed
                  ? 'Try a different keyword, plate number, BMS ID or phone number.'
                  : 'Find bikes, riders, officers, stations, incidents and fines. Tap a result to see full details or track a bike live.'}
              </Text>
            </View>
          }
          renderItem={({ item }: { item: string }) => {
            if (category !== 'all') {
              const list = grouped[category] || [];
              if (list.length === 0) return null;
              return <View>{list.map(renderRow)}</View>;
            }
            const kind = item as Result['kind'];
            const list = grouped[kind];
            if (!list || list.length === 0) return null;
            const meta = kindMeta[kind];
            return (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>
                  {meta.label} · {list.length}
                </Text>
                {list.map(renderRow)}
              </View>
            );
          }}
          ListHeaderComponent={
            trimmed && totalCount > 0 ? (
              <Text style={styles.totalText}>
                {totalCount} result{totalCount === 1 ? '' : 's'} for "{trimmed}"
              </Text>
            ) : null
          }
        />
      )}
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
  backBtn: { width: 40, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { ...typography.h2, fontSize: 17 },
  searchBarWrap: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  input: { flex: 1, fontSize: 14, color: colors.gray[900], padding: 0 },
  chipRail: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  chipRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 2,
    alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: 6,
  },
  catChipActive: { backgroundColor: colors.gray[900] },
  catChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray[600],
    letterSpacing: 0.2,
  },
  catChipTextActive: { color: colors.white },
  loader: { marginTop: spacing.xxxxl },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxxxl },
  totalText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.gray[500],
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  group: { marginBottom: spacing.md },
  groupTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gray[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray[100],
    ...shadows.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.gray[900], flex: 1 },
  cardSubtitle: { fontSize: 12, color: colors.gray[600], marginTop: 2 },
  cardMeta: { fontSize: 11, color: colors.gray[400], marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  emptyWrap: {
    alignItems: 'center',
    padding: spacing.xxxl,
    gap: spacing.sm,
    marginTop: spacing.xxxxl,
  },
  emptyTitle: { ...typography.h2, fontSize: 16, marginTop: spacing.md, textAlign: 'center' },
  emptyText: {
    ...typography.bodySmall,
    textAlign: 'center',
    color: colors.gray[500],
    maxWidth: 320,
  },
});
