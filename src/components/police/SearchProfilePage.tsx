import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  User,
  ShieldCheck,
  Bike,
  Phone,
  CreditCard,
  Star,
  Calendar,
  MapPin,
  FileText,
  ExternalLink,
  Loader2,
  AlertTriangle,
  ScrollText,
  DollarSign,
  Copy,
  Check,
  ShieldAlert,
  FileCheck,
  Hash,
  Award,
  ClipboardList,
  BadgeCheck,
  Clock,
  Cog,
  Printer,
  Ticket,
  Radio,
} from 'lucide-react';
import {
  supabase,
  type Rider,
  type Owner,
  type Motorcycle,
  type Incident,
  type Fine,
} from '../../lib/supabase';
import PartyAvatar from './PartyAvatar';
import TrackingModal from '../TrackingModal';
import DocumentRevalidateButton from '../DocumentRevalidateButton';
import DocumentViewerModal from '../DocumentViewerModal';
import type { DocumentType } from '../../lib/documentValidation';
import BmsIdLink from '../BmsIdLink';

export type ProfileEntity =
  | { kind: 'rider'; id: string }
  | { kind: 'owner'; id: string }
  | { kind: 'motorcycle'; id: string };

type Props = {
  entity: ProfileEntity;
  onBack: () => void;
  onNavigate?: (entity: ProfileEntity) => void;
  onTrack?: (motorcycleId: string) => void;
  initialTab?: TabKey;
};

type TabKey = 'overview' | 'documents' | 'history' | 'track';

const KIND_META: Record<ProfileEntity['kind'], { title: string; gradient: string; label: string; icon: any }> = {
  rider: {
    title: 'Rider Profile',
    label: 'Rider',
    gradient: 'from-blue-600 via-sky-500 to-cyan-400',
    icon: User,
  },
  owner: {
    title: 'Owner Profile',
    label: 'Owner',
    gradient: 'from-slate-700 via-slate-600 to-slate-500',
    icon: ShieldCheck,
  },
  motorcycle: {
    title: 'Motorcycle Profile',
    label: 'Motorcycle',
    gradient: 'from-emerald-600 via-teal-500 to-cyan-500',
    icon: Bike,
  },
};

const daysUntil = (iso: string | null | undefined) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((then - Date.now()) / 86400000);
};

const fmtDate = (iso: string | null | undefined, withTime = false) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(
    'en-KE',
    withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );
};

const licenceHint = (iso: string | null | undefined) => {
  const d = daysUntil(iso);
  if (d === null) return '';
  if (d < 0) return ` (expired ${Math.abs(d)}d)`;
  if (d <= 30) return ` (in ${d}d)`;
  return '';
};

