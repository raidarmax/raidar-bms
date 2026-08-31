import { useState, useEffect } from 'react';
import { Lock, Phone, KeyRound, CheckCircle, ShieldCheck, User, AlertTriangle } from 'lucide-react';
import AuthHeader from './AuthHeader';
import Footer from './Footer';
import { AuthService } from '../lib/auth';
import { sendOtp, verifyOtp } from '../lib/otp';
import type { SystemUserWithRole } from '../lib/supabase';

type AdminLoginProps = {
  onNavigate: (page: string) => void;
  onLoginSuccess: (user: SystemUserWithRole) => void;
};

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  return phone.slice(0, 3) + '*** ***' + phone.slice(-2);
}

export default function AdminLogin({ onNavigate, onLoginSuccess }: AdminLoginProps) {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [user, setUser] = useState<SystemUserWithRole | null>(null);

  const [otpSkipped, setOtpSkipped] = useState(false);

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
      const { user: validated, error: loginError } = await AuthService.validateCredentials(username, password);

      if (loginError || !validated) {
        setError(loginError ?? 'Invalid credentials');
        return;
      }

      setUser(validated);

      if (validated.phone_number) {
        const result = await sendOtp(validated.phone_number);
        if (!result.success) {
          // OTP sending failed — allow login without OTP since credentials were valid
          setOtpSkipped(true);
          setPhone(validated.phone_number);
          setStep('otp');
          return;
        }
        setPhone(validated.phone_number);
        setOtpSent(true);
        setResendCooldown(60);
      } else {
        // No phone number configured — skip OTP entirely
        await AuthService.completeLogin(validated.id);
        onLoginSuccess(validated);
        return;
      }

      setStep('otp');
    } catch (err) {
      console.error('Admin login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    setError('');
    setLoading(true);

    const result = await sendOtp(phone);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to send OTP. Please try again.');
      return;
    }

    setOtpSent(true);
    setResendCooldown(60);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      const valid = await verifyOtp(phone, otpCode);
      if (!valid) {
        setError('Invalid or expired OTP. Please try again or request a new code.');
        return;
      }

      await AuthService.completeLogin(user.id);
      onLoginSuccess(user);
    } catch (err) {
      console.error('OTP verification error:', err);
      setError('An error occurred during verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    const result = await sendOtp(phone);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to resend OTP');
    } else {
      setResendCooldown(60);
    }
  };

  const goBack = () => {
    setStep('credentials');
    setError('');
    setOtpCode('');
    setOtpSent(false);
    setPhone('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="admin" />

      <div className="flex-1 max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              {step === 'otp' ? (
                <Phone className="h-8 w-8 text-emerald-600" />
              ) : (
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
              )}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Admin Portal</h2>
          <p className="text-sm text-slate-600 text-center mb-6">
            {step === 'otp' ? 'Two-factor authentication' : 'Sign in to access the dashboard'}
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
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter your password"
                />
              </div>

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
                ) : 'Continue'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {otpSkipped ? (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 text-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-2" />
                    <p className="font-semibold mb-1">SMS service unavailable</p>
                    <p className="text-xs text-amber-700">
                      The OTP verification service could not be reached. Since your credentials have been verified, you can continue to the dashboard.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      setLoading(true);
                      await AuthService.completeLogin(user.id);
                      onLoginSuccess(user);
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
                      if (!phone) return;
                      setLoading(true);
                      const result = await sendOtp(phone);
                      setLoading(false);
                      if (result.success) {
                        setOtpSkipped(false);
                        setOtpSent(true);
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
              ) : !otpSent ? (
                <>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 text-center">
                    Enter your phone number to receive a one-time verification code.
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">
                      <Phone className="h-4 w-4 inline mr-1" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g., 0712 345 678"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || !phone.trim()}
                    className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        Send OTP
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                    <Phone className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
                    <p className="text-slate-600 text-sm">A 6-digit code was sent to</p>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {user?.phone_number ? maskPhone(phone) : phone}
                    </p>
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
                      onClick={goBack}
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
              Secure access for authorized personnel only
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
