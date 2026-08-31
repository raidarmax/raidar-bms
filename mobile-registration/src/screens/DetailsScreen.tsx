import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { checkExistingOwner } from '../services/registration';
import { sendOtp } from '../services/otp';

type Props = {
  navigation: any;
  route: { params: { serial: string; imei: string } };
};

export default function DetailsScreen({ navigation, route }: Props) {
  const { serial, imei } = route.params;
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!ownerName.trim()) { setError('Owner name is required'); return; }
    if (!phone.trim()) { setError('Phone number is required'); return; }
    if (!nationalId.trim()) { setError('National ID is required'); return; }
    if (!plate.trim()) { setError('Plate number is required'); return; }

    setLoading(true);

    const existing = await checkExistingOwner(phone);
    if (existing) {
      setLoading(false);
      navigation.navigate('Duplicate', {
        serial, imei, plate, existingOwner: existing,
      });
      return;
    }

    const result = await sendOtp(phone);
    setLoading(false);
    if (result.success) {
      navigation.navigate('Otp', {
        serial, imei, ownerName, phone, nationalId, plate,
      });
    } else {
      setError(result.error || 'Failed to send verification code');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Owner & Bike Details</Text>
        <Text style={styles.subtitle}>
          Tracker: <Text style={styles.serialBadge}>{serial}</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Owner Full Name</Text>
          <TextInput
            style={styles.input}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. John Kamau"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="07xx xxx xxx"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>National ID</Text>
          <TextInput
            style={styles.input}
            value={nationalId}
            onChangeText={setNationalId}
            placeholder="ID number"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Plate Number</Text>
          <TextInput
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            placeholder="KMXX 000X"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Register</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  header: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.xs },
  serialBadge: { color: colors.primary, fontFamily: 'monospace', fontWeight: '700' },
  form: { gap: spacing.md },
  field: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '600', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: 14,
    color: colors.text, fontSize: fontSize.base,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: fontSize.sm },
  buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  backBtn: {
    flex: 1, backgroundColor: colors.surfaceLight, paddingVertical: 14,
    borderRadius: borderRadius.lg, alignItems: 'center',
  },
  backBtnText: { color: colors.text, fontSize: fontSize.base, fontWeight: '600' },
  submitBtn: {
    flex: 2, backgroundColor: colors.primary, paddingVertical: 14,
    borderRadius: borderRadius.lg, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.text, fontSize: fontSize.base, fontWeight: '700' },
});
