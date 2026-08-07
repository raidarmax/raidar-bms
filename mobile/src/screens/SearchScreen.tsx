import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { theme } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Search'>;

type Row =
  | { kind: 'rider'; id: string; primary: string; secondary: string }
  | { kind: 'motorcycle'; id: string; primary: string; secondary: string };

export default function SearchScreen() {
  const nav = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setRows([]);
      return;
    }
    setLoading(true);
    const term = value.trim();
    const like = `%${term}%`;
    const [ridersRes, motoRes] = await Promise.all([
      supabase
        .from('riders')
        .select('id, name, bms_id, id_number, phone_number')
        .or(`name.ilike.${like},bms_id.ilike.${like},id_number.ilike.${like},phone_number.ilike.${like}`)
        .limit(10),
      supabase
        .from('motorcycles')
        .select('id, registration_number, make, model')
        .ilike('registration_number', like)
        .limit(10),
    ]);

    const riderRows: Row[] = (ridersRes.data ?? []).map((r) => ({
      kind: 'rider',
      id: r.id,
      primary: r.name,
      secondary: `${r.bms_id ?? r.id_number} · ${r.phone_number ?? '—'}`,
    }));
    const motoRows: Row[] = (motoRes.data ?? []).map((m) => ({
      kind: 'motorcycle',
      id: m.id,
      primary: m.registration_number,
      secondary: [m.make, m.model].filter(Boolean).join(' ') || 'Motorcycle',
    }));

    setRows([...riderRows, ...motoRows]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => run(query), 250);
    return () => clearTimeout(handle);
  }, [query, run]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SEARCH</Text>
        <Text style={styles.title}>Find rider or plate</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name, BMS ID, phone or plate"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Start typing</Text>
              <Text style={styles.emptyBody}>Search rider names, BMS IDs, phone numbers or plate numbers.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              nav.navigate('ManualLookup')
            }
          >
            <View style={[styles.tag, item.kind === 'rider' ? styles.tagRider : styles.tagMoto]}>
              <Text style={styles.tagText}>{item.kind === 'rider' ? 'Rider' : 'Bike'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowPrimary}>{item.primary}</Text>
              <Text style={styles.rowSecondary}>{item.secondary}</Text>
            </View>
            <Text style={styles.rowChev}>›</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(2), gap: 10 },
  eyebrow: { color: theme.colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '700' },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  loading: { paddingVertical: 8, alignItems: 'center' },
  list: { padding: theme.spacing(3), gap: 12 },
  separator: { height: 10 },
  row: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  tagRider: { backgroundColor: 'rgba(56,189,248,0.15)' },
  tagMoto: { backgroundColor: 'rgba(34,197,94,0.15)' },
  tagText: { color: theme.colors.textPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  rowPrimary: { color: theme.colors.textPrimary, fontWeight: '600', fontSize: 15 },
  rowSecondary: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  rowChev: { color: theme.colors.textMuted, fontSize: 22 },
  empty: { alignItems: 'center', paddingVertical: theme.spacing(6), gap: 6 },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  emptyBody: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
});
