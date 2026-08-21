import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, MessageSquarePlus, Reply, Loader2, Send, X } from 'lucide-react';
import { supabase, type IncidentResolution, type IncidentNoteReply } from '../../lib/supabase';

type NoteEntry = {
  key: string;
  isResolution: boolean;
  resolution?: IncidentResolution;
  legacyText?: string;
  legacyTimestamp?: string;
  legacyAuthor?: string;
};

export type NoteActor = {
  id: string | null;
  name: string;
};

type Props = {
  incidentId: string;
  actor: NoteActor;
  legacyNotes: string | null;
  timeline: IncidentResolution[];
  locked: boolean;
  onReplied?: () => void;
};

const LEGACY_LINE = /^\[([^\]]+?)\s+-\s+([^\]]+)\]\s*(.*)$/;

export default function CaseNotes({ incidentId, actor, legacyNotes, timeline, locked, onReplied }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [replies, setReplies] = useState<Record<string, IncidentNoteReply[]>>({});
  const [activeReplyFor, setActiveReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  const noteResolutions = timeline.filter((t) => t.action_type === 'note_added');
  const legacyEntries = parseLegacyNotes(legacyNotes);
  const entries: NoteEntry[] = [
    ...noteResolutions.map((r) => ({ key: `res-${r.id}`, isResolution: true, resolution: r })),
    ...legacyEntries.map((l, i) => ({
      key: `legacy-${i}`,
      isResolution: false,
      legacyText: l.body,
      legacyTimestamp: l.timestamp,
      legacyAuthor: l.author,
    })),
  ].sort((a, b) => {
    const at = a.isResolution ? new Date(a.resolution!.created_at).getTime() : 0;
    const bt = b.isResolution ? new Date(b.resolution!.created_at).getTime() : 0;
    return bt - at;
  });

  useEffect(() => {
    const resolutionIds = noteResolutions.map((r) => r.id);
    if (resolutionIds.length === 0) {
      setReplies({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('incident_note_replies')
        .select('*')
        .in('parent_resolution_id', resolutionIds)
        .order('created_at', { ascending: true });
      const grouped: Record<string, IncidentNoteReply[]> = {};
      for (const r of (data as IncidentNoteReply[]) || []) {
        (grouped[r.parent_resolution_id] ||= []).push(r);
      }
      setReplies(grouped);
    })();
  }, [incidentId, noteResolutions.map((r) => r.id).join(',')]);

  const toggleNote = (key: string) => {
    setExpandedNotes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startReply = (resolutionId: string) => {
    setActiveReplyFor(resolutionId);
    setReplyBody('');
    setExpandedNotes((prev) => ({ ...prev, [`res-${resolutionId}`]: true }));
  };

  const cancelReply = () => {
    setActiveReplyFor(null);
    setReplyBody('');
  };

  const submitReply = async (resolutionId: string) => {
    if (!replyBody.trim()) return;
    setSavingReply(true);
    try {
      const { data, error } = await supabase
        .from('incident_note_replies')
        .insert({
          parent_resolution_id: resolutionId,
          incident_id: incidentId,
          officer_id: actor.id,
          officer_name: actor.name,
          body: replyBody.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      setReplies((prev) => ({
        ...prev,
        [resolutionId]: [...(prev[resolutionId] || []), data as IncidentNoteReply],
      }));
      setReplyBody('');
      setActiveReplyFor(null);
      onReplied?.();
    } finally {
      setSavingReply(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-bold text-slate-900">Case Notes</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {entries.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {entries.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-500 italic">
              No notes on this case yet. Use the Add Note button on the right to log an entry.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const key = entry.key;
                const isOpen = expandedNotes[key] ?? entry.isResolution;
                if (entry.isResolution && entry.resolution) {
                  const res = entry.resolution;
                  const noteReplies = replies[res.id] || [];
                  return (
                    <li key={key} className="px-5 py-3">
                      <button
                        onClick={() => toggleNote(key)}
                        className="w-full text-left flex items-start gap-2 group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-slate-900">{res.actor_name || 'Officer'}</p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(res.created_at).toLocaleString('en-KE', {
                                day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                              })}
                            </p>
                            {noteReplies.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-0.5">
                                <Reply className="h-2.5 w-2.5" /> {noteReplies.length}
                              </span>
                            )}
                          </div>
                          {!isOpen && res.notes && (
                            <p className="text-xs text-slate-600 mt-1 line-clamp-1">{res.notes}</p>
                          )}
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="mt-2 pl-9">
                          {res.notes && (
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{res.notes}</p>
                          )}
                          {noteReplies.length > 0 && (
                            <ul className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3">
                              {noteReplies.map((r) => (
                                <li key={r.id} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-800">{r.officer_name || 'Officer'}</p>
                                    <p className="text-[10px] text-slate-500">
                                      {new Date(r.created_at).toLocaleString('en-KE', {
                                        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                                      })}
                                    </p>
                                  </div>
                                  <p className="text-slate-700 whitespace-pre-wrap mt-0.5 leading-relaxed">{r.body}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                          {!locked && activeReplyFor !== res.id && (
                            <button
                              onClick={() => startReply(res.id)}
                              className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Reply className="h-3 w-3" />
                              Reply to note
                            </button>
                          )}
                          {activeReplyFor === res.id && (
                            <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                              <textarea
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                rows={2}
                                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded resize-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Add a reply or follow-up..."
                                autoFocus
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => submitReply(res.id)}
                                  disabled={savingReply || !replyBody.trim()}
                                  className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-semibold rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {savingReply ? (
                                    <><Loader2 className="h-3 w-3 animate-spin" /> Posting...</>
                                  ) : (
                                    <><Send className="h-3 w-3" /> Post reply</>
                                  )}
                                </button>
                                <button
                                  onClick={cancelReply}
                                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 text-[11px] font-semibold rounded hover:bg-slate-50 flex items-center gap-1"
                                >
                                  <X className="h-3 w-3" /> Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={key} className="px-5 py-3">
                    <button
                      onClick={() => toggleNote(key)}
                      className="w-full text-left flex items-start gap-2 group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-slate-800">{entry.legacyAuthor || 'Legacy note'}</p>
                          <p className="text-[10px] text-slate-500">{entry.legacyTimestamp}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider">Legacy</span>
                        </div>
                        {!isOpen && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1">{entry.legacyText}</p>
                        )}
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap mt-2 pl-9 leading-relaxed">{entry.legacyText}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function parseLegacyNotes(text: string | null): { timestamp: string; author: string; body: string }[] {
  if (!text) return [];
  const chunks: { timestamp: string; author: string; body: string }[] = [];
  const rawLines = text.split(/\n(?=\[)/);
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const [firstLine, ...restLines] = trimmed.split('\n');
    const match = firstLine.match(LEGACY_LINE);
    if (match) {
      chunks.push({
        timestamp: match[1].trim(),
        author: match[2].trim(),
        body: [match[3].trim(), ...restLines].join('\n').trim(),
      });
    } else {
      chunks.push({ timestamp: '', author: 'Unknown', body: trimmed });
    }
  }
  return chunks;
}
