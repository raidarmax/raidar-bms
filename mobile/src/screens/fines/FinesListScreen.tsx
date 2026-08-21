import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { DollarSignIcon, PlusIcon, AlertTriangleIcon, CheckCircleIcon, ClockIcon } from '../../components/icons/Icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import type { Fine, TrafficOffence } from '../../services/supabase';
import { loadFinesForStation, type FetchStamp, type FinesFilter } from '../../services/data';
import { DataFooter } from '../../components/ui/DataFooter';
import { useFocusEffect } from '@react-navigation/native';

type FineRow = Fine & { offence?: TrafficOffence | null };

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  issued: { label: 'Issued', bg: colors.amber[50], fg: colors.amber[700], dot: colors.amber[500] },
  paid: { label: 'Paid', bg: colors.green[50], fg: colors.green[700], dot: colors.green[500] },
  overdue: { label: 'Overdue', bg: colors.red[50], fg: colors.red[700], dot: colors.red[500] },
  disputed: { label: 'Disputed', bg: colors.blue[50], fg: colors.blue[700], dot: colors.blue[500] },
  cancelled: { label: 'Cancelled', bg: colors.gray[100], fg: colors.gray[600], dot: colors.gray[400] },
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return 'KES 0';
  return 'KES ' + Number(n).toLocaleString();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function OverdueFlash() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View style={[styles.overdueDot, { opacity }]} />
  );
}

