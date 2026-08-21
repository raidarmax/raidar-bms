import { StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../../theme';

export const detailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.gray[700] },
  content: { padding: spacing.md, paddingBottom: spacing.xxxxl },
  hero: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.gray[900], letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 13, color: colors.gray[600], marginTop: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.gray[500],
    marginBottom: 6,
    marginLeft: 4,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.md,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 12, color: colors.gray[500], fontWeight: '600' },
  rowValue: {
    fontSize: 13,
    color: colors.gray[900],
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand[500],
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  actionBtnText: { color: colors.white, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.gray[500] },
  emptyText: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    color: colors.gray[500],
    textAlign: 'center',
    padding: spacing.md,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    width: '48.5%',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray[500],
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.gray[900] },
});

export function humanize(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function dateStr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso).getTime();
  if (!isFinite(d)) return false;
  return d < Date.now();
}
