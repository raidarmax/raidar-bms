import { useMemo, useState } from 'react';
import {
  AlertTriangle, Search, Filter, Eye, MessageSquare, MapPin, Clock, Bike, User,
  ShieldCheck, CheckCircle2, XCircle, Timer, FileText, ChevronRight, Sparkles,
  Flame, Building2, Hash, Inbox,
} from 'lucide-react';
import type { Incident, Motorcycle, Rider } from '../../lib/supabase';

export type IncidentsPanelRole = 'owner' | 'rider';

export type IncidentPanelTab = 'overview' | 'timeline' | 'evidence' | 'responses';

type IncidentsPanelProps = {
  role: IncidentsPanelRole;
  incidents: Incident[];
  motorcycles?: Motorcycle[];
  riders?: Rider[];
  stationNames?: Record<string, string>;
  unreadIncidentIds?: Set<string>;
  onOpen: (incident: Incident, openTo?: IncidentPanelTab) => void;
};

type StatusKey = 'pending' | 'confirmed' | 'resolved' | 'dismissed';
type FilterKey = 'all' | 'open' | StatusKey;

const STATUS_META: Record<StatusKey, {
  label: string;
  pill: string;
  accent: string;
  dot: string;
  icon: typeof Timer;
  iconTint: string;
}> = {
  pending: {
    label: 'Pending review',
    pill: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    accent: 'bg-amber-400',
    dot: 'bg-amber-500',
    icon: Timer,
    iconTint: 'bg-amber-50 text-amber-600',
  },
  confirmed: {
    label: 'Confirmed',
    pill: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    accent: 'bg-red-500',
    dot: 'bg-red-500',
    icon: Flame,
    iconTint: 'bg-red-50 text-red-600',
  },
  resolved: {
    label: 'Resolved',
    pill: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    accent: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
    iconTint: 'bg-emerald-50 text-emerald-600',
  },
  dismissed: {
    label: 'Dismissed',
    pill: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    accent: 'bg-slate-400',
    dot: 'bg-slate-400',
    icon: XCircle,
    iconTint: 'bg-slate-100 text-slate-500',
  },
};

function toStatusKey(status: string): StatusKey {
  const s = (status || '').toLowerCase();
  if (s === 'pending' || s === 'confirmed' || s === 'resolved' || s === 'dismissed') {
    return s;
  }
  return 'pending';
}

