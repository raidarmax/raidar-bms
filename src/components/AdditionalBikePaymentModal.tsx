import { useEffect, useState } from 'react';
import { X, Smartphone, CreditCard, CheckCircle, Loader, AlertCircle, Plus, Bike } from 'lucide-react';
import { supabase, type Payment } from '../lib/supabase';

type Props = {
  ownerId: string;
  ownerName: string;
  registrationNumber: string;
  onSuccess: (payment: Payment) => void;
  onClose: () => void;
};

type Method = 'mpesa' | 'salamapay';
type Step = 'loading' | 'select' | 'details' | 'processing' | 'success' | 'failed';

export default function AdditionalBikePaymentModal({
  ownerId,
  ownerName,
  registrationNumber,
  onSuccess,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('loading');
  const [amount, setAmount] = useState<number>(500);
  const [method, setMethod] = useState<Method | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [txnRef, setTxnRef] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'general')
        .eq('key', 'additional_bike_fee')
        .maybeSingle();
      const parsed = Number(data?.value ?? 500);
      setAmount(Number.isFinite(parsed) && parsed >= 0 ? parsed : 500);
      setStep('select');
    })();
  }, []);

  const validatePhone = (p: string) => /^(?:\+254|0)[17]\d{8}$/.test(p);
  const generateRef = (m: Method) => {
    const ts = Date.now().toString().slice(-8);
    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
    return m === 'mpesa' ? `BIKE-M${ts}${rnd}` : `BIKE-S${ts}${rnd}`;
  };

  const handlePay = async () => {
    if (!method) return;
    if (!validatePhone(phone)) {
      setError('Enter a valid Kenyan phone number (e.g., +254712345678).');
      return;
    }
    setError('');
    setStep('processing');
    const ref = generateRef(method);
    setTxnRef(ref);
    const normalized = phone.startsWith('0') ? '+254' + phone.slice(1) : phone;

    try {
      const { data: paymentData, error: insertErr } = await supabase
        .from('payments')
        .insert({
          user_type: 'owner',
          user_id: ownerId,
          amount,
          payment_method: method,
          payment_status: 'pending',
          transaction_reference: ref,
          phone_number: normalized,
          payment_year: new Date().getFullYear(),
          metadata: {
            purpose: 'additional_bike',
            registration_number: registrationNumber,
            owner_name: ownerName,
            initiated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      setTimeout(async () => {
        const ok = Math.random() > 0.05;
        if (ok) {
          const { data: updated, error: upErr } = await supabase
            .from('payments')
            .update({ payment_status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', paymentData.id)
            .select()
            .single();
          if (upErr) throw upErr;
          setStep('success');
          setTimeout(() => onSuccess(updated as Payment), 1500);
        } else {
          await supabase
            .from('payments')
            .update({ payment_status: 'failed' })
            .eq('id', paymentData.id);
          setStep('failed');
        }
      }, 2200);
    } catch (e: any) {
      console.error('Additional bike payment failed:', e);
      setError('Failed to process payment. Please try again.');
      setStep('details');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Plus className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Additional Bike Fee</h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Bike className="h-3 w-3" />
                <span className="font-mono">{registrationNumber || 'New bike'}</span>
              </p>
            </div>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          {step === 'loading' && (
            <div className="py-10 text-center">
              <Loader className="h-6 w-6 animate-spin text-emerald-600 mx-auto" />
              <p className="text-sm text-slate-600 mt-2">Loading fee...</p>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600">One-Time Additional Bike Fee</p>
                <p className="text-3xl font-bold text-emerald-600">KES {amount}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Required to register another motorcycle under your account
                </p>
              </div>

              <p className="text-sm text-slate-600 text-center">Select payment method</p>

              <button
                onClick={() => {
                  setMethod('mpesa');
                  setStep('details');
                }}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition flex items-center gap-4"
              >
                <div className="w-11 h-11 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-slate-900">M-Pesa</p>
                  <p className="text-xs text-slate-600">Pay with M-Pesa mobile money</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setMethod('salamapay');
                  setStep('details');
                }}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition flex items-center gap-4"
              >
                <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-slate-900">SalamaPay</p>
                  <p className="text-xs text-slate-600">Pay with SalamaPay wallet</p>
                </div>
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
                <span className="text-sm text-slate-600">Amount:</span>
                <span className="text-lg font-bold text-slate-900">KES {amount.toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError('');
                  }}
                  placeholder="+254712345678 or 0712345678"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handlePay}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Pay KES {amount}
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Loader className="h-7 w-7 animate-spin text-emerald-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-1">Processing Payment</h4>
              <p className="text-sm text-slate-600 mb-3">
                {method === 'mpesa'
                  ? 'Check your phone and enter your M-Pesa PIN...'
                  : 'Confirming with SalamaPay...'}
              </p>
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="text-xs text-slate-500">Reference</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{txnRef}</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-1">Payment Successful</h4>
              <p className="text-sm text-slate-600">You can now register your additional motorcycle.</p>
            </div>
          )}

          {step === 'failed' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="h-7 w-7 text-red-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-1">Payment Failed</h4>
              <p className="text-sm text-slate-600 mb-4">
                The transaction was not completed. Please try again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Change Method
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
