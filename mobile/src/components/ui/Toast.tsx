import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let toastHandler: ((toast: Toast) => void) | null = null;

export function showToast(message: string, type: ToastType = 'info') {
  toastHandler?.({
    id: Date.now().toString(),
    message,
    type,
  });
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastHandler = (toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    };
    return () => {
      toastHandler = null;
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </View>
    </View>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start(onDismiss);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const config = toastColors[toast.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.bg, borderColor: config.border, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.toastDot, { backgroundColor: config.dot }]} />
      <Text style={[styles.toastText, { color: config.text }]} numberOfLines={2}>
        {toast.message}
      </Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={[styles.toastDismiss, { color: config.text }]}>x</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const toastColors: Record<ToastType, { bg: string; border: string; text: string; dot: string }> = {
  success: { bg: colors.brand[50], border: colors.brand[200], text: colors.brand[800], dot: colors.brand[500] },
  error: { bg: colors.red[50], border: colors.red[100], text: colors.red[800], dot: colors.red[500] },
  info: { bg: colors.blue[50], border: colors.blue[100], text: colors.blue[700], dot: colors.blue[500] },
  warning: { bg: colors.amber[50], border: colors.amber[100], text: colors.amber[700], dot: colors.amber[500] },
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 9999,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  toastText: {
    ...typography.bodySmall,
    fontWeight: '500',
    flex: 1,
  },
  toastDismiss: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: spacing.sm,
    opacity: 0.6,
  },
});
