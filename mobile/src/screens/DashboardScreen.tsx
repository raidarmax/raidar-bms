import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { theme } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Stats = {
  newIncidents: number;
  activeIncidents: number;
  finesToday: number;
  verificationsToday: number;
};

export default function DashboardScreen() {
  const { officer, signOut } = useAuth();
  const nav = useNavigation<Nav>();
  const [stats, setStats] = useState<Stats>({
    newIncidents: 0,
    activeIncidents: 0,
    finesToday: 0,
    verificationsToday: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!officer) return;
    setRefreshing(true);
    const today = new Date().toISOString().split('T')[0];
    const [newInc, activeInc, finesToday, verifsToday] = await Promise.all([
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_station_id', officer.station_id)
        .eq('police_status', 'assigned'),
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_station_id', officer.station_id)
        .in('police_status', ['assigned', 'investigating']),
      supabase
        .from('fines')
        .select('id', { count: 'exact', head: true })
        .eq('station_id', officer.station_id)
        .gte('issued_at', today),
      supabase
        .from('police_verification_logs')
        .select('id', { count: 'exact', head: true })
        .eq('officer_id', officer.id)
        .gte('created_at', `${today}T00:00:00`),
    ]);

    setStats({
      newIncidents: newInc.count ?? 0,
      activeIncidents: activeInc.count ?? 0,
      finesToday: finesToday.count ?? 0,
      verificationsToday: verifsToday.count ?? 0,
    });
    setRefreshing(false);
  }, [officer]);

  useEffect(() => {
    load();
  }, [load]);

  if (!officer) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.accent} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>ON DUTY</Text>
            <Text style={styles.name}>{officer.full_name}</Text>
            <Text style={styles.station}>
              {officer.rank.replace(/_/g, ' ')} · {officer.station?.station_name ?? 'Unassigned'}
            </Text>
          </View>
          <Pressable onPress={signOut} style={styles.logout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Field toolkit</Text>
          <Text style={styles.heroBody}>
            Scan a rider QR to instantly verify identity, license, insurance, and outstanding fines.
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={[styles.heroAction, styles.heroPrimary]} onPress={() => nav.navigate('Scan')}>
              <Text style={styles.heroPrimaryLabel}>Scan QR</Text>
            </Pressable>
            <Pressable style={styles.heroAction} onPress={() => nav.navigate('DocumentValidation')}>
              <Text style={styles.heroSecondaryLabel}>Validate document</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard title="New incidents" value={String(stats.newIncidents)} accent={theme.colors.warning} />
          <StatCard title="Active" value={String(stats.activeIncidents)} accent={theme.colors.info} />
          <StatCard title="Fines today" value={String(stats.finesToday)} accent={theme.colors.success} />
          <StatCard title="Verifications" value={String(stats.verificationsToday)} accent={theme.colors.accent} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <QuickTile label="Search rider or plate" onPress={() => nav.navigate('Search')} />
          <QuickTile label="Manual verification" onPress={() => nav.navigate('ManualLookup')} />
          <QuickTile label="Assigned incidents" onPress={() => nav.navigate('Incidents')} />
          <QuickTile label="Recent fines" onPress={() => nav.navigate('Fines')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(3), gap: theme.spacing(3), paddingBottom: theme.spacing(6) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  name: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '700' },
  station: { color: theme.colors.textMuted, marginTop: 4, textTransform: 'capitalize' },
  logout: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  logoutText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  hero: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing(1.5),
  },
  heroTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' },
  heroBody: { color: theme.colors.textSecondary, lineHeight: 22 },
  heroActions: { flexDirection: 'row', gap: theme.spacing(1.5), marginTop: theme.spacing(1) },
  heroAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceElevated,
  },
  heroPrimary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  heroPrimaryLabel: { color: '#0B1220', fontWeight: '700' },
  heroSecondaryLabel: { color: theme.colors.textPrimary, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  section: { gap: theme.spacing(1) },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing(0.5),
  },
  tile: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileLabel: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '500' },
  tileArrow: { color: theme.colors.textMuted, fontSize: 22 },
});
