import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, ShieldAlert, ChevronRight } from 'lucide-react';
import { supabase, type Incident } from '../lib/supabase';

type Props = {
  motorcycleId: string;
  onViewIncident?: (incident: Incident) => void;
};

const RESOLVED_STATUSES = new Set(['resolved', 'ignored', 'dismissed', 'closed']);

function statusMeta(status: string) {
  const key = (status || '').toLowerCase();
  if (RESOLVED_STATUSES.has(key)) {
    return {
      label: key === 'ignored' || key === 'dismissed' ? 'Dismissed' : 'Resolved',
      className: 'bg-emerald-100 text-emerald-800',
      Icon: CheckCircle,
    };
  }
  if (key === 'confirmed' || key === 'active' || key === 'investigating') {
    return {
      label: key.charAt(0).toUpperCase() + key.slice(1),
      className: 'bg-red-100 text-red-800',
      Icon: ShieldAlert,
    };
  }
  return {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800',
    Icon: Clock,
  };
}

export function isIncidentUnresolved(status: string | null | undefined): boolean {
  if (!status) return true;
  return !RESOLVED_STATUSES.has(status.toLowerCase());
}

export default function MotorcycleIncidentsSection({ motorcycleId, onViewIncident }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('incidents')
        .select('*')
        .eq('motorcycle_id', motorcycleId)
        .order('incident_date', { ascending: false });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setIncidents([]);
      } else {
        setIncidents(data || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [motorcycleId]);

  const unresolvedCount = incidents.filter((i) => isIncidentUnresolved(i.status)).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Incidents ({incidents.length})
        </h3>
        {unresolvedCount > 0 && (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg text-xs font-semibold">
            <ShieldAlert className="h-3.5 w-3.5" />
            {unresolvedCount} unresolved
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
          <span className="ml-2 text-sm text-slate-600">Loading incidents...</span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">Failed to load incidents: {error}</p>
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-500">
          No incidents reported for this motorcycle.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {incidents.map((incident) => {
            const meta = statusMeta(incident.status);
            const Icon = meta.Icon;
            const clickable = !!onViewIncident;
            return (
              <li
                key={incident.id}
                className={`py-3 flex items-start gap-3 ${
                  clickable ? 'cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg transition' : ''
                }`}
                onClick={() => clickable && onViewIncident?.(incident)}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meta.className}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {incident.incident_type.replace(/_/g, ' ')}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(incident.incident_date).toLocaleDateString()}
                    {incident.location && <span> - {incident.location}</span>}
                  </p>
                  {incident.description && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{incident.description}</p>
                  )}
                </div>
                {clickable && <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
