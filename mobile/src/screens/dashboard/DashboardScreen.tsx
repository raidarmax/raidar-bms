import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../services/supabase';
import {
  AlertTriangleIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SearchIcon,
  ActivityIcon,
  FileTextIcon,
} from '../../components/icons/Icons';
import { colors, spacing, borderRadius, shadows } from '../../theme';

type Stats = {
  newIncidents: number;
  activeCases: number;
  finesToday: number;
  finesMonth: number;
  verificationsToday: number;
};

const INITIAL: Stats = {
  newIncidents: 0,
  activeCases: 0,
  finesToday: 0,
  finesMonth: 0,
  verificationsToday: 0,
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

const RANK_WORDS = new Set([
  'constable',
  'corporal',
  'sergeant',
  'inspector',
  'chief',
  'superintendent',
  'commissioner',
  'officer',
  'ip',
  'cip',
  'sp',
  'ssp',
  'ac',
  'sac',
  'ig',
  'dig',
]);

function titleCase(word: string) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function buildGreetingName(rank?: string | null, fullName?: string | null) {
  const rankLabel = rank ? titleCase(rank) : '';
  const tokens = (fullName || '').trim().split(/\s+/).filter(Boolean);
  const first = tokens.find((t) => !RANK_WORDS.has(t.toLowerCase())) || '';
  const firstLabel = first ? titleCase(first) : '';
  return [rankLabel, firstLabel].filter(Boolean).join(' ') || 'Officer';
}

type ActionPalette = {
  bg: string;
  iconColor: string;
};

type StatPalette = {
  base: string;
  highlight: string;
  border: string;
  chipBg: string;
  chipIcon: string;
  accent: string;
  glow: string;
};

const ACTION_TILE_COLOR = '#0FBF8F';

const ACTION_PALETTES: Record<string, ActionPalette> = {
  verify: { bg: ACTION_TILE_COLOR, iconColor: colors.white },
  search: { bg: ACTION_TILE_COLOR, iconColor: colors.white },
  fine: { bg: ACTION_TILE_COLOR, iconColor: colors.white },
  incident: { bg: ACTION_TILE_COLOR, iconColor: colors.white },
};

const STAT_PALETTES: Record<string, StatPalette> = {
  incidents: {
    base: '#FFDBE3',
    highlight: '#FFF3F5',
    border: 'rgba(190, 18, 60, 0.18)',
    chipBg: 'rgba(255, 255, 255, 0.72)',
    chipIcon: colors.rose[600],
    accent: colors.rose[700],
    glow: '#F43F5E',
  },
  cases: {
    base: '#FCE8B8',
    highlight: '#FFF8DE',
    border: 'rgba(180, 83, 9, 0.18)',
    chipBg: 'rgba(255, 255, 255, 0.72)',
    chipIcon: colors.amber[600],
    accent: colors.amber[700],
    glow: '#D97706',
  },
  finesToday: {
    base: '#C7F1E4',
    highlight: '#EBFBF5',
    border: 'rgba(15, 118, 110, 0.20)',
    chipBg: 'rgba(255, 255, 255, 0.72)',
    chipIcon: colors.teal[600],
    accent: colors.teal[700],
    glow: '#0D9488',
  },
  finesMonth: {
    base: '#D3E2FC',
    highlight: '#EEF4FE',
    border: 'rgba(29, 78, 216, 0.20)',
    chipBg: 'rgba(255, 255, 255, 0.72)',
    chipIcon: colors.blue[600],
    accent: colors.blue[700],
    glow: '#2563EB',
  },
};

const VERIFY_PALETTE: StatPalette = {
  base: '#C9EADB',
  highlight: '#EAF6EF',
  border: 'rgba(17, 88, 64, 0.20)',
  chipBg: 'rgba(255, 255, 255, 0.75)',
  chipIcon: colors.brand[600],
  accent: colors.brand[700],
  glow: colors.brand[500],
};

export default function DashboardScreen({ navigation }: any) {
  const { officer } = useAuth();
  const [stats, setStats] = useState<Stats>(INITIAL);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!officer?.station_id) return;
    const supabase = getSupabase();
    const stationId = officer.station_id;
    const officerId = officer.id;
    const todayIso = startOfToday();
    const monthIso = startOfMonth();

    const isManager = !!officer.is_station_admin;
    const incidentsQuery = supabase
      .from('incidents')
      .select('id, police_status, created_at, assigned_officer_id')
      .eq('assigned_station_id', stationId);

    const [incRes, finesRes, verifRes] = await Promise.all([
      isManager
        ? incidentsQuery
        : incidentsQuery.or(`assigned_officer_id.eq.${officerId},assigned_officer_id.is.null`),
      supabase
        .from('fines')
        .select('id, status, fine_amount, issued_at, paid_at, issued_by_officer_id')
        .eq('issued_by_officer_id', officerId),
      supabase
        .from('document_validations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', officerId)
        .gte('created_at', todayIso),
    ]);

    const incidents = incRes.data || [];
    const fines = finesRes.data || [];

    const newIncidents = incidents.filter(
      (i: any) => i.police_status === 'new' || i.police_status === 'reported' || i.police_status === 'unassigned',
    ).length;
    const activeCases = incidents.filter(
      (i: any) => i.assigned_officer_id === officerId && i.police_status && i.police_status !== 'closed' && i.police_status !== 'resolved',
    ).length;
    const finesToday = fines.filter(
      (f: any) => f.issued_at && f.issued_at >= todayIso,
    ).length;
    const finesMonth = fines.filter(
      (f: any) => f.issued_at && f.issued_at >= monthIso,
    ).length;

    setStats({
      newIncidents,
      activeCases,
      finesToday,
      finesMonth,
      verificationsToday: verifRes.count ?? 0,
    });
  }, [officer?.station_id, officer?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const goVerify = () => navigation.navigate('MoreTab', { screen: 'VerifyDocuments' });
  const goSearch = () => navigation.navigate('MoreTab', { screen: 'Search' });
  const goIssueFine = () => navigation.navigate('FinesTab', { screen: 'IssueFine' });
  const goIncidents = () => navigation.navigate('IncidentsTab');
  const goFines = () => navigation.navigate('FinesTab');

  const greetingName = buildGreetingName(officer?.rank, officer?.full_name);
  const dateLine = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[500]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}
        <View style={styles.welcome}>
          <Text style={styles.welcomeGreeting} numberOfLines={2}>
            Welcome, {greetingName}.
          </Text>
          <Text style={styles.welcomeSub} numberOfLines={1}>
            {officer?.station?.station_name || 'Station'}
          </Text>
          <Text style={styles.welcomeDate}>{dateLine}</Text>
        </View>

        {/* Bold, borderless action tiles with distinct colors */}
        <View style={styles.actionsGrid}>
          <ActionTile
            palette={ACTION_PALETTES.verify}
            icon={
              <FileTextIcon
                size={26}
                color={ACTION_PALETTES.verify.iconColor}
                strokeWidth={2.6}
              />
            }
            label="Verify"
            onPress={goVerify}
          />
          <ActionTile
            palette={ACTION_PALETTES.search}
            icon={
              <SearchIcon
                size={26}
                color={ACTION_PALETTES.search.iconColor}
                strokeWidth={2.6}
              />
            }
            label="Search"
            onPress={goSearch}
          />
          <ActionTile
            palette={ACTION_PALETTES.fine}
            icon={
              <ReceiptIcon
                size={26}
                color={ACTION_PALETTES.fine.iconColor}
                strokeWidth={2.4}
              />
            }
            label="Issue Fine"
            onPress={goIssueFine}
          />
          <ActionTile
            palette={ACTION_PALETTES.incident}
            icon={
              <AlertTriangleIcon
                size={26}
                color={ACTION_PALETTES.incident.iconColor}
                strokeWidth={2.6}
              />
            }
            label="Incidents"
            onPress={goIncidents}
          />
        </View>

        <Text style={styles.sectionLabel}>Today at a glance</Text>

        {/* Softly-tinted KPI cards */}
        <View style={styles.kpiGrid}>
          <StatCard
            palette={STAT_PALETTES.incidents}
            label="New Incidents"
            value={stats.newIncidents.toString()}
            icon={
              <AlertTriangleIcon
                size={18}
                color={STAT_PALETTES.incidents.chipIcon}
                strokeWidth={2.5}
              />
            }
            onPress={goIncidents}
          />
          <StatCard
            palette={STAT_PALETTES.cases}
            label="Active Cases"
            value={stats.activeCases.toString()}
            icon={
              <ActivityIcon
                size={18}
                color={STAT_PALETTES.cases.chipIcon}
                strokeWidth={2.5}
              />
            }
            onPress={goIncidents}
          />
          <StatCard
            palette={STAT_PALETTES.finesToday}
            label="Fines Today"
            value={stats.finesToday.toString()}
            icon={
              <ReceiptIcon
                size={18}
                color={STAT_PALETTES.finesToday.chipIcon}
                strokeWidth={2.3}
              />
            }
            onPress={goFines}
          />
          <StatCard
            palette={STAT_PALETTES.finesMonth}
            label="Fines This Month"
            value={stats.finesMonth.toString()}
            icon={
              <FileTextIcon
                size={18}
                color={STAT_PALETTES.finesMonth.chipIcon}
                strokeWidth={2.5}
              />
            }
            onPress={goFines}
          />
        </View>

        {/* Verifications wide card in brand mint */}
        <GlassSurface palette={VERIFY_PALETTE} onPress={goVerify} style={styles.wideCard}>
          <View style={styles.wideCardInner}>
            <View style={[styles.wideCardIcon, { backgroundColor: VERIFY_PALETTE.chipBg, borderColor: VERIFY_PALETTE.border }]}>
              <ShieldCheckIcon size={20} color={VERIFY_PALETTE.chipIcon} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.wideCardLabel, { color: VERIFY_PALETTE.accent }]}>Verifications Today</Text>
              <Text style={styles.wideCardValue}>{stats.verificationsToday}</Text>
            </View>
            <Text style={[styles.wideCardHint, { color: VERIFY_PALETTE.accent }]}>Documents checked</Text>
          </View>
        </GlassSurface>
      </ScrollView>
    </View>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ActionTile({
  palette,
  icon,
  label,
  onPress,
}: {
  palette: ActionPalette;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.actionTile}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.actionIcon, { backgroundColor: palette.bg }]}>
        {icon}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function GlassSurface({
  palette,
  onPress,
  style,
  children,
}: {
  palette: StatPalette;
  onPress?: () => void;
  style?: object;
  children: React.ReactNode;
}) {
  const Container: any = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.86 } : {};

  return (
    <Container
      {...containerProps}
      style={[
        styles.glassShadow,
        { shadowColor: palette.glow },
        style,
      ]}
    >
      <View style={[styles.glassClip, { borderColor: palette.border }]}>
        <LinearGradient
          colors={[palette.highlight, palette.base]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.glassGloss}
          pointerEvents="none"
        />
        <View style={styles.glassTopEdge} pointerEvents="none" />
        {children}
      </View>
    </Container>
  );
}

