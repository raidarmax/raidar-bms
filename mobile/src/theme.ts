export const theme = {
  colors: {
    background: '#0B1220',
    surface: '#111827',
    surfaceElevated: '#1F2937',
    card: '#0F172A',
    border: '#1F2A44',
    borderStrong: '#334155',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5F5',
    textMuted: '#64748B',
    accent: '#38BDF8',
    accentDeep: '#0284C7',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#38BDF8',
    overlay: 'rgba(15, 23, 42, 0.72)',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
  spacing: (n: number) => n * 8,
  typography: {
    display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
    title: { fontSize: 20, fontWeight: '600' as const },
    subtitle: { fontSize: 16, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
    caption: { fontSize: 13, fontWeight: '500' as const },
    micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  },
};

export type Theme = typeof theme;
