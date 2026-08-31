import { useState } from 'react';
import {
  CheckCircle, ChevronDown, ChevronUp, Loader2, Save,
  User, Shield, Users, MapPin, Bike, FileText, AlertCircle,
  ShieldCheck, Award, CreditCard, BookOpen, Building2,
} from 'lucide-react';
import { supabase, type Owner, type Motorcycle } from '../lib/supabase';
import GovernmentVerificationField, { type VerifyResult } from './GovernmentVerificationField';
import LocalitySelector from './LocalitySelector';
import DocumentValidationSummary from './DocumentValidationSummary';

// ── Completion weights ─────────────────────────────────────────────────────────
const OWNER_WEIGHTS = {
  full_name: 5, national_id: 5, phone_number: 5,
  id_verified: 10, kra_pin: 5, kra_pin_verified: 5,
  next_of_kin_name: 5, next_of_kin_phone: 5,
  county: 5,
  motorcycle_registration: 10, motorcycle_make: 5, motorcycle_model: 5,
  insurance_number: 5,
  bike_photo: 7, logbook: 7, kra_pin_doc: 5, insurance_cover: 6,
} as const;

const COMPANY_WEIGHTS = {
  company_name: 10, business_reg_number: 10, company_kra_pin: 8,
  company_kra_pin_verified: 7, contact_person_name: 5, phone_number: 5,
  county: 5,
  motorcycle_registration: 10, motorcycle_make: 5, motorcycle_model: 5,
  insurance_number: 5,
  bike_photo: 7, logbook: 7, kra_pin_doc: 8, insurance_cover: 8,
} as const;

type WeightKey = keyof typeof OWNER_WEIGHTS;
type CompanyWeightKey = keyof typeof COMPANY_WEIGHTS;

function computeCompletion(owner: Owner, motorcycle: Motorcycle | null): { pct: number; done: Set<WeightKey> } {
  const isCompany = (owner as any).owner_type === 'company';
  if (isCompany) {
    const done = new Set<CompanyWeightKey>();
    if ((owner as any).company_name) done.add('company_name');
    if ((owner as any).business_reg_number) done.add('business_reg_number');
    if ((owner as any).company_kra_pin) done.add('company_kra_pin');
    if ((owner as any).company_kra_pin_verified) done.add('company_kra_pin_verified');
    if ((owner as any).contact_person_name) done.add('contact_person_name');
    if (owner.phone_number) done.add('phone_number');
    if ((owner as any).county_id) done.add('county');
    if (motorcycle) {
      if (motorcycle.registration_number) done.add('motorcycle_registration');
      if (motorcycle.make) done.add('motorcycle_make');
      if (motorcycle.model) done.add('motorcycle_model');
      if (motorcycle.insurance_policy_number) done.add('insurance_number');
      if (motorcycle.bike_photo_url) done.add('bike_photo');
      if (motorcycle.logbook_url) done.add('logbook');
      if (motorcycle.kra_pin_url) done.add('kra_pin_doc');
      if (motorcycle.insurance_cover_url) done.add('insurance_cover');
    }
    const pct = Array.from(done).reduce((s, k) => s + COMPANY_WEIGHTS[k as CompanyWeightKey], 0);
    return { pct: Math.min(pct, 100), done: done as unknown as Set<WeightKey> };
  }

  const done = new Set<WeightKey>();
  if (owner.full_name) done.add('full_name');
  if (owner.national_id) done.add('national_id');
  if (owner.phone_number) done.add('phone_number');
  if (owner.id_verified) done.add('id_verified');
  if (owner.kra_pin) done.add('kra_pin');
  if (owner.kra_pin_verified) done.add('kra_pin_verified');
  if (owner.next_of_kin_name) done.add('next_of_kin_name');
  if (owner.next_of_kin_phone) done.add('next_of_kin_phone');
  if ((owner as any).county_id) done.add('county');
  if (motorcycle) {
    if (motorcycle.registration_number) done.add('motorcycle_registration');
    if (motorcycle.make) done.add('motorcycle_make');
    if (motorcycle.model) done.add('motorcycle_model');
    if (motorcycle.insurance_policy_number) done.add('insurance_number');
    if (motorcycle.bike_photo_url) done.add('bike_photo');
    if (motorcycle.logbook_url) done.add('logbook');
    if (motorcycle.kra_pin_url) done.add('kra_pin_doc');
    if (motorcycle.insurance_cover_url) done.add('insurance_cover');
  }
  const pct = Array.from(done).reduce((s, k) => s + OWNER_WEIGHTS[k], 0);
  return { pct, done };
}

