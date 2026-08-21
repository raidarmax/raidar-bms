import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { AlertTriangleIcon } from '../../components/icons/Icons';
import Svg, { Path } from 'react-native-svg';

function EyeIcon({ size = 20, color = colors.gray[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EyeOffIcon({ size = 20, color = colors.gray[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-7-11-7a19.36 19.36 0 015.06-5.94M9.9 4.24A10.86 10.86 0 0112 4c7 0 11 7 11 7a19.5 19.5 0 01-2.16 3.19M1 1l22 22"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.12 14.12A3 3 0 019.88 9.88"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!serviceNumber.trim() || !password.trim()) {
      setError('Please enter your service number and password.');
      return;
    }

    setLoading(true);
    try {
      await login(serviceNumber, password);
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.logoSection}>
            <Image
              source={require('../../../assets/bms_f_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appName}>BMS Police</Text>
            <Text style={styles.subtitle}>Boda Management System</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBanner}>
                <AlertTriangleIcon size={18} color={colors.red[600]} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Service Number</Text>
              <TextInput
                style={styles.input}
                value={serviceNumber}
                onChangeText={(t: string) => {
                  setServiceNumber(t);
                  if (error) setError(null);
                }}
                placeholder="e.g. AP/54321"
                placeholderTextColor={colors.gray[400]}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={(t: string) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  placeholder="Enter password"
                  placeholderTextColor={colors.gray[400]}
                  secureTextEntry={!showPassword}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOffIcon size={20} color={colors.gray[500]} />
                  ) : (
                    <EyeIcon size={20} color={colors.gray[500]} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            Contact your station admin if you cannot access your account.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xxxl },
  logoSection: { alignItems: 'center', marginBottom: spacing.xxxxl },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: spacing.lg,
  },
  appName: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, textAlign: 'center', marginTop: 4 },
  form: { gap: spacing.lg },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.red[50],
    borderColor: colors.red[100],
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  errorBannerText: { flex: 1, color: colors.red[700], fontSize: 13, fontWeight: '500' },
  inputGroup: { gap: spacing.xs },
  inputLabel: { ...typography.bodySmall, fontWeight: '500', color: colors.gray[700] },
  input: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 15,
    color: colors.gray[900],
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 15,
    color: colors.gray[900],
  },
  eyeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    backgroundColor: colors.brand[500],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { ...typography.button },
  footer: { ...typography.bodySmall, textAlign: 'center', marginTop: spacing.xxxl },
});
