import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { supabase, type Fine } from '../lib/supabase';
import { theme } from '../theme';

export default function FinesScreen() {
  const { officer } = useAuth();
  const [items, setItems] = useState<Fine[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!officer) return;
    setRefreshing(true);
    const { data } = await supabase
      .from('fines')
      .select('id, fine_reference, rider_name, rider_phone, fine_amount, status, issued_at, due_date')
      .eq('station_id', officer.station_id)
      .order('issued_at', { ascending: false })
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
        <Text style={styles.eyebrow}>FINES</Text>
        <Text style={styles.title}>Issued at your station</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No fines yet</Text>
            <Text style={styles.emptyBody}>Fines issued from the field will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.reference}>{item.fine_reference}</Text>
              <Text style={styles.amount}>KES {item.fine_amount.toLocaleString()}</Text>
            </View>
            <Text style={styles.rider}>{item.rider_name}</Text>
            <Text style={styles.meta}>
              {item.status} · issued {new Date(item.issued_at).toLocaleDateString()} · due{' '}
              {new Date(item.due_date).toLocaleDateString()}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
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
    gap: 4,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reference: { color: theme.colors.textPrimary, fontWeight: '700' },
  amount: { color: theme.colors.accent, fontWeight: '700' },
  rider: { color: theme.colors.textSecondary },
  meta: { color: theme.colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingVertical: theme.spacing(6), gap: 6 },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  emptyBody: { color: theme.colors.textMuted, fontSize: 13 },
});