export default function FinesListScreen({ navigation }: any) {
  const { officer } = useAuth();
  const [fines, setFines] = useState<FineRow[]>([]);
  const [stamp, setStamp] = useState<FetchStamp | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FinesFilter>('all');
  const reqIdRef = useRef(0);

  const fetchFines = useCallback(async () => {
    if (!officer?.station_id) {
      setFines([]);
      setStamp({ fetchedAt: Date.now(), rowCount: 0, filter: 'no-station', errorMessage: 'No station on account' });
      return;
    }
    const reqId = ++reqIdRef.current;
    try {
      const result = await loadFinesForStation(officer.station_id, filter);
      if (reqId !== reqIdRef.current) return;
      setFines(result.fines as FineRow[]);
      setStamp(result.stamp);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setFines([]);
      setStamp({
        fetchedAt: Date.now(),
        rowCount: 0,
        filter: `${filter}`,
        errorMessage: e?.message || 'Fetch failed',
      });
    }
  }, [officer?.station_id, filter]);

  useEffect(() => { fetchFines(); }, [fetchFines]);
  useFocusEffect(useCallback(() => { fetchFines(); }, [fetchFines]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFines();
    setRefreshing(false);
  }, [fetchFines]);

  const summary = useMemo(() => {
    let total = 0, overdue = 0, paid = 0, outstanding = 0;
    for (const f of fines) {
      total += 1;
      if (f.status === 'overdue') overdue += 1;
      if (f.status === 'paid') paid += 1;
      if (f.status === 'issued' || f.status === 'overdue') outstanding += Number(f.fine_amount || 0);
    }
    return { total, overdue, paid, outstanding };
  }, [fines]);

  const filters: { key: FinesFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'issued', label: 'Issued' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'paid', label: 'Paid' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const renderFine = ({ item }: { item: FineRow }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.issued;
    const overdue = item.status === 'overdue';
    const daysOverdue = overdue ? daysSince(item.due_date) : 0;
    return (
      <TouchableOpacity
        style={[styles.card, overdue && styles.cardOverdue]}
        onPress={() => navigation.navigate('FineDetail', { fineId: item.id })}
        activeOpacity={0.75}
      >
        {overdue && (
          <View style={styles.overdueRibbon}>
            <OverdueFlash />
            <Text style={styles.overdueRibbonText}>
              OVERDUE{daysOverdue > 0 ? ` · ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}` : ''}
            </Text>
          </View>
        )}

        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fineRef} numberOfLines={1}>{item.fine_reference}</Text>
            <Text style={styles.riderName} numberOfLines={1}>{item.rider_name}</Text>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={[styles.amount, overdue && { color: colors.red[600] }]}>
              {money(item.fine_amount)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardMeta}>
          <View style={styles.offenceBox}>
            <Text style={styles.metaLabel}>OFFENCE</Text>
            <Text style={styles.offenceText} numberOfLines={2}>
              {item.offence?.offence_name || 'Traffic violation'}
            </Text>
          </View>
          <View style={styles.rightMeta}>
            <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
              <View style={[styles.pillDot, { backgroundColor: cfg.dot }]} />
              <Text style={[styles.pillText, { color: cfg.fg }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.dateText}>{fmtDate(item.issued_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{summary.total}</Text>
            <Text style={styles.heroStatLabel}>Total</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatMid]}>
            <View style={styles.heroStatRow}>
              <AlertTriangleIcon size={16} color={colors.red[600]} />
              <Text style={[styles.heroStatValue, { color: colors.red[700] }]}>{summary.overdue}</Text>
            </View>
            <Text style={styles.heroStatLabel}>Overdue</Text>
          </View>
          <View style={styles.heroStat}>
            <View style={styles.heroStatRow}>
              <CheckCircleIcon size={16} color={colors.green[600]} />
              <Text style={[styles.heroStatValue, { color: colors.green[700] }]}>{summary.paid}</Text>
            </View>
            <Text style={styles.heroStatLabel}>Paid</Text>
          </View>
        </View>
        <View style={styles.outstandingBox}>
          <Text style={styles.outstandingLabel}>Outstanding Balance</Text>
          <Text style={styles.outstandingValue}>{money(summary.outstanding)}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={fines}
        keyExtractor={(item) => item.id}
        renderItem={renderFine}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <DollarSignIcon size={36} color={colors.gray[300]} />
            </View>
            <Text style={styles.emptyTitle}>No fines to show</Text>
            <Text style={styles.emptyText}>Fines issued at your station will appear here.</Text>
          </View>
        }
        ListFooterComponent={<DataFooter stamp={stamp} onRefresh={onRefresh} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('IssueFine')}
        activeOpacity={0.85}
      >
        <PlusIcon size={22} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },

  hero: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  heroRow: { flexDirection: 'row', gap: spacing.sm },
  heroStat: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatMid: { backgroundColor: colors.red[50] },
  heroStatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatValue: { fontSize: 22, fontWeight: '700', color: colors.gray[900], letterSpacing: -0.5 },
  heroStatLabel: {
    fontSize: 11, marginTop: 2, color: colors.gray[500], letterSpacing: 0.5, textTransform: 'uppercase',
  },
  outstandingBox: {
    marginTop: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg, backgroundColor: colors.brand[600],
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  outstandingLabel: { ...typography.bodySmall, color: colors.brand[100], fontWeight: '500' },
  outstandingValue: { fontSize: 20, fontWeight: '700', color: colors.white, letterSpacing: -0.4 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  chipActive: { backgroundColor: colors.brand[600] },
  chipText: { ...typography.bodySmall, color: colors.gray[600], fontWeight: '600' },
  chipTextActive: { color: colors.white },

  list: { padding: spacing.lg, paddingBottom: 120 },
  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.gray[200], ...shadows.sm,
  },
  cardOverdue: { borderColor: colors.red[500], borderWidth: 1.5 },
  overdueRibbon: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm + 2,
    paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: borderRadius.full,
    backgroundColor: colors.red[50], alignSelf: 'flex-start',
  },
  overdueDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red[600],
  },
  overdueRibbonText: {
    fontSize: 11, fontWeight: '700', color: colors.red[700], letterSpacing: 0.6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  fineRef: { fontSize: 16, fontWeight: '700', color: colors.gray[900], letterSpacing: -0.3 },
  riderName: { ...typography.bodySmall, marginTop: 2, color: colors.gray[600], fontWeight: '500' },
  amountBox: { alignItems: 'flex-end' },
  amountLabel: {
    fontSize: 10, letterSpacing: 0.5, color: colors.gray[400], textTransform: 'uppercase', fontWeight: '600',
  },
  amount: { fontSize: 16, fontWeight: '700', color: colors.gray[900], marginTop: 1 },

  divider: { height: 1, backgroundColor: colors.gray[100], marginVertical: spacing.md },

  cardMeta: { flexDirection: 'row', alignItems: 'flex-start' },
  offenceBox: { flex: 1, paddingRight: spacing.md },
  metaLabel: {
    fontSize: 10, letterSpacing: 0.5, color: colors.gray[400], textTransform: 'uppercase',
    marginBottom: 3, fontWeight: '600',
  },
  offenceText: { ...typography.body, color: colors.gray[800], fontWeight: '500' },
  rightMeta: { alignItems: 'flex-end' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: borderRadius.full,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  dateText: { ...typography.caption, color: colors.gray[500], marginTop: 6 },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gray[100],
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { ...typography.h3, color: colors.gray[700] },
  emptyText: { ...typography.bodySmall, color: colors.gray[500], textAlign: 'center', maxWidth: 260 },

  fab: {
    position: 'absolute', bottom: 90, right: spacing.xl, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.brand[600], alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10 },
      default: { elevation: 8 },
    }),
  },
});
