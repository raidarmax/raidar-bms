import { useState } from 'react';
import { RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  revalidateDocument, DOCUMENT_LABELS,
  type DocumentType, type DocumentValidationResult,
} from '../lib/documentValidation';
import { getExpiryStatus, formatDaysRemaining, formatDate } from '../lib/documentValidation';

type DocumentRevalidateButtonProps = {
  userType: 'rider' | 'owner';
  userId: string;
  documentType: DocumentType;
  fileUrl: string;
  fileName?: string;
  expectedName?: string;
  expectedIdNumber?: string;
  expectedPlateNumber?: string;
  knownExpiryDate?: string | null;
  onRevalidated?: (result: DocumentValidationResult) => void;
  size?: 'sm' | 'md';
};

export default function DocumentRevalidateButton({
  userType, userId, documentType, fileUrl, fileName,
  expectedName, expectedIdNumber, expectedPlateNumber, knownExpiryDate,
  onRevalidated, size = 'sm',
}: DocumentRevalidateButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<DocumentValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!fileUrl) return null;

  const handleRevalidate = async () => {
    setState('loading');
    setProgress(0);
    setErrorMsg('');
    setResult(null);

    const res = await revalidateDocument({
      userType, userId, documentType, fileUrl,
      fileName: fileName ?? DOCUMENT_LABELS[documentType],
      expectedName, expectedIdNumber, expectedPlateNumber, knownExpiryDate,
    }, (p) => setProgress(p));

    if (res.success && res.result) {
      setResult(res.result);
      setState('done');
      onRevalidated?.(res.result);
    } else {
      setErrorMsg(res.error ?? 'Re-validation failed.');
      setState('error');
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1 text-xs gap-1'
    : 'px-3 py-1.5 text-sm gap-1.5';

  return (
    <div className="space-y-2">
      <button
        onClick={handleRevalidate}
        disabled={state === 'loading'}
        className={`inline-flex items-center ${sizeClasses} font-medium rounded-lg border transition-colors ${
          state === 'loading'
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait'
            : state === 'done'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : state === 'error'
            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
        }`}
      >
        {state === 'loading' ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress > 0 ? `${progress}%` : 'Re-validating...'}
          </>
        ) : state === 'done' ? (
          <>
            <CheckCircle className="h-3 w-3" />
            Re-validated
          </>
        ) : state === 'error' ? (
          <>
            <AlertCircle className="h-3 w-3" />
            Failed — Retry
          </>
        ) : (
          <>
            <RefreshCw className="h-3 w-3" />
            Re-validate
          </>
        )}
      </button>

      {state === 'loading' && progress > 0 && (
        <div className="w-full bg-slate-200 rounded-full h-1">
          <div
            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {state === 'done' && result && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={result.status} />
            {result.expiryDate && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                getExpiryStatus(result.expiryDate) === 'expired'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : getExpiryStatus(result.expiryDate) === 'expiring'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {formatDaysRemaining(result.expiryDate)}
              </span>
            )}
          </div>
          {result.summary && (
            <p className="text-xs text-slate-600 leading-relaxed">{result.summary}</p>
          )}
          <div className="space-y-1">
            {result.extractedName && (
              <DetailItem label="Name" value={result.extractedName}
                match={result.fieldMatches?.name} />
            )}
            {result.extractedIdNumber && (
              <DetailItem
                label={documentType === 'bike_photo_back' ? 'Plate' : 'ID/Number'}
                value={result.extractedIdNumber}
                match={result.fieldMatches?.idNumber ?? result.fieldMatches?.plateNumber}
              />
            )}
            {result.issueDate && (
              <DetailItem label="Issue Date" value={formatDate(result.issueDate)} />
            )}
            {result.expiryDate && (
              <DetailItem label="Expiry Date" value={formatDate(result.expiryDate)} />
            )}
          </div>
        </div>
      )}

      {state === 'error' && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    validated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    mismatch: 'bg-red-50 text-red-700 border-red-200',
    expired: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    unreadable: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const icons: Record<string, React.ElementType> = {
    validated: CheckCircle,
    mismatch: XCircle,
    expired: XCircle,
    pending: AlertCircle,
    unreadable: AlertCircle,
  };
  const Icon = icons[status] ?? AlertCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status] ?? styles.pending}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function DetailItem({
  label, value, match,
}: { label: string; value: string; match?: { match: boolean; similarity: number } }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-slate-700">{value}</span>
        {match && (
          <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-semibold ${
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
