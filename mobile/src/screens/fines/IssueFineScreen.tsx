import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../services/supabase';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { DollarSignIcon, CheckCircleIcon } from '../../components/icons/Icons';

interface Offence {
  id: string;
  offence_name: string;
  fine_amount: number;
}

export default function IssueFineScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { officer } = useAuth();

  const [offences, setOffences] = useState<Offence[]>([]);
  const [selectedOffence, setSelectedOffence] = useState<Offence | null>(null);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderNationalId, setRiderNationalId] = useState('');
  const [registration, setRegistration] = useState('');
  const [locationDesc, setLocationDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingOffences, setLoadingOffences] = useState(true);

  useEffect(() => {
    fetchOffences();
  }, []);

  const fetchOffences = async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('traffic_offences')
      .select('id, offence_name, fine_amount')
      .eq('is_active', true)
      .order('offence_name');
    setOffences(data ?? []);
    setLoadingOffences(false);
  };

  const handleSubmit = async () => {
    const supabase = getSupabase();
    if (!riderName.trim()) {
      Alert.alert('Required', 'Please enter the rider name.');
      return;
    }
    if (!selectedOffence) {
      Alert.alert('Required', 'Please select an offence.');
      return;
    }

    setSubmitting(true);
    try {
      let motorcycle_id: string | null = null;
      if (registration.trim()) {
        const { data: moto } = await supabase
          .from('motorcycles')
          .select('id')
          .eq('registration_number', registration.trim().toUpperCase())
          .maybeSingle();
        if (moto) motorcycle_id = moto.id;
      }

      const { error } = await supabase.from('fines').insert({
        fine_reference: `FN-${Date.now()}`,
        rider_name: riderName.trim(),
        rider_phone: riderPhone.trim() || null,
        rider_national_id: riderNationalId.trim() || null,
        motorcycle_id,
        offence_id: selectedOffence.id,
        fine_amount: selectedOffence.fine_amount,
        status: 'issued',
        issued_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        location_description: locationDesc.trim() || null,
        notes: notes.trim() || null,
        issued_by_officer_id: officer?.id,
        station_id: officer?.station?.id ?? (officer as any)?.station_id,
      });

      if (error) throw error;

      Alert.alert('Success', 'Fine issued successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to issue fine.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <DollarSignIcon size={20} color={colors.brand[600]} />
        <Text style={styles.headerTitle}>Issue Fine</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Rider Name */}
          <Text style={styles.label}>Rider Name *</Text>
          <TextInput
            style={styles.input}
            value={riderName}
            onChangeText={setRiderName}
            placeholder="Full name"
            placeholderTextColor={colors.gray[400]}
            autoCapitalize="words"
          />

          {/* Rider Phone */}
          <Text style={styles.label}>Rider Phone</Text>
          <TextInput
            style={styles.input}
            value={riderPhone}
            onChangeText={setRiderPhone}
            placeholder="e.g. 0712345678"
            placeholderTextColor={colors.gray[400]}
            keyboardType="phone-pad"
          />

          {/* Rider National ID */}
          <Text style={styles.label}>Rider National ID</Text>
          <TextInput
            style={styles.input}
            value={riderNationalId}
            onChangeText={setRiderNationalId}
            placeholder="National ID number"
            placeholderTextColor={colors.gray[400]}
            keyboardType="numeric"
          />

          {/* Motorcycle Registration */}
          <Text style={styles.label}>Motorcycle Registration</Text>
          <TextInput
            style={styles.input}
            value={registration}
            onChangeText={setRegistration}
            placeholder="e.g. KMXX 123A"
            placeholderTextColor={colors.gray[400]}
            autoCapitalize="characters"
          />

          {/* Offence Selection */}
          <Text style={styles.label}>Offence *</Text>
          {loadingOffences ? (
            <ActivityIndicator size="small" color={colors.brand[500]} style={{ marginVertical: spacing.md }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.offenceScroll}
              contentContainerStyle={styles.offenceList}
            >
              {offences.map((o) => {
                const isSelected = selectedOffence?.id === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.offenceChip, isSelected && styles.offenceChipSelected]}
                    onPress={() => setSelectedOffence(o)}
                  >
                    {isSelected && <CheckCircleIcon size={14} color={colors.white} />}
                    <Text
                      style={[styles.offenceChipText, isSelected && styles.offenceChipTextSelected]}
                      numberOfLines={2}
                    >
                      {o.offence_name}
                    </Text>
                    <Text
                      style={[styles.offenceChipAmount, isSelected && styles.offenceChipAmountSelected]}
                    >
                      KES {o.fine_amount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedOffence && (
            <Text style={styles.selectedInfo}>
              Selected: {selectedOffence.offence_name} — KES {selectedOffence.fine_amount.toLocaleString()}
            </Text>
          )}

          {/* Location */}
          <Text style={styles.label}>Location Description</Text>
          <TextInput
            style={styles.input}
            value={locationDesc}
            onChangeText={setLocationDesc}
            placeholder="Where the offence occurred"
            placeholderTextColor={colors.gray[400]}
          />

          {/* Notes */}
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes..."
            placeholderTextColor={colors.gray[400]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitText}>Issue Fine</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: spacing.xxxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    gap: spacing.sm,
  },
  headerTitle: { ...typography.h2, color: colors.gray[900] },
  content: { padding: spacing.xl },
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.lg },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.gray[900],
  },
  multiline: { minHeight: 80 },
  offenceScroll: { marginTop: spacing.sm },
  offenceList: { gap: spacing.sm, paddingVertical: spacing.xs },
  offenceChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: 150,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.sm,
  },
  offenceChipSelected: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[700],
  },
  offenceChipText: { ...typography.bodySmall, color: colors.gray[800], textAlign: 'center' },
  offenceChipTextSelected: { color: colors.white },
  offenceChipAmount: { ...typography.caption, color: colors.brand[700], fontWeight: '700' },
  offenceChipAmountSelected: { color: colors.brand[100] },
  selectedInfo: {
    ...typography.bodySmall,
    color: colors.brand[700],
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.brand[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...typography.button, color: colors.white },
});
