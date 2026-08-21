import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PLATE_YELLOW = '#F4C21A';
const PLATE_BORDER = '#8A6E12';
const PLATE_BLACK = '#111111';

type Size = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<Size, { padH: number; padV: number; fs: number; radius: number; letterSp: number }> = {
  sm: { padH: 8, padV: 3, fs: 13, radius: 4, letterSp: 1 },
  md: { padH: 12, padV: 6, fs: 18, radius: 6, letterSp: 1.5 },
  lg: { padH: 18, padV: 10, fs: 26, radius: 8, letterSp: 2 },
};

function formatPlate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  const m = cleaned.match(/^(K[A-Z]{2,3})(\d{3})([A-Z])$/);
  if (m) return `${m[1]} ${m[2]}${m[3]}`;
  return raw.trim().toUpperCase();
}

export function KenyaPlate({
  plate,
  size = 'md',
}: {
  plate: string | null | undefined;
  size?: Size;
}) {
  const s = SIZE_MAP[size];
  return (
    <View
      style={[
        styles.plate,
        {
          paddingHorizontal: s.padH,
          paddingVertical: s.padV,
          borderRadius: s.radius,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: PLATE_BLACK,
          fontSize: s.fs,
          fontWeight: '900',
          letterSpacing: s.letterSp,
          fontFamily: 'monospace',
        }}
      >
        {formatPlate(plate)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    backgroundColor: PLATE_YELLOW,
    borderWidth: 2,
    borderColor: PLATE_BORDER,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
