import { useEffect, useState } from 'react';
import { History, MapPin, ChevronRight, ChevronDown, ChevronUp, User, Bike } from 'lucide-react';
import { supabase, type Incident } from '../../lib/supabase';

type Props = {
  currentIncidentId: string;
  reporterName: string | null;
  reporterPhone: string | null;
  riderId: string | null;
  motorcycleId: string | null;
  onOpen?: (incident: Incident) => void;
};

export default function PreviousReports({ currentIncidentId, reporterName, reporterPhone, riderId, motorcycleId, onOpen }: Props) {
  const [byReporter, setByReporter] = useState<Incident[]>([]);
  const [aboutParty, setAboutParty] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const results = await Promise.all([
        (async () => {
          if (!reporterPhone && !reporterName) return [];
          const filters: string[] = [];
          if (reporterPhone) filters.push(`reporter_phone.eq.${reporterPhone}`);
          if (reporterName) filters.push(`reporter_name.eq.${encodeURIComponent(reporterName)}`);
          const { data } = await supabase
            .from('incidents')
            .select('*')
            .or(filters.join(','))
            .neq('id', currentIncidentId)
            .order('created_at', { ascending: false })
            .limit(10);
          return (data as Incident[]) || [];
        })(),
        (async () => {
          if (!riderId && !motorcycleId) return [];
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
          return (data as Incident[]) || [];
        })(),
      ]);
      setByReporter(results[0]);
      setAboutParty(results[1]);
      setLoading(false);
    })();
  }, [currentIncidentId, reporterPhone, reporterName, riderId, motorcycleId]);

  if (loading) return null;
  const total = byReporter.length + aboutParty.length;
  if (total === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-bold text-slate-900">Previous Reports</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{total}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {byReporter.length > 0 && (
            <Section
              title="Reported by this reporter"
              subtitle={`Prior reports filed by ${reporterName || 'this reporter'}.`}
              icon={<User className="h-3.5 w-3.5 text-slate-500" />}
              items={byReporter}
              onOpen={onOpen}
            />
          )}
          {aboutParty.length > 0 && (
            <Section
              title="About this rider or motorcycle"
              subtitle="Prior reports where the same rider or motorcycle is involved."
              icon={<Bike className="h-3.5 w-3.5 text-slate-500" />}
              items={aboutParty}
              onOpen={onOpen}
            />
          )}
        </div>
      )}
    </div>
  );
}

const statusStyle = (s: string | null) => {
  switch (s) {
    case 'resolved': return 'bg-emerald-100 text-emerald-700';
    case 'closed': return 'bg-slate-200 text-slate-700';
    case 'investigating': return 'bg-blue-100 text-blue-700';
    case 'awaiting_evidence': return 'bg-purple-100 text-purple-700';
    default: return 'bg-amber-100 text-amber-700';
  }
};

function Section({
  title,
  subtitle,
  icon,
  items,
  onOpen,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: Incident[];
  onOpen?: (i: Incident) => void;
}) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">{title}</p>
      </div>
      <p className="text-[10px] text-slate-500 mb-2">{subtitle}</p>
      <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {items.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onOpen?.(c)}
              className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-300 hover:shadow-sm transition p-2 group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.case_number && (
                      <span className="text-[9px] font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">
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
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                    <span>{new Date(c.incident_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {c.location && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="h-2.5 w-2.5" />
                        {c.location}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
