import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  Fingerprint,
  ScanLine,
  QrCode,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  FileCheck,
  CreditCard,
  Car,
  Landmark,
  Building2,
  ChevronRight,
  History,
  X,
  Camera,
  UserCircle2,
  Sparkles,
} from 'lucide-react';
import { supabase, type PoliceOfficerWithStation } from '../../lib/supabase';
import { PoliceAuthService } from '../../lib/policeAuth';
import { generateQRCode } from '../../lib/qrcode';

type Props = { officer: PoliceOfficerWithStation };

type QuickType = 'national_id' | 'kra_pin' | 'driving_license' | 'insurance';

type QuickResult = {
  verified: boolean;
  sandbox?: boolean;
  name?: string;
  details?: Record<string, string>;
  error?: string;
};

type IdentitySession = {
  id: string | null;
  session_id: string;
  session_url: string;
  status: string;
  decision: string | null;
  extracted_data: Record<string, unknown> | null;
  face_match_score: number | null;
  liveness_score: number | null;
  risk_flags: unknown[];
};

type LogEntry = {
  id: string;
  verification_type: string;
  document_value: string | null;
  verification_result: string;
  result_details: Record<string, unknown> | null;
  created_at: string;
};

const QUICK_TABS: { id: QuickType; label: string; authority: string; icon: JSX.Element; placeholder: string; hint: string }[] = [
  { id: 'national_id', label: 'National ID', authority: 'IPRS', icon: <CreditCard className="h-4 w-4" />, placeholder: '7 or 8 digit ID number', hint: 'Cross-check against the population register.' },
  { id: 'driving_license', label: 'Driving Licence', authority: 'NTSA', icon: <Car className="h-4 w-4" />, placeholder: 'Licence number', hint: 'Validate class, expiry and endorsements via NTSA TIMS.' },
  { id: 'kra_pin', label: 'KRA PIN', authority: 'KRA', icon: <Landmark className="h-4 w-4" />, placeholder: 'A123456789B', hint: 'Confirm the taxpayer PIN and compliance status.' },
  { id: 'insurance', label: 'Insurance', authority: 'AKI', icon: <Building2 className="h-4 w-4" />, placeholder: 'Policy or registration number', hint: 'Confirm the motor insurance policy is live.' },
];

const STATUS_TONE: Record<string, { chip: string; text: string; icon: JSX.Element }> = {
  Approved: {
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  },
  Declined: {
    chip: 'bg-rose-100 text-rose-800 border-rose-200',
    text: 'text-rose-700',
    icon: <XCircle className="h-4 w-4 text-rose-600" />,
  },
  'In Review': {
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
    text: 'text-amber-700',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  },
  'In Progress': {
    chip: 'bg-blue-100 text-blue-800 border-blue-200',
    text: 'text-blue-700',
    icon: <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />,
  },
  'Not Started': {
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    text: 'text-slate-600',
    icon: <Clock className="h-4 w-4 text-slate-500" />,
  },
};

const FIELD_LABELS: Record<string, string> = {
  document_number: 'Document number',
  id_number: 'ID number',
  national_id: 'National ID',
  first_name: 'First name',
  last_name: 'Last name',
  full_name: 'Full name',
  date_of_birth: 'Date of birth',
  dob: 'Date of birth',
  gender: 'Gender',
  nationality: 'Nationality',
  issuing_country: 'Issuing country',
  document_type: 'Document type',
  issuing_state_name: 'Issuing authority',
  expiry_date: 'Expiry date',
  issue_date: 'Issue date',
  address: 'Address',
  place_of_birth: 'Place of birth',
};

export default function PoliceVerify({ officer }: Props) {
  const [mode, setMode] = useState<'identity' | 'quick'>('identity');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [detailLog, setDetailLog] = useState<LogEntry | null>(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('police_verification_logs')
      .select('id, verification_type, document_value, verification_result, result_details, created_at')
      .eq('officer_id', officer.id)
      .order('created_at', { ascending: false })
      .limit(25);
    setLogs((data ?? []) as LogEntry[]);
    setLoadingLogs(false);
  }, [officer.id]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <div className="space-y-6">
      <VerifyHeader officer={officer} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-5">
          <ModeSwitch mode={mode} onChange={setMode} />
          {mode === 'identity' ? (
            <IdentityVerifyPanel officer={officer} onLogged={loadLogs} />
          ) : (
            <QuickLookupPanel officer={officer} onLogged={loadLogs} />
          )}
        </div>

        <HistorySidebar logs={logs} loading={loadingLogs} onOpen={setDetailLog} onRefresh={loadLogs} />
      </div>

      {detailLog && <LogDetailDrawer log={detailLog} onClose={() => setDetailLog(null)} />}
    </div>
  );
}