const statusTone = (status: string | null | undefined) => {
  const s = (status || '').toLowerCase();
  if (['resolved', 'closed', 'confirmed', 'paid'].includes(s)) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (['ignored', 'deleted', 'dismissed', 'cancelled'].includes(s)) return 'bg-slate-100 text-slate-600 border-slate-200';
  if (['investigating', 'assigned', 'awaiting_evidence'].includes(s)) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (['unassigned', 'pending', 'issued'].includes(s)) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (['overdue', 'disputed'].includes(s)) return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function SearchProfilePage({ entity, onBack, onNavigate, onTrack, initialTab }: Props) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const [rider, setRider] = useState<Rider | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [ownedMotorcycles, setOwnedMotorcycles] = useState<Motorcycle[]>([]);
  const [assignedMotorcycle, setAssignedMotorcycle] = useState<Motorcycle | null>(null);
  const [motorcycleOwner, setMotorcycleOwner] = useState<Owner | null>(null);
  const [motorcycleRiders, setMotorcycleRiders] = useState<Rider[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);

  useEffect(() => {
    let cancelled = false;
    setTab(initialTab ?? 'overview');
    (async () => {
      setLoading(true);
      setError('');
      setRider(null); setOwner(null); setMotorcycle(null);
      setOwnedMotorcycles([]); setAssignedMotorcycle(null); setMotorcycleOwner(null); setMotorcycleRiders([]);
      setIncidents([]); setFines([]);
      try {
        if (entity.kind === 'rider') {
          const { data: r } = await supabase.from('riders').select('*').eq('id', entity.id).maybeSingle();
          if (cancelled) return;
          setRider(r as Rider | null);
          if (r) {
            const [ownerRes, motoRes, incRes, fineRes] = await Promise.all([
              r.owner_id ? supabase.from('owners').select('*').eq('id', r.owner_id).maybeSingle() : Promise.resolve({ data: null }),
              r.motorcycle_id ? supabase.from('motorcycles').select('*').eq('id', r.motorcycle_id).maybeSingle() : Promise.resolve({ data: null }),
              supabase.from('incidents').select('*').eq('rider_id', r.id).order('incident_date', { ascending: false }),
              supabase.from('fines').select('*').eq('rider_id', r.id).order('issued_at', { ascending: false }),
            ]);
            if (cancelled) return;
            setOwner((ownerRes.data as Owner) || null);
            setAssignedMotorcycle((motoRes.data as Motorcycle) || null);
            setIncidents((incRes.data as Incident[]) || []);
            setFines((fineRes.data as Fine[]) || []);
          }
        } else if (entity.kind === 'owner') {
          const { data: o } = await supabase.from('owners').select('*').eq('id', entity.id).maybeSingle();
          if (cancelled) return;
          setOwner(o as Owner | null);
          if (o) {
            const [motoRes, incRes, fineRes] = await Promise.all([
              supabase.from('motorcycles').select('*').eq('owner_id', o.id).order('created_at', { ascending: false }),
              supabase.from('incidents').select('*').eq('owner_id', o.id).order('incident_date', { ascending: false }),
              supabase.from('fines').select('*').eq('owner_id', o.id).order('issued_at', { ascending: false }),
            ]);
            if (cancelled) return;
            setOwnedMotorcycles((motoRes.data as Motorcycle[]) || []);
            setIncidents((incRes.data as Incident[]) || []);
            setFines((fineRes.data as Fine[]) || []);
          }
        } else {
          const { data: m } = await supabase.from('motorcycles').select('*').eq('id', entity.id).maybeSingle();
          if (cancelled) return;
          setMotorcycle(m as Motorcycle | null);
          if (m) {
            const [ownerRes, riderRes, incRes, fineRes] = await Promise.all([
              m.owner_id ? supabase.from('owners').select('*').eq('id', m.owner_id).maybeSingle() : Promise.resolve({ data: null }),
              supabase.from('riders').select('*').eq('motorcycle_id', m.id),
              supabase.from('incidents').select('*').eq('motorcycle_id', m.id).order('incident_date', { ascending: false }),
              supabase.from('fines').select('*').eq('motorcycle_id', m.id).order('issued_at', { ascending: false }),
            ]);
            if (cancelled) return;
            setMotorcycleOwner((ownerRes.data as Owner) || null);
            setMotorcycleRiders((riderRes.data as Rider[]) || []);
            setIncidents((incRes.data as Incident[]) || []);
            setFines((fineRes.data as Fine[]) || []);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Unable to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entity.kind, entity.id, initialTab]);

  const meta = KIND_META[entity.kind];

  const primaryPhoto = useMemo(() => {
    if (entity.kind === 'rider') return rider?.photo_url || null;
    if (entity.kind === 'owner') return owner?.profile_photo_url || null;
    return motorcycle?.bike_photo_url || null;
  }, [entity, rider, owner, motorcycle]);

  const primaryName = useMemo(() => {
    if (entity.kind === 'rider') return rider?.name || 'Unknown rider';
    if (entity.kind === 'owner') return owner?.full_name || 'Unknown owner';
    return motorcycle?.registration_number || 'Unregistered motorcycle';
  }, [entity, rider, owner, motorcycle]);

  const primarySub = useMemo(() => {
    if (entity.kind === 'rider') return rider?.bms_id ? `BMS ${rider.bms_id}` : (rider?.stage_name || rider?.phone_number || '');
    if (entity.kind === 'owner') return owner?.phone_number || owner?.national_id || '';
    if (motorcycle) {
      const parts = [motorcycle.make, motorcycle.model].filter(Boolean);
      return parts.join(' ') || '';
    }
    return '';
  }, [entity, rider, owner, motorcycle]);

  const copy = (value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500);
    }).catch(() => {});
  };

  const totalIncidents = incidents.length;
  const confirmedIncidents = incidents.filter((i) => i.status === 'confirmed').length;
  const totalFines = fines.length;
  const unpaidFines = fines.filter((f) => f.status !== 'paid' && f.status !== 'cancelled').length;
  const totalFinesAmount = fines.reduce((sum, f) => sum + Number(f.fine_amount || 0), 0);
  const outstandingAmount = fines
    .filter((f) => f.status !== 'paid' && f.status !== 'cancelled')
    .reduce((sum, f) => sum + Number(f.fine_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </button>
        <div className="text-[11px] font-medium text-slate-500 inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Profile view · logged for audit
        </div>
      </div>

      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${meta.gradient} text-white shadow-lg`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_60%)] pointer-events-none" />
        <div className="relative px-6 pt-6 pb-6">
          <div className="flex items-center gap-2 text-white/85 text-[11px] uppercase tracking-widest font-bold">
            <meta.icon className="h-3.5 w-3.5" />
            {meta.title}
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-start gap-5">
            <div className="rounded-2xl ring-4 ring-white/40 overflow-hidden bg-white/20 backdrop-blur shrink-0">
              <PartyAvatar
                kind={entity.kind}
                photoUrl={primaryPhoto}
                name={primaryName}
                size="xl"
                rounded="xl"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight break-words">{primaryName}</h1>
              {primarySub && <p className="text-sm text-white/85 mt-0.5">{primarySub}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <VerifyBadges kind={entity.kind} rider={rider} owner={owner} motorcycle={motorcycle} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatTile label="Incidents" value={totalIncidents} icon={ScrollText} />
            <StatTile label="Confirmed" value={confirmedIncidents} icon={ShieldAlert} />
            <StatTile label="Fines" value={totalFines} icon={DollarSign} />
            <StatTile label="Outstanding" value={unpaidFines} icon={AlertTriangle} highlight={unpaidFines > 0} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/85">
            <span>
              Total fines <span className="font-semibold text-white">KES {totalFinesAmount.toLocaleString()}</span>
            </span>
            <span className="opacity-40">·</span>
            <span>
              Outstanding <span className="font-semibold text-white">KES {outstandingAmount.toLocaleString()}</span>
            </span>
          </div>
        </div>

        <nav className="relative px-4 pb-0 flex items-center gap-1 border-t border-white/15 bg-white/5">
          {((entity.kind === 'motorcycle'
            ? ['overview', 'documents', 'history', 'track']
            : ['overview', 'documents', 'history']) as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === 'track' && entity.kind === 'motorcycle' && onTrack) {
                  onTrack(entity.id);
                }
              }}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition inline-flex items-center gap-1.5 ${
                tab === t
                  ? 'text-white border-b-2 border-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {t === 'overview'
                ? 'Overview'
                : t === 'documents'
                ? 'Documents'
                : t === 'history'
                ? 'Case & Fine History'
                : (
                  <>
                    <Radio className="h-3 w-3" />
                    Live Track
                  </>
                )}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading profile…
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <p>{error}</p>
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <OverviewSection
              entity={entity}
              rider={rider}
              owner={owner}
              motorcycle={motorcycle}
              assignedMotorcycle={assignedMotorcycle}
              ownedMotorcycles={ownedMotorcycles}
              motorcycleOwner={motorcycleOwner}
              motorcycleRiders={motorcycleRiders}
              copy={copy}
              copied={copied}
              onNavigate={onNavigate}
            />
          )}
          {tab === 'documents' && (
            <DocumentsSection entity={entity} rider={rider} owner={owner} motorcycle={motorcycle} />
          )}
          {tab === 'history' && (
            <HistorySection incidents={incidents} fines={fines} />
          )}
          {tab === 'track' && entity.kind === 'motorcycle' && motorcycle && (
            <TrackSection motorcycle={motorcycle} />
          )}
        </>
      )}
    </div>
  );
}

function StatTile({
  label, value, icon: Icon, highlight = false,
}: { label: string; value: number; icon: any; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 backdrop-blur border ${highlight ? 'bg-white/25 border-white/50' : 'bg-white/10 border-white/25'}`}>
      <div className="flex items-center gap-1.5 text-white/85 text-[10px] uppercase tracking-widest font-bold">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

function VerifyBadges({
  kind, rider, owner, motorcycle,
}: {
  kind: ProfileEntity['kind'];
  rider: Rider | null;
  owner: Owner | null;
  motorcycle: Motorcycle | null;
}) {
  if (kind === 'rider' && rider) {
    return (
      <>
        {rider.id_verified && <Chip icon={BadgeCheck}>ID verified</Chip>}
        {rider.license_verified && <Chip icon={FileCheck}>Licence verified</Chip>}
        {!rider.license_verified && rider.license_number && <Chip icon={Clock} tone="amber">Licence pending</Chip>}
        {rider.rating_score != null && (
          <Chip icon={Star} tone="sky">
            {Number(rider.rating_score).toFixed(1)} {rider.rating_tier ? `· ${rider.rating_tier}` : ''}
          </Chip>
        )}
        {rider.assignment_status && <Chip icon={Award} tone="slate">{rider.assignment_status}</Chip>}
      </>
    );
  }
  if (kind === 'owner' && owner) {
    return (
      <>
        {owner.id_verified && <Chip icon={BadgeCheck}>ID verified</Chip>}
        {owner.kra_pin_verified && <Chip icon={FileCheck}>KRA verified</Chip>}
        {owner.otp_verified && <Chip icon={ShieldCheck} tone="sky">OTP verified</Chip>}
        {owner.payment_status === 'completed' && <Chip icon={DollarSign}>Compliant</Chip>}
      </>
    );
  }
  if (kind === 'motorcycle' && motorcycle) {
    return (
      <>
        {motorcycle.is_compliant
          ? <Chip icon={ShieldCheck}>Compliant</Chip>
          : <Chip icon={AlertTriangle} tone="amber">Non-compliant</Chip>}
        {motorcycle.status === 'verified' && <Chip icon={BadgeCheck} tone="sky">Verified</Chip>}
        {motorcycle.tracking_device_id && <Chip icon={MapPin} tone="sky">Tracked</Chip>}
      </>
    );
  }
  return null;
}

function Chip({
  icon: Icon,
  tone = 'emerald',
  children,
}: {
  icon?: any;
  tone?: 'emerald' | 'amber' | 'sky' | 'slate';
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-500/25 text-emerald-50 ring-1 ring-inset ring-emerald-200/40',
    amber: 'bg-amber-500/30 text-amber-50 ring-1 ring-inset ring-amber-200/40',
    sky: 'bg-sky-500/25 text-sky-50 ring-1 ring-inset ring-sky-200/40',
    slate: 'bg-slate-500/30 text-slate-50 ring-1 ring-inset ring-slate-200/40',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tones[tone]}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

function OverviewSection({
  entity, rider, owner, motorcycle, assignedMotorcycle, ownedMotorcycles, motorcycleOwner, motorcycleRiders, copy, copied, onNavigate,
}: {
  entity: ProfileEntity;
  rider: Rider | null;
  owner: Owner | null;
  motorcycle: Motorcycle | null;
  assignedMotorcycle: Motorcycle | null;
  ownedMotorcycles: Motorcycle[];
  motorcycleOwner: Owner | null;
  motorcycleRiders: Rider[];
  copy: (v: string) => void;
  copied: string | null;
  onNavigate?: (e: ProfileEntity) => void;
}) {
  if (entity.kind === 'rider') {
    if (!rider) return <NotFound label="Rider record not found." />;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Identification" icon={CreditCard}>
            <Field label="Full name" value={rider.name} />
            <Field label="ID number" value={rider.id_number} copyable copy={copy} copied={copied} />
            <Field label="Phone" value={rider.phone_number} icon={Phone} copyable copy={copy} copied={copied} />
            <Field label="Stage" value={rider.stage_name} />
            {rider.bms_id ? (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                  <Hash className="h-3 w-3 text-slate-400" />
                  BMS ID
                </p>
                <div className="mt-0.5 flex items-center gap-1">
                  <BmsIdLink
                    bmsId={rider.bms_id}
                    riderName={rider.name}
                    idNumber={rider.id_number}
                    phoneNumber={rider.phone_number}
                    countyReg={rider.county_registration_number}
                    photoUrl={rider.photo_url}
                    motorcycle={assignedMotorcycle?.registration_number}
                    owner={owner?.full_name}
                    className="text-sm font-semibold"
                  />
                  <button
                    onClick={() => copy(rider.bms_id!)}
                    className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    title="Copy"
                  >
                    {copied === rider.bms_id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            ) : (
              <Field label="BMS ID" value={null} icon={Hash} />
            )}
            <Field label="County reg." value={rider.county_registration_number} />
            <Field label="National reg." value={rider.national_registration_number} />
            <Field label="SACCO" value={rider.sacco_id} />
            <Field label="KRA PIN" value={rider.kra_pin} copyable copy={copy} copied={copied} />
            <Field label="Registered" value={rider.created_at ? fmtDate(rider.created_at) : null} />
          </SectionCard>

          <SectionCard title="Licence" icon={FileCheck}>
            <Field label="Number" value={rider.license_number} copyable copy={copy} copied={copied} />
            <Field label="Class" value={rider.license_class} />
            <Field
              label="Expiry"
              value={rider.license_expiry ? `${fmtDate(rider.license_expiry)}${licenceHint(rider.license_expiry)}` : null}
            />
            <Field
              label="Verified"
              value={rider.license_verified ? 'Yes' : 'No'}
              tone={rider.license_verified ? 'emerald' : 'amber'}
            />
          </SectionCard>

          <SectionCard title="Next of Kin" icon={User}>
            <Field label="Name" value={rider.next_of_kin_name} />
            <Field label="Phone" value={rider.next_of_kin_phone} icon={Phone} copyable copy={copy} copied={copied} />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <RelatedEntitySidebar title="Assigned motorcycle" icon={Bike}>
            {assignedMotorcycle ? (
              <RelatedRow
                kind="motorcycle"
                photo={assignedMotorcycle.bike_photo_url}
                title={assignedMotorcycle.registration_number}
                sub={[assignedMotorcycle.make, assignedMotorcycle.model].filter(Boolean).join(' ') || 'No make/model'}
                badge={assignedMotorcycle.is_compliant
                  ? { tone: 'emerald', label: 'Compliant' }
                  : { tone: 'amber', label: 'Non-compliant' }}
                onOpen={() => onNavigate?.({ kind: 'motorcycle', id: assignedMotorcycle.id })}
              />
            ) : (
              <EmptyLine>No motorcycle assigned.</EmptyLine>
            )}
          </RelatedEntitySidebar>

          <RelatedEntitySidebar title="Owner" icon={ShieldCheck}>
            {owner ? (
              <RelatedRow
                kind="owner"
                photo={owner.profile_photo_url}
                title={owner.full_name}
                sub={owner.phone_number || owner.national_id || ''}
                badge={owner.id_verified ? { tone: 'emerald', label: 'ID Verified' } : { tone: 'slate', label: 'Unverified' }}
                onOpen={() => onNavigate?.({ kind: 'owner', id: owner.id })}
              />
            ) : (
              <EmptyLine>No owner linked.</EmptyLine>
            )}
          </RelatedEntitySidebar>

          <QuickActions />
        </div>
      </div>
    );
  }

  if (entity.kind === 'owner') {
    if (!owner) return <NotFound label="Owner record not found." />;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Identification" icon={CreditCard}>
            <Field label="Full name" value={owner.full_name} />
            <Field label="National ID" value={owner.national_id} copyable copy={copy} copied={copied} />
            <Field label="Phone" value={owner.phone_number} icon={Phone} copyable copy={copy} copied={copied} />
            <Field label="KRA PIN" value={owner.kra_pin} copyable copy={copy} copied={copied} />
            <Field
              label="ID verified"
              value={owner.id_verified ? 'Yes' : 'No'}
              tone={owner.id_verified ? 'emerald' : 'amber'}
            />
            <Field
              label="OTP verified"
              value={owner.otp_verified ? 'Yes' : 'No'}
              tone={owner.otp_verified ? 'emerald' : 'slate'}
            />
            <Field label="Registered" value={owner.created_at ? fmtDate(owner.created_at) : null} />
          </SectionCard>

          <SectionCard title="Next of Kin" icon={User}>
            <Field label="Name" value={owner.next_of_kin_name} />
            <Field label="Phone" value={owner.next_of_kin_phone} icon={Phone} copyable copy={copy} copied={copied} />
            <Field label="Relationship" value={owner.next_of_kin_relationship} />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <RelatedEntitySidebar title={`Motorcycles (${ownedMotorcycles.length})`} icon={Bike}>
            {ownedMotorcycles.length === 0 ? (
              <EmptyLine>No motorcycles registered.</EmptyLine>
            ) : (
              <div className="space-y-2">
                {ownedMotorcycles.map((m) => (
                  <RelatedRow
                    key={m.id}
                    kind="motorcycle"
                    photo={m.bike_photo_url}
                    title={m.registration_number}
                    sub={[m.make, m.model].filter(Boolean).join(' ') || 'No make/model'}
                    badge={m.is_compliant
                      ? { tone: 'emerald', label: 'Compliant' }
                      : { tone: 'amber', label: 'Non-compliant' }}
                    onOpen={() => onNavigate?.({ kind: 'motorcycle', id: m.id })}
                  />
                ))}
              </div>
            )}
          </RelatedEntitySidebar>

          <QuickActions />
        </div>
      </div>
    );
  }

  if (!motorcycle) return <NotFound label="Motorcycle record not found." />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <SectionCard title="Vehicle" icon={Bike}>
          <Field label="Registration" value={motorcycle.registration_number} copyable copy={copy} copied={copied} />
          <Field label="Make" value={motorcycle.make} />
          <Field label="Model" value={motorcycle.model} />
          <Field
            label="Verification"
            value={motorcycle.status === 'verified' ? 'Verified' : 'Pending'}
            tone={motorcycle.status === 'verified' ? 'emerald' : 'amber'}
          />
          <Field
            label="Compliance"
            value={motorcycle.is_compliant ? 'Compliant' : 'Non-compliant'}
            tone={motorcycle.is_compliant ? 'emerald' : 'amber'}
          />
          <Field label="Tracker" value={motorcycle.tracking_device_id} copyable copy={copy} copied={copied} />
        </SectionCard>

        <SectionCard title="Insurance" icon={ShieldCheck}>
          <Field label="Provider" value={motorcycle.insurance_provider} />
          <Field label="Policy #" value={motorcycle.insurance_policy_number} copyable copy={copy} copied={copied} />
          <Field
            label="Expiry"
            value={motorcycle.insurance_expiry ? `${fmtDate(motorcycle.insurance_expiry)}${licenceHint(motorcycle.insurance_expiry)}` : null}
          />
        </SectionCard>

        <SectionCard title="Inspection" icon={ClipboardList}>
          <Field label="Certificate #" value={motorcycle.inspection_certificate_number} copyable copy={copy} copied={copied} />
          <Field
            label="Expiry"
            value={motorcycle.inspection_expiry ? `${fmtDate(motorcycle.inspection_expiry)}${licenceHint(motorcycle.inspection_expiry)}` : null}
          />
        </SectionCard>
      </div>

      <div className="space-y-4">
        <RelatedEntitySidebar title="Owner" icon={ShieldCheck}>
          {motorcycleOwner ? (
            <RelatedRow
              kind="owner"
              photo={motorcycleOwner.profile_photo_url}
              title={motorcycleOwner.full_name}
              sub={motorcycleOwner.phone_number || motorcycleOwner.national_id || ''}
              badge={motorcycleOwner.id_verified ? { tone: 'emerald', label: 'ID Verified' } : { tone: 'slate', label: 'Unverified' }}
              onOpen={() => onNavigate?.({ kind: 'owner', id: motorcycleOwner.id })}
            />
          ) : (
            <EmptyLine>No owner linked.</EmptyLine>
          )}
        </RelatedEntitySidebar>

        <RelatedEntitySidebar title={`Riders (${motorcycleRiders.length})`} icon={User}>
          {motorcycleRiders.length === 0 ? (
            <EmptyLine>No rider assigned.</EmptyLine>
          ) : (
            <div className="space-y-2">
              {motorcycleRiders.map((r) => (
                <RelatedRow
                  key={r.id}
                  kind="rider"
                  photo={r.photo_url}
                  title={r.name}
                  sub={r.bms_id ? `BMS ${r.bms_id}` : r.phone_number || ''}
                  badge={r.license_verified ? { tone: 'emerald', label: 'Licensed' } : { tone: 'amber', label: 'No licence' }}
                  onOpen={() => onNavigate?.({ kind: 'rider', id: r.id })}
                />
              ))}
            </div>
          )}
        </RelatedEntitySidebar>

        <QuickActions />
      </div>
    </div>
  );
}

function DocumentsSection({
  entity, rider, owner, motorcycle,
}: {
  entity: ProfileEntity;
  rider: Rider | null;
  owner: Owner | null;
  motorcycle: Motorcycle | null;
}) {
  const docs = collectDocs(entity, rider, owner, motorcycle);
  if (docs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-14 text-center">
        <FileText className="h-8 w-8 text-slate-400 mx-auto" />
        <p className="mt-2 text-sm text-slate-500">No documents uploaded for this profile yet.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {docs.map((d) => (
        <DocCard key={d.key} d={d} />
      ))}
    </div>
  );
}

function DocCard({ d }: { d: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="group bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full text-left"
        >
          <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
            {/\.(png|jpe?g|webp|gif|heic|heif)(\?|$)/i.test(d.url) ? (
              <img src={d.url} alt={d.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <FileText className="h-8 w-8" />
                <span className="text-[10px] uppercase tracking-widest font-semibold">Document</span>
              </div>
            )}
          </div>
          <div className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{d.category}</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{d.label}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
          </div>
        </button>
        {d.documentType && d.userType && d.userId && (
          <div className="px-3 pb-3">
            <DocumentRevalidateButton
              userType={d.userType}
              userId={d.userId}
              documentType={d.documentType}
              fileUrl={d.url}
              fileName={d.label}
              expectedName={d.expectedName}
              expectedIdNumber={d.expectedIdNumber}
              expectedPlateNumber={d.expectedPlateNumber}
              knownExpiryDate={d.knownExpiryDate}
            />
          </div>
        )}
      </div>
      <DocumentViewerModal
        open={open}
        onClose={() => setOpen(false)}
        fileUrl={d.url}
        fileName={d.label}
        title={d.label}
        documentType={d.documentType}
      />
    </>
  );
}

function TrackSection({ motorcycle }: { motorcycle: Motorcycle }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Radio className="h-4 w-4 text-emerald-600" />
          Live tracking &middot; {motorcycle.registration_number}
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full uppercase tracking-widest">
          <ShieldCheck className="h-3 w-3" />
          Access logged for audit
        </div>
      </div>
      {motorcycle.tracking_device_id ? (
        <div className="h-[640px]">
          <TrackingModal motorcycle={motorcycle} onClose={() => {}} fullPage />
        </div>
      ) : (
        <div className="p-14 text-center">
          <MapPin className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No tracking device fitted</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            This motorcycle does not have a tracker registered. Ask the owner to enrol a device before live tracking can be used.
          </p>
        </div>
      )}
    </div>
  );
}

function HistorySection({ incidents, fines }: { incidents: Incident[]; fines: Fine[] }) {
  const empty = incidents.length === 0 && fines.length === 0;
  if (empty) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-14 text-center">
        <ScrollText className="h-8 w-8 text-slate-400 mx-auto" />
        <p className="mt-2 text-sm text-slate-500">No cases or fines on record.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ScrollText className="h-4 w-4 text-slate-500" />
            Incidents
          </div>
          <span className="text-xs text-slate-500">{incidents.length} case{incidents.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
          {incidents.length === 0 && (
            <p className="text-xs text-slate-500 italic px-5 py-4">No incidents on record.</p>
          )}
          {incidents.map((i) => (
            <div key={i.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {i.case_number && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-mono font-bold">
                        <Hash className="h-2.5 w-2.5 opacity-70" />
                        {i.case_number}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-slate-900 capitalize truncate">
                      {i.incident_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {fmtDate(i.incident_date, true)}
                    </span>
                    {i.location && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[220px]" title={i.location}>
                        <MapPin className="h-3 w-3" />
                        {i.location}
                      </span>
                    )}
                  </div>
                  {i.resolution_outcome && (
                    <p className="mt-1.5 text-[11px] text-slate-600 bg-slate-50 rounded-md px-2 py-1 border border-slate-100 inline-block">
                      <span className="font-semibold">Outcome:</span> {i.resolution_outcome.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusTone(i.police_status || i.status)}`}>
                  {(i.police_status || i.status || 'reported').replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <DollarSign className="h-4 w-4 text-slate-500" />
            Fines
          </div>
          <span className="text-xs text-slate-500">{fines.length} record{fines.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
          {fines.length === 0 && (
            <p className="text-xs text-slate-500 italic px-5 py-4">No fines on record.</p>
          )}
          {fines.map((f) => (
            <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold text-slate-900 truncate">
                  {f.fine_reference || `FIN-${f.id.slice(0, 8).toUpperCase()}`}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(f.issued_at)}
                  </span>
                  {f.notes && (
                    <span className="truncate max-w-[220px]" title={f.notes}>{f.notes}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-slate-900 text-sm">KES {Number(f.fine_amount).toLocaleString()}</p>
                <span className={`inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusTone(f.status)}`}>
                  {f.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-700">{title}</h3>
      </header>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </div>
    </section>
  );
}

function Field({
  label, value, icon: Icon, copyable, copy, copied, tone,
}: {
  label: string;
  value: string | null | undefined;
  icon?: any;
  copyable?: boolean;
  copy?: (v: string) => void;
  copied?: string | null;
  tone?: 'emerald' | 'amber' | 'slate';
}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
  const toneCls = tone === 'emerald'
    ? 'text-emerald-700'
    : tone === 'amber'
      ? 'text-amber-700'
      : tone === 'slate'
        ? 'text-slate-500'
        : 'text-slate-900';
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3 text-slate-400" />}
        {label}
      </p>
      <div className="mt-0.5 flex items-center gap-1">
        <p className={`text-sm font-semibold truncate ${toneCls}`}>
          {hasValue ? value : <span className="text-slate-400 font-normal">—</span>}
        </p>
        {hasValue && copyable && copy && (
          <button
            onClick={() => copy(String(value))}
            className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="Copy"
          >
            {copied === String(value) ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

function RelatedEntitySidebar({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-700">{title}</h3>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function RelatedRow({
  kind, photo, title, sub, badge, onOpen,
}: {
  kind: 'rider' | 'owner' | 'motorcycle';
  photo: string | null | undefined;
  title: string;
  sub: string;
  badge?: { tone: 'emerald' | 'amber' | 'slate'; label: string };
  onOpen?: () => void;
}) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    slate: 'bg-slate-100 text-slate-600',
  } as const;
  return (
    <button
      onClick={onOpen}
      disabled={!onOpen}
      className="w-full text-left flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-white hover:border-emerald-300 hover:shadow-sm p-2.5 transition disabled:cursor-default"
    >
      <PartyAvatar kind={kind} photoUrl={photo || null} name={title} size="md" rounded="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
        {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
      </div>
      {badge && (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tones[badge.tone]}`}>
          {badge.label}
        </span>
      )}
    </button>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-slate-400 px-1.5 py-2">{children}</p>;
}

function NotFound({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-14 text-center">
      <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto" />
      <p className="mt-2 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function QuickActions() {
  return (
    <section className="bg-slate-900 text-white rounded-2xl shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
        <Cog className="h-4 w-4 text-white/70" />
        <h3 className="text-[11px] uppercase tracking-widest font-bold text-white/80">Actions</h3>
      </header>
      <div className="p-3 grid grid-cols-1 gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 transition"
        >
          <Printer className="h-3.5 w-3.5" />
          Print profile
        </button>
        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[11px] text-white/70 leading-relaxed">
          <div className="inline-flex items-center gap-1 text-white font-semibold text-xs mb-0.5">
            <Ticket className="h-3 w-3" />
            Need to act?
          </div>
          Issue a fine from the Fines tab or open a case from the Incidents tab — this profile stays here while you work.
        </div>
      </div>
    </section>
  );
}

type DocRow = { key: string; url: string; label: string; category: string; documentType?: DocumentType; userType?: 'rider' | 'owner'; userId?: string; expectedName?: string; expectedIdNumber?: string; expectedPlateNumber?: string; knownExpiryDate?: string | null };

function collectDocs(
  entity: ProfileEntity,
  rider: Rider | null,
  owner: Owner | null,
  motorcycle: Motorcycle | null,
): DocRow[] {
  const docs: DocRow[] = [];
  if (entity.kind === 'rider' && rider) {
    if (rider.photo_url) docs.push({ key: 'photo', url: rider.photo_url, label: 'Passport photo', category: 'Identity' });
    if (rider.id_copy_url) docs.push({ key: 'id', url: rider.id_copy_url, label: 'National ID copy', category: 'Identity', documentType: 'national_id', userType: 'rider', userId: rider.id, expectedName: rider.name, expectedIdNumber: rider.id_number });
    if (rider.license_url) docs.push({ key: 'licence', url: rider.license_url, label: 'Driver licence', category: 'Licence', documentType: 'driving_license', userType: 'rider', userId: rider.id, expectedName: rider.name, expectedIdNumber: rider.id_number, knownExpiryDate: rider.license_expiry ?? null });
    if (rider.good_conduct_url) docs.push({ key: 'gc', url: rider.good_conduct_url, label: 'Certificate of good conduct', category: 'Background', documentType: 'good_conduct', userType: 'rider', userId: rider.id, expectedName: rider.name, expectedIdNumber: rider.id_number });
  }
  if (entity.kind === 'owner' && owner) {
    if (owner.profile_photo_url) docs.push({ key: 'photo', url: owner.profile_photo_url, label: 'Profile photo', category: 'Identity' });
  }
  if (entity.kind === 'motorcycle' && motorcycle) {
    if (motorcycle.bike_photo_url) docs.push({ key: 'bike', url: motorcycle.bike_photo_url, label: 'Motorcycle photo (side)', category: 'Vehicle', documentType: 'bike_photo_side', userType: 'owner', userId: motorcycle.owner_id });
    if (motorcycle.logbook_url) docs.push({ key: 'logbook', url: motorcycle.logbook_url, label: 'Logbook', category: 'Vehicle', documentType: 'logbook', userType: 'owner', userId: motorcycle.owner_id, expectedPlateNumber: motorcycle.registration_number });
    if (motorcycle.kra_pin_url) docs.push({ key: 'kra', url: motorcycle.kra_pin_url, label: 'KRA PIN certificate', category: 'Compliance', documentType: 'kra_pin_doc', userType: 'owner', userId: motorcycle.owner_id });
    if (motorcycle.insurance_cover_url) docs.push({ key: 'ins', url: motorcycle.insurance_cover_url, label: 'Insurance cover', category: 'Compliance', documentType: 'insurance_cover', userType: 'owner', userId: motorcycle.owner_id, knownExpiryDate: motorcycle.insurance_expiry ?? null });
    if (motorcycle.inspection_certificate_url) docs.push({ key: 'insp', url: motorcycle.inspection_certificate_url, label: 'Inspection certificate', category: 'Compliance' });
  }
  return docs;
}
