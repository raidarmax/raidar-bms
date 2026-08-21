import { useState, useEffect } from 'react';
import { Phone, User, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendOtp, verifyOtp } from '../lib/otp';
import Footer from './Footer';
import AuthHeader from './AuthHeader';

type RiderLoginProps = {
  onNavigate: (page: string, riderId?: string) => void;
  onRememberLogin?: (rememberMe: boolean) => void;
};

export default function RiderLogin({ onNavigate, onRememberLogin }: RiderLoginProps) {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!phoneNumber.match(/^(\+254|0)[17]\d{8}$/)) {
        setError('Please enter a valid Kenyan phone number (e.g., +254712345678 or 0712345678)');
        return;
      }

      const normalizedPhone = phoneNumber.startsWith('0')
        ? '+254' + phoneNumber.substring(1)
        : phoneNumber;

      const { data: rider, error: riderError } = await supabase
        .from('riders')
        .select('id, phone_number')
        .eq('id_number', idNumber)
        .maybeSingle();

      if (riderError) throw riderError;

      if (!rider) {
        setError('No rider found with this ID number. Please check your details or contact your motorcycle owner.');
        return;
      }

      if (rider.phone_number && rider.phone_number !== normalizedPhone) {
        setError(`Phone number mismatch. This rider is registered with a different phone number.`);
        return;
      }

      if (!rider.phone_number) {
        await supabase.from('riders').update({ phone_number: normalizedPhone }).eq('id', rider.id);
      }

      setRiderId(rider.id);

      const result = await sendOtp(phoneNumber);
      if (!result.success) {
        setError(result.error ?? 'Failed to send OTP. Please try again.');
        return;
      }

      setStep('otp');
      setResendCooldown(60);
    } catch (err) {
      console.error('Error requesting OTP:', err);
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const valid = await verifyOtp(phoneNumber, otp);
      if (!valid) {
        setError('Invalid or expired OTP. Please try again or request a new code.');
        return;
      }
      if (riderId) {
        onRememberLogin?.(rememberMe);
        onNavigate('rider-dashboard', riderId);
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="rider-login" />

      <div className="flex-1 max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {step === 'credentials' ? (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-emerald-600" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Rider Login</h2>
              <p className="text-sm text-slate-600 text-center mb-6">
                Enter your phone number and ID number to receive an OTP
              </p>

              <form onSubmit={handleRequestOTP} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    <Phone className="h-4 w-4 inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="+254712345678 or 0712345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    <User className="h-4 w-4 inline mr-1" />
                    ID Number
                  </label>
                  <input
                    type="text"
                    required
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="12345678"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-600">Remember me for 30 days</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('rider-registration')}
                  className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
                >
                  New Rider? Register Here
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <KeyRound className="h-8 w-8 text-emerald-600" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Enter OTP</h2>
              <p className="text-sm text-slate-600 text-center mb-6">
                A 6-digit code was sent via SMS to {phoneNumber}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    <KeyRound className="h-4 w-4 inline mr-1" />
                    OTP Code
                  </label>
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verifying...' : 'Verify & Login'}
                </button>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setError('');
                      setLoading(true);
                      const r = await sendOtp(phoneNumber);
                      setLoading(false);
                      if (!r.success) {
                        setError(r.error ?? 'Failed to resend');
                      } else {
                        setResendCooldown(60);
                      }
                    }}
                    disabled={loading || resendCooldown > 0}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
