import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle, XCircle, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type DiditSubjectType = 'owner' | 'rider' | 'officer' | 'prospect' | 'business';
export type DiditRole = 'rider' | 'owner' | 'business';

interface Props {
  subjectType: DiditSubjectType;
  subjectId?: string | null;
  role?: DiditRole;
  vendorData?: string;
  createdBy?: string;
  expectedDetails?: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    id_country?: string;
    expected_document_types?: string[];
  };
  contactDetails?: {
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
  label?: string;
  helperText?: string;
  onCompleted?: (result: {
    verification_id: string | null;
    session_id: string;
    status: string;
    decision: string | null;
  }) => void;
}

type Phase = 'idle' | 'creating' | 'in_progress' | 'polling' | 'approved' | 'declined' | 'review' | 'error';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const STATUS_META: Record<string, { tone: string; icon: JSX.Element; label: string }> = {
  Approved: {
    tone: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
    label: 'Verified',
  },
  Declined: {
    tone: 'bg-red-50 border-red-200 text-red-700',
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    label: 'Declined',
  },
  'In Review': {
    tone: 'bg-amber-50 border-amber-200 text-amber-700',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    label: 'In review',
  },
  'In Progress': {
    tone: 'bg-blue-50 border-blue-200 text-blue-700',
    icon: <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />,
    label: 'In progress',
  },
};

export default function DiditVerificationButton({
  subjectType,
  subjectId,
  role,
  vendorData,
  createdBy,
  expectedDetails,
  contactDetails,
  metadata,
  label,
  helperText,
  onCompleted,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const pollStart = useRef<number>(0);

  useEffect(() => () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    (async () => {
      const { data } = await supabase
        .from('identity_verifications')
        .select('id, session_id, session_url, status, decision')
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setVerificationId(data.id);
        setSessionId(data.session_id);
        setSessionUrl(data.session_url);
        setStatus(data.status);
        setDecision(data.decision);
        const s = (data.status ?? '').toLowerCase();
        if (s === 'approved') setPhase('approved');
        else if (s === 'declined') setPhase('declined');
        else if (s.includes('review')) setPhase('review');
        else if (data.session_url) setPhase('in_progress');
      }
    })();
  }, [subjectType, subjectId]);

  const startSession = async () => {
    setPhase('creating');
    setError(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-didit-session`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_type: subjectType,
          subject_id: subjectId ?? null,
          role,
          vendor_data: vendorData,
          created_by: createdBy,
          expected_details: expectedDetails,
          contact_details: contactDetails,
          metadata,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body?.error as string) ?? `Request failed (${res.status})`);
      }
      setSessionId(body.session_id ?? null);
      setSessionUrl(body.url ?? null);
      setVerificationId(body.verification_id ?? null);
      setStatus('Not Started');
      setPhase('in_progress');
      if (body.url) window.open(body.url as string, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start verification';
      setError(msg);
      setPhase('error');
    }
  };

  const pollDecision = async () => {
    if (!sessionId) return;
    setPhase('polling');
    setError(null);
    pollStart.current = Date.now();

    const tick = async () => {
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-didit-decision`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body?.error as string) ?? `Request failed (${res.status})`);

        const nextStatus = String(body.status ?? '');
        const nextDecision = body.decision ? String(body.decision) : null;
        setStatus(nextStatus);
        setDecision(nextDecision);

        const s = nextStatus.toLowerCase();
        if (s === 'approved') {
          setPhase('approved');
          onCompleted?.({ verification_id: verificationId, session_id: sessionId, status: nextStatus, decision: nextDecision });
          return;
        }
        if (s === 'declined') { setPhase('declined'); return; }
        if (s.includes('review')) { setPhase('review'); return; }

        if (Date.now() - pollStart.current > POLL_TIMEOUT_MS) {
          setPhase('in_progress');
          return;
        }
        pollTimer.current = window.setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Status check failed');
        setPhase('error');
      }
    };

    tick();
  };

  const meta = status ? STATUS_META[status] : null;
  const isTerminal = phase === 'approved' || phase === 'declined';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{label ?? 'Verify identity with Didit'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {helperText ?? 'Capture your ID, take a selfie for liveness, and receive a real-time verification decision.'}
          </p>
        </div>
        {meta && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.tone}`}>
            {meta.icon}
            {meta.label}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isTerminal && decision && (
        <p className="text-xs text-slate-500">Decision: <span className="font-medium text-slate-700">{decision}</span></p>
      )}

      <div className="flex flex-wrap gap-2">
        {phase === 'idle' && !sessionUrl && (
          <button
            type="button"
            onClick={startSession}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition"
          >
            <ShieldCheck className="h-4 w-4" />
            Start verification
          </button>
        )}

        {phase === 'creating' && (
          <button type="button" disabled className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting…
          </button>
        )}

        {sessionUrl && !isTerminal && (
          <>
            <a
              href={sessionUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
            >
              <ExternalLink className="h-4 w-4" />
              Open verification
            </a>
            <button
              type="button"
              onClick={pollDecision}
              disabled={phase === 'polling'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-50"
            >
              {phase === 'polling' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {phase === 'polling' ? 'Checking…' : 'Check status'}
            </button>
          </>
        )}

        {phase === 'declined' && (
          <button
            type="button"
            onClick={startSession}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Retry verification
          </button>
        )}
      </div>
    </div>
  );
}
