import { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle, Phone, User, CreditCard, Loader2,
  Building2, UserCircle, ChevronRight,
} from 'lucide-react';
import AuthHeader from './AuthHeader';
import { supabase } from '../lib/supabase';
import { generateQRCode, generateUniqueId } from '../lib/qrcode';
import PaymentModal from './PaymentModal';
import { sendOtp, verifyOtp } from '../lib/otp';
import type { Payment } from '../lib/supabase';

type OwnerType = 'individual' | 'company';
type Step = 'type' | 'details' | 'otp' | 'review' | 'payment';

type IndividualData = {
  fullName: string;
  nationalId: string;
  phoneNumber: string;
};

type CompanyData = {
  companyName: string;
  businessRegNumber: string;
  contactPersonName: string;
  phoneNumber: string;
};

type RegistrationFormProps = {
  onNavigate: (page: string) => void;
  onComplete: (qrCode: string, uniqueId: string) => void;
};

const STEPS: Step[] = ['type', 'details', 'otp', 'review', 'payment'];

export default function RegistrationForm({ onNavigate, onComplete }: RegistrationFormProps) {
  const [step, setStep] = useState<Step>('type');
  const [ownerType, setOwnerType] = useState<OwnerType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [tempOwnerId, setTempOwnerId] = useState<string | null>(null);

  const [individual, setIndividual] = useState<IndividualData>({ fullName: '', nationalId: '', phoneNumber: '' });
  const [company, setCompany] = useState<CompanyData>({ companyName: '', businessRegNumber: '', contactPersonName: '', phoneNumber: '' });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const phoneNumber = ownerType === 'individual' ? individual.phoneNumber : company.phoneNumber;
  const phoneDisplay = phoneNumber.startsWith('+254') ? phoneNumber : phoneNumber.replace(/^0/, '+254 ');

  const setError_ = (msg: string) => { setError(msg); };
  const clearErr = () => setError('');

  // ── validation ────────────────────────────────────────────────────────────────

  const validatePhone = (p: string) => /^(?:\+254|0)[17]\d{8}$/.test(p);

  const validateIndividual = () => {
    if (!individual.fullName.trim()) { setError_('Full name is required'); return false; }
    if (!individual.nationalId.trim()) { setError_('National ID is required'); return false; }
    if (!validatePhone(individual.phoneNumber)) { setError_('Enter a valid Kenyan phone number (e.g. 07xx xxx xxx)'); return false; }
    return true;
  };

  const validateCompany = () => {
    if (!company.companyName.trim()) { setError_('Company / SACCO name is required'); return false; }
    if (!company.businessRegNumber.trim()) { setError_('Business registration number is required'); return false; }
    if (!company.contactPersonName.trim()) { setError_('Contact person name is required'); return false; }
    if (!validatePhone(company.phoneNumber)) { setError_('Enter a valid Kenyan phone number for the contact person'); return false; }
    return true;
  };

  const validate = () => ownerType === 'individual' ? validateIndividual() : validateCompany();

  // ── OTP ───────────────────────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    if (!validate()) return;
    setLoading(true);
    clearErr();
    const result = await sendOtp(phoneNumber);
    setLoading(false);
    if (!result.success) { setError_(result.error ?? 'Failed to send OTP. Please check the phone number.'); return; }
    setStep('otp');
    setResendCooldown(60);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { setError_('Enter the OTP code'); return; }
    setLoading(true);
    clearErr();
    const valid = await verifyOtp(phoneNumber, otpCode);
    setLoading(false);
    if (!valid) { setError_('Invalid or expired OTP. Please try again or request a new code.'); return; }
    setStep('review');
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true);
    clearErr();
    try {
      const phoneFormatted = phoneNumber.startsWith('+254')
        ? phoneNumber
        : phoneNumber.replace(/^0/, '+254');

      const baseRecord: Record<string, unknown> = {
        phone_number: phoneFormatted,
        otp_verified: true,
        payment_status: 'pending',
        id_verified: false,
        kra_pin_verified: false,
        owner_type: ownerType,
      };

      if (ownerType === 'individual') {
        baseRecord.full_name = individual.fullName.trim();
        baseRecord.national_id = individual.nationalId.trim().toUpperCase();
      } else {
        baseRecord.full_name = company.contactPersonName.trim();
        baseRecord.company_name = company.companyName.trim();
        baseRecord.business_reg_number = company.businessRegNumber.trim().toUpperCase();
        baseRecord.contact_person_name = company.contactPersonName.trim();
      }

      const { data: ownerData, error: ownerError } = await supabase
        .from('owners')
        .insert(baseRecord)
        .select()
        .single();

      if (ownerError) throw ownerError;

      const uniqueId = generateUniqueId();
      const { error: verificationError } = await supabase
        .from('verifications')
        .insert({ owner_id: ownerData.id, status: 'Pending', qr_code_data: uniqueId });
      if (verificationError) throw verificationError;

      setTempOwnerId(ownerData.id);
      setStep('payment');
    } catch (err: any) {
      if (err?.code === '23505') {
        setError_('An account with this ID, phone number, or registration number already exists.');
      } else {
        setError_('Registration failed. Please try again or contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (_payment: Payment) => {
    setShowPaymentModal(false);
    try {
      const { data: verData } = await supabase
        .from('verifications')
        .select('qr_code_data')
        .eq('owner_id', tempOwnerId)
        .single();
      if (verData) {
        const verificationUrl = `${window.location.origin}/verify/${verData.qr_code_data}`;
        const qrCodeDataUrl = await generateQRCode(verificationUrl);
        onComplete(qrCodeDataUrl, verData.qr_code_data);
      }
    } catch {
      onComplete('', '');
    }
  };

  // ── progress ──────────────────────────────────────────────────────────────────

  const progressSteps: Step[] = ['type', 'details', 'otp', 'review', 'payment'];
  const currentIdx = progressSteps.indexOf(step);

  const goBack = () => {
    if (step === 'otp') { setStep('details'); return; }
    if (step === 'details') { setStep('type'); return; }
    onNavigate('registration-choice');
  };

  const displayName = ownerType === 'company' ? company.companyName || 'Company' : individual.fullName || 'Owner';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="register" />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Back + header */}
          <div className="mb-6">
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${ownerType === 'company' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                {ownerType === 'company' ? <Building2 className="h-6 w-6 text-white" /> : <User className="h-6 w-6 text-white" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">Owner Registration</h1>
                <p className="text-sm text-slate-500">Quick 2-minute sign-up</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-6">
            {progressSteps.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i <= currentIdx ? (ownerType === 'company' ? 'bg-blue-500' : 'bg-emerald-500') : 'bg-slate-200'}`}
              />
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">

            {/* ── STEP: type ── */}
            {step === 'type' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 font-display">Who is registering?</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Choose the type of owner account</p>
                </div>

                <div className="space-y-3">
                  <TypeCard
                    active={ownerType === 'individual'}
                    icon={<UserCircle className="h-7 w-7" />}
                    color="emerald"
                    title="Individual Owner"
                    description="A person who owns one or more motorcycles in their personal name."
                    features={['National ID required', 'Personal KRA PIN', 'Next of kin details']}
                    onClick={() => { setOwnerType('individual'); clearErr(); }}
                  />
                  <TypeCard
                    active={ownerType === 'company'}
                    icon={<Building2 className="h-7 w-7" />}
                    color="blue"
                    title="Company / SACCO / Fleet"
                    description="A registered business, SACCO, or fleet operator managing multiple motorcycles."
                    features={['Business registration number', 'Company KRA PIN', 'Authorised contact person']}
                    onClick={() => { setOwnerType('company'); clearErr(); }}
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                <button
                  onClick={() => {
                    if (!ownerType) { setError_('Please select an owner type'); return; }
                    clearErr();
                    setStep('details');
                  }}
                  className={`w-full font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-white ${
                    ownerType === 'company' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  } disabled:opacity-40`}
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ── STEP: details ── */}
            {step === 'details' && ownerType === 'individual' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 font-display">Your Details</h2>
                  <p className="text-sm text-slate-500 mt-0.5">We only need the basics to get you started</p>
                </div>
                <div className="space-y-4">
                  <Field label="Full Name" hint="As it appears on your National ID">
                    <input
                      type="text" value={individual.fullName}
                      onChange={e => { setIndividual(p => ({ ...p, fullName: e.target.value })); clearErr(); }}
                      placeholder="Jane Wanjiku Kamau"
                      className={INPUT}
                    />
                  </Field>
                  <Field label="National ID Number">
                    <input
                      type="text" value={individual.nationalId}
                      onChange={e => { setIndividual(p => ({ ...p, nationalId: e.target.value })); clearErr(); }}
                      placeholder="e.g. 12345678"
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Phone Number" hint="An OTP will be sent to verify this number">
                    <input
                      type="tel" value={individual.phoneNumber}
                      onChange={e => { setIndividual(p => ({ ...p, phoneNumber: e.target.value })); clearErr(); }}
                      placeholder="07xx xxx xxx"
                      className={INPUT}
                    />
                  </Field>
                </div>
                {error && <ErrorBanner>{error}</ErrorBanner>}
                <button onClick={handleSendOtp} disabled={loading} className={BTN_PRIMARY_GREEN}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  {loading ? 'Sending OTP…' : 'Send Verification Code'}
                </button>
              </div>
            )}

            {step === 'details' && ownerType === 'company' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 font-display">Company Details</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Enter the basic details — full documents can be added in your profile</p>
                </div>
                <div className="space-y-4">
                  <Field label="Company / SACCO Name">
                    <input
                      type="text" value={company.companyName}
                      onChange={e => { setCompany(p => ({ ...p, companyName: e.target.value })); clearErr(); }}
                      placeholder="e.g. Nairobi Riders SACCO Ltd"
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Business Registration Number" hint="Certificate of Incorporation number or SACCO reg. number">
                    <input
                      type="text" value={company.businessRegNumber}
                      onChange={e => { setCompany(p => ({ ...p, businessRegNumber: e.target.value })); clearErr(); }}
                      placeholder="e.g. CPR/2024/123456"
                      className={INPUT}
                    />
                  </Field>
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Authorised Contact Person</p>
                    <div className="space-y-3">
                      <Field label="Full Name">
                        <input
                          type="text" value={company.contactPersonName}
                          onChange={e => { setCompany(p => ({ ...p, contactPersonName: e.target.value })); clearErr(); }}
                          placeholder="Director or authorised representative"
                          className={INPUT}
                        />
                      </Field>
                      <Field label="Phone Number" hint="An OTP will be sent to verify this number">
                        <input
                          type="tel" value={company.phoneNumber}
                          onChange={e => { setCompany(p => ({ ...p, phoneNumber: e.target.value })); clearErr(); }}
                          placeholder="07xx xxx xxx"
                          className={INPUT}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
                {error && <ErrorBanner>{error}</ErrorBanner>}
                <button onClick={handleSendOtp} disabled={loading} className={BTN_PRIMARY_BLUE}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  {loading ? 'Sending OTP…' : 'Send Verification Code'}
                </button>
              </div>
            )}

            {/* ── STEP: otp ── */}
            {step === 'otp' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 font-display">Verify Phone</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Enter the 6-digit code sent to <span className="font-medium text-slate-700">{phoneDisplay}</span>
                  </p>
                </div>
                <input
                  type="text" value={otpCode}
                  onChange={e => { setOtpCode(e.target.value); clearErr(); }}
                  placeholder="Enter OTP code"
                  maxLength={6} autoFocus
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center tracking-widest text-lg font-mono"
                />
                {error && <ErrorBanner>{error}</ErrorBanner>}
                <button onClick={handleVerifyOtp} disabled={loading} className={ownerType === 'company' ? BTN_PRIMARY_BLUE : BTN_PRIMARY_GREEN}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {loading ? 'Verifying…' : 'Verify Code'}
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

            {/* ── STEP: review ── */}
            {step === 'review' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 font-display">Confirm Details</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Review before proceeding to payment</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  {ownerType === 'individual' ? (
                    <>
                      <ReviewRow label="Type" value="Individual Owner" />
                      <ReviewRow label="Full Name" value={individual.fullName} />
                      <ReviewRow label="National ID" value={individual.nationalId.toUpperCase()} />
                      <ReviewRow label="Phone Number" value={phoneDisplay} />
                    </>
                  ) : (
                    <>
                      <ReviewRow label="Type" value="Company / SACCO" />
                      <ReviewRow label="Company Name" value={company.companyName} />
                      <ReviewRow label="Business Reg. No." value={company.businessRegNumber.toUpperCase()} />
                      <ReviewRow label="Contact Person" value={company.contactPersonName} />
                      <ReviewRow label="Contact Phone" value={phoneDisplay} />
                    </>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                    <span className="text-slate-500">Registration Fee</span>
                    <span className="font-bold text-emerald-600">KES 350</span>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                  <p className="font-medium mb-1">What happens next?</p>
                  <p className="text-emerald-700">
                    After registration you complete your full profile from the dashboard — adding motorcycle details,
                    {ownerType === 'company' ? ' KRA PIN, certificate of incorporation, and business documents.' : ' KRA PIN, next of kin, and documents.'}
                  </p>
                </div>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <button onClick={handleSubmit} disabled={loading} className={ownerType === 'company' ? BTN_PRIMARY_BLUE : BTN_PRIMARY_GREEN}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {loading ? 'Processing…' : 'Proceed to Payment (KES 350)'}
                </button>
              </div>
            )}

            {/* ── STEP: payment ── */}
            {step === 'payment' && (
              <div className="space-y-5 text-center">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto ${ownerType === 'company' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                  <CreditCard className={`h-8 w-8 ${ownerType === 'company' ? 'text-blue-600' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 font-display">Complete Payment</h2>
                  <p className="text-sm text-slate-500 mt-1">Pay KES 350 to activate the account for <span className="font-medium text-slate-700">{displayName}</span></p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className={`w-full font-semibold py-3 rounded-xl transition-colors text-white ${ownerType === 'company' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  Pay Now — KES 350
                </button>
              </div>
            )}
          </div>

          {showPaymentModal && tempOwnerId && (
            <PaymentModal
              userType="owner"
              userId={tempOwnerId}
              userName={ownerType === 'company' ? company.companyName : individual.fullName}
              onSuccess={handlePaymentSuccess}
              onClose={() => setShowPaymentModal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── small shared components ────────────────────────────────────────────────────

const INPUT = 'w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm';
const BTN_PRIMARY_GREEN = 'w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2';
const BTN_PRIMARY_BLUE = 'w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{children}</p>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function TypeCard({
  active, icon, color, title, description, features, onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  color: 'emerald' | 'blue';
  title: string;
  description: string;
  features: string[];
  onClick: () => void;
}) {
  const ring = color === 'blue'
    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
    : 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200';
  const iconBg = color === 'blue' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white';
  const dot = color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${active ? ring : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? iconBg : 'bg-slate-100 text-slate-500'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 font-display">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          <ul className="mt-2 space-y-1">
            {features.map(f => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${active ? dot : 'bg-slate-300'}`} />
                {f}
              </li>
            ))}
          </ul>
        </div>
        {active && (
          <CheckCircle className={`h-5 w-5 flex-shrink-0 mt-1 ${color === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`} />
        )}
      </div>
    </button>
  );
}
