import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Upload, X, FileText, Eye, Loader2, Tag, CheckCircle2, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  fetchAllSamples, upsertSample, deleteSample,
  type DocumentSample,
} from '../lib/documentSamples';
import { DOCUMENT_LABELS, type DocumentType } from '../lib/documentValidation';
import type { DocumentKind } from '../lib/documentMarkers';
import DocumentViewerModal from './DocumentViewerModal';

const DOC_TYPES: DocumentType[] = [
  'national_id', 'driving_license', 'good_conduct',
  'logbook', 'insurance_cover', 'kra_pin_doc',
];

const SAMPLES_BUCKET = 'documents';

type Draft = {
  id?: string;
  document_type: DocumentType;
  document_kind: DocumentKind | null;
  label: string;
  description: string;
  keywords: string;
  file?: File;
  fileUrl?: string;
  fileName?: string;
  active: boolean;
};

const emptyDraft = (): Draft => ({
  document_type: 'national_id',
  document_kind: null,
  label: '',
  description: '',
  keywords: '',
  active: true,
});

export default function DocumentSamplesManager({ currentUsername }: { currentUsername: string }) {
  const [samples, setSamples] = useState<DocumentSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<DocumentSample | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setSamples(await fetchAllSamples());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const g = new Map<DocumentType, DocumentSample[]>();
    for (const t of DOC_TYPES) g.set(t, []);
    for (const s of samples) {
      const arr = g.get(s.document_type) ?? [];
      arr.push(s);
      g.set(s.document_type, arr);
    }
    return g;
  }, [samples]);

  const uploadSampleFile = async (file: File): Promise<{ url: string; name: string } | null> => {
    const ext = file.name.split('.').pop() || 'bin';
    const key = `document-samples/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(SAMPLES_BUCKET).upload(key, file, {
      contentType: file.type || 'application/octet-stream',
    });
    if (upErr) { console.error(upErr); return null; }
    const { data } = supabase.storage.from(SAMPLES_BUCKET).getPublicUrl(key);
    return { url: data.publicUrl, name: file.name };
  };

  const handleSave = async () => {
    if (!drawer) return;
    if (!drawer.label.trim()) { setError('Label is required'); return; }

    setSaving(true);
    setError('');
    let fileUrl = drawer.fileUrl ?? '';
    let fileName = drawer.fileName ?? '';

    if (drawer.file) {
      const up = await uploadSampleFile(drawer.file);
      if (!up) { setError('Failed to upload sample file'); setSaving(false); return; }
      fileUrl = up.url;
      fileName = up.name;
    }

    if (!fileUrl && !drawer.id) {
      setError('Please attach a sample file');
      setSaving(false);
      return;
    }

    const keywords = drawer.keywords.split(/[,\n]/).map(k => k.trim()).filter(Boolean);

    const saved = await upsertSample({
      id: drawer.id,
      document_type: drawer.document_type,
      document_kind: drawer.document_kind,
      label: drawer.label.trim(),
      description: drawer.description.trim() || null,
      file_url: fileUrl,
      file_name: fileName,
      keywords,
      active: drawer.active,
      created_by: currentUsername,
    });

    if (!saved) {
      setError('Failed to save sample');
      setSaving(false);
      return;
    }

    await load();
    setDrawer(null);
    setSaving(false);
  };

  const handleToggleActive = async (sample: DocumentSample) => {
    await upsertSample({ ...sample, active: !sample.active, created_by: sample.created_by ?? currentUsername });
    await load();
  };

  const handleDelete = async (sample: DocumentSample) => {
    if (!confirm(`Delete sample "${sample.label}"? This cannot be undone.`)) return;
    await deleteSample(sample.id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Document Sample Library
            </h4>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Upload reference samples of each accepted document. Extracted keywords are used to guide the OCR
              validator and make it stricter. The more high-quality samples you add, the fewer false uploads
              (screenshots, newspaper clips, unrelated images) will slip through.
            </p>
          </div>
          <button
            onClick={() => { setError(''); setDrawer(emptyDraft()); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" /> Add sample
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading samples…
        </div>
      ) : (
        <div className="space-y-4">
          {DOC_TYPES.map(t => {
            const list = grouped.get(t) ?? [];
            return (
              <div key={t} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{DOCUMENT_LABELS[t]}</p>
                    <p className="text-xs text-slate-500">{list.length} sample{list.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                {list.length === 0 ? (
                  <div className="p-5 text-sm text-slate-400 italic">No samples uploaded yet.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {list.map(s => (
                      <li key={s.id} className="p-4 flex items-start gap-4">
                        <div className="h-14 w-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {/\.(png|jpe?g|webp|gif)$/i.test(s.file_url) ? (
                            <img src={s.file_url} alt={s.label} className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">{s.label}</p>
                            {s.document_kind && (
                              <span className="text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {s.document_kind === 'passport' ? 'Passport' : 'National ID'}
                              </span>
                            )}
                            {!s.active && (
                              <span className="text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">Disabled</span>
                            )}
                          </div>
                          {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                          {s.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {s.keywords.map((kw, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">
                                  <Tag className="h-2.5 w-2.5" /> {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setPreview(s)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(s)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                            title={s.active ? 'Disable' : 'Enable'}
                          >
                            {s.active ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setDrawer({
                              id: s.id,
                              document_type: s.document_type,
                              document_kind: s.document_kind,
                              label: s.label,
                              description: s.description ?? '',
                              keywords: s.keywords.join(', '),
                              fileUrl: s.file_url,
                              fileName: s.file_name ?? '',
                              active: s.active,
                            })}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                            title="Edit"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {drawer && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4" onClick={() => !saving && setDrawer(null)}>
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{drawer.id ? 'Edit sample' : 'Add document sample'}</h3>
              <button onClick={() => setDrawer(null)} disabled={saving} className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-50">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-2 text-sm">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Document type</label>
                <select
                  value={drawer.document_type}
                  onChange={e => setDrawer({ ...drawer, document_type: e.target.value as DocumentType })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {DOC_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_LABELS[t]}</option>)}
                </select>
              </div>
              {drawer.document_type === 'national_id' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Kind</label>
                  <div className="flex gap-2">
                    {([null, 'national_id', 'passport'] as (DocumentKind | null)[]).map(k => (
                      <button
                        key={String(k)}
                        onClick={() => setDrawer({ ...drawer, document_kind: k })}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${drawer.document_kind === k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-300'}`}
                      >
                        {k === null ? 'Both' : k === 'passport' ? 'Passport' : 'National ID'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Label</label>
                <input
                  value={drawer.label}
                  onChange={e => setDrawer({ ...drawer, label: e.target.value })}
                  placeholder="e.g. Alpha-series National ID front"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <textarea
                  value={drawer.description}
                  onChange={e => setDrawer({ ...drawer, description: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Keywords <span className="text-slate-400 font-normal">(comma or newline separated)</span>
                </label>
                <textarea
                  value={drawer.keywords}
                  onChange={e => setDrawer({ ...drawer, keywords: e.target.value })}
                  rows={3}
                  placeholder="e.g. REPUBLIC OF KENYA, SERIAL NUMBER, JAMHURI YA KENYA"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">These strings are treated as additional required markers by the OCR validator.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sample file</label>
                {drawer.fileUrl && !drawer.file && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 mb-2 bg-slate-50 rounded p-2">
                    <FileText className="h-3.5 w-3.5" /> {drawer.fileName || 'current file'}
                  </div>
                )}
                <label className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-emerald-400 transition">
                  <Upload className="h-4 w-4 text-slate-400 mr-2" />
                  <span className="text-sm text-slate-600">{drawer.file ? drawer.file.name : 'Choose image or PDF'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setDrawer({ ...drawer, file: f });
                    }}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={drawer.active}
                  onChange={e => setDrawer({ ...drawer, active: e.target.checked })}
                />
                Active (use to strengthen OCR validation)
              </label>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setDrawer(null)} disabled={saving} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save sample
              </button>
            </div>
          </div>
        </div>
      )}

      <DocumentViewerModal
        open={!!preview}
        onClose={() => setPreview(null)}
        fileUrl={preview?.file_url ?? null}
        fileName={preview?.file_name}
        title={preview?.label}
        documentType={preview?.document_type}
      />
    </div>
  );
}
