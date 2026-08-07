import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(serviceNumber, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logoRing}>
              <Text style={styles.logoLetter}>R</Text>
            </View>
            <Text style={styles.brandName}>Raidar Police</Text>
            <Text style={styles.brandTag}>Field verification & compliance</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Officer sign in</Text>
            <Text style={styles.sub}>Use your service number and station password.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Service number</Text>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                value={serviceNumber}
                onChangeText={setServiceNumber}
                placeholder="e.g. 12345"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label="Sign in" onPress={submit} loading={loading} />
          </View>

          <Text style={styles.footer}>
            Access is restricted to registered officers. All activity is audited.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
    padding: theme.spacing(3),
    justifyContent: 'center',
    gap: theme.spacing(3),
  },
  brand: { alignItems: 'center', gap: 8, marginBottom: theme.spacing(2) },
  logoRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  logoLetter: { color: theme.colors.accent, fontSize: 28, fontWeight: '700' },
  brandName: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '700' },
  brandTag: { color: theme.colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing(2),
  },
  heading: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '600' },
  sub: { color: theme.colors.textMuted, fontSize: 13, marginTop: -6 },
  field: { gap: 6 },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
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
  footer: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center' },
});
