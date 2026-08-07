import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { parseQR } from '../lib/qrParser';
import { lookupBmsId, lookupIncident, lookupRegistration } from '../lib/lookup';
import { useAuth } from '../context/AuthContext';
import { PoliceAuth } from '../lib/policeAuth';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Scan'>;

export default function ScanScreen() {
  const nav = useNavigation<Nav>();
  const { officer } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [torch, setTorch] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const lastCode = useRef<string | null>(null);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScanned = async (result: BarcodeScanningResult) => {
    if (!scanning || !officer) return;
    const value = result.data;
    if (!value || value === lastCode.current) return;
    lastCode.current = value;
    setScanning(false);
    setStatus('Looking up record…');

    try {
      const parsed = parseQR(value);
      let lookup;
      let subjectType: string | null = null;

      switch (parsed.kind) {
        case 'rider':
          lookup = await lookupBmsId(parsed.identifier);
          subjectType = 'rider';
          break;
        case 'motorcycle':
          lookup = await lookupRegistration(parsed.identifier);
          subjectType = 'motorcycle';
          break;
        case 'incident':
          lookup = await lookupIncident(parsed.identifier);
          subjectType = 'incident';
          break;
        case 'url':
          setStatus('QR contains a URL; open in browser?');
          setTimeout(() => setScanning(true), 1200);
          return;
        default:
          setStatus(`Unrecognised QR: ${value.slice(0, 32)}`);
          setTimeout(() => {
            setScanning(true);
            setStatus(null);
          }, 1600);
          return;
      }

      const resultLabel = lookup.type === 'not_found' ? 'not_found' : 'matched';

      await PoliceAuth.logVerification({
        officerId: officer.id,
        stationId: officer.station_id,
        verificationType: `qr_${subjectType}`,
        documentValue: value,
        subjectType,
        subjectId: lookup.type === 'not_found' ? null : (lookup.data as { id?: string }).id ?? null,
        result: resultLabel,
        resultDetails: { parsed_kind: parsed.kind, source: 'mobile' },
      });

      nav.navigate('VerifyResult', { lookup, source: 'qr' });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Scan failed.');
      setTimeout(() => {
        setScanning(true);
        setStatus(null);
      }, 1800);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Camera access required</Text>
          <Text style={styles.body}>
            Raidar Police needs your camera to scan rider QR codes and documents.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Allow camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'pdf417', 'code128', 'ean13'] }}
        onBarcodeScanned={scanning ? handleScanned : undefined}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => nav.goBack()}>
            <Text style={styles.iconBtnText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Scan QR</Text>
          <Pressable style={styles.iconBtn} onPress={() => setTorch((t) => !t)}>
            <Text style={styles.iconBtnText}>{torch ? 'Torch on' : 'Torch'}</Text>
          </Pressable>
        </View>

        <View style={styles.reticleWrap}>
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.reticleHint}>Align the QR code within the frame</Text>
        </View>

        <View style={styles.footer}>
          {status ? (
            <View style={styles.statusPill}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : (
            <Text style={styles.footerHint}>
              Supports BMS rider IDs, plate numbers, case references, and rider portal URLs.
            </Text>
          )}

          <Pressable style={styles.manualBtn} onPress={() => nav.navigate('ManualLookup')}>
            <Text style={styles.manualBtnText}>Enter manually</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const RETICLE_SIZE = 260;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
    gap: theme.spacing(2),
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  iconBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  iconBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reticleWrap: { alignItems: 'center', gap: theme.spacing(2) },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: theme.colors.accent,
  },
  tl: { top: 0, left: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 12 },
  reticleHint: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: theme.spacing(3),
    paddingBottom: theme.spacing(2),
    gap: theme.spacing(1.5),
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
  },
  statusText: { color: '#fff', fontSize: 13 },
  footerHint: { color: '#CBD5F5', fontSize: 12, textAlign: 'center' },
  manualBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  manualBtnText: { color: theme.colors.accent, fontWeight: '600' },
  title: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '600' },
  body: { color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  primaryBtnText: { color: '#0B1220', fontWeight: '700' },
});
