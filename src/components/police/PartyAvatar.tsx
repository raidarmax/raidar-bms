import { useState } from 'react';
import { User, Bike, Shield, Crown, AlertTriangle, UserPlus, ShieldCheck, Video as LucideIcon } from 'lucide-react';

export type AvatarKind = 'rider' | 'owner' | 'motorcycle' | 'officer' | 'senior_officer' | 'reporter' | 'poi';

const KIND_ICON: Record<AvatarKind, LucideIcon> = {
  rider: User,
  owner: ShieldCheck,
  motorcycle: Bike,
  officer: Shield,
  senior_officer: Crown,
  reporter: AlertTriangle,
  poi: UserPlus,
};

const KIND_TONE: Record<AvatarKind, { bg: string; text: string; ring: string }> = {
  rider: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200' },
  owner: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  motorcycle: { bg: 'bg-emerald-100', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  officer: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  senior_officer: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  reporter: { bg: 'bg-rose-100', text: 'text-rose-600', ring: 'ring-rose-200' },
  poi: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200' },
};

const SIZE_MAP = {
  xs: { box: 'w-6 h-6', icon: 'h-3 w-3', text: 'text-[9px]' },
  sm: { box: 'w-7 h-7', icon: 'h-3.5 w-3.5', text: 'text-[10px]' },
  md: { box: 'w-8 h-8', icon: 'h-4 w-4', text: 'text-xs' },
  lg: { box: 'w-10 h-10', icon: 'h-5 w-5', text: 'text-sm' },
  xl: { box: 'w-14 h-14', icon: 'h-6 w-6', text: 'text-base' },
} as const;

type Size = keyof typeof SIZE_MAP;

type Props = {
  kind: AvatarKind;
  photoUrl?: string | null;
  name?: string | null;
  size?: Size;
  rounded?: 'lg' | 'xl' | 'full';
  className?: string;
};

function initials(name?: string | null) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('');
}

export default function PartyAvatar({ kind, photoUrl, name, size = 'md', rounded = 'lg', className = '' }: Props) {
  const [broken, setBroken] = useState(false);
  const tone = KIND_TONE[kind];
  const s = SIZE_MAP[size];
  const Icon = KIND_ICON[kind];
  const shape = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-lg';
  const showPhoto = photoUrl && !broken;
  const showInitials = !showPhoto && name && kind !== 'motorcycle';

  return (
    <div
      className={`${s.box} ${shape} ${tone.bg} ${tone.text} flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
      title={name || undefined}
    >
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt={name || ''}
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : showInitials ? (
        <span className={`font-bold ${s.text} tracking-wide`}>{initials(name)}</span>
      ) : (
        <Icon className={s.icon} />
      )}
    </div>
  );
}
