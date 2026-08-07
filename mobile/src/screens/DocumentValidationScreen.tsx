import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import {
  documentLabel,
  validateDocument,
  type DocumentKind,
  type DocumentValidationResult,
} from '../lib/documentValidation';
import { PoliceAuth } from '../lib/policeAuth';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DocumentValidation'>;

const KINDS: DocumentKind[] = ['national_id', 'driving_license', 'insurance', 'logbook', 'inspection'];

type PickedFile = { uri: string; name: string; mimeType?: string };

export default function DocumentValidationScreen() {
  const nav = useNavigation<Nav>();
  const { officer } = useAuth();
  const [kind, setKind] = useState<DocumentKind>('national_id');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [subjectRef, setSubjectRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocumentValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const captureFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera in Settings to capture documents.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({ uri: asset.uri, name: asset.fileName ?? `capture-${Date.now()}.jpg`, mimeType: 'image/jpeg' });
    }
  };

  const pickFromLibrary = async () => {
    const doc = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!doc.canceled && doc.assets[0]) {
      const asset = doc.assets[0];
      setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? undefined });
    }
  };

  const submit = async () => {
    if (!officer) return;
    if (!file) {
      setError('Attach a document photo or PDF first.');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const validation = await validateDocument({
        kind,
        file,
        officerId: officer.id,
        stationId: officer.station_id,
        subjectId: subjectRef.trim() || null,
      });
      setResult(validation);
      await PoliceAuth.logVerification({
        officerId: officer.id,
        stationId: officer.station_id,
        verificationType: `document_${kind}`,
        documentValue: subjectRef || file.name,
        subjectType: null,
        subjectId: null,
        result: validation.overall_status,
        resultDetails: {
          confidence: validation.confidence,
          markers: validation.markers,
          source: 'mobile',
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DOCUMENT VALIDATION</Text>
          <Text style={styles.title}>Verify a physical document</Text>
          <Text style={styles.body}>
            Capture or upload the document. Raidar runs OCR and compares the extracted fields against the register.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Document type</Text>
          <View style={styles.chipsRow}>
            {KINDS.map((k) => {
              const active = k === kind;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[styles.kindChip, active && styles.kindChipActive]}
                >
                  <Text style={[styles.kindChipText, active && styles.kindChipTextActive]}>
                    {documentLabel(k)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Attach document</Text>
          <View style={styles.attachRow}>
            <Button label="Capture photo" onPress={captureFromCamera} variant="secondary" style={{ flex: 1 }} />
            <Button label="Upload file" onPress={pickFromLibrary} variant="secondary" style={{ flex: 1 }} />
          </View>
          {file ? (
            <View style={styles.filePreview}>
              {file.mimeType?.startsWith('image/') ? (
                <Image source={{ uri: file.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewFallback}>
                  <Text style={styles.previewFallbackText}>PDF</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileHint}>{file.mimeType ?? 'file'}</Text>
              </View>
              <Pressable onPress={() => setFile(null)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Link to subject (optional)</Text>
          <TextInput
            value={subjectRef}
            onChangeText={setSubjectRef}
            placeholder="BMS ID, plate number, or case reference"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Run validation" onPress={submit} loading={loading} />

        {result ? <ResultBlock result={result} /> : null}

        <Button label="Back" variant="ghost" onPress={() => nav.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultBlock({ result }: { result: DocumentValidationResult }) {
  const palette = statusPalette(result.overall_status);
  return (
    <View style={[styles.resultCard, { borderColor: palette.border, backgroundColor: palette.bg }]}>
      <Text style={[styles.resultStatus, { color: palette.fg }]}>{result.overall_status.toUpperCase()}</Text>
      <Text style={styles.resultTitle}>Confidence {Math.round(result.confidence * 100)}%</Text>

      {Object.entries(result.extracted).length ? (
        <View style={styles.extractedBlock}>
          <Text style={styles.extractedHeader}>Extracted fields</Text>
          {Object.entries(result.extracted).map(([label, value]) => (
            <View key={label} style={styles.extractedRow}>
              <Text style={styles.extractedLabel}>{label}</Text>
              <Text style={styles.extractedValue}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {result.markers.length ? (
        <View style={styles.extractedBlock}>
          <Text style={styles.extractedHeader}>Field checks</Text>
          {result.markers.map((marker) => (
            <View key={marker.field} style={styles.markerRow}>
              <View
                style={[styles.markerDot, { backgroundColor: marker.ok ? theme.colors.success : theme.colors.danger }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.markerField}>{marker.field}</Text>
                <Text style={styles.markerNote}>{marker.note}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function statusPalette(status: DocumentValidationResult['overall_status']) {
  switch (status) {
    case 'passed':
      return { fg: theme.colors.success, bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.35)' };
    case 'failed':
      return { fg: theme.colors.danger, bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.35)' };
    default:
      return { fg: theme.colors.warning, bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)' };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(6) },
  header: { gap: 6 },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '700' },
  body: { color: theme.colors.textSecondary, lineHeight: 22 },
  section: { gap: 10 },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  kindChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  kindChipText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
  kindChipTextActive: { color: '#0B1220' },
  attachRow: { flexDirection: 'row', gap: 10 },
  filePreview: {
    marginTop: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: theme.colors.surface },
  previewFallback: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFallbackText: { color: theme.colors.textPrimary, fontWeight: '700' },
  fileName: { color: theme.colors.textPrimary, fontWeight: '600' },
  fileHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  remove: { color: theme.colors.danger, fontWeight: '600', fontSize: 12 },
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
  resultCard: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing(3),
    borderWidth: 1,
    gap: 8,
  },
  resultStatus: { fontWeight: '700', letterSpacing: 1.2, fontSize: 12 },
  resultTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' },
  extractedBlock: { marginTop: 12, gap: 6 },
  extractedHeader: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  extractedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingTop: 6,
  },
  extractedLabel: { color: theme.colors.textMuted, fontSize: 12 },
  extractedValue: { color: theme.colors.textPrimary, fontSize: 13, maxWidth: '60%', textAlign: 'right' },
  markerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6 },
  markerDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6 },
  markerField: { color: theme.colors.textPrimary, fontWeight: '600' },
  markerNote: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
});
