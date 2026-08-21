import { Platform } from 'react-native';

// Color system: clean whites, soft grays, and BMS green/mint accents
export const colors = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // BMS brand green (primary accent)
  brand: {
    50: '#E8F5F0',
    100: '#C8E6DB',
    200: '#9AD4BF',
    300: '#5FBFA0',
    400: '#2EA883',
    500: '#1B8A6A',
    600: '#167054',
    700: '#115840',
    800: '#0D402E',
    900: '#082A1E',
  },

  // Neutral grays
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Status colors
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  orange: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    500: '#F97316',
    600: '#EA580C',
    700: '#C2410C',
  },
  rose: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    500: '#F43F5E',
    600: '#E11D48',
    700: '#BE123C',
  },
  teal: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
  },
  // Warm neutrals for background canvas
  warm: {
    50: '#FDF8F3',
    100: '#F8EFE4',
    200: '#EBD9C1',
    500: '#8A6E52',
    800: '#2C221A',
    900: '#1B140E',
  },
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 999,
};

export const typography = {
  h1: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: colors.gray[900],
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'android' ? 'Inter_700Bold' : 'Inter-Bold',
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.gray[900],
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'android' ? 'Inter_600SemiBold' : 'Inter-SemiBold',
  },
  h3: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.gray[800],
    fontFamily: Platform.OS === 'android' ? 'Inter_600SemiBold' : 'Inter-SemiBold',
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.gray[700],
    lineHeight: 22,
    fontFamily: Platform.OS === 'android' ? 'Inter_400Regular' : 'Inter-Regular',
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.gray[500],
    lineHeight: 18,
    fontFamily: Platform.OS === 'android' ? 'Inter_400Regular' : 'Inter-Regular',
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.gray[400],
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'android' ? 'Inter_500Medium' : 'Inter-Medium',
  },
  button: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.white,
    fontFamily: Platform.OS === 'android' ? 'Inter_600SemiBold' : 'Inter-SemiBold',
  },
  buttonSmall: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.white,
    fontFamily: Platform.OS === 'android' ? 'Inter_600SemiBold' : 'Inter-SemiBold',
  },
  stat: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.gray[900],
    fontFamily: Platform.OS === 'android' ? 'Inter_700Bold' : 'Inter-Bold',
  },
  statSmall: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.gray[900],
    fontFamily: Platform.OS === 'android' ? 'Inter_700Bold' : 'Inter-Bold',
  },
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.gray[500],
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'android' ? 'Inter_500Medium' : 'Inter-Medium',
  },
};

export const shadows = {
  none: {},
  sm: Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }
    : { elevation: 1 },
  md: Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }
    : { elevation: 2 },
  lg: Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 }
    : { elevation: 4 },
};
