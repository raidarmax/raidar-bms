import { useState, useEffect } from 'react';
import { User, Phone, ArrowLeft, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import AuthHeader from './AuthHeader';
import { supabase, type Payment } from '../lib/supabase';
import PaymentModal from './PaymentModal';
import { sendOtp, verifyOtp } from '../lib/otp';
import LocalitySelector from './LocalitySelector';

type RiderRegistrationProps = {
  onNavigate: (page: string) => void;
};

type Step = 'details' | 'otp' | 'review' | 'payment';

export default function RiderRegistration({ onNavigate }: RiderRegistrationProps) {
  const [step, setStep] = useState<Step>('details');
  const [formData, setFormData] = useState({ name: '', id_number: '', phone_number: '' });
  const [locality, setLocality] = useState<{ countyId: number | null; constituencyId: number | null; wardId: number | null }>({ countyId: null, constituencyId: null, wardId: null });
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [tempRiderId, setTempRiderId] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleInput = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateDetails = () => {
    if (!formData.name.trim()) { setError('Full name is required'); return false; }
    if (!formData.id_number.trim()) { setError('ID number is required'); return false; }
    if (!/^(?:\+254|0)[17]\d{8}$/.test(formData.phone_number)) {
      setError('Enter a valid Kenyan phone number (e.g. 07xx xxx xxx)');
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    if (!validateDetails()) return;
    setLoading(true);
    setError('');
    const result = await sendOtp(formData.phone_number);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to send OTP. Please check your phone number.');
      return;
    }
    setStep('otp');
    setResendCooldown(60);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { setError('Enter the OTP code'); return; }
    setLoading(true);
    setError('');
    const valid = await verifyOtp(formData.phone_number, otpCode);
    setLoading(false);
    if (!valid) {
      setError('Invalid or expired OTP. Please try again or request a new code.');
      return;
    }
    setStep('review');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const phoneFormatted = formData.phone_number.startsWith('+254')
        ? formData.phone_number
        : formData.phone_number.replace(/^0/, '+254');

      const { data, error: insertError } = await supabase
        .from('riders')
        .insert({
          name: formData.name.trim(),
          id_number: formData.id_number.trim().toUpperCase(),
          phone_number: phoneFormatted,
          assignment_status: 'Unassigned',
          payment_status: 'pending',
          id_verified: false,
          kra_pin_verified: false,
          license_verified: false,
          ...(locality.countyId && { county_id: locality.countyId }),
          ...(locality.constituencyId && { constituency_id: locality.constituencyId }),
          ...(locality.wardId && { ward_id: locality.wardId }),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setTempRiderId(data.id);
      setStep('payment');
    } catch (err: any) {
      console.error('Rider registration error:', err);
      if (err?.code === '23505') {
        setError('An account with this ID or phone number already exists.');
      } else {
        setError('Registration failed. Please try again or contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (_payment: Payment) => {
    setShowPaymentModal(false);
    onNavigate('rider-login');
  };

  const phoneDisplay = formData.phone_number.startsWith('+254')
    ? formData.phone_number
    : formData.phone_number.replace(/^0/, '+254 ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="rider-registration" />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => step === 'otp' ? setStep('details') : onNavigate('registration-choice')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Rider Registration</h1>
              <p className="text-sm text-slate-500">Quick 2-minute sign-up</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {(['details', 'otp', 'review', 'payment'] as Step[]).map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${
                i <= (['details', 'otp', 'review', 'payment'] as Step[]).indexOf(step)
                  ? 'bg-emerald-500' : 'bg-slate-200'
              }`} />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {/* STEP: details */}
          {step === 'details' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Your Details</h2>
                <p className="text-sm text-slate-500 mt-0.5">Only the essentials to get you started</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleInput('name', e.target.value)}
                    placeholder="As it appears on your National ID"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">National ID Number</label>
                  <input
                    type="text"
                    value={formData.id_number}
                    onChange={e => handleInput('id_number', e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={e => handleInput('phone_number', e.target.value)}
                    placeholder="07xx xxx xxx"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">An OTP will be sent to verify this number</p>
                </div>

                <LocalitySelector
                  countyId={locality.countyId}
                  constituencyId={locality.constituencyId}
                  wardId={locality.wardId}
                  onChange={setLocality}
                  label="Operating Area"
                  compact
                />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {loading ? 'Sending OTP...' : 'Send Verification Code'}
              </button>
            </div>
          )}

          {/* STEP: otp */}
          {step === 'otp' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Verify Phone</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Enter the 6-digit code sent to <span className="font-medium text-slate-700">{phoneDisplay}</span>
                </p>
              </div>

              <input
                type="text"
                value={otpCode}
                onChange={e => { setOtpCode(e.target.value); setError(''); }}
                placeholder="Enter OTP code"
                maxLength={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm text-center tracking-widest text-lg font-mono"
                autoFocus
              />

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-sm text-slate-400">Resend in {resendCooldown}s</p>
                ) : (
                  <button onClick={handleSendOtp} disabled={loading} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                    Resend code
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Confirm Details</h2>
                <p className="text-sm text-slate-500 mt-0.5">Review before proceeding to payment</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                {[
                  { label: 'Full Name', value: formData.name },
                  { label: 'National ID', value: formData.id_number.toUpperCase() },
                  { label: 'Phone Number', value: phoneDisplay },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-800">{value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                  <span className="text-slate-500">Registration Fee</span>
                  <span className="font-bold text-emerald-600">KES 100</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                <p className="font-medium mb-1">What happens next?</p>
                <p className="text-emerald-700">After registration you can complete your profile — adding license, documents, and verifications — right from your dashboard.</p>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {loading ? 'Processing...' : 'Proceed to Payment (KES 100)'}
              </button>
            </div>
          )}

          {/* STEP: payment */}
          {step === 'payment' && (
            <div className="space-y-5 text-center">
              <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CreditCard className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Complete Payment</h2>
                <p className="text-sm text-slate-500 mt-1">Pay KES 100 to activate your account</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Pay Now — KES 100
              </button>
            </div>
          )}
        </div>

        {showPaymentModal && tempRiderId && (
          <PaymentModal
            userType="rider"
            userId={tempRiderId}
            userName={formData.name}
            onSuccess={handlePaymentSuccess}
            onClose={() => setShowPaymentModal(false)}
          />
        )}
      </div>
      </div>
    </div>
  );
}
