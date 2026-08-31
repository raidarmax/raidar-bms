import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  type CameraPermissionStatus,
} from 'react-native-vision-camera';
import {
  QrCodeIcon,
  CameraIcon,
  XCircleIcon,
  AlertTriangleIcon,
  HashIcon,
  ChevronRightIcon,
} from '../../components/icons/Icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';

type ScanMode = 'qr' | 'plate';

const PLATE_BLACK = '#111111';

function FlashIcon({ size = 18, color = colors.white, filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <Path
        d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function isValidKenyaPlate(value: string): boolean {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^K[A-Z]{2,3}\d{3}[A-Z]$/.test(cleaned);
}

export default function ScannerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<CameraPermissionStatus>('not-determined');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [torch, setTorch] = useState<'off' | 'on'>('off');
  const [mode, setMode] = useState<ScanMode>('qr');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [platePrefix, setPlatePrefix] = useState('');
  const [platePlate, setPlatePlate] = useState('');
  const [plateError, setPlateError] = useState<string | null>(null);
  const platePlateRef = useRef<TextInput>(null);
  const scannedRef = useRef(false);
  const device = useCameraDevice('back');

  const scanLine = useRef(new Animated.Value(0)).current;
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const frameAnim = useRef(new Animated.Value(0)).current;

  const requestPermission = useCallback(async () => {
    try {
      const current = await Camera.getCameraPermissionStatus();
      if (current === 'granted') {
        setPermission('granted');
        return;
      }
      const result = await Camera.requestCameraPermission();
      setPermission(result);
      if (result !== 'granted') {
        setPermissionError(
          result === 'denied'
            ? 'Camera access was denied. Enable it in Settings to scan.'
            : 'Camera access is required to scan.'
        );
      } else {
        setPermissionError(null);
      }
    } catch (err: any) {
      setPermissionError(err?.message || 'Could not request camera permission.');
    }
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (mode !== 'qr' || permission !== 'granted') {
      scanLine.stopAnimation();
      scanLine.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mode, permission, scanLine]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(toggleAnim, {
        toValue: mode === 'qr' ? 0 : 1,
        useNativeDriver: false,
        friction: 8,
        tension: 90,
      }),
      Animated.spring(frameAnim, {
        toValue: mode === 'qr' ? 0 : 1,
        useNativeDriver: false,
        friction: 9,
        tension: 80,
      }),
    ]).start();
  }, [mode, toggleAnim, frameAnim]);

  const handleCode = useCallback(
    (value: string) => {
      if (scannedRef.current) return;
      if (mode !== 'qr') return;
      scannedRef.current = true;
      navigation.navigate('ScanResult', { scannedData: value });
      setTimeout(() => {
        scannedRef.current = false;
      }, 1500);
    },
    [navigation, mode]
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'ean-13', 'pdf-417', 'data-matrix'],
    onCodeScanned: (codes: Array<{ value?: string | null }>) => {
      const value = codes.find((c) => c.value)?.value;
      if (value) handleCode(value);
    },
  });

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (!trimmed) {
      setManualError('Please enter a code, BMS ID, or plate number.');
      return;
    }
    setManualOpen(false);
    setManualValue('');
    setManualError(null);
    navigation.navigate('ScanResult', { scannedData: trimmed });
  };

  const combinedPlate = `${platePrefix}${platePlate ? ` ${platePlate}` : ''}`.trim();

  const handlePlateSubmit = () => {
    if (!combinedPlate) {
      setPlateError('Enter the plate number to look up.');
      return;
    }
    const cleaned = combinedPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length < 5) {
      setPlateError('Plate number is too short.');
      return;
    }
    if (cleaned.startsWith('K') && !isValidKenyaPlate(combinedPlate)) {
      setPlateError('Prefix should be K + 2 or 3 letters, plate 3 digits + 1 letter.');
      return;
    }
    setPlateError(null);
    navigation.navigate('ScanResult', { scannedData: combinedPlate });
    setPlatePrefix('');
    setPlatePlate('');
  };

  const permissionScreen = useMemo(() => {
    if (permission === 'granted') return null;
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <View style={styles.centered}>
          <View style={styles.permIcon}>
            <CameraIcon size={38} color={colors.gray[500]} />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permText}>
            {permissionError ||
              'Allow camera access so BMS Police can scan QR codes and plates.'}
          </Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.permButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.secondaryButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { marginTop: spacing.md }]}
            onPress={() => setManualOpen(true)}
          >
            <Text style={styles.secondaryButtonText}>Enter Code Manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [permission, permissionError, requestPermission]);

  if (permissionScreen) {
    return (
      <>
        {permissionScreen}
        <ManualEntryModal
          visible={manualOpen}
          value={manualValue}
          error={manualError}
          onChange={(t) => {
            setManualValue(t);
            if (manualError) setManualError(null);
          }}
          onClose={() => {
            setManualOpen(false);
            setManualError(null);
          }}
          onSubmit={handleManualSubmit}
        />
      </>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand[500]} size="large" />
          <Text style={[styles.permText, { marginTop: spacing.lg }]}>Preparing camera…</Text>
          <View style={{ height: spacing.xxl }} />
          <View style={styles.permIcon}>
            <AlertTriangleIcon size={26} color={colors.amber[600]} />
          </View>
          <Text style={styles.permText}>
            No camera detected on this device. You can still enter codes manually.
          </Text>
          <TouchableOpacity
            style={[styles.permButton, { marginTop: spacing.lg }]}
            onPress={() => setManualOpen(true)}
          >
            <Text style={styles.permButtonText}>Enter Code Manually</Text>
          </TouchableOpacity>
        </View>
        <ManualEntryModal
          visible={manualOpen}
          value={manualValue}
          error={manualError}
          onChange={(t) => {
            setManualValue(t);
            if (manualError) setManualError(null);
          }}
          onClose={() => {
            setManualOpen(false);
            setManualError(null);
          }}
          onSubmit={handleManualSubmit}
        />
      </View>
    );
  }

  const scanLineTranslate = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [8, QR_FRAME_SIZE - 20],
  });

  const togglePillLeft = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, TOGGLE_WIDTH / 2 + 2],
  });

  const frameWidth = frameAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [QR_FRAME_SIZE, PLATE_FRAME_WIDTH],
  });
  const frameHeight = frameAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [QR_FRAME_SIZE, PLATE_FRAME_HEIGHT],
  });

  return (
    <View style={styles.cameraContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        codeScanner={mode === 'qr' ? codeScanner : undefined}
        torch={torch}
      />

      {/* Dim overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.55)']}
          style={{ flex: 1 }}
        />
      </View>

      {/* Centered frame */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.frameCenterWrap}>
          <Animated.View
            style={[
              styles.frame,
              { width: frameWidth, height: frameHeight },
            ]}
          >
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            {mode === 'qr' ? (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslate }] },
                ]}
              >
                <LinearGradient
                  colors={['rgba(46,168,131,0)', colors.brand[400], 'rgba(46,168,131,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: 3, width: '100%' }}
                />
              </Animated.View>
            ) : (
              <View style={styles.plateGuide}>
                <Text allowFontScaling={false} style={styles.plateGuideTextTop}>
                  KMEA
                </Text>
                <Text allowFontScaling={false} style={styles.plateGuideTextBottom}>
                  123A
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          accessibilityLabel="Close"
          activeOpacity={0.7}
        >
          <XCircleIcon size={22} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.toggleTrack}>
          <Animated.View style={[styles.togglePill, { left: togglePillLeft }]} />
          <Pressable
            onPress={() => setMode('qr')}
            style={styles.toggleOption}
            android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: false }}
          >
            <QrCodeIcon size={15} color={mode === 'qr' ? colors.gray[900] : colors.gray[300]} />
            <Text
              style={[
                styles.toggleLabel,
                { color: mode === 'qr' ? colors.gray[900] : colors.gray[300] },
              ]}
            >
              QR
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('plate')}
            style={styles.toggleOption}
            android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: false }}
          >
            <HashIcon size={15} color={mode === 'plate' ? colors.gray[900] : colors.gray[300]} />
            <Text
              style={[
                styles.toggleLabel,
                { color: mode === 'plate' ? colors.gray[900] : colors.gray[300] },
              ]}
            >
              Plate
            </Text>
          </Pressable>
        </View>

        <TouchableOpacity
          onPress={() => setTorch((t) => (t === 'off' ? 'on' : 'off'))}
          style={[styles.iconBtn, torch === 'on' && styles.iconBtnActive]}
          accessibilityLabel="Toggle flashlight"
          activeOpacity={0.7}
        >
          <FlashIcon
            size={18}
            color={torch === 'on' ? colors.amber[500] : colors.white}
            filled={torch === 'on'}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom pane */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomWrapper}
        pointerEvents="box-none"
      >
        {mode === 'qr' ? (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.instructionRow}>
              <QrCodeIcon size={16} color={colors.white} />
              <Text style={styles.instructionText}>
                Point the camera at a QR code to scan
              </Text>
            </View>
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => setManualOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.manualButtonText}>Enter Code Manually</Text>
              <ChevronRightIcon size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.plateSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.plateHandle} />
            <View style={styles.plateSheetHeader}>
              <View style={styles.plateSheetIconWrap}>
                <HashIcon size={16} color={colors.brand[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.plateSheetTitle}>Enter plate number</Text>
                <Text style={styles.plateSheetSubtitle}>
                  Works with any plate colour, front or rear
                </Text>
              </View>
            </View>

            <View style={styles.plateSquareWrap}>
              <View style={styles.plateSquare}>
                <View style={styles.plateRivetTL} />
                <View style={styles.plateRivetTR} />
                <View style={styles.plateRivetBL} />
                <View style={styles.plateRivetBR} />
                <TextInput
                  value={platePrefix}
                  onChangeText={(t) => {
                    const cleaned = t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
                    setPlatePrefix(cleaned);
                    if (plateError) setPlateError(null);
                    if (cleaned.length >= 3) {
                      platePlateRef.current?.focus();
                    }
                  }}
                  placeholder="KMEA"
                  placeholderTextColor="rgba(17,17,17,0.28)"
                  style={styles.plateRowInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={4}
                  returnKeyType="next"
                  onSubmitEditing={() => platePlateRef.current?.focus()}
                  allowFontScaling={false}
                />
                <View style={styles.plateDivider} />
                <TextInput
                  ref={platePlateRef}
                  value={platePlate}
                  onChangeText={(t) => {
                    const cleaned = t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
                    setPlatePlate(cleaned);
                    if (plateError) setPlateError(null);
                  }}
                  placeholder="123A"
                  placeholderTextColor="rgba(17,17,17,0.28)"
                  style={styles.plateRowInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={4}
                  returnKeyType="search"
                  onSubmitEditing={handlePlateSubmit}
                  allowFontScaling={false}
                />
              </View>
            </View>

            {plateError ? (
              <Text style={styles.plateError}>{plateError}</Text>
            ) : (
              <Text style={styles.plateHint}>
                Type the letters on the top line, digits on the bottom — just like the rear plate.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.lookupButton, !combinedPlate && styles.lookupButtonDisabled]}
              onPress={handlePlateSubmit}
              activeOpacity={0.85}
              disabled={!combinedPlate}
            >
              <Text style={styles.lookupButtonText}>Look Up Plate</Text>
              <ChevronRightIcon size={18} color={colors.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.altManualLink}
              onPress={() => setManualOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.altManualLinkText}>Or search by BMS ID / case reference</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <ManualEntryModal
        visible={manualOpen}
        value={manualValue}
        error={manualError}
        onChange={(t) => {
          setManualValue(t);
          if (manualError) setManualError(null);
        }}
        onClose={() => {
          setManualOpen(false);
          setManualError(null);
        }}
        onSubmit={handleManualSubmit}
      />
    </View>
  );
}

function ManualEntryModal({
  visible,
  value,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  value: string;
  error: string | null;
  onChange: (t: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.plateHandle} />
          <Text style={styles.modalTitle}>Manual look-up</Text>
          <Text style={styles.modalSubtitle}>
            Enter a BMS ID, plate number, or case reference.
          </Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="BMS-2024-00001 or KMEA 123A"
            placeholderTextColor={colors.gray[400]}
            style={styles.modalInput}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={onSubmit}
          />
          {error ? <Text style={styles.modalError}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnGhost} onPress={onClose}>
              <Text style={styles.modalBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtn} onPress={onSubmit}>
              <Text style={styles.modalBtnText}>Look Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const QR_FRAME_SIZE = 260;
const PLATE_FRAME_WIDTH = 240;
const PLATE_FRAME_HEIGHT = 240;
const TOGGLE_WIDTH = 168;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  permIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  permTitle: { ...typography.h2, textAlign: 'center', marginBottom: spacing.md },
  permText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    color: colors.gray[600],
  },
  permButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  permButtonText: { ...typography.button },
  secondaryButton: {
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: { ...typography.body, color: colors.brand[500], fontWeight: '600' },

  frameCenterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  frame: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 34,
    height: 34,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.brand[400],
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 34,
    height: 34,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.brand[400],
    borderTopRightRadius: 18,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 34,
    height: 34,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.brand[400],
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.brand[400],
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
  },
  plateGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  plateGuideTextTop: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'monospace',
    lineHeight: 40,
  },
  plateGuideTextBottom: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'monospace',
    lineHeight: 40,
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.5)',
  },

  toggleTrack: {
    width: TOGGLE_WIDTH,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    padding: 3,
    position: 'relative',
  },
  togglePill: {
    position: 'absolute',
    top: 3,
    width: TOGGLE_WIDTH / 2 - 4,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    ...shadows.md,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    zIndex: 1,
    borderRadius: 16,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  bottomWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
  },
  instructionText: { color: colors.white, fontSize: 13, fontWeight: '500' },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  manualButtonText: { color: colors.white, fontSize: 14, fontWeight: '600' },

  plateSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
    ...shadows.lg,
  },
  plateHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[200],
    marginBottom: spacing.sm,
  },
  plateSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  plateSheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateSheetTitle: {
    ...typography.h3,
    color: colors.gray[900],
  },
  plateSheetSubtitle: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginTop: 2,
  },
  plateSquareWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  plateSquare: {
    width: 200,
    height: 200,
    backgroundColor: '#F4C21A',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#0F0F0F',
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    alignItems: 'stretch',
    position: 'relative',
  },
  plateRivetTL: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,15,15,0.55)',
  },
  plateRivetTR: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,15,15,0.55)',
  },
  plateRivetBL: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,15,15,0.55)',
  },
  plateRivetBR: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,15,15,0.55)',
  },
  plateRowInput: {
    flex: 1,
    color: PLATE_BLACK,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: 4,
    fontFamily: 'monospace',
    textAlign: 'center',
    padding: 0,
    width: '100%',
  },
  plateDivider: {
    height: 2,
    backgroundColor: 'rgba(15,15,15,0.25)',
    marginHorizontal: 16,
  },
  plateHint: {
    ...typography.bodySmall,
    color: colors.gray[500],
    textAlign: 'center',
  },
  plateError: {
    fontSize: 13,
    color: colors.red[600],
    textAlign: 'center',
    fontWeight: '500',
  },
  lookupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand[500],
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  lookupButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  lookupButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  altManualLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  altManualLinkText: {
    ...typography.bodySmall,
    color: colors.brand[600],
    fontWeight: '600',
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: {
    backgroundColor: colors.white,
    padding: spacing.xxl,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  modalTitle: { ...typography.h2, marginTop: spacing.xs },
  modalSubtitle: { ...typography.body, color: colors.gray[500] },
  modalInput: {
    backgroundColor: colors.gray[50],
    borderColor: colors.gray[200],
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 15,
    color: colors.gray[900],
    marginTop: spacing.xs,
  },
  modalError: { color: colors.red[600], fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  modalBtn: {
    flex: 1,
    backgroundColor: colors.brand[500],
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalBtnText: { ...typography.button },
  modalBtnGhost: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.gray[100],
  },
  modalBtnGhostText: { color: colors.gray[700], fontWeight: '600' },
});
