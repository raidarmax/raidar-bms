import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../services/supabase';
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  SearchIcon,
  XIcon,
  UserIcon,
  CheckCircleIcon,
  ActivityIcon,
} from '../../components/icons/Icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import type { Incident } from '../../services/supabase';
import { INCIDENT_TYPE_META, STATUS_LIST_META, humanize, timeAgo } from './incidentMeta';
import { DataFooter } from '../../components/ui/DataFooter';
import type { FetchStamp } from '../../services/data';

type IncidentRow = Incident & {
  motorcycle?: { registration_number: string | null; make: string | null; model: string | null } | null;
  rider?: { name: string | null; bms_id: string | null } | null;
};

const PAGE_SIZE = 25;
type FilterKey = 'all' | 'unassigned' | 'investigating' | 'resolved' | 'closed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

// PostgREST uses `*` as the wildcard inside .or() clauses — % is URL-reserved
// and gets silently dropped, which is why the previous version returned every row.
function toStarWildcard(term: string): string {
  return `*${term.replace(/([*,()])/g, '')}*`;
}

function cleanReporterName(name: string | null | undefined, phone: string | null | undefined): string {
  const n = (name || '').trim();
  if (!n) return 'Reporter unknown';
  const looksTestPhone = phone && /^0?7?0000+/.test(phone);
  const looksTestName = /^anonymous( tester)?$/i.test(n) || /^test/i.test(n);
  if (looksTestName && looksTestPhone) return 'Unverified reporter';
  return n;
}

