import { useEffect, useState } from 'react';
import {
  X,
  ArrowRightLeft,
  Phone,
  Search,
  ShieldAlert,
  Loader,
  CheckCircle,
  AlertTriangle,
  User,
  KeyRound,
  Bike,
} from 'lucide-react';
import { supabase, type Motorcycle, type Owner, type Incident } from '../lib/supabase';
import { sendOtp, verifyOtp } from '../lib/otp';
import { isIncidentUnresolved } from './MotorcycleIncidentsSection';

type Props = {
  motorcycle: Motorcycle;
  currentOwner: Owner;
  onClose: () => void;
  onTransferred: () => void;
};

type Step = 'check' | 'recipient' | 'otp' | 'transferring' | 'success';

function normalizePhone(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '');
  if (s.startsWith('+254')) return s;
  if (s.startsWith('254')) return '+' + s;
  if (s.startsWith('0')) return '+254' + s.slice(1);
  return '+254' + s;
}

export default function BikeTransferModal({ motorcycle, currentOwner, onClose, onTransferred }: Props) {
  const [step, setStep] = useState<Step>('check');
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [unresolved, setUnresolved] = useState<Incident[]>([]);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipient, setRecipient] = useState<Owner | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .eq('motorcycle_id', motorcycle.id);
      if (cancelled) return;
      setUnresolved((data || []).filter((i: Incident) => isIncidentUnresolved(i.status)));
      setLoadingIncidents(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [motorcycle.id]);

  const canProceed = !loadingIncidents && unresolved.length === 0;

  const handleLookup = async () => {
    setError(null);
    const normalized = normalizePhone(recipientPhone);
    if (!/^\+254[17]\d{8}$/.test(normalized)) {
      setError('Enter a valid Kenyan phone number (e.g., +254712345678).');
      return;
    }
    if (normalized === normalizePhone(currentOwner.phone_number)) {
      setError('You cannot transfer a bike to yourself.');
      return;
    }
    setLookingUp(true);
    const { data, error: err } = await supabase
      .from('owners')
      .select('*')
      .eq('phone_number', normalized)
      .maybeSingle();
    setLookingUp(false);
    if (err) {
      setError('Lookup failed: ' + err.message);
      return;
    }
    if (!data) {
      setError('No registered owner found with that phone number. The recipient must be registered first.');
      return;
    }
    setRecipient(data as Owner);
  };

  const handleSendOtp = async () => {
    if (!recipient) return;
    setOtpSending(true);
    setError(null);
    const res = await sendOtp(recipient.phone_number);
    setOtpSending(false);
    if (!res.success) {
      setError(res.error || 'Failed to send OTP.');
      return;
    }
    setOtpSent(true);
    setStep('otp');
  };

  const handleVerifyAndTransfer = async () => {
    if (!recipient) return;
    setError(null);
    if (!/^\d{4,8}$/.test(otpCode.trim())) {
      setError('Enter the OTP code sent to the recipient.');
      return;
    }
    setVerifying(true);
    const ok = await verifyOtp(recipient.phone_number, otpCode.trim());
    if (!ok) {
      setVerifying(false);
      setError('Invalid or expired OTP. Ask the recipient to resend if needed.');
      return;
    }

    setStep('transferring');
    try {
      const now = new Date().toISOString();

      const { data: assignedRider } = await supabase
        .from('riders')
        .select('id, name, id_number')
        .eq('motorcycle_id', motorcycle.id)
        .eq('assignment_status', 'Assigned')
        .maybeSingle();

      if (assignedRider) {
        await supabase
          .from('rider_history')
          .update({ removed_at: now, removal_reason: 'Bike ownership transferred' })
          .eq('motorcycle_id', motorcycle.id)
          .eq('rider_id', assignedRider.id)
          .is('removed_at', null);

        await supabase
          .from('riders')
          .update({ assignment_status: 'Unassigned', motorcycle_id: null })
          .eq('id', assignedRider.id);
      }

      await supabase
        .from('assignment_requests')
        .update({ status: 'Rejected', responded_at: now })
        .eq('motorcycle_id', motorcycle.id)
        .eq('status', 'Pending');

      const { error: updateErr } = await supabase
        .from('motorcycles')
        .update({ owner_id: recipient.id })
        .eq('id', motorcycle.id);

      if (updateErr) throw updateErr;

      setStep('success');
      setTimeout(() => {
        onTransferred();
      }, 1800);
    } catch (e: any) {
      console.error('Transfer failed', e);
      setError('Transfer failed: ' + (e?.message || 'Unknown error'));
      setStep('recipient');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Transfer Motorcycle</h2>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Bike className="h-3.5 w-3.5" />
                <span className="font-mono">{motorcycle.registration_number}</span>
              </p>
            </div>
          </div>
          {step !== 'transferring' && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {step === 'check' && (
            <>
              {loadingIncidents ? (
                <div className="flex items-center justify-center py-10">
                  <Loader className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-slate-600">Checking bike status...</span>
                </div>
              ) : unresolved.length > 0 ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-900">
                        Transfer blocked - {unresolved.length} unresolved incident
                        {unresolved.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-red-800 mt-1">
                        This bike has open incidents. Resolve them with the authorities before you can transfer ownership.
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {unresolved.slice(0, 5).map((i) => (
                          <li key={i.id} className="text-xs text-red-800 bg-white/50 rounded-md px-2 py-1.5">
                            <span className="font-semibold capitalize">
                              {i.incident_type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-red-600 ml-2">
                              - {new Date(i.incident_date).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Bike is eligible for transfer</p>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        No unresolved incidents found on this motorcycle.
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-900">
                      Once transferred, this bike will belong to the new owner. Any assigned rider will
                      be unassigned. This action cannot be undone from your account.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {step === 'recipient' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Recipient Owner Phone Number
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => {
                        setRecipientPhone(e.target.value);
                        setRecipient(null);
                        setError(null);
                      }}
                      disabled={!!recipient}
                      placeholder="+254712345678"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  {recipient ? (
                    <button
                      onClick={() => {
                        setRecipient(null);
                        setRecipientPhone('');
                      }}
                      className="px-3 py-2.5 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                      Change
                    </button>
                  ) : (
                    <button
                      onClick={handleLookup}
                      disabled={lookingUp || !recipientPhone}
                      className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {lookingUp ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Lookup
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  The recipient must be a registered owner. They will receive an OTP to accept the transfer.
                </p>
              </div>

              {recipient && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                    Verified Recipient
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{recipient.full_name}</p>
                      <p className="text-xs text-slate-600 font-mono">{recipient.phone_number}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {recipient.national_id}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'otp' && recipient && (
            <>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm text-emerald-900">
                  A verification code has been sent to <span className="font-semibold">{recipient.full_name}</span>{' '}
                  at <span className="font-mono">{recipient.phone_number}</span>.
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Ask them to share the 6-digit code to confirm they accept the transfer.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Recipient's OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                      setError(null);
                    }}
                    placeholder="Enter code"
                    autoFocus
                    className="w-full pl-9 pr-3 py-3 border border-slate-300 rounded-lg text-center font-mono text-lg tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSendOtp}
                disabled={otpSending}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {otpSending ? 'Resending...' : 'Resend code'}
              </button>
            </>
          )}

          {step === 'transferring' && (
            <div className="py-10 text-center">
              <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-900">Transferring ownership...</p>
              <p className="text-xs text-slate-500 mt-1">Do not close this window.</p>
            </div>
          )}

          {step === 'success' && recipient && (
            <div className="py-8 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-slate-900">Transfer Complete</p>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-mono">{motorcycle.registration_number}</span> now belongs to{' '}
                <span className="font-semibold">{recipient.full_name}</span>.
              </p>
            </div>
          )}

          {error && step !== 'success' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {step !== 'success' && step !== 'transferring' && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100"
            >
              Cancel
            </button>
            {step === 'check' && (
              <button
                onClick={() => setStep('recipient')}
                disabled={!canProceed}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            )}
            {step === 'recipient' && (
              <button
                onClick={handleSendOtp}
                disabled={!recipient || otpSending}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {otpSending && <Loader className="h-4 w-4 animate-spin" />}
                Send OTP to Recipient
              </button>
            )}
            {step === 'otp' && (
              <button
                onClick={handleVerifyAndTransfer}
                disabled={verifying || !otpCode}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {verifying && <Loader className="h-4 w-4 animate-spin" />}
                Verify & Transfer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
