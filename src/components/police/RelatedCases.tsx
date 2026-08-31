import { useEffect, useState } from 'react';
import { History, MapPin, ChevronRight, AlertTriangle } from 'lucide-react';
import { supabase, type Incident } from '../../lib/supabase';

type Props = {
  currentIncidentId: string;
  riderId: string | null;
  motorcycleId: string | null;
  onOpen?: (incident: Incident) => void;
};

export default function RelatedCases({ currentIncidentId, riderId, motorcycleId, onOpen }: Props) {
  const [related, setRelated] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!riderId && !motorcycleId) {
        setRelated([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const filters: string[] = [];
      if (riderId) filters.push(`rider_id.eq.${riderId}`);
      if (motorcycleId) filters.push(`motorcycle_id.eq.${motorcycleId}`);
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .or(filters.join(','))
        .neq('id', currentIncidentId)
        .order('created_at', { ascending: false })
        .limit(10);
      setRelated((data as Incident[]) || []);
      setLoading(false);
    })();
  }, [currentIncidentId, riderId, motorcycleId]);

  if (loading) return null;
  if (related.length === 0) return null;

  const statusStyle = (s: string | null) => {
    switch (s) {
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700';
      case 'closed':
        return 'bg-slate-200 text-slate-700';
      case 'investigating':
        return 'bg-blue-100 text-blue-700';
      case 'awaiting_evidence':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" />
        Related Cases ({related.length})
      </p>
      <p className="text-[11px] text-slate-500 mb-3">
        Prior incidents involving the same rider or motorcycle. Look for patterns.
      </p>
      <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {related.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onOpen?.(c)}
              className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-300 hover:shadow-sm transition p-2.5 group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.case_number && (
                      <span className="text-[10px] font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">
                        {c.case_number}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-900 capitalize">
                      {c.incident_type.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${statusStyle(c.police_status)}`}>
                      {(c.police_status || 'unassigned').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <span>{new Date(c.incident_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {c.location && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="h-2.5 w-2.5" />
                        {c.location}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              </div>
              {c.description && (
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">{c.description}</p>
              )}
              {c.resolution_outcome && (
                <p className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Outcome: {c.resolution_outcome.replace(/_/g, ' ')}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