type OwnerProfileCompletionProps = {
  owner: Owner & { county_id?: number | null; constituency_id?: number | null; ward_id?: number | null };
  motorcycles: Motorcycle[];
  onUpdate: () => void;
};

type SectionKey = 'company' | 'identity' | 'nok' | 'location' | 'motorcycle' | 'documents';

export default function OwnerProfileCompletion({ owner, motorcycles, onUpdate }: OwnerProfileCompletionProps) {
  const motorcycle = motorcycles[0] ?? null;
  const { pct, done } = computeCompletion(owner as any, motorcycle);
  const isCompany = (owner as any).owner_type === 'company';
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [sectionSuccess, setSectionSuccess] = useState('');

  // Identity section (individual)
  const [kraPin, setKraPin] = useState(owner.kra_pin ?? '');
  const [idVerResult, setIdVerResult] = useState<VerifyResult | null>(owner.id_verified ? { verified: true } : null);
  const [kraVerResult, setKraVerResult] = useState<VerifyResult | null>(owner.kra_pin_verified ? { verified: true } : null);

  // Company section
  const [companyName, setCompanyName] = useState((owner as any).company_name ?? '');
  const [businessRegNumber, setBusinessRegNumber] = useState((owner as any).business_reg_number ?? '');
  const [companyKraPin, setCompanyKraPin] = useState((owner as any).company_kra_pin ?? '');
  const [contactPersonName, setContactPersonName] = useState((owner as any).contact_person_name ?? '');
  const [contactPersonId, setContactPersonId] = useState((owner as any).contact_person_id ?? '');
  const [companyKraVerResult, setCompanyKraVerResult] = useState<VerifyResult | null>(
    (owner as any).company_kra_pin_verified ? { verified: true } : null
  );

  // NOK section
  const [nokName, setNokName] = useState(owner.next_of_kin_name ?? '');
  const [nokPhone, setNokPhone] = useState(owner.next_of_kin_phone ?? '');

  // Location section
  const [locality, setLocality] = useState({
    countyId: (owner as any).county_id as number | null ?? null,
    constituencyId: (owner as any).constituency_id as number | null ?? null,
    wardId: (owner as any).ward_id as number | null ?? null,
  });

  // Motorcycle section
  const [motoForm, setMotoForm] = useState({
    registration_number: motorcycle?.registration_number ?? '',
    make: motorcycle?.make ?? '',
    model: motorcycle?.model ?? '',
    tracking_device_id: motorcycle?.tracking_device_id ?? '',
    insurance_policy_number: motorcycle?.insurance_policy_number ?? '',
    insurance_provider: motorcycle?.insurance_provider ?? '',
    insurance_expiry: motorcycle?.insurance_expiry ?? '',
  });

  const flash = (msg: string, isError = false) => {
    if (isError) setSectionError(msg); else setSectionSuccess(msg);
    setTimeout(() => { setSectionError(''); setSectionSuccess(''); }, 3000);
  };

  const toggle = (s: SectionKey) => setOpenSection(prev => prev === s ? null : s);

  // ── Save handlers ───────────────────────────────────────────────────────────

  const saveCompany = async () => {
    if (!companyName.trim()) { flash('Company name is required.', true); return; }
    setSaving(true);
    const { error } = await supabase.from('owners').update({
      company_name: companyName.trim(),
      business_reg_number: businessRegNumber.trim().toUpperCase() || null,
      company_kra_pin: companyKraPin.trim().toUpperCase() || null,
      company_kra_pin_verified: companyKraVerResult?.verified ?? false,
      contact_person_name: contactPersonName.trim() || null,
      contact_person_id: contactPersonId.trim().toUpperCase() || null,
    }).eq('id', owner.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Company details saved!');
    onUpdate();
  };

  const saveIdentity = async () => {
    setSaving(true);
    const { error } = await supabase.from('owners').update({
      kra_pin: kraPin.trim().toUpperCase() || null,
      id_verified: idVerResult?.verified ?? false,
      kra_pin_verified: kraVerResult?.verified ?? false,
    }).eq('id', owner.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Identity details saved!');
    onUpdate();
  };

  const saveNok = async () => {
    setSaving(true);
    const { error } = await supabase.from('owners').update({
      next_of_kin_name: nokName.trim() || null,
      next_of_kin_phone: nokPhone.trim() || null,
    }).eq('id', owner.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Next of kin saved!');
    onUpdate();
  };

  const saveLocation = async () => {
    setSaving(true);
    const { error } = await supabase.from('owners').update({
      county_id: locality.countyId,
      constituency_id: locality.constituencyId,
      ward_id: locality.wardId,
    }).eq('id', owner.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Location saved!');
    onUpdate();
  };

  const saveMotorcycle = async () => {
    if (!motoForm.registration_number.trim()) { flash('Registration number is required.', true); return; }
    setSaving(true);
    const payload = {
      registration_number: motoForm.registration_number.trim().toUpperCase(),
      make: motoForm.make.trim() || null,
      model: motoForm.model.trim() || null,
      tracking_device_id: motoForm.tracking_device_id.trim() || null,
      insurance_policy_number: motoForm.insurance_policy_number.trim() || null,
      insurance_provider: motoForm.insurance_provider.trim() || null,
      insurance_expiry: motoForm.insurance_expiry || null,
    };
    let error;
    if (motorcycle) {
      ({ error } = await supabase.from('motorcycles').update(payload).eq('id', motorcycle.id));
    } else {
      ({ error } = await supabase.from('motorcycles').insert({ ...payload, owner_id: owner.id }));
    }
    setSaving(false);
    if (error) { flash('Failed to save motorcycle. Please try again.', true); return; }
    flash('Motorcycle details saved!');
    onUpdate();
  };

  // ── Section component helpers ───────────────────────────────────────────────

  const sectionDone = (keys: string[]) => keys.every(k => done.has(k as WeightKey));
  const sectionPartial = (keys: string[]) => keys.some(k => done.has(k as WeightKey)) && !sectionDone(keys);

  const SectionHeader = ({
    id, title, subtitle, icon: Icon, keys, accent,
  }: { id: SectionKey; title: string; subtitle: string; icon: React.ElementType; keys: string[]; accent?: 'blue' }) => {
    const isDone = sectionDone(keys);
    const isPartial = sectionPartial(keys);
    const activeBg = accent === 'blue' ? 'bg-blue-100' : 'bg-emerald-100';
    const activeIcon = accent === 'blue' ? 'text-blue-600' : 'text-emerald-600';
    return (
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDone ? activeBg : isPartial ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <Icon className={`h-5 w-5 ${isDone ? activeIcon : isPartial ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-800 text-sm">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDone && <CheckCircle className="h-5 w-5 text-emerald-500" />}
          {isPartial && <AlertCircle className="h-5 w-5 text-amber-400" />}
          {openSection === id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
    );
  };

  const circleR = 54;
  const circlePct = pct / 100;
  const circumference = 2 * Math.PI * circleR;

  return (
    <div className="space-y-6">
      {/* Progress ring */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <svg width="128" height="128" className="-rotate-90">
              <circle cx="64" cy="64" r={circleR} fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <circle
                cx="64" cy="64" r={circleR} fill="none"
                stroke={pct === 100 ? '#059669' : pct >= 60 ? '#0ea5e9' : '#f59e0b'}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - circlePct)}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-800">{pct}%</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Complete</span>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Complete Your Profile</h2>
            <p className="text-sm text-slate-500 mt-1">
              {pct < 40 ? 'A complete profile gets verified faster and builds trust with riders.' :
               pct < 80 ? 'Good progress! Keep going to unlock all features.' :
               pct < 100 ? 'Almost done — just a few more steps.' : 'Your profile is fully complete!'}
            </p>
            {pct < 100 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(Object.keys(OWNER_WEIGHTS) as WeightKey[])
                  .filter(k => !done.has(k))
                  .slice(0, 3)
                  .map(k => (
                    <span key={k} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                      {k.replace(/_/g, ' ')}
                    </span>
                  ))}
                {(Object.keys(OWNER_WEIGHTS) as WeightKey[]).filter(k => !done.has(k)).length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                    +{(Object.keys(OWNER_WEIGHTS) as WeightKey[]).filter(k => !done.has(k)).length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {(sectionSuccess || sectionError) && (
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium ${
          sectionError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {sectionError ? <AlertCircle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle className="h-4 w-4 flex-shrink-0" />}
          {sectionSuccess || sectionError}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">

        {/* ── COMPANY DETAILS (company owners only) ── */}
        {isCompany && (
          <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden">
            <SectionHeader
              id="company" title="Company / SACCO Details"
              subtitle="Business registration, KRA PIN and authorised contact"
              icon={Building2} keys={['company_name', 'business_reg_number', 'company_kra_pin', 'company_kra_pin_verified', 'contact_person_name']}
              accent="blue"
            />
            {openSection === 'company' && (
              <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Company / SACCO Name</label>
                    <input type="text" value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. Nairobi Riders SACCO Ltd"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Business Reg. Number</label>
                    <input type="text" value={businessRegNumber}
                      onChange={e => setBusinessRegNumber(e.target.value)}
                      placeholder="e.g. CPR/2024/123456"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono" />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Company KRA PIN</label>
                  <input type="text" value={companyKraPin}
                    onChange={e => setCompanyKraPin(e.target.value)}
                    placeholder="e.g. P051234567A"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono" />
                </div>
                {companyKraPin.trim() && (
                  <GovernmentVerificationField
                    type="kra_pin"
                    value={companyKraPin}
                    label="Company KRA PIN Verification"
                    onChange={() => {}}
                    onResult={setCompanyKraVerResult}
                  />
                )}

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Authorised Contact Person</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                      <input type="text" value={contactPersonName}
                        onChange={e => setContactPersonName(e.target.value)}
                        placeholder="Director or authorised rep."
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">National ID</label>
                      <input type="text" value={contactPersonId}
                        onChange={e => setContactPersonId(e.target.value)}
                        placeholder="ID number"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono" />
                    </div>
                  </div>
                </div>

                <button onClick={saveCompany} disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Company Details
                </button>
              </div>
            )}
          </div>
        )}

        {/* 1 — Identity & Tax */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="identity" title={isCompany ? 'Contact Person ID Verification' : 'Identity & Tax Verification'}
            subtitle={isCompany ? 'Verify the authorised contact person\'s government ID' : 'KRA PIN and government ID verification'}
            icon={Shield} keys={isCompany ? [] : ['id_verified', 'kra_pin', 'kra_pin_verified']}
          />
          {openSection === 'identity' && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
              <div className="pt-3">
                <GovernmentVerificationField
                  type="iprs"
                  value={owner.national_id}
                  label="National ID (IPRS)"
                  readOnly
                  onVerify={setIdVerResult}
                  initialResult={idVerResult}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">KRA PIN</label>
                <input
                  type="text"
                  value={kraPin}
                  onChange={e => setKraPin(e.target.value)}
                  placeholder="e.g. A123456789B"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
              {kraPin.trim() && (
                <GovernmentVerificationField
                  type="kra"
                  value={kraPin}
                  label="KRA PIN Verification"
                  onVerify={setKraVerResult}
                  initialResult={kraVerResult}
                />
              )}
              <button
                onClick={saveIdentity}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
        </div>

        {/* 2 — Next of Kin */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="nok" title="Next of Kin"
            subtitle="Emergency contact details"
            icon={Users} keys={['next_of_kin_name', 'next_of_kin_phone']}
          />
          {openSection === 'nok' && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={nokName}
                    onChange={e => setNokName(e.target.value)}
                    placeholder="Next of kin name"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={nokPhone}
                    onChange={e => setNokPhone(e.target.value)}
                    placeholder="07xx xxx xxx"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <button
                onClick={saveNok}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
        </div>

        {/* 3 — Operating Area */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="location" title="Operating Area"
            subtitle="County, constituency and ward"
            icon={MapPin} keys={['county']}
          />
          {openSection === 'location' && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
              <LocalitySelector
                countyId={locality.countyId}
                constituencyId={locality.constituencyId}
                wardId={locality.wardId}
                onChange={setLocality}
              />
              <button
                onClick={saveLocation}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
        </div>

        {/* 4 — Motorcycle Details */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="motorcycle" title="Motorcycle Details"
            subtitle="Registration, insurance and tracking"
            icon={Bike} keys={['motorcycle_registration', 'motorcycle_make', 'motorcycle_model', 'insurance_number']}
          />
          {openSection === 'motorcycle' && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'registration_number', label: 'Registration Number', placeholder: 'e.g. KDD 123A' },
                  { key: 'make', label: 'Make', placeholder: 'e.g. Bajaj' },
                  { key: 'model', label: 'Model', placeholder: 'e.g. Boxer' },
                  { key: 'tracking_device_id', label: 'Serial Number', placeholder: 'Optional' },
                  { key: 'insurance_policy_number', label: 'Insurance Policy No.', placeholder: 'e.g. INS-2024-12345' },
                  { key: 'insurance_provider', label: 'Insurance Provider', placeholder: 'e.g. APA Insurance' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={(motoForm as any)[key]}
                      onChange={e => setMotoForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Insurance Expiry</label>
                  <input
                    type="date"
                    value={motoForm.insurance_expiry}
                    onChange={e => setMotoForm(p => ({ ...p, insurance_expiry: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <button
                onClick={saveMotorcycle}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Motorcycle
              </button>
            </div>
          )}
        </div>

        {/* 5 — Documents */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="documents" title="Documents"
            subtitle="Bike photo, logbook, KRA PIN copy, insurance"
            icon={FileText} keys={['bike_photo', 'logbook', 'kra_pin_doc', 'insurance_cover']}
          />
          {openSection === 'documents' && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
              {!motorcycle && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Save motorcycle details first before uploading documents.
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  Each uploaded document is automatically read using OCR to verify it belongs to you.
                  The system checks the name and ID number against your profile and extracts issue/expiry dates.
                </p>
              </div>
              <DocumentValidationSummary
                userType="owner"
                userId={owner.id}
                expectedName={owner.full_name}
                expectedIdNumber={owner.national_id}
                expectedPlateNumber={motorcycle?.registration_number ?? motoForm.registration_number}
                knownExpiryDates={{ insurance_cover: motorcycle?.insurance_expiry ?? null }}
                documents={[
                  { docType: 'national_id', label: 'National ID / Passport', accept: 'image/*,application/pdf', icon: CreditCard, allowPassportToggle: true, hint: 'Toggle between National ID and Passport above' },
                  { docType: 'logbook', label: 'Logbook', accept: 'image/*,application/pdf', icon: BookOpen },
                  { docType: 'kra_pin_doc', label: 'KRA PIN Document', accept: 'image/*,application/pdf', icon: FileText },
                  { docType: 'insurance_cover', label: 'Insurance Cover Note', accept: 'image/*,application/pdf', icon: ShieldCheck },
                  { docType: 'bike_photo_side', label: 'Bike Photo (Side View)', accept: 'image/*', icon: Bike, hint: 'Take a clear side photo of the motorcycle' },
                  { docType: 'bike_photo_back', label: 'Bike Photo (Back / Plate)', accept: 'image/*', icon: Bike, hint: 'Photo from the back clearly showing the number plate' },
                ]}
                onValidationComplete={onUpdate}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
