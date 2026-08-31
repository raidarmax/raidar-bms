import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertCircle, XCircle, Clock, FileText, Eye, X,
  Loader2, Upload, Trash2, Calendar, Hash, User, Award,
  ChevronDown, ChevronUp, ShieldAlert,
} from 'lucide-react';
import {
  validateDocument, saveDocumentValidation, fetchDocumentValidations,
  deleteDocumentValidation, getExpiryStatus, formatDaysRemaining, formatDate,
  preflightDocument,
  DOCUMENT_LABELS, type DocumentType, type DocumentValidationResult,
  type StoredDocumentValidation, type DocumentKind,
} from '../lib/documentValidation';
import type { MarkerCheckResult } from '../lib/documentMarkers';
import { supabase } from '../lib/supabase';
import DocumentViewerModal from './DocumentViewerModal';

type DocConfig = {
  docType: DocumentType;
  label: string;
  accept: string;
  icon: React.ElementType;
  hint?: string;
  /** For National ID slots, allow selecting Passport as an alternative */
  allowPassportToggle?: boolean;
};

type DocumentValidationSummaryProps = {
  userType: 'rider' | 'owner';
  userId: string;
  expectedName?: string;
  expectedIdNumber?: string;
  expectedPlateNumber?: string;
  documents: DocConfig[];
  /** known expiry dates from the profile form, keyed by DocumentType */
  knownExpiryDates?: Partial<Record<DocumentType, string | null>>;
  onValidationComplete?: () => void;
};

