import { useEffect, useState } from 'react';
import { Database, Loader2, Play, Trash2, AlertTriangle, CheckCircle2, RefreshCw, History } from 'lucide-react';
import {
  SEGMENTS,
  type SegmentId,
  type DemoBatch,
  generateSegment,
  getDemoCounts,
  listBatches,
  wipeAll,
  wipeSegment,
} from '../lib/demoContent';

type Props = { currentUsername: string; onDataChanged?: () => void };

type Feedback = { kind: 'success' | 'error'; message: string } | null;

export default function DemoContentManager({ currentUsername, onDataChanged }: Props) {
  const [counts, setCounts] = useState<Record<SegmentId, number> | null>(null);
  const [amounts, setAmounts] = useState<Record<SegmentId, number>>(() => {
    const initial: Partial<Record<SegmentId, number>> = {};
    for (const s of SEGMENTS) initial[s.id] = s.defaultCount;
    return initial as Record<SegmentId, number>;
  });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [batches, setBatches] = useState<DemoBatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const [c, b] = await Promise.all([getDemoCounts(), listBatches(15)]);
      setCounts(c);
      setBatches(b);
    } finally {
      setRefreshing(false);
    }
  }

  function setSegmentBusy(key: string, value: boolean) {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate(segment: SegmentId) {
    const count = amounts[segment];
    if (!count || count < 1) {
      setFeedback({ kind: 'error', message: 'Enter a positive count first.' });
      return;
    }
    const key = `gen-${segment}`;
    setSegmentBusy(key, true);
    setFeedback(null);
    try {
      const result = await generateSegment(segment, { count, createdBy: currentUsername });
      setFeedback({
        kind: 'success',
        message: `Created ${result.created} ${segment.replace('_', ' ')} row${result.created === 1 ? '' : 's'}.${result.message ? ` (${result.message})` : ''}`,
      });
      await refresh();
      onDataChanged?.();
    } catch (err: any) {
      setFeedback({ kind: 'error', message: err?.message || `Failed to generate ${segment}` });
    } finally {
      setSegmentBusy(key, false);
    }
  }

  async function handleWipe(segment: SegmentId) {
    if (!window.confirm(`Wipe all demo ${segment.replace('_', ' ')} rows? Real records are not affected.`)) return;
    const key = `wipe-${segment}`;
    setSegmentBusy(key, true);
    setFeedback(null);
    try {
      const { deleted } = await wipeSegment(segment);
      setFeedback({ kind: 'success', message: `Deleted ${deleted} demo ${segment.replace('_', ' ')} row${deleted === 1 ? '' : 's'}.` });
      await refresh();
      onDataChanged?.();
    } catch (err: any) {
      setFeedback({ kind: 'error', message: err?.message || `Failed to wipe ${segment}` });
    } finally {
      setSegmentBusy(key, false);
    }
  }

  async function handleWipeAll() {
    setSegmentBusy('wipe-all', true);
    setFeedback(null);
    try {
      const result = await wipeAll();
      const total = Object.values(result).reduce((a, b) => a + b, 0);
      setFeedback({ kind: 'success', message: `Deleted ${total} demo rows across ${Object.keys(result).length} segments.` });
      setConfirmWipeAll(false);
      await refresh();
      onDataChanged?.();
    } catch (err: any) {
      setFeedback({ kind: 'error', message: err?.message || 'Failed to wipe demo data' });
    } finally {
      setSegmentBusy('wipe-all', false);
    }
  }

  const totalDemo = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Demo Content Manager</h3>
              <p className="text-sm text-blue-100 mt-0.5 max-w-2xl">
                Generate realistic Kenyan demo data for training, screenshots, and QA. Every row is
                flagged so wipes never touch real customer data.
              </p>
              <p className="text-xs text-blue-100/80 mt-2">
                {refreshing ? 'Refreshing...' : `${totalDemo} demo rows across ${SEGMENTS.length} segments`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
            {!confirmWipeAll ? (
              <button
                onClick={() => setConfirmWipeAll(true)}
                disabled={totalDemo === 0}
                className="px-3 py-2 bg-red-500/90 hover:bg-red-500 rounded-lg text-sm font-medium flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Wipe all demo data
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-white/15 rounded-lg px-2 py-1.5">
                <span className="text-xs">Confirm?</span>
                <button
                  onClick={handleWipeAll}
                  disabled={busy['wipe-all']}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                >
                  {busy['wipe-all'] ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, wipe all'}
                </button>
                <button
                  onClick={() => setConfirmWipeAll(false)}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            feedback.kind === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {feedback.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SEGMENTS.map((segment) => {
          const currentCount = counts?.[segment.id] ?? 0;
          const genKey = `gen-${segment.id}`;
          const wipeKey = `wipe-${segment.id}`;
          return (
            <div key={segment.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900">{segment.label}</h4>
                  <p className="text-xs text-slate-500 mt-1">{segment.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{currentCount}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">demo rows</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-500 mb-1">Count to generate</label>
                  <input
                    type="number"
                    min={1}
                    max={segment.maxCount}
                    value={amounts[segment.id]}
                    onChange={(e) =>
                      setAmounts((prev) => ({
                        ...prev,
                        [segment.id]: Math.max(1, Math.min(segment.maxCount, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => handleGenerate(segment.id)}
                  disabled={busy[genKey]}
                  className="mt-5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy[genKey] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Generate
                </button>
                <button
                  onClick={() => handleWipe(segment.id)}
                  disabled={busy[wipeKey] || currentCount === 0}
                  className="mt-5 px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy[wipeKey] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-slate-500" />
          <h4 className="font-semibold text-slate-900">Recent Generation Runs</h4>
        </div>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500">No generation runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="text-left py-2 pr-4 font-medium">When</th>
                  <th className="text-left py-2 pr-4 font-medium">By</th>
                  <th className="text-left py-2 pr-4 font-medium">Segment</th>
                  <th className="text-left py-2 pr-4 font-medium">Requested</th>
                  <th className="text-left py-2 pr-4 font-medium">Created</th>
                  <th className="text-left py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => {
                  const seg = Object.keys(b.segments || {})[0] || '';
                  const req = seg ? b.segments[seg] : '';
                  const created = seg ? b.counts?.[seg] ?? '' : '';
                  return (
                    <tr key={b.id}>
                      <td className="py-2 pr-4 text-slate-600">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-slate-600">{b.created_by || '—'}</td>
                      <td className="py-2 pr-4 text-slate-900">{seg.replace('_', ' ') || '—'}</td>
                      <td className="py-2 pr-4 text-slate-600">{req}</td>
                      <td className="py-2 pr-4 text-slate-900 font-medium">{created}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            b.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : b.status === 'failed'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
