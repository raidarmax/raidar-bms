import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar,
} from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { colors, spacing, fontSize, borderRadius } from '../theme';

type Props = {
  navigation: any;
};

export default function ScanScreen({ navigation }: Props) {
  const [serial, setSerial] = useState('');
  const [imei, setImei] = useState('');
  const [manualSerial, setManualSerial] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');
  const scannedRef = useRef(false);

  const requestCameraPermission = async () => {
    const status = await Camera.requestCameraPermission();
    if (status === 'granted') {
      setHasPermission(true);
      setCameraActive(true);
    } else {
      Alert.alert('Permission Denied', 'Camera access is needed to scan barcodes.');
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['code-128', 'code-39', 'ean-13', 'ean-8', 'itf'],
    onCodeScanned: (codes) => {
      if (scannedRef.current) return;
      const code = codes[0];
      if (code?.value && code.value.trim().length >= 8) {
        scannedRef.current = true;
        setCameraActive(false);
        const value = code.value.trim();
        if (value.length >= 14) {
          setImei(value);
          const derivedSerial = value.length === 15 ? value.slice(4) : value;
          if (!serial) setSerial(derivedSerial);
        } else {
          setSerial(value);
        }
      }
    },
  });

  const handleManualEntry = () => {
    const trimmed = manualSerial.trim();
    if (trimmed.length < 6) {
      Alert.alert('Invalid', 'Serial number must be at least 6 digits');
      return;
    }
    setSerial(trimmed);
  };

  const handleContinue = () => {
    if (!serial) {
      Alert.alert('Required', 'Please scan or enter a serial number first');
      return;
    }
    navigation.navigate('Details', { serial, imei });
  };

  const handleRescan = () => {
    scannedRef.current = false;
    setSerial('');
    setImei('');
    setCameraActive(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Scan Tracker Barcode</Text>
        <Text style={styles.subtitle}>Point camera at the serial number barcode</Text>
      </View>

      {/* Camera area */}
      <View style={styles.cameraContainer}>
        {cameraActive && device && hasPermission ? (
          <View style={styles.cameraWrapper}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={cameraActive}
              codeScanner={codeScanner}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanBox} />
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={() => setCameraActive(false)}>
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraPlaceholder} onPress={requestCameraPermission}>
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.cameraText}>Tap to open camera</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Serial result */}
      {serial ? (
        <View style={styles.serialResult}>
          <Text style={styles.serialLabel}>Serial captured</Text>
          <Text style={styles.serialValue}>{serial}</Text>
          {imei ? <Text style={styles.imeiValue}>IMEI: {imei}</Text> : null}
          <TouchableOpacity onPress={handleRescan}>
            <Text style={styles.rescanText}>Rescan</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Manual entry */}
      <View style={styles.manualSection}>
        <Text style={styles.manualLabel}>Or enter serial manually</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manualSerial}
            onChangeText={setManualSerial}
            placeholder="e.g. 44062431433"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.setBtn} onPress={handleManualEntry}>
            <Text style={styles.setBtnText}>Set</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Continue button */}
      <TouchableOpacity
        style={[styles.continueBtn, !serial && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={!serial}
      >
        <Text style={styles.continueBtnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.xs },
  cameraContainer: {
    height: 220, borderRadius: borderRadius.lg, overflow: 'hidden',
    backgroundColor: '#000', marginBottom: spacing.lg,
  },
  cameraWrapper: { flex: 1 },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center',
  },
  scanBox: {
    width: '75%', height: 50, borderWidth: 2, borderColor: colors.primary,
    borderRadius: borderRadius.sm, opacity: 0.7,
  },
  stopBtn: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  stopBtnText: { color: colors.text, fontSize: fontSize.xs },
  cameraPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  cameraIcon: { fontSize: 48 },
  cameraText: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.sm },
  serialResult: {
    backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, alignItems: 'center',
  },
  serialLabel: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '600' },
  serialValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', fontFamily: 'monospace', marginTop: spacing.xs },
  imeiValue: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: spacing.xs },
  rescanText: { color: colors.primary, fontSize: fontSize.sm, marginTop: spacing.sm },
  manualSection: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.xl,
  },
  manualLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '600', marginBottom: spacing.sm },
  manualRow: { flexDirection: 'row', gap: spacing.sm },
  manualInput: {
    flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.text, fontSize: fontSize.base,
  },
  setBtn: {
    backgroundColor: colors.surfaceLight, paddingHorizontal: spacing.lg, justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  setBtnText: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  continueBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg, alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: colors.text, fontSize: fontSize.base, fontWeight: '700' },
});
