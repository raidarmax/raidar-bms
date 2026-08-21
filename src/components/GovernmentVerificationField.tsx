import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type VerifyType = 'national_id' | 'kra_pin' | 'driving_license';

export interface VerifyResult {
  verified: boolean;
  sandbox: boolean;
  name?: string;
  details?: Record<string, string>;
  error?: string;
}

interface Props {
  label: string;
  type: VerifyType;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onResult: (result: VerifyResult | null) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
}

type Status = 'idle' | 'loading' | 'verified' | 'failed';

const AUTHORITY_LABEL: Record<VerifyType, string> = {
  national_id: 'IPRS',
  kra_pin: 'KRA',
  driving_license: 'NTSA',
};

const DETAIL_LABELS: Record<string, string> = {
  gender: 'Gender',
  dob: 'Date of Birth',
  citizenship: 'Citizenship',
  pin_status: 'PIN Status',
  taxpayer_type: 'Taxpayer Type',
  compliance_status: 'Compliance',
  license_class: 'Class',
  expiry_date: 'Expires',
  status: 'Status',
};

export default function GovernmentVerificationField({
  label, type, value, placeholder, onChange, onResult, disabled, required, hint,
}: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<VerifyResult | null>(null);

  const handleVerify = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setStatus('loading');
    setResult(null);
    onResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-documents', {
        body: { type, value: trimmed },
      });

      if (error) throw new Error(error.message ?? 'Verification service unavailable');

      const r = data as VerifyResult;
      setResult(r);
      setStatus(r.verified ? 'verified' : 'failed');
      onResult(r);
    } catch (err) {
      const r: VerifyResult = {
        verified: false,
        sandbox: false,
        error: err instanceof Error ? err.message : 'Verification service unavailable',
      };
      setResult(r);
      setStatus('failed');
      onResult(r);
    }
  };

  const handleChange = (v: string) => {
    if (status !== 'idle') {
      setStatus('idle');
      setResult(null);
      onResult(null);
    }
    onChange(v);
  };

  const authority = AUTHORITY_LABEL[type];
  const isLocked = status === 'verified';

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || isLocked || status === 'loading'}
            className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors disabled:bg-slate-50 disabled:text-slate-500 ${
              status === 'verified'
                ? 'border-emerald-400 bg-emerald-50 pr-10'
                : status === 'failed'
                ? 'border-red-300 bg-red-50'
                : 'border-slate-300 bg-white'
            }`}
          />
          {status === 'verified' && (
            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
          )}
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={!value.trim() || disabled || isLocked || status === 'loading'}
          className={`shrink-0 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${
            isLocked
              ? 'bg-emerald-100 text-emerald-700 cursor-default'
              : status === 'loading'
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {status === 'loading' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /><span>Verifying…</span></>
          ) : isLocked ? (
            <><CheckCircle className="h-4 w-4" /><span>Verified</span></>
          ) : (
            <><ShieldCheck className="h-4 w-4" /><span>Verify via {authority}</span></>
          )}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm flex gap-2.5 items-start ${
            result.verified
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {result.verified
              ? <CheckCircle className="h-4 w-4 text-emerald-600" />
              : <XCircle className="h-4 w-4 text-red-500" />}
          </span>

          <div className="min-w-0 flex-1">
            {result.verified ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">
                  {result.name && result.name !== 'Simulated IPRS record' &&
                   result.name !== 'Simulated KRA record' &&
                   result.name !== 'Simulated NTSA record'
                    ? result.name
                    : `${authority} record found`}
                </span>

                {result.sandbox && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium border border-amber-200">
                    <AlertTriangle className="h-3 w-3" />
                    Sandbox mode
                  </span>
                )}

                {result.details &&
                  Object.entries(result.details)
                    .filter(([, v]) => v && v !== '—')
                    .map(([k, v]) => (
                      <span key={k} className="text-xs text-emerald-700">
                        <span className="text-emerald-500">{DETAIL_LABELS[k] ?? k}:</span> {v}
                      </span>
                    ))}
              </div>
            ) : (
              <span>{result.error ?? `${authority} verification failed — please check the value entered`}</span>
            )}
          </div>
        </div>
      )}

      {status === 'idle' && !result && value.trim() && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Click "Verify via {authority}" to confirm this {label.toLowerCase()}
        </p>
      )}
    </div>
  );
}