/* ------------------------------ header ------------------------------ */

function VerifyHeader({ officer }: { officer: PoliceOfficerWithStation }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm">
      <div aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.25),transparent_60%)]" />
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <ShieldCheck className="h-6 w-6 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300 font-semibold">Field verification</p>
            <h2 className="text-2xl font-bold leading-tight">Verify a rider, owner or document</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Run a live identity check with liveness and face-match, or look up an ID / licence / KRA PIN / insurance policy on the spot.
              Every verification is logged against your service number.
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 md:min-w-[240px]">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Officer</p>
          <p className="text-sm font-semibold text-white mt-0.5">{officer.full_name}</p>
          <p className="text-xs text-slate-300">
            {officer.rank ?? 'Officer'} · Service #{officer.service_number}
          </p>
          <p className="text-xs text-emerald-300 mt-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {officer.station?.name ?? 'Station'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- mode switch --------------------------- */

function ModeSwitch({ mode, onChange }: { mode: 'identity' | 'quick'; onChange: (m: 'identity' | 'quick') => void }) {
  const items = [
    { id: 'identity' as const, title: 'Identity session', subtitle: 'ID capture + liveness + face-match', icon: <Fingerprint className="h-5 w-5" /> },
    { id: 'quick' as const, title: 'Quick number lookup', subtitle: 'IPRS · NTSA · KRA · AKI', icon: <ScanLine className="h-5 w-5" /> },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`text-left rounded-xl border p-4 flex items-start gap-3 transition ${
              active
                ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${active ? 'text-emerald-900' : 'text-slate-900'}`}>{item.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
            </div>
            {active && <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto mt-1" />}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------ identity (didit) ------------------------ */

function IdentityVerifyPanel({ officer, onLogged }: { officer: PoliceOfficerWithStation; onLogged: () => void }) {
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<IdentitySession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const pollStart = useRef<number>(0);
  const loggedRef = useRef<Set<string>>(new Set());

  useEffect(() => () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); }, []);

  const canStart = !!(reference.trim() || phone.trim());

  const start = async () => {
    setStarting(true);
    setError(null);
    setSession(null);
    setQrDataUrl(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-didit-session`;
      const vendor = `officer:${officer.service_number}:${Date.now()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_type: 'prospect',
          role: 'rider',
          vendor_data: vendor,
          created_by: `officer:${officer.service_number}`,
          contact_details: phone.trim() ? { phone: phone.trim() } : undefined,
          metadata: {
            officer_id: officer.id,
            station_id: officer.station_id,
            reference: reference.trim() || null,
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body?.error as string) ?? `Request failed (${res.status})`);

      const s: IdentitySession = {
        id: body.verification_id ?? null,
        session_id: body.session_id,
        session_url: body.url,
        status: 'Not Started',
        decision: null,
        extracted_data: null,
        face_match_score: null,
        liveness_score: null,
        risk_flags: [],
      };
      setSession(s);
      const qr = await generateQRCode(body.url as string).catch(() => null);
      setQrDataUrl(qr);
      poll(s.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start verification');
    } finally {
      setStarting(false);
    }
  };

  const poll = (sid: string) => {
    setPolling(true);
    pollStart.current = Date.now();
    const tick = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-didit-decision`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: sid }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          const { data: row } = await supabase
            .from('identity_verifications')
            .select('id, session_id, session_url, status, decision, extracted_data, face_match_score, liveness_score, risk_flags')
            .eq('session_id', sid)
            .maybeSingle();
          if (row) {
            setSession({
              id: row.id,
              session_id: row.session_id,
              session_url: row.session_url,
              status: row.status,
              decision: row.decision,
              extracted_data: (row.extracted_data ?? null) as Record<string, unknown> | null,
              face_match_score: row.face_match_score,
              liveness_score: row.liveness_score,
              risk_flags: (row.risk_flags ?? []) as unknown[],
            });
            const s = (row.status ?? '').toLowerCase();
            if ((s === 'approved' || s === 'declined' || s.includes('review')) && !loggedRef.current.has(sid)) {
              loggedRef.current.add(sid);
              await PoliceAuthService.logVerification(
                officer.id,
                officer.station_id,
                'identity_didit',
                sid,
                'prospect',
                null,
                s === 'approved' ? 'verified' : 'failed',
                body,
              );
              onLogged();
            }
            if (s === 'approved' || s === 'declined') { setPolling(false); return; }
          }
        }
        if (Date.now() - pollStart.current > 10 * 60 * 1000) { setPolling(false); return; }
        pollTimer.current = window.setTimeout(tick, 4000);
      } catch {
        setPolling(false);
      }
    };
    tick();
  };

  const reset = () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    setSession(null);
    setQrDataUrl(null);
    setError(null);
    setPolling(false);
  };

  const copyLink = async () => {
    if (!session?.session_url) return;
    await navigator.clipboard?.writeText(session.session_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const statusMeta = session ? (STATUS_TONE[session.status] ?? STATUS_TONE['Not Started']) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 1 · Start a session</p>
          <p className="text-sm text-slate-700 mt-1">
            The person on your left completes ID capture, selfie and liveness on their own phone via a hosted flow. You watch progress live.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Phone number <span className="text-slate-400 font-normal">(optional — sends the link via SMS)</span></label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254712345678"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Reference <span className="text-slate-400 font-normal">(optional — plate, incident #, name)</span></label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="KMDL 123A · Incident #C-2088"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {!session && (
          <button
            onClick={start}
            disabled={!canStart || starting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            {starting ? 'Preparing session…' : 'Start identity session'}
          </button>
        )}

        {session && (
          <button
            onClick={reset}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Start a new session
          </button>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 flex items-start gap-2">
            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 min-h-[420px]">
        {!session ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-500">
            <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
              <QrCode className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No active session yet</p>
            <p className="text-xs mt-1 max-w-sm">
              Once you start a session, a QR code and a share link appear here. Hand the phone over or let the person scan the code to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 2 · Live session</p>
                <p className="text-sm text-slate-800 font-semibold mt-0.5">Awaiting the person to complete the flow</p>
                <p className="text-xs text-slate-500 mt-0.5">Session ID · <span className="font-mono">{session.session_id.slice(0, 12)}…</span></p>
              </div>
              {statusMeta && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusMeta.chip}`}>
                  {statusMeta.icon}
                  {session.status}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4 items-start">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Verification QR" className="h-40 w-40" />
                ) : (
                  <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                )}
              </div>
              <div className="space-y-2.5">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Share link</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono text-slate-800 truncate flex-1">{session.session_url}</code>
                    <button onClick={copyLink} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <a href={session.session_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Face match" value={session.face_match_score != null ? `${Math.round(session.face_match_score)}%` : '—'} icon={<UserCircle2 className="h-3.5 w-3.5" />} />
                  <Stat label="Liveness" value={session.liveness_score != null ? `${Math.round(session.liveness_score)}%` : '—'} icon={<Camera className="h-3.5 w-3.5" />} />
                  <Stat label="Risk flags" value={session.risk_flags?.length ? String(session.risk_flags.length) : '0'} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  {polling ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Polling decision every few seconds…</> : <><Clock className="h-3.5 w-3.5" /> Polling paused. Press Check status to resume.</>}
                  {!polling && (
                    <button onClick={() => poll(session.session_id)} className="ml-2 text-emerald-700 font-semibold hover:underline">
                      Check status
                    </button>
                  )}
                </p>
              </div>
            </div>

            {(session.status === 'Approved' || session.status === 'Declined') && (
              <ResultCard session={session} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: JSX.Element }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function ResultCard({ session }: { session: IdentitySession }) {
  const approved = session.status === 'Approved';
  const rows = session.extracted_data ? Object.entries(session.extracted_data).filter(([, v]) => v != null && v !== '') : [];

  return (
    <div className={`rounded-xl border p-4 ${approved ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
      <div className="flex items-center gap-2 mb-3">
        {approved ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
        <p className={`text-sm font-bold ${approved ? 'text-emerald-800' : 'text-rose-800'}`}>
          {approved ? 'Identity verified' : 'Identity declined'}
        </p>
        {session.decision && (
          <span className="text-xs text-slate-600 ml-1">· {session.decision}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">Didit has not returned extracted fields yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {rows.map(([key, value]) => (
            <div key={key} className="text-sm min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}</p>
              <p className="font-medium text-slate-800 truncate">{formatValue(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

/* ------------------------- quick lookup ------------------------- */

function QuickLookupPanel({ officer, onLogged }: { officer: PoliceOfficerWithStation; onLogged: () => void }) {
  const [tab, setTab] = useState<QuickType>('national_id');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuickResult | null>(null);

  const active = useMemo(() => QUICK_TABS.find((t) => t.id === tab)!, [tab]);

  useEffect(() => { setResult(null); setValue(''); }, [tab]);

  const verify = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('verify-documents', {
        body: { type: tab, value: value.trim() },
      });
      if (error) throw new Error(error.message ?? 'Verification service unavailable');
      const r = data as QuickResult;
      setResult(r);
      await PoliceAuthService.logVerification(
        officer.id,
        officer.station_id,
        tab,
        value.trim(),
        'general',
        null,
        r.verified ? 'verified' : 'failed',
        r,
      );
      onLogged();
    } catch (err) {
      const r: QuickResult = { verified: false, error: err instanceof Error ? err.message : 'Verification failed' };
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-100">
        {QUICK_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                active ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={active ? 'text-emerald-600' : 'text-slate-400'}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Verify via {active.authority}</p>
            <p className="text-xs text-slate-500 mt-0.5">{active.hint}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
            <Search className="h-3 w-3" />
            Lookup
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
            placeholder={active.placeholder}
            className="flex-1 px-4 py-3 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            onClick={verify}
            disabled={busy || !value.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 transition"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </div>

        {result && (
          <div className={`rounded-xl border p-5 ${result.verified ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.verified ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
              <p className={`text-sm font-bold ${result.verified ? 'text-emerald-800' : 'text-rose-800'}`}>
                {result.verified ? `${active.authority} record found` : `${active.authority} verification failed`}
              </p>
              {result.sandbox && (
                <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Sandbox
                </span>
              )}
            </div>
            {result.name && (
              <p className="text-sm font-medium text-slate-800 mb-2">Name · <span className="text-slate-900">{result.name}</span></p>
            )}
            {result.details && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                {Object.entries(result.details)
                  .filter(([, v]) => v && v !== '—')
                  .map(([k, v]) => (
                    <div key={k} className="text-sm">
                      <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{FIELD_LABELS[k] ?? k.replace(/_/g, ' ')}</p>
                      <p className="font-medium text-slate-800">{v}</p>
                    </div>
                  ))}
              </div>
            )}
            {result.error && <p className="text-sm text-rose-700 mt-2">{result.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------- history sidebar ----------------------- */

function HistorySidebar({
  logs,
  loading,
  onOpen,
  onRefresh,
}: {
  logs: LogEntry[];
  loading: boolean;
  onOpen: (l: LogEntry) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-900">Recent verifications</p>
        </div>
        <button onClick={onRefresh} className="text-slate-400 hover:text-slate-600 transition" title="Refresh">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>
      <div className="max-h-[540px] overflow-y-auto">
        {logs.length === 0 && !loading ? (
          <div className="px-4 py-10 text-center text-xs text-slate-500">
            <History className="h-6 w-6 mx-auto text-slate-300 mb-2" />
            You haven't run any verifications yet in this shift.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => {
              const passed = log.verification_result === 'verified';
              const label = QUICK_TABS.find((t) => t.id === log.verification_type)?.label
                ?? (log.verification_type === 'identity_didit' ? 'Identity (Didit)' : log.verification_type.replace(/_/g, ' '));
              return (
                <li key={log.id}>
                  <button
                    onClick={() => onOpen(log)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition"
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
                      <p className="text-xs text-slate-500 truncate font-mono">{log.document_value ?? '—'}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[11px] text-slate-500">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 ml-auto mt-0.5" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function LogDetailDrawer({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  const passed = log.verification_result === 'verified';
  const details = log.result_details ?? {};
  const entries = Object.entries(details).filter(([, v]) => v != null && v !== '');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {passed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Verification detail</p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">{log.verification_type.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Value</p>
            <p className="font-mono text-slate-800 mt-1 break-all">{log.document_value ?? '—'}</p>
          </div>
          {entries.length === 0 ? (
            <p className="text-xs text-slate-500">No extra details were returned.</p>
          ) : (
            <div className="space-y-2.5">
              {entries.map(([key, value]) => (
                <div key={key}>
                  <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}</p>
                  <p className="text-slate-800 mt-0.5 break-words">{formatValue(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
