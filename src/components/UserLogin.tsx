import { useState, useEffect } from 'react';
import { Bike, Phone, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendOtp, verifyOtp } from '../lib/otp';
import Footer from './Footer';
import AuthHeader from './AuthHeader';

type UserLoginProps = {
  onNavigate: (page: string) => void;
  onLoginSuccess: (ownerId: string, rememberMe: boolean) => void;
};

export default function UserLogin({ onNavigate, onLoginSuccess }: UserLoginProps) {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [otp, setOtp] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [loading, setLoading] = useState(false);
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
      const phoneFormatted = phoneNumber.startsWith('+254')
        ? phoneNumber
        : phoneNumber.replace(/^0/, '+254');

      const { data: owner, error: queryError } = await supabase
        .from('owners')
        .select('id')
        .eq('phone_number', phoneFormatted)
        .eq('national_id', nationalId)
        .maybeSingle();

      if (queryError) throw queryError;

      if (!owner) {
        setError('No registration found with these details. Please check your phone number and ID.');
        return;
      }

      setOwnerId(owner.id);

      const result = await sendOtp(phoneNumber);
      if (!result.success) {
        setError(result.error ?? 'Failed to send OTP. Please try again.');
        return;
      }

      setStep('otp');
      setResendCooldown(60);
    } catch (err) {
      console.error('Owner login error:', err);
      setError('An error occurred during login. Please try again.');
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
      onLoginSuccess(ownerId, rememberMe);
    } catch (err) {
      console.error('OTP verification error:', err);
      setError('An error occurred during verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setLoading(true);
    const result = await sendOtp(phoneNumber);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to resend OTP. Please try again.');
    } else {
      setResendCooldown(60);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="user-login" />

      <div className="flex-1 max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {step === 'credentials' ? (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Bike className="h-8 w-8 text-emerald-600" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Owner Login</h2>
              <p className="text-sm text-slate-600 text-center mb-6">
                Enter your phone number and National ID to receive an OTP
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
                    National ID Number
                  </label>
                  <input
                    type="text"
                    required
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
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
                  onClick={() => onNavigate('register')}
                  className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
                >
                  New Owner? Register Here
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
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-center text-2xl tracking-widest"
                    placeholder="000000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
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
                    onClick={handleResendOTP}
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