export default function IncidentListScreen({ navigation }: any) {
  const { officer } = useAuth();
  const stationId = officer?.station_id || null;

  const [allIncidents, setAllIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stamp, setStamp] = useState<FetchStamp | null>(null);

  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 220);
    return () => clearTimeout(t);
  }, [search]);

  const loadAll = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    try {
      const supabase = getSupabase();

      let base = supabase.from('incidents').select('*');
      if (stationId) base = base.eq('assigned_station_id', stationId);
      if (officer && !officer.is_station_admin) {
        base = base.or(`assigned_officer_id.eq.${officer.id},assigned_officer_id.is.null`);
      }
      const { data, error: qErr } = await base;
      if (qErr) throw qErr;
      if (reqId !== reqIdRef.current) return;

      const rows: any[] = (data as any[]) || [];

      const motoIds = Array.from(new Set(rows.map((r) => r.motorcycle_id).filter(Boolean))) as string[];
      const riderIds = Array.from(new Set(rows.map((r) => r.rider_id).filter(Boolean))) as string[];

      const [motoRes, riderRes] = await Promise.all([
        motoIds.length
          ? supabase
              .from('motorcycles')
              .select('id, registration_number, make, model')
              .in('id', motoIds)
          : Promise.resolve({ data: [] } as any),
        riderIds.length
          ? supabase.from('riders').select('id, name, bms_id').in('id', riderIds)
          : Promise.resolve({ data: [] } as any),
      ]);
      if (reqId !== reqIdRef.current) return;

      const motoMap: Record<string, any> = {};
      ((motoRes as any).data || []).forEach((m: any) => (motoMap[m.id] = m));
      const riderMap: Record<string, any> = {};
      ((riderRes as any).data || []).forEach((r: any) => (riderMap[r.id] = r));

      const hydrated: IncidentRow[] = rows.map((r) => ({
        ...r,
        motorcycle: r.motorcycle_id
          ? {
              registration_number: motoMap[r.motorcycle_id]?.registration_number ?? null,
              make: motoMap[r.motorcycle_id]?.make ?? null,
              model: motoMap[r.motorcycle_id]?.model ?? null,
            }
          : null,
        rider: r.rider_id
          ? {
              name: riderMap[r.rider_id]?.name ?? null,
              bms_id: riderMap[r.rider_id]?.bms_id ?? null,
            }
          : null,
      }));

      hydrated.sort((a, b) => {
        const ta = new Date(a.incident_date || a.created_at || 0).getTime();
        const tb = new Date(b.incident_date || b.created_at || 0).getTime();
        return tb - ta;
      });

      setAllIncidents(hydrated);
      setError(null);
      setStamp({
        fetchedAt: Date.now(),
        rowCount: hydrated.length,
        filter: stationId ? `station:${stationId.slice(0, 8)}` : 'all-stations',
      });
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setError(e?.message || 'Failed to load incidents');
      setAllIncidents([]);
      setStamp({
        fetchedAt: Date.now(),
        rowCount: 0,
        filter: stationId ? `station:${stationId.slice(0, 8)}` : 'all-stations',
        errorMessage: e?.message || 'Fetch failed',
      });
    }
  }, [stationId]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const totals = useMemo(() => {
    const buckets = { total: 0, unassigned: 0, investigating: 0, resolved: 0, closed: 0 };
    allIncidents.forEach((r) => {
      buckets.total += 1;
      const s = (r.police_status || 'unassigned') as keyof typeof buckets;
      if (s in buckets) (buckets as any)[s] += 1;
    });
    return buckets;
  }, [allIncidents]);

  const incidents = useMemo(() => {
    const term = debouncedSearch;
    return allIncidents.filter((r) => {
      if (filter !== 'all' && (r.police_status || 'unassigned') !== filter) return false;
      if (!term) return true;
      const hay = [
        r.case_number,
        r.location,
        r.description,
        r.reporter_name,
        r.reporter_phone,
        r.incident_type,
        r.motorcycle?.registration_number,
        r.rider?.name,
        r.rider?.bms_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [allIncidents, filter, debouncedSearch]);

  const hasMore = false;
  const loadingMore = false;
  const onEndReached = useCallback(() => {}, []);

  const summaryCards = useMemo(
    () => [
      {
        key: 'all',
        label: 'Total cases',
        value: totals.total,
        icon: AlertTriangleIcon,
        gradient: [colors.brand[600], colors.brand[800]] as [string, string],
        tint: colors.brand[100],
      },
      {
        key: 'unassigned',
        label: 'Unassigned',
        value: totals.unassigned,
        icon: ClockIcon,
        gradient: ['#B45309', '#78350F'] as [string, string],
        tint: '#FEF3C7',
      },
      {
        key: 'investigating',
        label: 'Investigating',
        value: totals.investigating,
        icon: ActivityIcon,
        gradient: ['#1D4ED8', '#1E3A8A'] as [string, string],
        tint: '#DBEAFE',
      },
      {
        key: 'resolved',
        label: 'Resolved',
        value: totals.resolved,
        icon: CheckCircleIcon,
        gradient: ['#15803D', '#14532D'] as [string, string],
        tint: '#DCFCE7',
      },
      {
        key: 'closed',
        label: 'Closed',
        value: totals.closed,
        icon: CheckCircleIcon,
        gradient: ['#334155', '#0F172A'] as [string, string],
        tint: '#E2E8F0',
      },
    ],
    [totals],
  );

  const renderIncident = ({ item }: { item: IncidentRow }) => {
    const typeMeta = INCIDENT_TYPE_META[item.incident_type] || INCIDENT_TYPE_META.default;
    const statusKey = (item.police_status || 'unassigned') as keyof typeof STATUS_LIST_META;
    const statusMeta = STATUS_LIST_META[statusKey] || STATUS_LIST_META.unassigned;
    const Icon = typeMeta.icon;
    const when = item.incident_date || item.created_at;
    const reporter = cleanReporterName(item.reporter_name, item.reporter_phone);
    const plate = item.motorcycle?.registration_number || null;
    const riderLabel = item.rider?.name || item.rider?.bms_id || null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}
        activeOpacity={0.85}
      >
        <View style={[styles.accent, { backgroundColor: typeMeta.color }]} />
        <View style={styles.cardBody}>
          <View style={[styles.iconWrap, { backgroundColor: typeMeta.tint }]}>
            <Icon size={18} color={typeMeta.color} />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.typeLabel} numberOfLines={1}>
                {typeMeta.label}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusMeta.bg, borderColor: statusMeta.border },
                ]}
              >
                <Text style={[styles.statusText, { color: statusMeta.fg }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.caseNumber} numberOfLines={1}>
                {item.case_number || 'Awaiting case number'}
              </Text>
              {plate ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.plateText} numberOfLines={1}>
                    {plate}
                  </Text>
                </>
              ) : null}
            </View>
            <View style={styles.metaLine}>
              <UserIcon size={11} color={colors.gray[400]} />
              <Text style={styles.reporterText} numberOfLines={1}>
                {reporter}
              </Text>
              {riderLabel ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.reporterText} numberOfLines={1}>
                    Rider: {riderLabel}
                  </Text>
                </>
              ) : null}
            </View>
            <View style={styles.metaLine}>
              <ClockIcon size={11} color={colors.gray[400]} />
              <Text style={styles.timeAgo}>{timeAgo(when)}</Text>
              {item.location ? (
                <>
                  <MapPinIcon size={11} color={colors.gray[400]} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.location}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <ChevronRightIcon size={16} color={colors.gray[300]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.summaryStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryContent}
        >
          {summaryCards.map((c) => {
            const CardIcon = c.icon;
            const active = filter === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                activeOpacity={0.9}
                onPress={() => setFilter(c.key as FilterKey)}
                style={[
                  styles.summaryCard,
                  { backgroundColor: c.gradient[1] },
                  active && styles.summaryCardActive,
                ]}
              >
                <View
                  style={[
                    styles.summaryCardOverlay,
                    { backgroundColor: c.gradient[0], opacity: 0.65 },
                  ]}
                />
                <View style={styles.summaryTop}>
                  <View style={[styles.summaryIconWrap, { backgroundColor: c.tint }]}>
                    <CardIcon size={14} color={c.gradient[1]} />
                  </View>
                  <Text style={styles.summaryLabel}>{c.label.toUpperCase()}</Text>
                </View>
                <Text style={styles.summaryValue}>{c.value.toLocaleString()}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <SearchIcon size={16} color={colors.gray[400]} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="Case, plate, location, reporter, rider..."
            placeholderTextColor={colors.gray[400]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
              <XIcon size={14} color={colors.gray[400]} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterInner}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.centerText}>Loading incidents</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <View style={styles.errorIcon}>
            <AlertTriangleIcon size={28} color={colors.red[500]} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load incidents</Text>
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item: IncidentRow) => item.id}
          renderItem={renderIncident}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
            />
          }
          ListFooterComponent={
            <>
              {loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.brand[500]} />
                  <Text style={styles.footerLoaderText}>Loading more…</Text>
                </View>
              ) : !hasMore && incidents.length > 0 ? (
                <Text style={styles.endText}>End of results · {incidents.length} shown</Text>
              ) : null}
              <DataFooter stamp={stamp} onRefresh={onRefresh} />
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <AlertTriangleIcon size={32} color={colors.gray[400]} />
              </View>
              <Text style={styles.emptyTitle}>No incidents to show</Text>
              <Text style={styles.emptyText}>
                {debouncedSearch
                  ? `Nothing matched "${debouncedSearch}". Try another keyword or clear the search.`
                  : filter === 'all'
                    ? 'When incidents are reported at your station they will show up here.'
                    : `No ${humanize(filter).toLowerCase()} incidents right now.`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },

  summaryStrip: {
    backgroundColor: colors.white,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  summaryContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  summaryCard: {
    width: 148,
    height: 88,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  summaryCardActive: {
    transform: [{ scale: 1.02 }],
    borderWidth: 2,
    borderColor: colors.white,
  },
  summaryCardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },

  searchWrap: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.gray[900],
    padding: 0,
  },

  filterRow: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  filterInner: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 2,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: 6,
  },
  chipActive: { backgroundColor: colors.gray[900] },
  chipText: { fontSize: 12, color: colors.gray[600], fontWeight: '700', letterSpacing: 0.2 },
  chipTextActive: { color: colors.white },

  list: { padding: spacing.md, paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[100],
    overflow: 'hidden',
  },
  accent: { width: 3, alignSelf: 'stretch' },
  cardBody: {
    flex: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1, gap: 2 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  typeLabel: { fontSize: 14, fontWeight: '700', color: colors.gray[900], flexShrink: 1 },
  caseNumber: { fontSize: 11, color: colors.gray[500], fontWeight: '600', letterSpacing: 0.3 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  metaDot: { fontSize: 11, color: colors.gray[300], marginHorizontal: 2 },
  plateText: {
    fontSize: 11,
    color: colors.gray[800],
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeAgo: { fontSize: 11, color: colors.gray[500], fontWeight: '500' },
  locationText: { fontSize: 11, color: colors.gray[500], flexShrink: 1, marginLeft: 2 },
  reporterText: { fontSize: 11, color: colors.gray[500], flexShrink: 1 },

  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  footerLoaderText: { fontSize: 12, color: colors.gray[500] },
  endText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.gray[400],
    paddingVertical: spacing.lg,
    letterSpacing: 0.4,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  centerText: { ...typography.body, color: colors.gray[500], textAlign: 'center' },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.red[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: { ...typography.h2, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryBtnText: { ...typography.button },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md, paddingHorizontal: spacing.xxxl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...typography.h2, textAlign: 'center' },
  emptyText: { ...typography.body, color: colors.gray[500], textAlign: 'center' },
});
