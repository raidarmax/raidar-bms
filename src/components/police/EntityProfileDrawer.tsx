import { useEffect, useMemo, useState } from 'react';
import {
  X, User, ShieldCheck, Bike, Phone, CreditCard, Star, Calendar, MapPin,
  FileText, FileImage, ExternalLink, Loader2, AlertTriangle, ScrollText,
  DollarSign, Copy, Check, ShieldAlert, FileCheck,
  Hash, Sparkles, Award, ClipboardList, BadgeCheck, Clock, Cog,
} from 'lucide-react';
import { supabase, type Rider, type Owner, type Motorcycle, type Incident, type Fine } from '../../lib/supabase';
import PartyAvatar from './PartyAvatar';
import DocumentRevalidateButton from '../DocumentRevalidateButton';
import DocumentViewerModal from '../DocumentViewerModal';
import type { DocumentType } from '../../lib/documentValidation';
import BmsIdLink from '../BmsIdLink';

export type EntityRef =
  | { kind: 'rider'; id: string }
  | { kind: 'owner'; id: string }
  | { kind: 'motorcycle'; id: string };

type Props = {
  entity: EntityRef | null;
  onClose: () => void;
};

type TabKey = 'overview' | 'documents' | 'history';

const KIND_META: Record<EntityRef['kind'], { title: string; gradient: string; ring: string; accent: string; icon: any }> = {
  rider: {
    title: 'Rider Profile',
    gradient: 'from-blue-600 via-sky-500 to-cyan-400',
    ring: 'ring-blue-200',
    accent: 'text-blue-700',
    icon: User,
  },
  owner: {
    title: 'Owner Profile',
    gradient: 'from-slate-700 via-slate-600 to-slate-500',
    ring: 'ring-slate-200',
    accent: 'text-slate-700',
    icon: ShieldCheck,
  },
  motorcycle: {
    title: 'Motorcycle Profile',
    gradient: 'from-emerald-600 via-teal-500 to-cyan-500',
    ring: 'ring-emerald-200',
    accent: 'text-emerald-700',
    icon: Bike,
  },
};

const daysUntil = (iso: string | null | undefined) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((then - Date.now()) / (24 * 60 * 60 * 1000));
};

