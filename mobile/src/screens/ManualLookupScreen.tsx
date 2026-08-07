import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { Button } from '../components/Button';
import { lookupBmsId, lookupIncident, lookupRegistration } from '../lib/lookup';
import { useAuth } from '../context/AuthContext';
import { PoliceAuth } from '../lib/policeAuth';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ManualLookup'>;

type Mode = 'rider' | 'motorcycle' | 'incident';

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'rider', label: 'Rider (BMS ID)', hint: 'e.g. BMS-2025-00042' },
  { value: 'motorcycle', label: 'Motorcycle plate', hint: 'e.g. KMFB 123A' },
  { value: 'incident', label: 'Case number', hint: 'e.g. CASE-2025-4102' },
];

export default function ManualLookupScreen() {
  const nav = useNavigation<Nav>();
  const { officer } = useAuth();
  const [mode, setMode] = useState<Mode>('rider');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!officer || !value.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const query = value.trim();
      let lookup;
      if (mode === 'rider') lookup = await lookupBmsId(query);
      else if (mode === 'motorcycle') lookup = await lookupRegistration(query);
      else lookup = await lookupIncident(query);

      await PoliceAuth.logVerification({
        officerId: officer.id,
        stationId: officer.station_id,
        verificationType: `manual_${mode}`,
        documentValue: query,
        subjectType: mode,
        subjectId: lookup.type === 'not_found' ? null : (lookup.data as { id?: string }).id ?? null,
        result: lookup.type === 'not_found' ? 'not_found' : 'matched',
        resultDetails: { source: 'mobile', mode },
      });
      nav.navigate('VerifyResult', { lookup, source: 'manual' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>MANUAL LOOKUP</Text>
          <Text style={styles.title}>Verify without scanning</Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Search by</Text>
            {MODES.map((option) => {
              const active = mode === option.value;
              return (
                <View
                  key={option.value}
                  style={[styles.modeRow, active && styles.modeRowActive]}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={() => setMode(option.value)}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modeLabel}>{option.label}</Text>
                    <Text style={styles.modeHint}>{option.hint}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Reference</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={MODES.find((m) => m.value === mode)?.hint ?? ''}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Verify" onPress={submit} loading={loading} disabled={!value.trim()} />
          <Button label="Cancel" variant="ghost" onPress={() => nav.goBack()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(6) },
  eyebrow: { color: theme.colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '700' },
  section: { gap: 10 },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    padding: theme.spacing(2),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
  },
  modeRowActive: { borderColor: theme.colors.accent, backgroundColor: 'rgba(56,189,248,0.08)' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: theme.colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.accent },
  modeLabel: { color: theme.colors.textPrimary, fontWeight: '600' },
  modeHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
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
  error: { color: theme.colors.danger, fontSize: 13 },
});
