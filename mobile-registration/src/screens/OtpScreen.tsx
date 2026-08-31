import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { verifyOtp, sendOtp } from '../services/otp';
import { registerMotorcycle } from '../services/registration';

type Props = {
  navigation: any;
  route: {
    params: {
      serial: string; imei: string; ownerName: string;
      phone: string; nationalId: string; plate: string;
    };
  };
};

export default function OtpScreen({ navigation, route }: Props) {
  const { serial, imei, ownerName, phone, nationalId, plate } = route.params;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    setError('');
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }

    setVerifying(true);
    const valid = await verifyOtp(phone, code);
    if (!valid) {
      setVerifying(false);
      setError('Invalid or expired code. Please try again.');
      return;
    }

    const result = await registerMotorcycle({
      ownerName, phone, nationalId, plateNumber: plate, serial, imei, existingOwnerId: null,
    });
    setVerifying(false);

    if (result.success) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Success', params: { ownerName, phone, plate, serial } }],
      });
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    const result = await sendOtp(phone);
    setResending(false);
    if (!result.success) {
      setError(result.error || 'Failed to resend');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Verify Phone Number</Text>
        <Text style={styles.subtitle}>
          A 6-digit code was sent to{' '}
          <Text style={styles.phoneHighlight}>{phone}</Text>
        </Text>
      </View>

      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
        maxLength={6}
        keyboardType="number-pad"
        placeholder="000000"
        placeholderTextColor={colors.textMuted}
        textAlign="center"
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.verifyBtn, (verifying || code.length !== 6) && styles.btnDisabled]}
        onPress={handleVerify}
        disabled={verifying || code.length !== 6}
      >
        {verifying ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.verifyBtnText}>Verify & Register</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={resending}>
        <Text style={styles.resendText}>{resending ? 'Resending...' : 'Resend code'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backLink}>Back to details</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  phoneHighlight: { color: colors.primary, fontWeight: '600' },
  codeInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.lg, paddingVertical: 18, paddingHorizontal: spacing.xl,
    color: colors.text, fontSize: fontSize.xxl, fontFamily: 'monospace',
    letterSpacing: 8, alignSelf: 'center', width: 200, marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
  verifyBtn: {
    backgroundColor: colors.primary, paddingVertical: 16,
    borderRadius: borderRadius.lg, alignItems: 'center', marginBottom: spacing.lg,
  },
  btnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: colors.text, fontSize: fontSize.base, fontWeight: '700' },
  resendBtn: { alignItems: 'center', marginBottom: spacing.lg },
  resendText: { color: colors.textSecondary, fontSize: fontSize.sm },
  backLink: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' },
});
