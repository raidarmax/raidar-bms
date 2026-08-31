import { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { IncidentResolution } from '../../lib/supabase';
import { getTimelineIcon } from './timelineIcons';

type Props = {
  timeline: IncidentResolution[];
};

export default function CaseTimeline({ timeline }: Props) {
  const [expanded, setExpanded] = useState(true);

  if (timeline.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-bold text-slate-900">Case Timeline</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {timeline.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {expanded && (
        <ol className="px-5 py-3 space-y-3 max-h-96 overflow-y-auto border-t border-slate-100">
          {timeline.map((t, i) => {
            const style = getTimelineIcon(t.action_type);
            const Icon = style.Icon;
            const isLast = i === timeline.length - 1;
            return (
              <li key={t.id} className="relative flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.text} flex items-center justify-center`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-slate-900">{style.label}</p>
                    {t.from_status && t.to_status && t.from_status !== t.to_status && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {t.from_status.replace(/_/g, ' ')} to {t.to_status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(t.created_at).toLocaleString('en-KE', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                    {(t.actor_name || t.actor_type) && ` - ${t.actor_name || t.actor_type}`}
                  </p>
                  {t.notes && (
                    <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-snug">{t.notes}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
