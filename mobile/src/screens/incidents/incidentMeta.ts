import type { ComponentType } from 'react';
import {
  AlertTriangleIcon,
  ShieldIcon,
  MotorcycleIcon,
  ActivityIcon,
  ExclamationIcon,
  FileTextIcon,
} from '../../components/icons/Icons';
import { colors } from '../../theme';

export type IconComp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type IncidentTypeMeta = {
  label: string;
  icon: IconComp;
  color: string;
  colorDark: string;
  tint: string;
};

export const INCIDENT_TYPE_META: Record<string, IncidentTypeMeta> = {
  crime: {
    label: 'Crime',
    icon: ShieldIcon,
    color: '#B91C1C',
    colorDark: '#7F1D1D',
    tint: '#FEE2E2',
  },
  accident: {
    label: 'Accident',
    icon: AlertTriangleIcon,
    color: '#EA580C',
    colorDark: '#9A3412',
    tint: '#FFEDD5',
  },
  reckless_driving: {
    label: 'Reckless Driving',
    icon: ActivityIcon,
    color: '#D97706',
    colorDark: '#78350F',
    tint: '#FEF3C7',
  },
  no_helmet: {
    label: 'No Helmet',
    icon: MotorcycleIcon,
    color: '#0D9488',
    colorDark: '#134E4A',
    tint: '#CCFBF1',
  },
  speeding: {
    label: 'Speeding',
    icon: ActivityIcon,
    color: '#2563EB',
    colorDark: '#1E3A8A',
    tint: '#DBEAFE',
  },
  traffic_violation: {
    label: 'Traffic Violation',
    icon: ExclamationIcon,
    color: '#7C3AED',
    colorDark: '#4C1D95',
    tint: '#EDE9FE',
  },
  default: {
    label: 'Incident',
    icon: FileTextIcon,
    color: colors.gray[700],
    colorDark: colors.gray[900],
    tint: colors.gray[100],
  },
};

export const STATUS_META: Record<string, { label: string; chipBg: string; chipFg: string }> = {
  unassigned: { label: 'Unassigned', chipBg: 'rgba(255,255,255,0.28)', chipFg: '#FEF3C7' },
  new: { label: 'New', chipBg: 'rgba(255,255,255,0.28)', chipFg: '#DBEAFE' },
  reported: { label: 'Reported', chipBg: 'rgba(255,255,255,0.28)', chipFg: '#FEF3C7' },
  investigating: { label: 'Investigating', chipBg: 'rgba(255,255,255,0.28)', chipFg: '#FDE68A' },
  resolved: { label: 'Resolved', chipBg: 'rgba(255,255,255,0.28)', chipFg: '#BBF7D0' },
  closed: { label: 'Closed', chipBg: 'rgba(255,255,255,0.28)', chipFg: '#E5E7EB' },
};

export const STATUS_LIST_META: Record<
  string,
  { label: string; bg: string; fg: string; border: string }
> = {
  unassigned: { label: 'Unassigned', bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A' },
  new: { label: 'New', bg: '#DBEAFE', fg: '#1E40AF', border: '#BFDBFE' },
  reported: { label: 'Reported', bg: '#FFEDD5', fg: '#9A3412', border: '#FED7AA' },
  investigating: { label: 'Investigating', bg: '#FEF3C7', fg: '#78350F', border: '#FDE68A' },
  resolved: { label: 'Resolved', bg: '#DCFCE7', fg: '#15803D', border: '#BBF7D0' },
  closed: { label: 'Closed', bg: '#F3F4F6', fg: '#4B5563', border: '#E5E7EB' },
};

export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .split('_')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