function daysBetween(iso: string, now = Date.now()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

function formatType(type: string): string {
  return type
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function IncidentsPanel({
  role,
  incidents,
  motorcycles = [],
  riders = [],
  stationNames = {},
  unreadIncidentIds,
  onOpen,
}: IncidentsPanelProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const base = { pending: 0, confirmed: 0, resolved: 0, dismissed: 0 };
    for (const incident of incidents) {
      base[toStatusKey(incident.status)] += 1;
    }
    return base;
  }, [incidents]);

  const openCount = counts.pending + counts.confirmed;

  const motorcycleById = useMemo(() => {
    const map = new Map<string, Motorcycle>();
    motorcycles.forEach((m) => map.set(m.id, m));
    return map;
  }, [motorcycles]);

  const riderById = useMemo(() => {
    const map = new Map<string, Rider>();
    riders.forEach((r) => map.set(r.id, r));
    return map;
  }, [riders]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return incidents.filter((incident) => {
      const statusKey = toStatusKey(incident.status);
      const statusMatch =
        filter === 'all' ||
        (filter === 'open' ? statusKey === 'pending' || statusKey === 'confirmed' : filter === statusKey);
      if (!statusMatch) return false;
      if (!term) return true;

      const motorcycle = incident.motorcycle_id ? motorcycleById.get(incident.motorcycle_id) : null;
      const rider = incident.rider_id ? riderById.get(incident.rider_id) : null;
      const haystack = [
        incident.incident_type,
        incident.description,
        incident.location,
        incident.case_number,
        incident.reporter_name,
        motorcycle?.registration_number,
        rider?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [incidents, filter, query, motorcycleById, riderById]);

  const filters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all', label: 'All', count: incidents.length },
    { key: 'open', label: 'Open', count: openCount },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'confirmed', label: 'Confirmed', count: counts.confirmed },
    { key: 'resolved', label: 'Resolved', count: counts.resolved },
    { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
  ];

  return (
    <div id="incidents-section" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 lg:p-6 border-b border-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-slate-900 leading-tight">
                Incident Reports
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {role === 'owner'
                  ? 'Track incidents reported against your motorcycles and riders.'
                  : 'Reports involving you, their status and steps you can take.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {openCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {openCount} needing attention
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {incidents.length} total
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Pending review"
            value={counts.pending}
            tone="amber"
            icon={<Timer className="h-4 w-4" />}
          />
          <StatTile
            label="Confirmed"
            value={counts.confirmed}
            tone="red"
            icon={<Flame className="h-4 w-4" />}
          />
          <StatTile
            label="Resolved"
            value={counts.resolved}
            tone="emerald"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatTile
            label="Dismissed"
            value={counts.dismissed}
            tone="slate"
            icon={<XCircle className="h-4 w-4" />}
          />
        </div>
      </div>

      <div className="p-5 lg:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by type, description, plate, rider or case number"
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map(({ key, label, count }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
                <span
                  className={`min-w-[1.25rem] text-[10px] px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 lg:p-6">
        {filtered.length === 0 ? (
          <EmptyState
            hasIncidents={incidents.length > 0}
            filter={filter}
            query={query}
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((incident) => {
              const statusKey = toStatusKey(incident.status);
              const meta = STATUS_META[statusKey];
              const StatusIcon = meta.icon;
              const motorcycle = incident.motorcycle_id
                ? motorcycleById.get(incident.motorcycle_id)
                : null;
              const rider = incident.rider_id ? riderById.get(incident.rider_id) : null;
              const isOpen = statusKey === 'pending' || statusKey === 'confirmed';
              const ageDays = daysBetween(incident.incident_date);
              const isUrgent = isOpen && ageDays >= 7;
              const isUnread = unreadIncidentIds?.has(incident.id);
              const stationLabel = incident.assigned_station_id
                ? stationNames[incident.assigned_station_id]
                : null;

              const showAppeal =
                role === 'rider' &&
                statusKey === 'confirmed' &&
                !incident.rider_response;
              const showRespond = role === 'rider' && isOpen && !incident.rider_response;

              return (
                <li
                  key={incident.id}
                  className="group relative pl-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition overflow-hidden"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.accent}`} />

                  <div className="p-4 lg:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconTint}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {incident.case_number && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-slate-500 bg-slate-100 tracking-wide">
                              <Hash className="h-3 w-3" />
                              {incident.case_number}
                            </span>
                          )}
                          <h3 className="text-base lg:text-lg font-bold text-slate-900 leading-tight">
                            {formatType(incident.incident_type)}
                          </h3>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                          {isUrgent && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                              <Flame className="h-3 w-3" />
                              Urgent · {ageDays}d open
                            </span>
                          )}
                          {isUnread && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                              <Sparkles className="h-3 w-3" />
                              New
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-2">
                          {incident.description}
                        </p>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                          <MetaRow
                            icon={<Clock className="h-3.5 w-3.5" />}
                            label={formatDate(incident.incident_date)}
                          />
                          {incident.location && (
                            <MetaRow
                              icon={<MapPin className="h-3.5 w-3.5" />}
                              label={incident.location}
                            />
                          )}
                          {motorcycle && (
                            <MetaRow
                              icon={<Bike className="h-3.5 w-3.5" />}
                              label={motorcycle.registration_number}
                            />
                          )}
                          {role === 'owner' && rider && (
                            <MetaRow
                              icon={<User className="h-3.5 w-3.5" />}
                              label={rider.name}
                            />
                          )}
                          {stationLabel && (
                            <MetaRow
                              icon={<Building2 className="h-3.5 w-3.5" />}
                              label={stationLabel}
                            />
                          )}
                          {role === 'rider' && incident.rider_response && (
                            <MetaRow
                              icon={<MessageSquare className="h-3.5 w-3.5" />}
                              label="Your response submitted"
                              tone="emerald"
                            />
                          )}
                          {incident.admin_response && (
                            <MetaRow
                              icon={<ShieldCheck className="h-3.5 w-3.5" />}
                              label="Official response received"
                              tone="emerald"
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap lg:flex-col gap-2 lg:min-w-[10rem]">
                        <button
                          onClick={() => onOpen(incident, 'overview')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
                        >
                          <Eye className="h-4 w-4" />
                          View details
                          <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                        </button>

                        {showAppeal && (
                          <button
                            onClick={() => onOpen(incident, 'responses')}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                          >
                            <MessageSquare className="h-4 w-4" />
                            Submit appeal
                          </button>
                        )}

                        {showRespond && (
                          <button
                            onClick={() => onOpen(incident, 'responses')}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
                          >
                            <FileText className="h-4 w-4" />
                            Add response
                          </button>
                        )}

                        {role === 'owner' && isOpen && (
                          <button
                            onClick={() => onOpen(incident, 'evidence')}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
                          >
                            <FileText className="h-4 w-4" />
                            Provide info
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'red' | 'emerald' | 'slate';
  icon: React.ReactNode;
}) {
  const tones: Record<typeof tone, string> = {
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    slate: 'bg-slate-50 text-slate-700 ring-slate-100',
  };
  return (
    <div className={`rounded-xl p-3.5 ring-1 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'emerald';
}) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700 font-medium' : 'text-slate-600';
  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${toneClass}`}>
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function EmptyState({
  hasIncidents,
  filter,
  query,
}: {
  hasIncidents: boolean;
  filter: FilterKey;
  query: string;
}) {
  if (!hasIncidents) {
    return (
      <div className="text-center py-14 px-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-slate-900 font-semibold">No incidents to worry about</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          You're in the clear. Anything reported involving you or your motorcycles will show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="text-center py-12 px-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Inbox className="h-7 w-7 text-slate-500" />
      </div>
      <p className="text-slate-900 font-semibold">Nothing matches this view</p>
      <p className="text-sm text-slate-500 mt-1">
        {query
          ? `No incidents matching "${query}"${filter === 'all' ? '' : ` in ${filter}`}.`
          : `No incidents in the "${filter}" filter yet.`}
      </p>
    </div>
  );
}
