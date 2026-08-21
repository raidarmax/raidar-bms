import { useState, useEffect } from 'react';
import {
  CheckCircle, ChevronDown, ChevronUp, Loader2, Save,
  Shield, Users, MapPin, FileText, AlertCircle, Briefcase,
  ShieldCheck, Award, CreditCard, Bike,
} from 'lucide-react';
import { supabase, type Rider } from '../lib/supabase';
import GovernmentVerificationField, { type VerifyResult } from './GovernmentVerificationField';
import LocalitySelector from './LocalitySelector';
import DocumentValidationSummary from './DocumentValidationSummary';

// ── Completion weights ─────────────────────────────────────────────────────────
const RIDER_WEIGHTS = {
  name: 5, id_number: 5, phone_number: 5,
  id_verified: 10, kra_pin: 5, kra_pin_verified: 5,
  license_number: 8, license_verified: 7,
  next_of_kin_name: 5, next_of_kin_phone: 5,
  county: 5,
  photo_url: 8, license_url: 8, good_conduct_url: 8, id_copy_url: 6,
} as const;

type WeightKey = keyof typeof RIDER_WEIGHTS;

type ExtendedRider = Rider & {
  county_id?: number | null;
  constituency_id?: number | null;
  ward_id?: number | null;
};

function computeCompletion(rider: ExtendedRider): { pct: number; done: Set<WeightKey> } {
  const done = new Set<WeightKey>();
  if (rider.name) done.add('name');
  if (rider.id_number) done.add('id_number');
  if (rider.phone_number) done.add('phone_number');
  if (rider.id_verified) done.add('id_verified');
  if (rider.kra_pin) done.add('kra_pin');
  if (rider.kra_pin_verified) done.add('kra_pin_verified');
  if (rider.license_number) done.add('license_number');
  if (rider.license_verified) done.add('license_verified');
  if (rider.next_of_kin_name) done.add('next_of_kin_name');
  if (rider.next_of_kin_phone) done.add('next_of_kin_phone');
  if (rider.county_id) done.add('county');
  if (rider.photo_url) done.add('photo_url');
  if (rider.license_url) done.add('license_url');
  if (rider.good_conduct_url) done.add('good_conduct_url');
  if (rider.id_copy_url) done.add('id_copy_url');
  const pct = Array.from(done).reduce((s, k) => s + RIDER_WEIGHTS[k], 0);
  return { pct, done };
}

type RiderProfileCompletionProps = {
  rider: ExtendedRider;
  onUpdate: () => void;
};

type SectionKey = 'identity' | 'professional' | 'nok' | 'location' | 'documents';