function StatCard({
  palette,
  label,
  value,
  icon,
  onPress,
}: {
  palette: StatPalette;
  label: string;
  value: string;
  icon: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <View style={styles.statCell}>
      <GlassSurface palette={palette} onPress={onPress} style={styles.statCardShadow}>
        <View style={styles.statInner}>
          <View style={[styles.statChip, { backgroundColor: palette.chipBg, borderColor: palette.border }]}>
            {icon}
          </View>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={[styles.statLabel, { color: palette.accent }]}>{label}</Text>
        </View>
      </GlassSurface>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },

  // Welcome
  welcome: {
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  welcomeGreeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray[900],
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  welcomeSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brand[600],
    marginTop: 6,
    letterSpacing: 0.2,
  },
  welcomeDate: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 2,
  },

  // Action tiles (borderless, colored)
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    paddingHorizontal: 4,
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...shadows.md,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray[800],
    letterSpacing: 0.2,
  },

  // Section
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.gray[500],
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.md,
  },
  statCell: {
    width: '50%',
    padding: spacing.xs,
  },
  statCardShadow: {
    minHeight: 116,
  },
  statInner: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  statChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 }
      : { elevation: 1 }),
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gray[900],
    letterSpacing: -0.6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // Glass surface primitives
  glassShadow: {
    borderRadius: borderRadius.lg + 2,
    ...(Platform.OS === 'ios'
      ? { shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18 }
      : { elevation: 5 }),
  },
  glassClip: {
    flex: 1,
    borderRadius: borderRadius.lg + 2,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  glassGloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '55%',
  },
  glassTopEdge: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  // Verifications wide card
  wideCard: {
    marginTop: spacing.sm,
  },
  wideCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  wideCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 }
      : { elevation: 1 }),
  },
  wideCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  wideCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gray[900],
    letterSpacing: -0.4,
    marginTop: 2,
  },
  wideCardHint: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