const fmtDate = (iso: string | null | undefined, withTime = false) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-KE', withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusTone = (status: string | null | undefined): string => {
  const s = (status || '').toLowerCase();
  if (['resolved', 'closed', 'confirmed', 'paid'].includes(s)) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (['ignored', 'deleted', 'dismissed'].includes(s)) return 'bg-slate-100 text-slate-600 border-slate-200';
  if (['investigating', 'assigned', 'awaiting_evidence'].includes(s)) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (['unassigned', 'pending', 'issued'].includes(s)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function EntityProfileDrawer({ entity, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rider, setRider] = useState<Rider | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [ownedMotorcycles, setOwnedMotorcycles] = useState<Motorcycle[]>([]);
  const [assignedMotorcycle, setAssignedMotorcycle] = useState<Motorcycle | null>(null);
  const [motorcycleOwner, setMotorcycleOwner] = useState<Owner | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setTab('overview');
    if (!entity) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setRider(null); setOwner(null); setMotorcycle(null);
      setOwnedMotorcycles([]); setAssignedMotorcycle(null); setMotorcycleOwner(null);
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
            const [motoRes, incRes] = await Promise.all([
              supabase.from('motorcycles').select('*').eq('owner_id', o.id).order('created_at', { ascending: false }),
              supabase.from('incidents').select('*').eq('owner_id', o.id).order('incident_date', { ascending: false }),
            ]);
            if (cancelled) return;
            setOwnedMotorcycles((motoRes.data as Motorcycle[]) || []);
            setIncidents((incRes.data as Incident[]) || []);
          }
        } else if (entity.kind === 'motorcycle') {
          const { data: m } = await supabase.from('motorcycles').select('*').eq('id', entity.id).maybeSingle();
          if (cancelled) return;
          setMotorcycle(m as Motorcycle | null);
          if (m) {
            const [ownerRes, incRes] = await Promise.all([
              m.owner_id ? supabase.from('owners').select('*').eq('id', m.owner_id).maybeSingle() : Promise.resolve({ data: null }),
              supabase.from('incidents').select('*').eq('motorcycle_id', m.id).order('incident_date', { ascending: false }),
            ]);
            if (cancelled) return;
            setMotorcycleOwner((ownerRes.data as Owner) || null);
            setIncidents((incRes.data as Incident[]) || []);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Unable to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entity?.kind, entity?.id]);

  useEffect(() => {
    if (!entity) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entity, onClose]);

  const meta = entity ? KIND_META[entity.kind] : null;

  const primaryPhoto = useMemo(() => {
    if (!entity) return null;
    if (entity.kind === 'rider') return rider?.photo_url || null;
    if (entity.kind === 'owner') return owner?.profile_photo_url || null;
    return motorcycle?.bike_photo_url || null;
  }, [entity, rider, owner, motorcycle]);

  const primaryName = useMemo(() => {
    if (!entity) return '';
    if (entity.kind === 'rider') return rider?.name || 'Unknown rider';
    if (entity.kind === 'owner') return owner?.full_name || 'Unknown owner';
    return motorcycle?.registration_number || 'Unregistered motorcycle';
  }, [entity, rider, owner, motorcycle]);

  const primarySub = useMemo(() => {
    if (!entity) return '';
    if (entity.kind === 'rider') return rider?.bms_id ? `BMS ${rider.bms_id}` : (rider?.stage_name || rider?.phone_number || '');
    if (entity.kind === 'owner') return owner?.phone_number || owner?.national_id || '';
    if (motorcycle) {
      const parts = [motorcycle.make, motorcycle.model].filter(Boolean);
      return parts.join(' ') || (motorcycle.registration_number ? '' : 'No details');
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
  const unpaidFines = fines.filter((f) => f.status !== 'paid').length;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${entity ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={meta?.title || 'Profile'}
        className={`fixed top-0 right-0 z-50 h-full w-full sm:max-w-xl md:max-w-2xl bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${entity ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {entity && meta && (
          <div className="h-full flex flex-col">
            <div className={`relative bg-gradient-to-br ${meta.gradient} text-white`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)] pointer-events-none" />
              <div className="relative px-5 pt-5 pb-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-white/80 text-[11px] uppercase tracking-widest font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                    {meta.title}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                    aria-label="Close profile"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-3 flex items-start gap-4">
                  <div className="relative">
                    <div className="rounded-2xl ring-4 ring-white/40 overflow-hidden bg-white/20 backdrop-blur">
                      <PartyAvatar kind={entity.kind} photoUrl={primaryPhoto} name={primaryName} size="xl" rounded="xl" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <h2 className="text-xl font-bold leading-tight truncate">{primaryName}</h2>
                    {primarySub && (
                      <p className="text-sm text-white/80 mt-0.5 truncate">{primarySub}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <VerifyBadges entity={entity} rider={rider} owner={owner} motorcycle={motorcycle} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <StatTile label="Cases" value={totalIncidents} tone="light" icon={ScrollText} />
                  <StatTile label="Confirmed" value={confirmedIncidents} tone="light" icon={ShieldAlert} />
                  <StatTile label="Fines" value={totalFines} tone="light" icon={DollarSign} />
                  <StatTile label="Unpaid" value={unpaidFines} tone="light" icon={AlertTriangle} highlight={unpaidFines > 0} />
                </div>
              </div>

              <div className="relative px-5">
                <nav className="flex items-center gap-1 bg-white/15 backdrop-blur rounded-t-xl p-1 -mb-px">
                  {(['overview', 'documents', 'history'] as TabKey[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 text-xs font-semibold uppercase tracking-wider px-3 py-2 rounded-lg transition-colors ${tab === t ? 'bg-white text-slate-900 shadow' : 'text-white/85 hover:bg-white/10'}`}
                    >
                      {t === 'overview' ? 'Overview' : t === 'documents' ? 'Documents' : 'Case History'}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50">
              {loading ? (
                <div className="p-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading profile...
                </div>
              ) : error ? (
                <div className="p-6 text-sm text-red-700 bg-red-50 border-y border-red-100 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <p>{error}</p>
                </div>
              ) : (
                <div className="p-5 space-y-5">
                  {tab === 'overview' && (
                    <OverviewPanel
                      entity={entity}
                      rider={rider}
                      owner={owner}
                      motorcycle={motorcycle}
                      assignedMotorcycle={assignedMotorcycle}
                      ownedMotorcycles={ownedMotorcycles}
                      motorcycleOwner={motorcycleOwner}
                      copy={copy}
                      copied={copied}
                    />
                  )}
                  {tab === 'documents' && (
                    <DocumentsPanel entity={entity} rider={rider} owner={owner} motorcycle={motorcycle} />
                  )}
                  {tab === 'history' && (
                    <HistoryPanel incidents={incidents} fines={fines} entity={entity} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function StatTile({ label, value, icon: Icon, highlight = false }: { label: string; value: number; icon: any; tone?: 'light'; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-2.5 py-2 backdrop-blur border ${highlight ? 'bg-white/20 border-white/40' : 'bg-white/10 border-white/20'}`}>
      <div className="flex items-center gap-1.5 text-white/80 text-[9px] uppercase tracking-widest font-bold">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`mt-0.5 text-xl font-black tabular-nums ${highlight ? 'text-white drop-shadow' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function VerifyBadges({ entity, rider, owner, motorcycle }: { entity: EntityRef; rider: Rider | null; owner: Owner | null; motorcycle: Motorcycle | null }) {
  if (entity.kind === 'rider' && rider) {
    return (
      <>
        {rider.id_verified && <Chip icon={BadgeCheck} tone="emerald">ID verified</Chip>}
        {rider.license_verified && <Chip icon={FileCheck} tone="emerald">Licence verified</Chip>}
        {!rider.license_verified && rider.license_number && <Chip icon={Clock} tone="amber">Licence pending</Chip>}
        {rider.rating_score !== null && rider.rating_score !== undefined && (
          <Chip icon={Star} tone="sky">
            {Number(rider.rating_score).toFixed(1)} {rider.rating_tier ? `· ${rider.rating_tier}` : ''}
          </Chip>
        )}
        {rider.assignment_status && <Chip icon={Award} tone="slate">{rider.assignment_status}</Chip>}
      </>
    );
  }
  if (entity.kind === 'owner' && owner) {
    return (
      <>
        {owner.id_verified && <Chip icon={BadgeCheck} tone="emerald">ID verified</Chip>}
        {owner.kra_pin_verified && <Chip icon={FileCheck} tone="emerald">KRA verified</Chip>}
        {owner.otp_verified && <Chip icon={ShieldCheck} tone="sky">OTP verified</Chip>}
        {owner.payment_status === 'completed' && <Chip icon={DollarSign} tone="emerald">Compliant</Chip>}
      </>
    );
  }
  if (entity.kind === 'motorcycle' && motorcycle) {
    return (
      <>
        {motorcycle.is_compliant ? (
          <Chip icon={ShieldCheck} tone="emerald">Compliant</Chip>
        ) : (
          <Chip icon={AlertTriangle} tone="amber">Non-compliant</Chip>
        )}
        {motorcycle.status === 'verified' && <Chip icon={BadgeCheck} tone="sky">Verified</Chip>}
      </>
    );
  }
  return null;
}

function Chip({ icon: Icon, tone, children }: { icon?: any; tone: 'emerald' | 'amber' | 'sky' | 'slate' | 'red'; children: any }) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-50 ring-1 ring-inset ring-emerald-200/40',
    amber: 'bg-amber-500/25 text-amber-50 ring-1 ring-inset ring-amber-200/40',
    sky: 'bg-sky-500/20 text-sky-50 ring-1 ring-inset ring-sky-200/40',
    slate: 'bg-slate-500/25 text-slate-50 ring-1 ring-inset ring-slate-200/40',
    red: 'bg-red-500/25 text-red-50 ring-1 ring-inset ring-red-200/40',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tones[tone]}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

function OverviewPanel({
  entity, rider, owner, motorcycle, assignedMotorcycle, ownedMotorcycles, motorcycleOwner, copy, copied,
}: {
  entity: EntityRef;
  rider: Rider | null;
  owner: Owner | null;
  motorcycle: Motorcycle | null;
  assignedMotorcycle: Motorcycle | null;
  ownedMotorcycles: Motorcycle[];
  motorcycleOwner: Owner | null;
  copy: (v: string) => void;
  copied: string | null;
}) {
  if (entity.kind === 'rider') {
    if (!rider) return <EmptyState label="Rider record not found." />;
    return (
      <div className="space-y-4">
        <SectionCard title="Identification" icon={CreditCard}>
          <Field label="Full name" value={rider.name} />
          <Field label="ID number" value={rider.id_number} copyable copy={copy} copied={copied} />
          <Field label="Phone" value={rider.phone_number} icon={Phone} copyable copy={copy} copied={copied} />
          <Field label="Stage name" value={rider.stage_name} />
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
        </SectionCard>

        <SectionCard title="Licence" icon={FileCheck}>
          <Field label="Number" value={rider.license_number} copyable copy={copy} copied={copied} />
          <Field label="Class" value={rider.license_class} />
          <Field label="Expiry" value={rider.license_expiry ? `${fmtDate(rider.license_expiry)}${licenceHint(rider.license_expiry)}` : null} />
          <Field label="Verified" value={rider.license_verified ? 'Yes' : 'No'} tone={rider.license_verified ? 'emerald' : 'amber'} />
        </SectionCard>

        <SectionCard title="Next of kin" icon={User}>
          <Field label="Name" value={rider.next_of_kin_name} />
          <Field label="Phone" value={rider.next_of_kin_phone} icon={Phone} copyable copy={copy} copied={copied} />
        </SectionCard>

        {(assignedMotorcycle || owner) && (
          <SectionCard title="Links" icon={Cog}>
            {owner && (
              <div className="col-span-2 flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                <PartyAvatar kind="owner" photoUrl={owner.profile_photo_url} name={owner.full_name} size="md" rounded="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Owner</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">{owner.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">{owner.phone_number}</p>
                </div>
              </div>
            )}
            {assignedMotorcycle && (
              <div className="col-span-2 flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                <PartyAvatar kind="motorcycle" photoUrl={assignedMotorcycle.bike_photo_url} name={assignedMotorcycle.registration_number} size="md" rounded="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Assigned bike</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">{assignedMotorcycle.registration_number}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {[assignedMotorcycle.make, assignedMotorcycle.model].filter(Boolean).join(' ') || 'No make/model'}
                  </p>
                </div>
                {assignedMotorcycle.is_compliant ? (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Compliant</span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Non-compliant</span>
                )}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    );
  }

  if (entity.kind === 'owner') {
    if (!owner) return <EmptyState label="Owner record not found." />;
    return (
      <div className="space-y-4">
        <SectionCard title="Identification" icon={CreditCard}>
          <Field label="Full name" value={owner.full_name} />
          <Field label="National ID" value={owner.national_id} copyable copy={copy} copied={copied} />
          <Field label="Phone" value={owner.phone_number} icon={Phone} copyable copy={copy} copied={copied} />
          <Field label="KRA PIN" value={owner.kra_pin} copyable copy={copy} copied={copied} />
          <Field label="ID verified" value={owner.id_verified ? 'Yes' : 'No'} tone={owner.id_verified ? 'emerald' : 'amber'} />
          <Field label="OTP verified" value={owner.otp_verified ? 'Yes' : 'No'} tone={owner.otp_verified ? 'emerald' : 'slate'} />
        </SectionCard>

        <SectionCard title="Next of kin" icon={User}>
          <Field label="Name" value={owner.next_of_kin_name} />
          <Field label="Phone" value={owner.next_of_kin_phone} icon={Phone} copyable copy={copy} copied={copied} />
          <Field label="Relationship" value={owner.next_of_kin_relationship} />
        </SectionCard>

        <SectionCard title={`Motorcycles (${ownedMotorcycles.length})`} icon={Bike}>
          {ownedMotorcycles.length === 0 ? (
            <div className="col-span-2 text-xs text-slate-500 italic">No motorcycles registered under this owner.</div>
          ) : (
            <div className="col-span-2 space-y-2">
              {ownedMotorcycles.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <PartyAvatar kind="motorcycle" photoUrl={m.bike_photo_url} name={m.registration_number} size="md" rounded="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.registration_number}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {[m.make, m.model].filter(Boolean).join(' ') || 'No make/model'}
                    </p>
                  </div>
                  {m.is_compliant ? (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Compliant</span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Non-compliant</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  // motorcycle
  if (!motorcycle) return <EmptyState label="Motorcycle record not found." />;
  return (
    <div className="space-y-4">
      <SectionCard title="Vehicle" icon={Bike}>
        <Field label="Registration" value={motorcycle.registration_number} copyable copy={copy} copied={copied} />
        <Field label="Make" value={motorcycle.make} />
        <Field label="Model" value={motorcycle.model} />
        <Field label="Verification" value={motorcycle.status === 'verified' ? 'Verified' : 'Pending'} tone={motorcycle.status === 'verified' ? 'emerald' : 'amber'} />
        <Field label="Compliance" value={motorcycle.is_compliant ? 'Compliant' : 'Non-compliant'} tone={motorcycle.is_compliant ? 'emerald' : 'amber'} />
        <Field label="Tracker" value={motorcycle.tracking_device_id} copyable copy={copy} copied={copied} />
      </SectionCard>

      <SectionCard title="Insurance" icon={ShieldCheck}>
        <Field label="Provider" value={motorcycle.insurance_provider} />
        <Field label="Policy #" value={motorcycle.insurance_policy_number} copyable copy={copy} copied={copied} />
        <Field label="Expiry" value={motorcycle.insurance_expiry ? `${fmtDate(motorcycle.insurance_expiry)}${licenceHint(motorcycle.insurance_expiry)}` : null} />
      </SectionCard>

      <SectionCard title="Inspection" icon={ClipboardList}>
        <Field label="Certificate #" value={motorcycle.inspection_certificate_number} copyable copy={copy} copied={copied} />
        <Field label="Expiry" value={motorcycle.inspection_expiry ? `${fmtDate(motorcycle.inspection_expiry)}${licenceHint(motorcycle.inspection_expiry)}` : null} />
      </SectionCard>

      {motorcycleOwner && (
        <SectionCard title="Owner" icon={ShieldCheck}>
          <div className="col-span-2 flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
            <PartyAvatar kind="owner" photoUrl={motorcycleOwner.profile_photo_url} name={motorcycleOwner.full_name} size="md" rounded="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{motorcycleOwner.full_name}</p>
              <p className="text-xs text-slate-500 truncate">
                {motorcycleOwner.phone_number}{motorcycleOwner.national_id ? ` · ${motorcycleOwner.national_id}` : ''}
              </p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function DocumentsPanel({ entity, rider, owner, motorcycle }: { entity: EntityRef; rider: Rider | null; owner: Owner | null; motorcycle: Motorcycle | null }) {
  const docs = collectDocs(entity, rider, owner, motorcycle);
  if (docs.length === 0) {
    return <EmptyState label="No documents uploaded for this profile yet." icon={FileText} />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {docs.map((d) => (
        <DocumentCard key={d.key} doc={d} />
      ))}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocRow }) {
  const [open, setOpen] = useState(false);
  const isImage = /\.(png|jpe?g|webp|gif|heic|heif)(\?|$)/i.test(doc.url);
  return (
    <>
    <div className="group relative bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left"
      >
        <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
          {isImage ? (
            <img src={doc.url} alt={doc.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <FileText className="h-8 w-8" />
              <span className="text-[10px] uppercase tracking-widest font-semibold">Document</span>
            </div>
          )}
        </div>
        <div className="p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{doc.category}</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{doc.label}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </div>
        </div>
      </button>
      {doc.documentType && doc.userType && doc.userId && (
        <div className="px-3 pb-3">
          <DocumentRevalidateButton
            userType={doc.userType}
            userId={doc.userId}
            documentType={doc.documentType}
            fileUrl={doc.url}
            fileName={doc.label}
            expectedName={doc.expectedName}
            expectedIdNumber={doc.expectedIdNumber}
            expectedPlateNumber={doc.expectedPlateNumber}
            knownExpiryDate={doc.knownExpiryDate}
          />
        </div>
      )}
    </div>
    <DocumentViewerModal
      open={open}
      onClose={() => setOpen(false)}
      fileUrl={doc.url}
      fileName={doc.label}
      title={doc.label}
      documentType={doc.documentType}
    />
    </>
  );
}

function HistoryPanel({ incidents, fines, entity }: { incidents: Incident[]; fines: Fine[]; entity: EntityRef }) {
  const showFines = entity.kind === 'rider';
  if (incidents.length === 0 && (!showFines || fines.length === 0)) {
    return <EmptyState label="No cases or fines on record." icon={ScrollText} />;
  }
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1.5">
          <ScrollText className="h-3.5 w-3.5" />
          Incidents ({incidents.length})
        </h3>
        {incidents.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-1">No incidents on record.</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((i) => (
              <div key={i.id} className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
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
                        <span className="inline-flex items-center gap-1 truncate max-w-[180px]" title={i.location}>
                          <MapPin className="h-3 w-3" />
                          {i.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusTone(i.police_status || i.status)}`}>
                      {(i.police_status || i.status || 'reported').replace(/_/g, ' ')}
                    </span>
                    {i.reopened_count > 0 && (
                      <span className="text-[10px] font-semibold text-orange-700">Reopened x{i.reopened_count}</span>
                    )}
                  </div>
                </div>
                {i.resolution_outcome && (
                  <p className="mt-2 text-[11px] text-slate-600 bg-slate-50 rounded-md px-2 py-1 border border-slate-100">
                    <span className="font-semibold">Outcome:</span> {i.resolution_outcome.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showFines && (
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Fines ({fines.length})
          </h3>
          {fines.length === 0 ? (
            <p className="text-xs text-slate-500 italic px-1">No fines on record.</p>
          ) : (
            <div className="space-y-2">
              {fines.map((f) => (
                <div key={f.id} className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-mono font-bold">
                          <Hash className="h-2.5 w-2.5 opacity-70" />
                          {f.fine_reference}
                        </span>
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {f.notes || 'Traffic fine'}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {f.issued_at && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmtDate(f.issued_at)}
                          </span>
                        )}
                        {f.fine_amount != null && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <DollarSign className="h-3 w-3" />
                            KES {Number(f.fine_amount).toLocaleString('en-KE')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusTone(f.status)}`}>
                      {(f.status || 'issued').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: any }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-700">{title}</h3>
      </header>
      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {children}
      </div>
    </section>
  );
}

function Field({ label, value, icon: Icon, copyable, copy, copied, tone }: { label: string; value: string | null | undefined; icon?: any; copyable?: boolean; copy?: (v: string) => void; copied?: string | null; tone?: 'emerald' | 'amber' | 'slate' }) {
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
          {hasValue ? value : <span className="text-slate-400 font-normal">-</span>}
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

function EmptyState({ label, icon: Icon = FileImage }: { label: string; icon?: any }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 flex flex-col items-center justify-center text-slate-400">
      <Icon className="h-8 w-8 mb-2" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

type DocRow = { key: string; url: string; label: string; category: string; documentType?: DocumentType; userType?: 'rider' | 'owner'; userId?: string; expectedName?: string; expectedIdNumber?: string; expectedPlateNumber?: string; knownExpiryDate?: string | null };

function collectDocs(entity: EntityRef, rider: Rider | null, owner: Owner | null, motorcycle: Motorcycle | null): DocRow[] {
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

function licenceHint(iso: string | null | undefined) {
  const d = daysUntil(iso);
  if (d === null) return '';
  if (d < 0) return ` (expired ${Math.abs(d)}d)`;
  if (d <= 30) return ` (in ${d}d)`;
  return '';
}
