import { useEffect, useMemo, useState } from 'react';
import { X, FileText, User, Hash, Calendar, Award, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Loader2, Download } from 'lucide-react';
import { isPdfUrl } from '../lib/pdfReader';
import { DOCUMENT_LABELS, type DocumentType, type StoredDocumentValidation, formatDate } from '../lib/documentValidation';

type DocumentViewerModalProps = {
  open: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName?: string | null;
  title?: string;
  documentType?: DocumentType;
  validation?: StoredDocumentValidation | null;
};

export default function DocumentViewerModal({
  open, onClose, fileUrl, fileName, title, documentType, validation,
}: DocumentViewerModalProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => { setShowRaw(false); setPdfError(false); setImgError(false); }, [fileUrl]);

  const isPdf = useMemo(() => (fileUrl ? isPdfUrl(fileUrl) : false), [fileUrl]);

  if (!open || !fileUrl) return null;

  const headerTitle = title
    ?? (documentType ? DOCUMENT_LABELS[documentType] : 'Document Viewer');

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{headerTitle}</h3>
              {fileName && <p className="text-xs text-slate-500 truncate">{fileName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={fileUrl}
              download={fileName ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Document preview */}
          <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-3">
            {isPdf ? (
              pdfError ? (
                <PdfFallback fileUrl={fileUrl} />
              ) : (
                <object
                  data={`${fileUrl}#toolbar=1&view=FitH`}
                  type="application/pdf"
                  className="w-full h-full min-h-[70vh] rounded"
                  onError={() => setPdfError(true)}
                >
                  <PdfFallback fileUrl={fileUrl} />
                </object>
              )
            ) : imgError ? (
              <div className="text-slate-300 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8" />
                Preview unavailable. <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="underline text-emerald-300">Open in new tab</a>
              </div>
            ) : (
              <img
                src={fileUrl}
                alt={headerTitle}
                className="max-w-full max-h-[75vh] object-contain rounded shadow-lg"
                onError={() => setImgError(true)}
              />
            )}
          </div>

          {/* Sidebar summary */}
          {validation ? (
            <aside className="w-full md:w-[360px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-white overflow-y-auto">
              <SummaryPanel validation={validation} showRaw={showRaw} setShowRaw={setShowRaw} />
            </aside>
          ) : (
            <aside className="w-full md:w-[300px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-white p-5 text-sm text-slate-500 overflow-y-auto">
              <div className="flex items-center gap-2 text-slate-700 font-semibold mb-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Document
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isPdf ? 'PDF document.' : 'Image document.'} No extracted summary is available for this file.
              </p>
              {documentType && (
                <p className="text-xs text-slate-400 mt-3">Type: {DOCUMENT_LABELS[documentType]}</p>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function PdfFallback({ fileUrl }: { fileUrl: string }) {
  return (
    <iframe
      src={fileUrl}
      title="PDF document"
      className="w-full h-full min-h-[70vh] rounded bg-white"
    />
  );
}

function SummaryPanel({
  validation, showRaw, setShowRaw,
}: { validation: StoredDocumentValidation; showRaw: boolean; setShowRaw: (v: boolean) => void }) {
  const statusStyles: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    validated: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle, label: 'Validated' },
    mismatch: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Field Mismatch' },
    expired: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Expired' },
    pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Loader2, label: 'Pending Review' },
    unreadable: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', icon: AlertCircle, label: 'Unreadable' },
  };
  const s = statusStyles[validation.validation_status] ?? statusStyles.pending;
  const Icon = s.icon;

  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide font-bold text-slate-400">Extracted Summary</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text}`}>
            <Icon className="h-3 w-3" /> {s.label}
          </span>
        </div>
        <h4 className="text-base font-bold text-slate-900">{DOCUMENT_LABELS[validation.document_type]}</h4>
        {validation.document_kind && (
          <p className="text-xs text-slate-500 mt-0.5">Type: {validation.document_kind === 'passport' ? 'Passport' : 'National ID'}</p>
        )}
        {validation.summary && (
          <p className="text-xs text-slate-600 leading-relaxed mt-2">{validation.summary}</p>
        )}
      </div>

      <div className="space-y-2">
        {validation.extracted_name && (
          <SummaryRow icon={User} label="Name" value={validation.extracted_name} match={validation.field_matches?.name} />
        )}
        {validation.extracted_id_number && (
          <SummaryRow
            icon={Hash}
            label={validation.document_kind === 'passport' ? 'Passport No.'
              : validation.document_type === 'bike_photo_back' ? 'Plate No.'
              : validation.document_type === 'kra_pin_doc' ? 'KRA PIN'
              : validation.document_type === 'driving_license' ? 'Licence No.'
              : 'ID Number'}
            value={validation.extracted_id_number}
            match={validation.field_matches?.idNumber ?? validation.field_matches?.plateNumber}
          />
        )}
        {validation.extracted_date_of_birth && (
          <SummaryRow icon={Calendar} label="Date of Birth" value={validation.extracted_date_of_birth} />
        )}
        {validation.issue_date && (
          <SummaryRow icon={Calendar} label="Issue Date" value={formatDate(validation.issue_date) || validation.issue_date} />
        )}
        {validation.expiry_date && (
          <SummaryRow icon={Calendar} label="Expiry Date" value={formatDate(validation.expiry_date) || validation.expiry_date} />
        )}
        {validation.ocr_confidence != null && (
          <SummaryRow icon={Award} label="OCR Confidence" value={`${Math.round(Number(validation.ocr_confidence))}%`} />
        )}
      </div>

      {validation.raw_text && (
        <div className="pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showRaw ? 'Hide raw OCR text' : 'Show raw OCR text'}
          </button>
          {showRaw && (
            <pre className="mt-2 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">
              {validation.raw_text}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  icon: Icon, label, value, match,
}: { icon: React.ElementType; label: string; value: string; match?: { match: boolean; similarity: number } }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-right">
        <span className="font-semibold text-slate-800 break-all">{value}</span>
        {match && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${match.match ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {match.match ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
            {match.match ? '✓' : `${match.similarity}%`}
          </span>
        )}
      </div>
    </div>
  );
}
