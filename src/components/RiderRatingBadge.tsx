import { useEffect, useState, type ComponentType } from 'react';
import {
  Star,
  ShieldCheck,
  Check,
  X,
  FileText,
  Calendar,
  BadgeCheck,
  Award,
  Fingerprint,
  Files,
  User,
  Users,
  AlertOctagon,
  AlertTriangle,
  Receipt,
  Sparkles,
  CreditCard,
  Contact,
  Bike,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export type RiderRatingStats = {
  rating_score?: number | null;
  rating_tier?: string | null;
  pending_incident_count?: number | null;
  confirmed_incident_count?: number | null;
  total_incident_count?: number | null;
  total_fines_count?: number | null;
  unpaid_fines_count?: number | null;
  license_verified?: boolean | null;
  license_expiry?: string | null;
  id_verified?: boolean | null;
  payment_status?: string | null;
  photo_url?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  good_conduct_url?: string | null;
  id_copy_url?: string | null;
  license_url?: string | null;
  kra_pin?: string | null;
  kra_pin_verified?: boolean | null;
  sacco_id?: string | null;
  bms_id?: string | null;
  assignment_status?: string | null;
  created_at?: string | null;
};

type Tier = 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';

const TIER_META: Record<Tier, { label: string; bg: string; text: string; ring: string; barFrom: string; barTo: string }> = {
  excellent:  { label: 'Excellent', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', barFrom: 'from-emerald-500', barTo: 'to-green-500' },
  good:       { label: 'Good',      bg: 'bg-teal-50',    text: 'text-teal-700',    ring: 'ring-teal-200',    barFrom: 'from-teal-500',    barTo: 'to-emerald-500' },
  fair:       { label: 'Fair',      bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   barFrom: 'from-amber-400',   barTo: 'to-yellow-500' },
  poor:       { label: 'Poor',      bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200',  barFrom: 'from-orange-500',  barTo: 'to-red-500' },
  very_poor:  { label: 'Very Poor', bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200',    barFrom: 'from-rose-500',    barTo: 'to-red-600' },
};

const DEFAULT_POINTS: Record<string, number> = {
  deduct_confirmed_incident: 10,
  deduct_pending_incident: 3,
  deduct_unpaid_fine: 8,
  deduct_paid_fine: 3,
  deduct_license_expired: 20,
  deduct_license_unverified: 10,
  deduct_id_unverified: 5,
  deduct_license_expiring_soon: 5,
  deduct_no_good_conduct: 5,
  deduct_no_kra_pin: 3,
  deduct_repeat_offender: 10,
  deduct_repeat_fined: 5,
  bonus_clean_record: 5,
  bonus_compliance_paid: 5,
  bonus_profile_complete: 5,
  bonus_good_conduct: 5,
  bonus_kra_pin_verified: 3,
  bonus_all_documents: 5,
  bonus_sacco_member: 3,
  bonus_bms_issued: 3,
  bonus_assigned: 2,
  bonus_tenure_year: 5,
  bonus_no_recent_incidents: 5,
  bonus_no_recent_fines: 5,
};

let cachedPoints: Record<string, number> | null = null;
let inflight: Promise<Record<string, number>> | null = null;

function fetchRatingPoints(): Promise<Record<string, number>> {
  if (cachedPoints) return Promise.resolve(cachedPoints);
  if (inflight) return inflight;
  inflight = supabase
    .from('system_settings')
    .select('key, value')
    .eq('category', 'rating')
    .then(({ data, error }) => {
      inflight = null;
      if (error || !data) return { ...DEFAULT_POINTS };
      const map: Record<string, number> = { ...DEFAULT_POINTS };
      data.forEach((row: { key: string; value: string }) => {
        const n = parseInt(row.value ?? '', 10);
        if (Number.isFinite(n)) map[row.key] = n;
      });
      cachedPoints = map;
      return map;
    });
  return inflight;
}

function toTier(tier?: string | null): Tier {
  const t = (tier || 'excellent') as Tier;
  return (Object.keys(TIER_META) as Tier[]).includes(t) ? t : 'excellent';
}

function scoreToStars(score: number): number {
  return Math.max(0, Math.min(5, Math.round((score / 20) * 2) / 2));
}

export function RiderRatingChip({ score, tier, className = '' }: { score?: number | null; tier?: string | null; className?: string }) {
  const s = typeof score === 'number' ? score : 100;
  const meta = TIER_META[toTier(tier)];
  const stars = scoreToStars(s);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${meta.bg} ${meta.text} ${meta.ring} ${className}`}
      title={`${meta.label} · ${s}/100`}
    >
      <Star className="h-3 w-3 fill-current" />
      {stars.toFixed(1)}
    </span>
  );
}

function StarRow({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const stars = scoreToStars(score);
  const cls = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = stars >= i;
        const half = !filled && stars >= i - 0.5;
        return (
          <div key={i} className={`relative ${cls}`}>
            <Star className={`${cls} text-slate-200 fill-current`} />
            {(filled || half) && (
              <div className="absolute inset-0 overflow-hidden" style={{ width: half ? '50%' : '100%' }}>
                <Star className={`${cls} text-amber-400 fill-current`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type IconCmp = ComponentType<{ className?: string }>;

type CheckRow = {
  key: string;
  Icon: IconCmp;
  iconBg: string;
  iconColor: string;
  label: string;
  detail?: string;
  passed: boolean;
  points: number;
  sign: 'positive' | 'negative' | 'neutral';
};

function buildChecklist(stats: RiderRatingStats, points: Record<string, number>): CheckRow[] {
  const rows: CheckRow[] = [];

  const confirmed = stats.confirmed_incident_count || 0;
  const pending = stats.pending_incident_count || 0;
  const totalIncidents = stats.total_incident_count || 0;
  const unpaidFines = stats.unpaid_fines_count || 0;
  const totalFines = stats.total_fines_count || 0;
  const paidFines = Math.max(0, totalFines - unpaidFines);

  const now = new Date();
  const expiry = stats.license_expiry ? new Date(stats.license_expiry) : null;
  const licenseExpired = !!expiry && expiry < now;
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const licenseExpiringSoon = !!expiry && !licenseExpired && expiry < in30Days;

  const kraPresent = !!(stats.kra_pin && stats.kra_pin.trim());
  const kraVerified = kraPresent && !!stats.kra_pin_verified;
  const docsComplete = !!stats.id_copy_url && !!stats.license_url && !!stats.good_conduct_url;
  const profileComplete = !!stats.photo_url && !!stats.next_of_kin_name && !!stats.next_of_kin_phone;
  const saccoMember = !!(stats.sacco_id && stats.sacco_id.trim());
  const bmsIssued = !!(stats.bms_id && stats.bms_id.trim());
  const assigned = stats.assignment_status === 'Assigned';
  const createdAt = stats.created_at ? new Date(stats.created_at) : null;
  const tenureYear = !!createdAt && (now.getTime() - createdAt.getTime()) >= 365 * 24 * 60 * 60 * 1000;
  const cleanRecord = totalIncidents === 0 && totalFines === 0;

  // Documents & credentials
  rows.push({
    key: 'license_upload',
    Icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    label: 'Driving licence uploaded',
    passed: !!stats.license_url,
    points: 0, sign: 'neutral',
  });
  rows.push({
    key: 'license_valid',
    Icon: Calendar, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    label: licenseExpired ? 'Licence expired' : 'Licence valid',
    detail: expiry ? `Expires ${expiry.toLocaleDateString()}` : 'No expiry on file',
    passed: !!expiry && !licenseExpired,
    points: licenseExpired ? points.deduct_license_expired : 0,
    sign: licenseExpired ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'license_soon',
    Icon: Calendar, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    label: licenseExpiringSoon ? 'Licence expiring within 30 days' : 'Licence not expiring soon',
    passed: !licenseExpiringSoon,
    points: licenseExpiringSoon ? points.deduct_license_expiring_soon : 0,
    sign: licenseExpiringSoon ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'license_verified',
    Icon: ShieldCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    label: 'Licence verified',
    passed: stats.license_verified === true,
    points: stats.license_verified === false ? points.deduct_license_unverified : 0,
    sign: stats.license_verified === false ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'id_uploaded',
    Icon: Contact, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    label: 'National ID copy uploaded',
    passed: !!stats.id_copy_url,
    points: 0, sign: 'neutral',
  });
  rows.push({
    key: 'id_verified',
    Icon: BadgeCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    label: 'National ID verified',
    passed: stats.id_verified === true,
    points: stats.id_verified === false ? points.deduct_id_unverified : 0,
    sign: stats.id_verified === false ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'good_conduct',
    Icon: Award, iconBg: 'bg-teal-50', iconColor: 'text-teal-600',
    label: 'Good conduct certificate on file',
    passed: !!stats.good_conduct_url,
    points: stats.good_conduct_url ? points.bonus_good_conduct : points.deduct_no_good_conduct,
    sign: stats.good_conduct_url ? 'positive' : 'negative',
  });
  rows.push({
    key: 'kra_pin',
    Icon: Fingerprint, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600',
    label: 'KRA PIN provided',
    passed: kraPresent,
    points: kraPresent ? 0 : points.deduct_no_kra_pin,
    sign: kraPresent ? 'neutral' : 'negative',
  });
  rows.push({
    key: 'kra_verified',
    Icon: BadgeCheck, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600',
    label: 'KRA PIN verified',
    passed: kraVerified,
    points: kraVerified ? points.bonus_kra_pin_verified : 0,
    sign: kraVerified ? 'positive' : 'neutral',
  });
  rows.push({
    key: 'docs_complete',
    Icon: Files, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    label: 'All required documents uploaded',
    detail: 'Licence, ID copy, good conduct',
    passed: docsComplete,
    points: docsComplete ? points.bonus_all_documents : 0,
    sign: docsComplete ? 'positive' : 'neutral',
  });

  // Profile
  rows.push({
    key: 'photo',
    Icon: User, iconBg: 'bg-slate-50', iconColor: 'text-slate-600',
    label: 'Profile photo uploaded',
    passed: !!stats.photo_url,
    points: 0, sign: 'neutral',
  });
  rows.push({
    key: 'next_of_kin',
    Icon: Users, iconBg: 'bg-slate-50', iconColor: 'text-slate-600',
    label: 'Next of kin provided',
    passed: !!stats.next_of_kin_name && !!stats.next_of_kin_phone,
    points: 0, sign: 'neutral',
  });
  rows.push({
    key: 'profile_complete',
    Icon: BadgeCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    label: 'Profile complete',
    detail: 'Photo + next of kin',
    passed: profileComplete,
    points: profileComplete ? points.bonus_profile_complete : 0,
    sign: profileComplete ? 'positive' : 'neutral',
  });

  // Records / behaviour
  rows.push({
    key: 'confirmed_incidents',
    Icon: AlertOctagon, iconBg: 'bg-rose-50', iconColor: 'text-rose-600',
    label: `Confirmed incidents (${confirmed})`,
    detail: confirmed > 0 ? 'Verified rider fault' : 'None recorded',
    passed: confirmed === 0,
    points: confirmed * points.deduct_confirmed_incident,
    sign: confirmed > 0 ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'pending_incidents',
    Icon: AlertTriangle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
    label: `Pending incidents (${pending})`,
    detail: pending > 0 ? 'Awaiting review' : 'None pending',
    passed: pending === 0,
    points: pending * points.deduct_pending_incident,
    sign: pending > 0 ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'unpaid_fines',
    Icon: Receipt, iconBg: 'bg-rose-50', iconColor: 'text-rose-600',
    label: `Unpaid fines (${unpaidFines})`,
    passed: unpaidFines === 0,
    points: unpaidFines * points.deduct_unpaid_fine,
    sign: unpaidFines > 0 ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'paid_fines',
    Icon: Receipt, iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
    label: `Paid fines on record (${paidFines})`,
    passed: paidFines === 0,
    points: paidFines * points.deduct_paid_fine,
    sign: paidFines > 0 ? 'negative' : 'neutral',
  });
  rows.push({
    key: 'clean_record',
    Icon: Sparkles, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    label: 'Clean record',
    detail: 'No incidents or fines ever',
    passed: cleanRecord,
    points: cleanRecord ? points.bonus_clean_record : 0,
    sign: cleanRecord ? 'positive' : 'neutral',
  });

  // Compliance & membership
  rows.push({
    key: 'compliance_paid',
    Icon: CreditCard, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    label: 'Annual compliance fee paid',
    passed: stats.payment_status === 'Paid',
    points: stats.payment_status === 'Paid' ? points.bonus_compliance_paid : 0,
    sign: stats.payment_status === 'Paid' ? 'positive' : 'neutral',
  });
  rows.push({
    key: 'sacco_member',
    Icon: Users, iconBg: 'bg-teal-50', iconColor: 'text-teal-600',
    label: 'SACCO member',
    passed: saccoMember,
    points: saccoMember ? points.bonus_sacco_member : 0,
    sign: saccoMember ? 'positive' : 'neutral',
  });
  rows.push({
    key: 'bms_issued',
    Icon: Contact, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    label: 'BMS card issued',
    passed: bmsIssued,
    points: bmsIssued ? points.bonus_bms_issued : 0,
    sign: bmsIssued ? 'positive' : 'neutral',
  });
  rows.push({
    key: 'assigned',
    Icon: Bike, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    label: 'Assigned to a motorcycle',
    passed: assigned,
    points: assigned ? points.bonus_assigned : 0,
    sign: assigned ? 'positive' : 'neutral',
  });
  rows.push({
    key: 'tenure',
    Icon: Clock, iconBg: 'bg-slate-50', iconColor: 'text-slate-600',
    label: 'Registered for 12+ months',
    detail: createdAt ? `Since ${createdAt.toLocaleDateString()}` : undefined,
    passed: tenureYear,
    points: tenureYear ? points.bonus_tenure_year : 0,
    sign: tenureYear ? 'positive' : 'neutral',
  });

  return rows;
}

export default function RiderRatingCard({ stats, compact = false }: { stats: RiderRatingStats; compact?: boolean }) {
  const [points, setPoints] = useState<Record<string, number>>(cachedPoints ?? DEFAULT_POINTS);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchRatingPoints().then((p) => {
      if (alive) setPoints(p);
    });
    return () => { alive = false; };
  }, []);

  const score = typeof stats.rating_score === 'number' ? stats.rating_score : 100;
  const tier = toTier(stats.rating_tier);
  const meta = TIER_META[tier];
  const checklist = buildChecklist(stats, points);
  const failing = checklist.filter((r) => !r.passed);
  const passing = checklist.filter((r) => r.passed);
  const sorted = [...failing, ...passing];

  if (compact) {
    return (
      <div className={`rounded-xl ${meta.bg} ring-1 ring-inset ${meta.ring} p-3 flex items-center gap-3`}>
        <div className="flex flex-col items-center min-w-[64px]">
          <span className={`text-2xl font-bold tabular-nums ${meta.text}`}>{score}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
        </div>
        <div className="flex-1 min-w-0">
          <StarRow score={score} size="sm" />
          <p className="text-[11px] text-slate-600 mt-1 truncate">
            {passing.length}/{checklist.length} checks passing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={`px-5 py-4 ${meta.bg} border-b ${meta.ring} ring-inset flex items-center gap-4`}>
        <div className="flex flex-col items-center min-w-[80px]">
          <span className={`text-4xl font-bold tabular-nums ${meta.text}`}>{score}</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">/ 100</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${meta.text}`} />
            <span className={`text-sm font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StarRow score={score} />
            <span className="text-xs font-semibold text-slate-500">{scoreToStars(score).toFixed(1)} / 5</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-white/70 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${meta.barFrom} ${meta.barTo} transition-all`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <MetricCell label="Passing" value={passing.length.toString()} detail={`of ${checklist.length}`} tone="positive" />
        <MetricCell label="Failing" value={failing.length.toString()} detail="need action" tone={failing.length > 0 ? 'negative' : 'neutral'} />
        <MetricCell
          label="Incidents"
          value={(stats.total_incident_count || 0).toString()}
          detail={`${stats.total_fines_count || 0} fines`}
          tone={(stats.confirmed_incident_count || 0) > 0 || (stats.unpaid_fines_count || 0) > 0 ? 'negative' : 'neutral'}
        />
      </div>

      <div className="px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
              Compliance checklist
            </p>
            <span className="text-[10px] font-semibold text-slate-500">
              <span className="text-emerald-600">{passing.length} pass</span>
              <span className="text-slate-300 mx-1.5">·</span>
              <span className="text-rose-600">{failing.length} fail</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
            {expanded ? 'Hide' : 'Expand'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {!expanded && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {failing.slice(0, 6).map((row) => (
              <span
                key={row.key}
                title={row.label}
                className={`h-8 w-8 rounded-lg ${row.iconBg} flex items-center justify-center ring-1 ring-inset ring-rose-200 relative`}
              >
                <row.Icon className={`h-4 w-4 ${row.iconColor}`} />
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 text-white flex items-center justify-center">
                  <X className="h-2 w-2" strokeWidth={4} />
                </span>
              </span>
            ))}
            {failing.length > 6 && (
              <span className="text-[10px] font-semibold text-slate-500">+{failing.length - 6} more</span>
            )}
            {failing.length === 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                All {checklist.length} checks passing
              </span>
            )}
          </div>
        )}

        {expanded && (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {sorted.map((row) => (
              <ChecklistRow key={row.key} row={row} />
            ))}
          </ul>
        )}

        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
          Score starts at 100. Point weights are configured in Admin Settings and applied server-side.
          Positive checks add points; failed checks remove them. Repeat offenders in the past 12 months incur extra penalties.
        </p>
      </div>
    </div>
  );
}

function ChecklistRow({ row }: { row: CheckRow }) {
  const { Icon, iconBg, iconColor, label, detail, passed, points, sign } = row;
  const showPoints = points > 0 && sign !== 'neutral';
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-slate-50/70 transition-colors">
      <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate">{label}</p>
        {detail && <p className="text-[10px] text-slate-500 truncate">{detail}</p>}
      </div>
      {showPoints && (
        <span
          className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ${
            sign === 'positive' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
          }`}
        >
          {sign === 'positive' ? '+' : '\u2212'}{points}
        </span>
      )}
      <span
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ring-1 ring-inset ${
          passed
            ? 'bg-emerald-500 text-white ring-emerald-500'
            : 'bg-rose-500 text-white ring-rose-500'
        }`}
        title={passed ? 'Pass' : 'Fail'}
      >
        {passed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </li>
  );
}

function MetricCell({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'positive' | 'negative' | 'neutral' }) {
  const valueColor =
    tone === 'positive' ? 'text-emerald-600'
    : tone === 'negative' ? 'text-rose-600'
    : 'text-slate-900';
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>
    </div>
  );
}
