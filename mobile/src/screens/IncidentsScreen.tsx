import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { supabase, type Incident } from '../lib/supabase';
import { theme } from '../theme';

export default function IncidentsScreen() {
  const { officer } = useAuth();
  const [items, setItems] = useState<Incident[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!officer) return;
    setRefreshing(true);
    const { data } = await supabase
      .from('incidents')
      .select('id, incident_type, description, location_description, police_status, created_at, motorcycle_id, rider_id')
      .eq('assigned_station_id', officer.station_id)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems(data ?? []);
    setRefreshing(false);
  }, [officer]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>INCIDENTS</Text>
        <Text style={styles.title}>Assigned to your station</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyBody}>No active incidents at this station.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowType}>{item.incident_type.replace(/_/g, ' ')}</Text>
              <StatusChip value={item.police_status} />
            </View>
            {item.description ? (
              <Text style={styles.rowBody} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <Text style={styles.rowMeta}>
              {item.location_description ?? 'Location on file'} · {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function StatusChip({ value }: { value: string }) {
  const palette = statusPalette(value);
  return (
    <View style={[styles.chip, { borderColor: palette.border, backgroundColor: palette.bg }]}>
      <Text style={[styles.chipText, { color: palette.fg }]}>{value.replace(/_/g, ' ')}</Text>
    </View>
  );
}

function statusPalette(value: string) {
  switch (value) {
    case 'assigned':
      return { fg: theme.colors.warning, border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.1)' };
    case 'investigating':
      return { fg: theme.colors.info, border: 'rgba(56,189,248,0.4)', bg: 'rgba(56,189,248,0.1)' };
    case 'closed':
    case 'resolved':
      return { fg: theme.colors.success, border: 'rgba(34,197,94,0.4)', bg: 'rgba(34,197,94,0.1)' };
    default:
      return { fg: theme.colors.textSecondary, border: theme.colors.borderStrong, bg: theme.colors.surface };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(2) },
  eyebrow: { color: theme.colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 4 },
  list: { padding: theme.spacing(3), gap: 12 },
  separator: { height: 12 },
  row: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowType: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  rowBody: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
  rowMeta: { color: theme.colors.textMuted, fontSize: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingVertical: theme.spacing(6), gap: 6 },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  emptyBody: { color: theme.colors.textMuted, fontSize: 13 },
});