export default function DocumentValidationSummary({
  userType, userId, expectedName, expectedIdNumber, expectedPlateNumber, documents, knownExpiryDates,
  onValidationComplete,
}: DocumentValidationSummaryProps) {
  const [validations, setValidations] = useState<StoredDocumentValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; fileName?: string | null; validation?: StoredDocumentValidation | null; docType?: DocumentType } | null>(null);
  const [error, setError] = useState('');
  const [rejection, setRejection] = useState<{ docType: DocumentType; marker: MarkerCheckResult; confidence: number } | null>(null);
  const [idKindByDoc, setIdKindByDoc] = useState<Record<string, DocumentKind>>({});

  const loadValidations = useCallback(async () => {
    setLoading(true);
    const data = await fetchDocumentValidations(userType, userId);
    setValidations(data);
    setLoading(false);
  }, [userType, userId]);

  useEffect(() => { loadValidations(); }, [loadValidations]);

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const filePath = `${path}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file);
    if (upErr) return null;
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
    return publicUrl;
  };

  const handleUpload = async (docType: DocumentType, file: File) => {
    setUploading(docType);
    setProgress(0);
    setError('');
    setRejection(null);

    const documentKind = idKindByDoc[docType] ?? (docType === 'national_id' ? 'national_id' : null);

    try {
      // Pre-flight: reject clearly wrong documents before uploading anything
      const preflight = await preflightDocument(docType, file, documentKind, (p) => setProgress(Math.round(p * 0.5)));
      if (!preflight.ok) {
        setRejection({ docType, marker: preflight.markerCheck, confidence: preflight.ocrConfidence });
        setUploading(null);
        setProgress(0);
        return;
      }

      // Upload file to storage
      const fileUrl = await uploadFile(file, `docval-${userType}-${docType}-${userId}`);
      if (!fileUrl) {
        setError(`Failed to upload ${DOCUMENT_LABELS[docType]}. Please try again.`);
        setUploading(null);
        return;
      }

      // Run full validation (reuses OCR internally)
      const result: DocumentValidationResult = await validateDocument({
        documentType: docType,
        file,
        expectedName,
        expectedIdNumber,
        expectedPlateNumber,
        knownExpiryDate: knownExpiryDates?.[docType] ?? null,
        documentKind,
      }, (p) => setProgress(50 + Math.round(p * 0.5)));

      // Save to database
      const saved = await saveDocumentValidation(
        userType, userId, docType, fileUrl, file.name, result,
      );

      if (saved) {
        setValidations(prev => [saved, ...prev.filter(v => v.document_type !== docType)]);
        onValidationComplete?.();
      } else {
        setError(`Failed to save validation record for ${DOCUMENT_LABELS[docType]}.`);
      }
    } catch (err) {
      console.error('Document validation error:', err);
      setError(`An error occurred while validating ${DOCUMENT_LABELS[docType]}.`);
    } finally {
      setUploading(null);
      setProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteDocumentValidation(id);
    if (ok) {
      setValidations(prev => prev.filter(v => v.id !== id));
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
      validated: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle, label: 'Validated' },
      mismatch: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Mismatch' },
      expired: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Expired' },
      pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Clock, label: 'Pending' },
      unreadable: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', icon: AlertCircle, label: 'Unreadable' },
    };
    const s = styles[status] ?? styles.pending;
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text}`}>
        <Icon className="h-3 w-3" />
        {s.label}
      </span>
    );
  };

  const getExpiryBadge = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const status = getExpiryStatus(expiryDate);
    if (status === 'none') return null;

    const styles: Record<string, string> = {
      valid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      expiring: 'bg-amber-50 text-amber-700 border-amber-200',
      expired: 'bg-red-50 text-red-700 border-red-200',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
        <Calendar className="h-3 w-3" />
        {formatDaysRemaining(expiryDate)}
      </span>
    );
  };

  // Build a map of latest validation per doc type
  const validationByType = new Map<DocumentType, StoredDocumentValidation>();
  for (const v of validations) {
    if (!validationByType.has(v.document_type)) {
      validationByType.set(v.document_type, v);
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {documents.map(({ docType, label, accept, icon: Icon, hint, allowPassportToggle }) => {
          const validation = validationByType.get(docType);
          const isUploading = uploading === docType;
          const currentKind: DocumentKind = idKindByDoc[docType] ?? (docType === 'national_id' ? 'national_id' : 'national_id');

          return (
            <div key={docType} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Upload area */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-slate-500" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  {validation && getStatusBadge(validation.validation_status)}
                </div>

                {!validation && !isUploading && (
                  <>
                    {allowPassportToggle && (
                      <div className="flex gap-1 mb-2 p-0.5 bg-slate-100 rounded-lg">
                        {(['national_id', 'passport'] as DocumentKind[]).map(kind => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => setIdKindByDoc(prev => ({ ...prev, [docType]: kind }))}
                            className={`flex-1 text-xs font-semibold py-1 px-2 rounded transition ${
                              currentKind === kind ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {kind === 'passport' ? 'Passport' : 'National ID'}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="block cursor-pointer">
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-emerald-500 transition-colors">
                        <Upload className="h-5 w-5 text-slate-400 mx-auto mb-1" />
                        <span className="text-xs text-slate-500">Click to upload</span>
                        {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
                      </div>
                      <input
                        type="file"
                        accept={accept}
                        className="sr-only"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(docType, file);
                        }}
                      />
                    </label>
                  </>
                )}

                {isUploading && (
                  <div className="space-y-2 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Validating document...</span>
                      <span className="text-emerald-600 font-semibold">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Reading document...
                    </div>
                  </div>
                )}

                {validation && !isUploading && (
                  <div className="space-y-2">
                    {/* File info */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-600 truncate">
                          {validation.file_name ?? 'Uploaded file'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setViewer({ url: validation.file_url, fileName: validation.file_name, validation, docType })}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(validation.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Summary */}
                    {validation.summary && (
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-600 leading-relaxed">{validation.summary}</p>
                      </div>
                    )}

                    {/* Expiry badge */}
                    {validation.expiry_date && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {getExpiryBadge(validation.expiry_date)}
                        <span className="text-xs text-slate-400">
                          Expires: {formatDate(validation.expiry_date)}
                        </span>
                      </div>
                    )}

                    {/* Expandable details */}
                    <button
                      onClick={() => setExpandedDoc(expandedDoc === validation.id ? null : validation.id)}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition"
                    >
                      {expandedDoc === validation.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {expandedDoc === validation.id ? 'Hide details' : 'View details'}
                    </button>

                    {expandedDoc === validation.id && (
                      <div className="border-t border-slate-100 pt-2 space-y-1.5">
                        {validation.extracted_name && (
                          <DetailRow icon={User} label="Extracted Name" value={validation.extracted_name}
                            match={validation.field_matches?.name} />
                        )}
                        {validation.extracted_id_number && (
                          <DetailRow icon={Hash} label={validation.document_type === 'bike_photo_back' ? 'Detected Plate' : 'Extracted ID/Number'} value={validation.extracted_id_number}
                            match={validation.field_matches?.idNumber ?? validation.field_matches?.plateNumber} />
                        )}
                        {validation.extracted_date_of_birth && (
                          <DetailRow icon={Calendar} label="Date of Birth" value={validation.extracted_date_of_birth} />
                        )}
                        {validation.issue_date && (
                          <DetailRow icon={Calendar} label="Issue Date" value={formatDate(validation.issue_date)} />
                        )}
                        {validation.expiry_date && (
                          <DetailRow icon={Calendar} label="Expiry Date" value={formatDate(validation.expiry_date)} />
                        )}
                        {validation.ocr_confidence != null && (
                          <DetailRow icon={Award} label="OCR Confidence" value={`${Math.round(Number(validation.ocr_confidence))}%`} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading document validations...
        </div>
      )}

      {/* Document viewer modal (image or PDF + summary) */}
      <DocumentViewerModal
        open={!!viewer}
        onClose={() => setViewer(null)}
        fileUrl={viewer?.url ?? null}
        fileName={viewer?.fileName}
        documentType={viewer?.docType}
        validation={viewer?.validation}
      />

      {/* Pre-upload rejection modal */}
      {rejection && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-4" onClick={() => setRejection(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Document rejected</h3>
                <p className="text-xs text-slate-500">{DOCUMENT_LABELS[rejection.docType]}</p>
              </div>
              <button onClick={() => setRejection(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4 text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700">
                This file does not appear to be a valid {DOCUMENT_LABELS[rejection.docType]}. It was not uploaded.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {rejection.marker.reason}
              </div>
              {rejection.marker.missingMarkers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Missing markers</p>
                  <ul className="space-y-1">
                    {rejection.marker.missingMarkers.map(m => (
                      <li key={m} className="text-xs text-slate-600 flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" /> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rejection.marker.matchedMarkers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Detected</p>
                  <ul className="space-y-1">
                    {rejection.marker.matchedMarkers.map(m => (
                      <li key={m} className="text-xs text-slate-600 flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0" /> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-500">
                OCR confidence: {Math.round(rejection.confidence)}%. Please upload the actual document — not a screenshot, newspaper clip, or unrelated image.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
              <button onClick={() => setRejection(null)} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800">
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value, match,
}: { icon: React.ElementType; label: string; value: string; match?: { match: boolean; similarity: number } }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon className="h-3 w-3 flex-shrink-0" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-700 text-right">{value}</span>
        {match && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            match.match ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            {match.match ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
            {match.match ? 'Match' : `${match.similarity}%`}
          </span>
        )}
      </div>
    </div>
  );
}
