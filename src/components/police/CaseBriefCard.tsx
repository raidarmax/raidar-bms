import { useEffect, useState } from 'react';
import { AlertCircle, ListChecks, RefreshCw, Loader2, ShieldAlert, Flame, Info, ChevronDown, ChevronUp, BrainCircuit } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Brief = {
  priority: 'critical' | 'high' | 'medium' | 'low';
  priority_reason: string;
  headline: string;
  narrative: string[];
  key_facts: { label: string; value: string }[];
  red_flags: string[];
  next_steps: string[];
  generated_at: string;
};

type Props = { incidentId: string; isClosed?: boolean };

const PRIORITY_STYLES: Record<Brief['priority'], { chip: string; bar: string; icon: any; label: string; dot: string }> = {
  critical: { chip: 'bg-red-100 text-red-800 border-red-200', bar: 'bg-red-500', icon: Flame, label: 'Critical', dot: 'bg-red-500' },
  high: { chip: 'bg-amber-100 text-amber-800 border-amber-200', bar: 'bg-amber-500', icon: ShieldAlert, label: 'High priority', dot: 'bg-amber-500' },
  medium: { chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', bar: 'bg-emerald-500', icon: Info, label: 'Medium priority', dot: 'bg-emerald-500' },
  low: { chip: 'bg-slate-100 text-slate-700 border-slate-200', bar: 'bg-slate-400', icon: Info, label: 'Low priority', dot: 'bg-slate-400' },
};

export default function CaseBriefCard({ incidentId, isClosed = false }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);

  const fetchBrief = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-case-brief', {
        body: { incident_id: incidentId },
      });
      if (fnErr) throw fnErr;
      if (!data?.success) throw new Error(data?.error || 'Unable to generate brief.');
      setBrief(data.brief as Brief);
    } catch (err: any) {
      setError(err?.message || 'Unable to generate brief.');
      setBrief(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrief();
  }, [incidentId]);

  const style = brief ? PRIORITY_STYLES[brief.priority] : PRIORITY_STYLES.medium;
  const PriorityIcon = style.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1 ${style.bar}`} />
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-blue-500 to-cyan-400 flex items-center justify-center shadow-md ring-2 ring-white">
              <BrainCircuit className="h-5 w-5 text-white drop-shadow" strokeWidth={2.25} />
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 ring-2 ring-white flex items-center justify-center">
              <span className="text-[7px] font-black text-white leading-none">AI</span>
            </span>
            <span className="absolute inset-0 rounded-xl ring-2 ring-fuchsia-400/30 animate-pulse pointer-events-none" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-widest font-bold bg-gradient-to-r from-fuchsia-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              BMS AI Case Brief
            </p>
            <p className="text-sm font-bold text-slate-900 truncate">
              {brief ? brief.headline : loading ? 'Analysing case...' : error ? 'Brief unavailable' : 'BMS Intelligence'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {brief && (
            <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${style.chip}`}>
              <PriorityIcon className="h-3 w-3" />
              {style.label}
            </span>
          )}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); fetchBrief(); }}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
            title="Regenerate brief"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {loading && !brief && (
            <div className="p-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing case...
            </div>
          )}

          {error && !brief && (
            <div className="p-5 text-sm text-red-700 bg-red-50 border-t border-red-100 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Couldn't generate brief</p>
                <p className="text-red-600 text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {brief && (
            <div className="p-5 space-y-4">
              {brief.priority_reason && (
                <div className="flex items-start gap-2 text-xs text-slate-600">
                  <span className={`inline-flex sm:hidden items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.chip} flex-shrink-0`}>
                    <PriorityIcon className="h-3 w-3" />
                    {style.label}
                  </span>
                  <p className="italic leading-snug"><span className="font-semibold text-slate-700">Why:</span> {brief.priority_reason}</p>
                </div>
              )}

              {brief.key_facts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {brief.key_facts.map((f, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{f.label}</p>
                      <p className="text-xs text-slate-900 font-semibold truncate" title={f.value}>{f.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 text-sm text-slate-700 leading-relaxed">
                {brief.narrative.map((p, i) => (
                  <p key={i} className="whitespace-pre-wrap">{p}</p>
                ))}
              </div>

              {brief.red_flags.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Red Flags ({brief.red_flags.length})
                  </p>
                  <ul className="space-y-1">
                    {brief.red_flags.map((r, i) => (
                      <li key={i} className="text-xs text-red-800 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">-</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.next_steps.length > 0 && !isClosed && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <ListChecks className="h-3.5 w-3.5" />
                    Recommended Next Steps
                  </p>
                  <ol className="space-y-1.5">
                    {brief.next_steps.map((s, i) => (
                      <li key={i} className="text-xs text-emerald-900 flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-right">
                Generated {new Date(brief.generated_at).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
