import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, Phone, KeyRound, CheckCircle, User, AlertTriangle } from 'lucide-react';
import AuthHeader from './AuthHeader';
import Footer from './Footer';
import { PoliceAuthService } from '../lib/policeAuth';
import { sendOtp, verifyOtp } from '../lib/otp';
import type { PoliceOfficerWithStation } from '../lib/supabase';

type PoliceLoginProps = {
  onNavigate: (page: string) => void;
  onLoginSuccess: (officer: PoliceOfficerWithStation, rememberMe: boolean) => void;
};

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  const normalized = phone.startsWith('+') ? phone : '+' + phone;
  return normalized.slice(0, 5) + '*** ***' + normalized.slice(-2);
}

export default function PoliceLogin({ onNavigate, onLoginSuccess }: PoliceLoginProps) {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSkipped, setOtpSkipped] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [officer, setOfficer] = useState<PoliceOfficerWithStation | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const validated = await PoliceAuthService.validateCredentials(serviceNumber, password);
      setOfficer(validated);

      const result = await sendOtp(validated.phone_number);
      if (!result.success) {
        setOtpSkipped(true);
        setStep('otp');
        return;
      }

      setStep('otp');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officer) return;
    setError('');
    setLoading(true);

    try {
      const valid = await verifyOtp(officer.phone_number, otpCode);
      if (!valid) {
        setError('Invalid or expired OTP. Please try again or request a new code.');
        return;
      }

      await PoliceAuthService.completeLogin(officer.id);
      onLoginSuccess(officer, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!officer) return;
    setError('');
    setLoading(true);
    const result = await sendOtp(officer.phone_number);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to resend OTP');
    } else {
      setResendCooldown(60);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="police" />

      <div className="flex-1 max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              {step === 'otp' ? (
                <Phone className="h-8 w-8 text-emerald-600" />
              ) : (
                <Shield className="h-8 w-8 text-emerald-600" />
              )}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
            {step === 'otp' ? 'Verify Your Identity' : 'Police Portal'}
          </h2>
          <p className="text-sm text-slate-600 text-center mb-6">
            {step === 'otp'
              ? `OTP sent to ${maskPhone(officer?.phone_number ?? '')}`
              : 'Kenya Police Service — BMS Enforcement'}
          </p>

          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 'credentials' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                {step === 'otp' ? <CheckCircle className="w-4 h-4" /> : '1'}
              </div>
              <span className="text-xs text-slate-500">Credentials</span>
            </div>
            <div className="flex-1 h-px bg-slate-200" />
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-xs text-slate-500">OTP Verify</span>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 'otp' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                2
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  <User className="h-4 w-4 inline mr-1" />
                  Service Number
                </label>
                <input
                  type="text"
                  value={serviceNumber}
                  onChange={(e) => setServiceNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., AP/12345"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
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
                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Continue
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {otpSkipped ? (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-amber-800 mb-1">SMS service unavailable</p>
                    <p className="text-xs text-amber-700">
                      The OTP service could not be reached. Since your credentials are verified, you can continue.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!officer) return;
                      setLoading(true);
                      await PoliceAuthService.completeLogin(officer.id);
                      onLoginSuccess(officer, rememberMe);
                    }}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Continue to Dashboard
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!officer) return;
                      setLoading(true);
                      const result = await sendOtp(officer.phone_number);
                      setLoading(false);
                      if (result.success) {
                        setOtpSkipped(false);
                        setResendCooldown(60);
                      } else {
                        setError(result.error ?? 'Still unable to send OTP');
                      }
                    }}
                    disabled={loading}
                    className="w-full text-sm text-slate-600 hover:text-emerald-700 font-medium"
                  >
                    Retry sending OTP
                  </button>
                </>
              ) : (
                <>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <Phone className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
                <p className="text-slate-600 text-sm">A 6-digit code was sent to</p>
                <p className="text-slate-900 font-semibold mt-0.5">{maskPhone(officer?.phone_number ?? '')}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  <KeyRound className="h-4 w-4 inline mr-1" />
                  OTP Code
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-center text-2xl tracking-widest"
                  required
                  autoFocus
                  maxLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Verify & Sign In
                  </>
                )}
              </button>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setOtpCode(''); setError(''); }}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
                </>
              )}
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-500">
              Authorized access only. All activity is monitored and logged.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