export default function RiderProfileCompletion({ rider, onUpdate }: RiderProfileCompletionProps) {
  const { pct, done } = computeCompletion(rider);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [sectionSuccess, setSectionSuccess] = useState('');

  // Identity
  const [kraPin, setKraPin] = useState(rider.kra_pin ?? '');
  const [idVerResult, setIdVerResult] = useState<VerifyResult | null>(rider.id_verified ? { verified: true } : null);
  const [kraVerResult, setKraVerResult] = useState<VerifyResult | null>(rider.kra_pin_verified ? { verified: true } : null);

  // Professional
  const [licenseNumber, setLicenseNumber] = useState(rider.license_number ?? '');
  const [licenseClass, setLicenseClass] = useState(rider.license_class ?? '');
  const [licenseExpiry, setLicenseExpiry] = useState(rider.license_expiry ?? '');
  const [saccoId, setSaccoId] = useState(rider.sacco_id ?? '');
  const [stageName, setStageName] = useState(rider.stage_name ?? '');
  const [licenseVerResult, setLicenseVerResult] = useState<VerifyResult | null>(rider.license_verified ? { verified: true } : null);

  // NOK
  const [nokName, setNokName] = useState(rider.next_of_kin_name ?? '');
  const [nokPhone, setNokPhone] = useState(rider.next_of_kin_phone ?? '');

  // Location
  const [locality, setLocality] = useState({
    countyId: (rider.county_id ?? null) as number | null,
    constituencyId: (rider.constituency_id ?? null) as number | null,
    wardId: (rider.ward_id ?? null) as number | null,
  });

  const [regNumber, setRegNumber] = useState('');

  useEffect(() => {
    (async () => {
      if (!rider.motorcycle_id) return;
      const { data } = await supabase
        .from('motorcycles')
        .select('registration_number')
        .eq('id', rider.motorcycle_id)
        .maybeSingle();
      if (data) setRegNumber(data.registration_number);
    })();
  }, [rider.motorcycle_id]);

  const flash = (msg: string, isError = false) => {
    if (isError) setSectionError(msg); else setSectionSuccess(msg);
    setTimeout(() => { setSectionError(''); setSectionSuccess(''); }, 3000);
  };

  const toggle = (s: SectionKey) => setOpenSection(prev => prev === s ? null : s);

  const saveIdentity = async () => {
    setSaving(true);
    const { error } = await supabase.from('riders').update({
      kra_pin: kraPin.trim().toUpperCase() || null,
      id_verified: idVerResult?.verified ?? false,
      kra_pin_verified: kraVerResult?.verified ?? false,
    }).eq('id', rider.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Identity details saved!');
    onUpdate();
  };

  const saveProfessional = async () => {
    setSaving(true);
    const { error } = await supabase.from('riders').update({
      license_number: licenseNumber.trim() || null,
      license_class: licenseClass.trim() || null,
      license_expiry: licenseExpiry || null,
      license_verified: licenseVerResult?.verified ?? false,
      sacco_id: saccoId.trim() || null,
      stage_name: stageName.trim() || null,
    }).eq('id', rider.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Professional details saved!');
    onUpdate();
  };

  const saveNok = async () => {
    setSaving(true);
    const { error } = await supabase.from('riders').update({
      next_of_kin_name: nokName.trim() || null,
      next_of_kin_phone: nokPhone.trim() || null,
    }).eq('id', rider.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Next of kin saved!');
    onUpdate();
  };

  const saveLocation = async () => {
    setSaving(true);
    const { error } = await supabase.from('riders').update({
      county_id: locality.countyId,
      constituency_id: locality.constituencyId,
      ward_id: locality.wardId,
    }).eq('id', rider.id);
    setSaving(false);
    if (error) { flash('Failed to save. Please try again.', true); return; }
    flash('Location saved!');
    onUpdate();
  };

  const sectionDone = (keys: WeightKey[]) => keys.every(k => done.has(k));
  const sectionPartial = (keys: WeightKey[]) => keys.some(k => done.has(k)) && !sectionDone(keys);

  const SectionHeader = ({
    id, title, subtitle, icon: Icon, keys,
  }: { id: SectionKey; title: string; subtitle: string; icon: React.ElementType; keys: WeightKey[] }) => {
    const isDone = sectionDone(keys);
    const isPartial = sectionPartial(keys);
    return (
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDone ? 'bg-emerald-100' : isPartial ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <Icon className={`h-5 w-5 ${isDone ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-slate-400'}`} />
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
              {pct < 40 ? 'A complete profile helps match you with motorcycle owners faster.' :
               pct < 80 ? 'Good progress! Keep going to unlock all features.' :
               pct < 100 ? 'Almost done — just a few more steps.' : 'Your profile is fully complete!'}
            </p>
            {pct < 100 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(Object.keys(RIDER_WEIGHTS) as WeightKey[])
                  .filter(k => !done.has(k))
                  .slice(0, 3)
                  .map(k => (
                    <span key={k} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                      {k.replace(/_/g, ' ')}
                    </span>
                  ))}
                {(Object.keys(RIDER_WEIGHTS) as WeightKey[]).filter(k => !done.has(k)).length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                    +{(Object.keys(RIDER_WEIGHTS) as WeightKey[]).filter(k => !done.has(k)).length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {(sectionSuccess || sectionError) && (
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium ${
          sectionError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {sectionError ? <AlertCircle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle className="h-4 w-4 flex-shrink-0" />}
          {sectionSuccess || sectionError}
        </div>
      )}

      <div className="space-y-3">
        {/* 1 — Identity & Tax */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="identity" title="Identity & Tax Verification"
            subtitle="KRA PIN and government ID verification"
            icon={Shield} keys={['id_verified', 'kra_pin', 'kra_pin_verified']}
          />
          {openSection === 'identity' && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
              <GovernmentVerificationField
                type="iprs"
                value={rider.id_number}
                label="National ID (IPRS)"
                readOnly
                onVerify={setIdVerResult}
                initialResult={idVerResult}
              />
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

        {/* 2 — Professional Details */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="professional" title="Professional Details"
            subtitle="License, SACCO and stage information"
            icon={Briefcase} keys={['license_number', 'license_verified']}
          />
          {openSection === 'professional' && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Driving License No.</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                    placeholder="e.g. DL12345678"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">License Class</label>
                  <select
                    value={licenseClass}
                    onChange={e => setLicenseClass(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white"
                  >
                    <option value="">Select class</option>
                    <option value="A">Class A — Motorcycle</option>
                    <option value="B">Class B — Light Vehicle</option>
                    <option value="C">Class C — Heavy Vehicle</option>
                    <option value="D">Class D — PSV</option>
                    <option value="G">Class G — General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">License Expiry Date</label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={e => setLicenseExpiry(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                  {licenseExpiry && (() => {
                    const days = Math.ceil((new Date(licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (days < 0) {
                      return (
                        <p className="mt-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 inline-flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" /> Expired {Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} ago
                        </p>
                      );
                    }
                    if (days <= 30) {
                      return (
                        <p className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 inline-flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" /> Expiring in {days} day{days === 1 ? '' : 's'}
                        </p>
                      );
                    }
                    return (
                      <p className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 inline-flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Valid for {days} more day{days === 1 ? '' : 's'}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">SACCO / Operator ID</label>
                  <input
                    type="text"
                    value={saccoId}
                    onChange={e => setSaccoId(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Stage Name</label>
                  <input
                    type="text"
                    value={stageName}
                    onChange={e => setStageName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
              {licenseNumber.trim() && (
                <GovernmentVerificationField
                  type="ntsa"
                  value={licenseNumber}
                  label="License Verification (NTSA TIMS)"
                  onVerify={setLicenseVerResult}
                  initialResult={licenseVerResult}
                />
              )}
              <button
                onClick={saveProfessional}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          )}
        </div>

        {/* 3 — Next of Kin */}
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

        {/* 4 — Operating Area */}
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

        {/* 5 — Documents */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <SectionHeader
            id="documents" title="Documents"
            subtitle="Rider photo, license copy, good conduct cert, KRA PIN, ID copy"
            icon={FileText} keys={['photo_url', 'license_url', 'good_conduct_url', 'id_copy_url']}
          />
          {openSection === 'documents' && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  Each uploaded document is automatically read using OCR to verify it belongs to you.
                  The system checks the name and ID number against your profile and extracts issue/expiry dates.
                </p>
              </div>
              <DocumentValidationSummary
                userType="rider"
                userId={rider.id}
                expectedName={rider.name}
                expectedIdNumber={rider.id_number}
                expectedPlateNumber={regNumber}
                knownExpiryDates={{ driving_license: rider.license_expiry ?? null }}
                documents={[
                  { docType: 'national_id', label: 'National ID / Passport', accept: 'image/*,application/pdf', icon: CreditCard, allowPassportToggle: true, hint: 'Toggle between National ID and Passport above' },
                  { docType: 'driving_license', label: 'Driving Licence (or NTSA Receipt)', accept: 'image/*,application/pdf', icon: CreditCard, hint: 'Licence card OR NTSA payment receipt' },
                  { docType: 'good_conduct', label: 'Good Conduct Certificate', accept: 'image/*,application/pdf', icon: Award },
                  { docType: 'kra_pin_doc', label: 'KRA PIN Certificate', accept: 'image/*,application/pdf', icon: FileText, hint: 'KRA PIN certificate or iTax printout' },
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
