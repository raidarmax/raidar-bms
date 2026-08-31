import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../services/supabase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { ChevronLeftIcon, CheckCircleIcon, XCircleIcon } from '../../components/icons/Icons';

export default function VerifyDocumentsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { officer } = useAuth();
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType] = useState<'license' | 'insurance'>('license');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async () => {
    if (!documentNumber.trim()) {
      Alert.alert('Error', 'Please enter a document number');
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const supabase = getSupabase();
      if (documentType === 'license') {
        const { data } = await supabase
          .from('riders')
          .select('full_name, bms_id, license_number, license_expiry, status')
          .eq('license_number', documentNumber.trim())
          .maybeSingle();

        if (data) {
          const isExpired = data.license_expiry && new Date(data.license_expiry) < new Date();
          setResult({
            found: true,
            type: 'License',
            holder: data.full_name,
            bmsId: data.bms_id,
            status: isExpired ? 'Expired' : 'Valid',
            expiry: data.license_expiry,
            valid: !isExpired,
          });
        } else {
          setResult({ found: false });
        }
      } else {
        const { data } = await supabase
          .from('motorcycles')
          .select('registration_number, insurance_status, insurance_provider, insurance_expiry')
          .eq('registration_number', documentNumber.trim().toUpperCase())
          .maybeSingle();

        if (data) {
          const isExpired = data.insurance_expiry && new Date(data.insurance_expiry) < new Date();
          setResult({
            found: true,
            type: 'Insurance',
            vehicle: data.registration_number,
            provider: data.insurance_provider,
            status: isExpired ? 'Expired' : (data.insurance_status || 'Unknown'),
            expiry: data.insurance_expiry,
            valid: !isExpired && data.insurance_status === 'active',
          });
        } else {
          setResult({ found: false });
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeftIcon size={20} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Documents</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.cardTitle}>Document Verification</Text>

          {/* Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, documentType === 'license' && styles.toggleBtnActive]}
              onPress={() => setDocumentType('license')}
            >
              <Text style={[styles.toggleText, documentType === 'license' && styles.toggleTextActive]}>
                License
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, documentType === 'insurance' && styles.toggleBtnActive]}
              onPress={() => setDocumentType('insurance')}
            >
              <Text style={[styles.toggleText, documentType === 'insurance' && styles.toggleTextActive]}>
                Insurance
              </Text>
            </TouchableOpacity>
          </View>

          <Input
            label={documentType === 'license' ? 'License Number' : 'Registration Number'}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder={documentType === 'license' ? 'Enter license number' : 'e.g. KMXX 123A'}
            autoCapitalize="characters"
          />

          <Button
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            fullWidth
            size="lg"
          />
        </Card>

        {/* Result */}
        {result && (
          <Card style={{ marginTop: spacing.lg }}>
            {result.found ? (
              <View>
                <View style={styles.resultHeader}>
                  <View style={[styles.resultStatusIcon, { backgroundColor: result.valid ? colors.brand[50] : colors.red[50] }]}>
                    {result.valid
                      ? <CheckCircleIcon size={24} color={colors.brand[600]} />
                      : <XCircleIcon size={24} color={colors.red[600]} />
                    }
                  </View>
                  <View style={styles.resultHeaderText}>
                    <Text style={styles.resultTitle}>{result.type}</Text>
                    <Badge
                      label={result.status}
                      variant={result.valid ? 'success' : 'danger'}
                      size="md"
                    />
                  </View>
                </View>
                <View style={styles.resultDetails}>
                  {result.holder && <DetailRow label="Holder" value={result.holder} />}
                  {result.bmsId && <DetailRow label="BMS ID" value={result.bmsId} />}
                  {result.vehicle && <DetailRow label="Vehicle" value={result.vehicle} />}
                  {result.provider && <DetailRow label="Provider" value={result.provider} />}
                  {result.expiry && (
                    <DetailRow
                      label="Expiry"
                      value={new Date(result.expiry).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    />
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.notFound}>
                <Text style={styles.notFoundTitle}>Not Found</Text>
                <Text style={styles.notFoundText}>
                  No record found for this document number
                </Text>
              </View>
            )}
          </Card>
        )}

        <View style={{ height: spacing.xxxxl }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  headerTitle: {
    ...typography.h3,
    color: colors.gray[900],
  },
  content: {
    padding: spacing.xl,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.gray[900],
    marginBottom: spacing.lg,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.xl,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  toggleBtnActive: {
    backgroundColor: colors.white,
  },
  toggleText: {
    ...typography.buttonSmall,
    color: colors.gray[500],
  },
  toggleTextActive: {
    color: colors.brand[700],
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resultStatusIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  resultHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTitle: {
    ...typography.h3,
    color: colors.gray[900],
  },
  resultDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
  detailValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.gray[900],
  },
  notFound: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  notFoundTitle: {
    ...typography.h4,
    color: colors.gray[700],
    marginBottom: spacing.sm,
  },
  notFoundText: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
});
