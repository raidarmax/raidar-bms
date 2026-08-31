import { Building2, Phone, Calendar, MapPin, Hash, Lock, Zap, ArrowUpRight } from 'lucide-react';
import type { Incident, Rider, Owner, PoliceOfficer, PoliceStation } from '../../lib/supabase';
import PartyAvatar, { type AvatarKind } from './PartyAvatar';
import type { EntityRef } from './EntityProfileDrawer';

type Props = {
  incident: Incident;
  rider: Rider | null;
  owner: Owner | null;
  motorcycleReg: string | null;
  motorcyclePhotoUrl?: string | null;
  assignedOfficerName: string | null;
  assignedOfficerPhotoUrl?: string | null;
  station: PoliceStation | null;
  claimingOfficer?: PoliceOfficer | null;
  onOpenProfile?: (ref: EntityRef) => void;
};

const STATUS_STEPS = [
  { key: 'unassigned', label: 'Reported' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const stepIndex = (status: string | null | undefined) => {
  if (!status) return 0;
  if (status === 'awaiting_evidence' || status === 'awaiting_appeal_review') return 2;
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
};

export default function CaseSummaryHeader({
  incident,
  rider,
  owner,
  motorcycleReg,
  motorcyclePhotoUrl,
  assignedOfficerName,
  assignedOfficerPhotoUrl,
  station,
  onOpenProfile,
}: Props) {
  const currentStep = stepIndex(incident.police_status);
  const totalSteps = STATUS_STEPS.length - 1;
  const progressPct = Math.max(4, Math.round((currentStep / totalSteps) * 100));
  const isClosed = incident.police_status === 'closed';
  const isResolved = incident.police_status === 'resolved';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {incident.case_number && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-mono font-bold">
                  <Hash className="h-3 w-3 opacity-70" />
                  {incident.case_number}
                </span>
              )}
              <h2 className="text-lg font-bold text-slate-900 capitalize truncate">
                {incident.incident_type.replace(/_/g, ' ')}
              </h2>
              {incident.auto_assigned && !incident.claimed_by_manager_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  <Zap className="h-3 w-3" /> Auto-routed
                </span>
              )}
              {incident.claimed_by_manager_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <Lock className="h-3 w-3" /> Claimed
                </span>
              )}
              {incident.reopened_count > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  Reopened x{incident.reopened_count}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(incident.incident_date).toLocaleString('en-KE', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
              {incident.location && (
                <span className="inline-flex items-center gap-1 truncate max-w-[240px]" title={incident.location}>
                  <MapPin className="h-3 w-3" />
                  {incident.location}
                </span>
              )}
              {station && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {station.station_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-2">
          <PartyChip
            tone="rose"
            kind="reporter"
            label="Reporter"
            name={incident.reporter_name}
            sub={incident.reporter_phone}
          />
          <PartyChip
            tone="blue"
            kind="rider"
            photoUrl={rider?.photo_url}
            label="Rider"
            name={rider?.name || 'Not linked'}
            sub={rider?.phone_number || rider?.id_number || null}
            onClick={rider && onOpenProfile ? () => onOpenProfile({ kind: 'rider', id: rider.id }) : undefined}
          />
          <PartyChip
            tone="teal"
            kind="motorcycle"
            photoUrl={motorcyclePhotoUrl}
            label="Motorcycle"
            name={motorcycleReg || 'Not linked'}
            sub={owner?.full_name ? `Owner: ${owner.full_name}` : null}
            onClick={incident.motorcycle_id && onOpenProfile ? () => onOpenProfile({ kind: 'motorcycle', id: incident.motorcycle_id as string }) : undefined}
            onSubClick={owner && onOpenProfile ? () => onOpenProfile({ kind: 'owner', id: owner.id }) : undefined}
          />
          <PartyChip
            tone="emerald"
            kind="officer"
            photoUrl={assignedOfficerPhotoUrl}
            label="Assigned"
            name={assignedOfficerName || 'Unassigned'}
            sub={assignedOfficerName ? (station?.station_name || null) : 'Awaiting officer'}
          />
        </div>
      </div>

      <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Resolution progress</p>
          <p className="text-[11px] text-slate-500">
            Step {Math.min(currentStep + 1, STATUS_STEPS.length)} of {STATUS_STEPS.length}
          </p>
        </div>
        <div className="relative">
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all ${isClosed ? 'bg-slate-500' : isResolved ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <ol className="mt-2 grid grid-cols-5 gap-1 text-[10px]">
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <li
                  key={step.key}
                  className={`text-center leading-tight ${
                    done ? (isClosed && i === currentStep ? 'text-slate-700 font-semibold' : 'text-slate-800 font-semibold') : 'text-slate-400'
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mb-0.5 ${
                    done
                      ? isClosed && i === currentStep
                        ? 'bg-slate-500'
                        : isResolved && i === currentStep
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      : 'bg-slate-300'
                  } ${isCurrent ? 'ring-2 ring-offset-1 ring-blue-200' : ''}`} />
                  <br />
                  {step.label}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

type ChipTone = 'rose' | 'blue' | 'teal' | 'emerald';
const TONES: Record<ChipTone, { bg: string; ring: string; label: string }> = {
  rose: { bg: 'bg-rose-50', ring: 'border-rose-200', label: 'text-rose-700' },
  blue: { bg: 'bg-blue-50', ring: 'border-blue-200', label: 'text-blue-700' },
  teal: { bg: 'bg-teal-50', ring: 'border-teal-200', label: 'text-teal-700' },
  emerald: { bg: 'bg-emerald-50', ring: 'border-emerald-200', label: 'text-emerald-700' },
};

function PartyChip({
  tone,
  kind,
  photoUrl,
  label,
  name,
  sub,
  onClick,
  onSubClick,
}: {
  tone: ChipTone;
  kind: AvatarKind;
  photoUrl?: string | null;
  label: string;
  name: string;
  sub: string | null;
  onClick?: () => void;
  onSubClick?: () => void;
}) {
  const t = TONES[tone];
  const clickable = !!onClick;
  const Wrapper: any = clickable ? 'button' : 'div';
  return (
    <Wrapper
      {...(clickable ? { onClick, type: 'button', title: `View ${label.toLowerCase()} profile` } : {})}
      className={`w-full text-left rounded-xl border ${t.ring} ${t.bg} p-2.5 min-w-0 ${clickable ? 'hover:shadow-md hover:border-opacity-100 transition-all group cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-2">
        <PartyAvatar kind={kind} photoUrl={photoUrl} name={name} size="md" rounded="lg" />
        <div className="min-w-0 flex-1">
          <div className={`text-[9px] uppercase tracking-widest font-bold ${t.label} flex items-center gap-1`}>
            {label}
            {clickable && <ArrowUpRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
          <p className="text-xs font-bold text-slate-900 truncate" title={name}>{name}</p>
          {sub && (
            onSubClick ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onSubClick(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onSubClick(); } }}
                className="text-[10px] text-slate-500 truncate flex items-center gap-0.5 hover:text-slate-900 hover:underline cursor-pointer"
                title="View owner profile"
              >
                {label === 'Reporter' && <Phone className="h-2.5 w-2.5" />}
                {sub}
              </span>
            ) : (
              <p className="text-[10px] text-slate-500 truncate flex items-center gap-0.5" title={sub}>
                {label === 'Reporter' && <Phone className="h-2.5 w-2.5" />}
                {sub}
              </p>
            )
          )}
        </div>
      </div>
    </Wrapper>
  );
}
