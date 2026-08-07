import {
  CheckCircle, MapPin, AlertTriangle, Eye, Smartphone,
  ArrowRight, Star, Search, ShieldAlert
} from 'lucide-react';
import {
  PoliceBadgeIcon,
  MotorcycleIcon,
  TrafficFineIcon,
  QrVerifyIcon,
  IdentityCardIcon,
  GpsBeaconIcon,
  SmsBroadcastIcon,
  RevenueVaultIcon,
  ComplianceCheckIcon,
  CommandCenterIcon,
} from './icons/BrandIcons';
import AuthHeader from './AuthHeader';

type LandingPageProps = {
  onNavigate: (page: string) => void;
};

function HeroGraphic() {
  return (
    <svg viewBox="0 0 520 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Sky background */}
      <rect width="520" height="380" rx="24" fill="url(#skyGrad)" />

      {/* City skyline silhouette */}
      <rect x="0" y="220" width="520" height="160" fill="#0f172a" opacity="0.08" rx="0" />
      <rect x="20" y="200" width="40" height="80" fill="#1e293b" opacity="0.12" rx="2" />
      <rect x="30" y="185" width="20" height="20" fill="#1e293b" opacity="0.12" rx="1" />
      <rect x="70" y="180" width="55" height="100" fill="#1e293b" opacity="0.1" rx="2" />
      <rect x="82" y="170" width="12" height="14" fill="#1e293b" opacity="0.1" rx="1" />
      <rect x="135" y="210" width="35" height="70" fill="#1e293b" opacity="0.09" rx="2" />
      <rect x="180" y="195" width="50" height="85" fill="#1e293b" opacity="0.1" rx="2" />
      <rect x="240" y="205" width="30" height="75" fill="#1e293b" opacity="0.09" rx="2" />
      <rect x="280" y="175" width="60" height="105" fill="#1e293b" opacity="0.1" rx="2" />
      <rect x="295" y="163" width="14" height="16" fill="#1e293b" opacity="0.1" rx="1" />
      <rect x="350" y="200" width="45" height="80" fill="#1e293b" opacity="0.09" rx="2" />
      <rect x="405" y="185" width="55" height="95" fill="#1e293b" opacity="0.1" rx="2" />
      <rect x="465" y="210" width="40" height="70" fill="#1e293b" opacity="0.08" rx="2" />

      {/* Road */}
      <rect x="0" y="285" width="520" height="95" rx="0" fill="url(#roadGrad)" />
      {/* Road markings */}
      <rect x="60" y="315" width="40" height="6" rx="3" fill="white" opacity="0.3" />
      <rect x="140" y="315" width="40" height="6" rx="3" fill="white" opacity="0.3" />
      <rect x="220" y="315" width="40" height="6" rx="3" fill="white" opacity="0.3" />
      <rect x="300" y="315" width="40" height="6" rx="3" fill="white" opacity="0.3" />
      <rect x="380" y="315" width="40" height="6" rx="3" fill="white" opacity="0.3" />
      <rect x="460" y="315" width="40" height="6" rx="3" fill="white" opacity="0.3" />

      {/* Motorcycle body */}
      <g transform="translate(160, 230)">
        {/* Rear wheel */}
        <circle cx="30" cy="55" r="28" fill="#1e293b" />
        <circle cx="30" cy="55" r="20" fill="#334155" />
        <circle cx="30" cy="55" r="8" fill="#64748b" />
        {/* Front wheel */}
        <circle cx="155" cy="55" r="28" fill="#1e293b" />
        <circle cx="155" cy="55" r="20" fill="#334155" />
        <circle cx="155" cy="55" r="8" fill="#64748b" />
        {/* Frame */}
        <path d="M30 55 L75 20 L120 25 L155 55" stroke="#059669" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M75 20 L90 55 L30 55" stroke="#10b981" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M120 25 L140 10 L155 40" stroke="#059669" strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* Seat */}
        <ellipse cx="88" cy="16" rx="22" ry="7" fill="#059669" />
        {/* Handlebar */}
        <path d="M140 10 L148 2 M140 10 L148 18" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        {/* Engine */}
        <rect x="72" y="28" width="38" height="24" rx="4" fill="#10b981" opacity="0.8" />
        {/* Exhaust */}
        <path d="M30 55 Q15 58 5 65" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Headlight */}
        <ellipse cx="158" cy="20" rx="10" ry="7" fill="#fef08a" opacity="0.9" />
        <path d="M168 20 L195 15 M168 22 L195 28" stroke="#fef08a" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
      </g>

      {/* Rider */}
      <g transform="translate(245, 195)">
        {/* Helmet */}
        <circle cx="30" cy="12" r="14" fill="#059669" />
        <ellipse cx="30" cy="16" rx="14" ry="8" fill="#047857" />
        <rect x="22" y="14" width="16" height="8" rx="2" fill="#bef264" opacity="0.6" />
        {/* Body */}
        <rect x="20" y="26" width="22" height="28" rx="4" fill="#1e293b" />
        {/* Arms */}
        <path d="M20 30 L8 42 M42 30 L52 38" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
        {/* Legs */}
        <path d="M22 54 L18 68 M38 54 L42 65" stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
      </g>

      {/* QR code card floating */}
      <g transform="translate(355, 130)">
        <rect width="90" height="90" rx="12" fill="white" opacity="0.95" filter="url(#shadow)" />
        <rect x="8" y="8" width="74" height="74" rx="6" fill="white" />
        {/* QR pattern */}
        <rect x="12" y="12" width="22" height="22" rx="2" fill="#059669" />
        <rect x="15" y="15" width="16" height="16" rx="1" fill="white" />
        <rect x="18" y="18" width="10" height="10" rx="1" fill="#059669" />
        <rect x="56" y="12" width="22" height="22" rx="2" fill="#059669" />
        <rect x="59" y="15" width="16" height="16" rx="1" fill="white" />
        <rect x="62" y="18" width="10" height="10" rx="1" fill="#059669" />
        <rect x="12" y="56" width="22" height="22" rx="2" fill="#059669" />
        <rect x="15" y="59" width="16" height="16" rx="1" fill="white" />
        <rect x="18" y="62" width="10" height="10" rx="1" fill="#059669" />
        {/* QR dots */}
        <rect x="38" y="12" width="6" height="6" rx="1" fill="#059669" />
        <rect x="46" y="12" width="6" height="6" rx="1" fill="#059669" />
        <rect x="38" y="20" width="6" height="6" rx="1" fill="#059669" opacity="0.5" />
        <rect x="38" y="36" width="6" height="6" rx="1" fill="#059669" />
        <rect x="46" y="36" width="6" height="6" rx="1" fill="#059669" opacity="0.5" />
        <rect x="56" y="36" width="6" height="6" rx="1" fill="#059669" />
        <rect x="38" y="44" width="6" height="6" rx="1" fill="#059669" opacity="0.7" />
        <rect x="46" y="44" width="6" height="6" rx="1" fill="#059669" />
        <rect x="56" y="44" width="6" height="6" rx="1" fill="#059669" opacity="0.5" />
        <rect x="38" y="52" width="6" height="6" rx="1" fill="#059669" opacity="0.5" />
        <rect x="46" y="52" width="6" height="6" rx="1" fill="#059669" />
        <rect x="56" y="52" width="6" height="6" rx="1" fill="#059669" />
        <rect x="56" y="60" width="6" height="6" rx="1" fill="#059669" opacity="0.7" />
        <rect x="64" y="60" width="6" height="6" rx="1" fill="#059669" opacity="0.5" />
        <rect x="72" y="60" width="6" height="6" rx="1" fill="#059669" />
        <rect x="56" y="68" width="6" height="6" rx="1" fill="#059669" />
        <rect x="64" y="68" width="6" height="6" rx="1" fill="#059669" />
        <rect x="72" y="68" width="6" height="6" rx="1" fill="#059669" opacity="0.5" />
      </g>

      {/* GPS pin */}
      <g transform="translate(60, 100)">
        <rect width="78" height="46" rx="10" fill="white" opacity="0.92" filter="url(#shadow)" />
        <circle cx="20" cy="23" r="10" fill="#dcfce7" />
        <path d="M20 18 C17 18 15 20 15 23 C15 27 20 32 20 32 C20 32 25 27 25 23 C25 20 23 18 20 18Z" fill="#059669" />
        <circle cx="20" cy="23" r="3" fill="white" />
        <rect x="36" y="14" width="32" height="5" rx="2.5" fill="#e2e8f0" />
        <rect x="36" y="22" width="24" height="5" rx="2.5" fill="#e2e8f0" />
        <rect x="36" y="30" width="28" height="4" rx="2" fill="#bbf7d0" />
      </g>

      {/* Shield badge */}
      <g transform="translate(420, 80)">
        <rect width="72" height="72" rx="36" fill="white" opacity="0.92" filter="url(#shadow)" />
        <path d="M36 18 L52 24 L52 38 C52 46 44 52 36 54 C28 52 20 46 20 38 L20 24 Z" fill="url(#shieldGrad)" />
        <path d="M29 36 L34 41 L44 31" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Floating stat pills */}
      <g transform="translate(70, 175)">
        <rect width="110" height="34" rx="17" fill="white" opacity="0.92" filter="url(#shadow)" />
        <circle cx="17" cy="17" r="9" fill="#dcfce7" />
        <text x="17" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="#059669">✓</text>
        <text x="62" y="12" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f172a">Verified</text>
        <text x="62" y="24" textAnchor="middle" fontSize="9" fill="#64748b">Rider #BMS-4821</text>
      </g>

      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="520" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0fdf4" />
          <stop offset="50%" stopColor="#ecfdf5" />
          <stop offset="100%" stopColor="#d1fae5" />
        </linearGradient>
        <linearGradient id="roadGrad" x1="0" y1="285" x2="0" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.1" />
        </filter>
      </defs>
    </svg>
  );
}

const features = [
  {
    icon: <IdentityCardIcon className="h-6 w-6 text-white" strokeWidth={1.75} />,
    color: 'from-emerald-500 to-teal-600',
    title: 'Owner & Rider Registration',
    desc: 'Full digital onboarding for motorcycle owners and boda operators. Capture national IDs, KRA PIN, logbook, and bike photos with built-in OCR and government verification.',
  },
  {
    icon: <QrVerifyIcon className="h-6 w-6 text-white" strokeWidth={1.75} />,
    color: 'from-teal-500 to-cyan-600',
    title: 'QR Code Identity System',
    desc: 'Every registered motorcycle receives a unique scannable QR code. Passengers and officials can instantly verify ownership, rider details, and compliance status.',
  },
  {
    icon: <GpsBeaconIcon className="h-6 w-6 text-white" strokeWidth={1.75} />,
    color: 'from-blue-500 to-indigo-600',
    title: 'RAIDAR GPS Tracking',
    desc: 'Real-time location tracking via GPRS-enabled devices. Live map dashboard, route history, geofencing alerts, and remote monitoring for fleet owners.',
  },
  {
    icon: <ShieldAlert className="h-6 w-6 text-white" />,
    color: 'from-orange-500 to-red-500',
    title: 'Incident Reporting',
    desc: 'Public and registered users can file incident reports — accidents, theft, traffic violations, harassment — with OTP-verified phone authentication and evidence uploads.',
  },
  {
    icon: <TrafficFineIcon className="h-6 w-6 text-white" strokeWidth={1.75} />,
    color: 'from-violet-500 to-purple-600',
    title: 'Fines Management',
    desc: 'Issue, track, and pay traffic fines digitally. Automatic SMS notifications to riders on issuance. Full fine history with payment status and dispute workflows.',
  },
  {
    icon: <PoliceBadgeIcon className="h-6 w-6 text-white" strokeWidth={1.75} />,
    color: 'from-cyan-500 to-blue-600',
    title: 'Police Module',
    desc: 'Dedicated portal for officers to search registrations, verify compliance, log incidents, manage fines, and view assigned station data — all in real time.',
  },
  {
    icon: <SmsBroadcastIcon className="h-6 w-6 text-white" strokeWidth={1.75} />,
    color: 'from-rose-500 to-pink-600',
    title: 'SMS Notifications',
    desc: 'Automated SMS alerts for OTP verification, fine issuance, incident updates, and compliance reminders via bulk.ke gateway with configurable message templates.',
  },
  {
    icon: <RevenueVaultIcon className="h-6 w-6 text-white" strokeWidth={1.75} />,
    color: 'from-amber-500 to-orange-500',
    title: 'Revenue & Audit Dashboard',
    desc: 'Track registration fees, annual renewals, and fine collections. Full audit log of every system action, with role-based user and user-group access control.',
  },
  {
    icon: <Eye className="h-6 w-6 text-white" />,
    color: 'from-slate-600 to-slate-800',
    title: 'Public Verification',
    desc: 'Anyone can scan a bike\'s QR code or enter a plate number to instantly verify registration status, rider identity, and compliance — no login required.',
  },
];

const steps = [
  { num: '01', title: 'Register', desc: 'Owner submits motorcycle and personal details with supporting documents.' },
  { num: '02', title: 'Verify', desc: 'System performs OCR and government ID verification automatically.' },
  { num: '03', title: 'Get Your QR', desc: 'Download and print your unique QR code to display on your bike.' },
  { num: '04', title: 'Stay Compliant', desc: 'Renew annually, receive fine notices by SMS, and manage incidents online.' },
];

export default function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white font-sans">

      <AuthHeader onNavigate={onNavigate} activePage="home" />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50 pt-12 pb-0 sm:pt-20">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-100 rounded-full opacity-30 translate-x-1/3 -translate-y-1/3 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-100 rounded-full opacity-20 -translate-x-1/3 translate-y-1/3 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text */}
            <div className="text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-semibold text-emerald-700">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Kenya's Boda Management Platform
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                <span className="text-slate-900">Register.</span>
                <br />
                <span className="text-slate-900">Verify.</span>
                <br />
                <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Stay Secure.</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                The complete digital platform for bodaboda operators — registration, GPS tracking, incident reporting, police integration, and compliance management in one system.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <button
                  onClick={() => onNavigate('registration-choice')}
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-base hover:shadow-2xl hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  Get Registered
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => onNavigate('verify')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 rounded-2xl font-semibold text-base hover:shadow-lg border-2 border-slate-200 hover:border-emerald-300 transition-all duration-200"
                >
                  <QrVerifyIcon className="h-5 w-5 text-emerald-600" strokeWidth={1.75} />
                  Verify a Bike
                </button>
                <button
                  onClick={() => onNavigate('report-incident')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-red-700 rounded-2xl font-semibold text-base hover:shadow-lg border-2 border-red-200 hover:border-red-400 transition-all duration-200"
                >
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Report Incident
                </button>
              </div>

              <div className="flex items-center gap-6 justify-center lg:justify-start pt-2">
                <div className="flex -space-x-2">
                  {['#059669','#0d9488','#0891b2','#7c3aed'].map((c, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold" style={{ background: c }}>
                      {['JM','AK','BN','SW'][i]}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-slate-600">
                  <div className="flex items-center gap-1 font-semibold text-slate-800">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    Trusted by operators across Kenya
                  </div>
                </div>
              </div>
            </div>

            {/* Graphic */}
            <div className="relative w-full max-w-lg mx-auto lg:mx-0">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl transform rotate-3 scale-95 opacity-60" />
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-emerald-100">
                <HeroGraphic />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Compliance Status</p>
                  <p className="text-sm font-bold text-slate-900">Verified & Active</p>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Live Tracking</p>
                  <p className="text-sm font-bold text-slate-900">Nairobi, Kenya</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="mt-16 sm:mt-24">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 60 C360 0 1080 0 1440 60 L1440 60 L0 60Z" fill="#f8fafc" />
          </svg>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section className="bg-slate-50 py-10 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { value: '9 Modules', label: 'Integrated features', icon: <ComplianceCheckIcon className="h-5 w-5" /> },
              { value: '47 Counties', label: 'Locality coverage', icon: <MapPin className="h-5 w-5" /> },
              { value: 'Real-time', label: 'GPS tracking', icon: <GpsBeaconIcon className="h-5 w-5" /> },
              { value: 'SMS + OTP', label: 'Secure authentication', icon: <Smartphone className="h-5 w-5" /> },
            ].map(({ value, label, icon }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">{icon}</div>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{value}</p>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-emerald-600 font-bold text-sm uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
              Everything you need to operate legally
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              BMS covers the full lifecycle of bodaboda management — from first registration to daily operations.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map(({ icon, color, title, desc }) => (
              <div key={title} className="group bg-white rounded-2xl p-7 border border-slate-100 hover:border-emerald-200 hover:shadow-xl transition-all duration-300 cursor-default">
                <div className={`bg-gradient-to-br ${color} rounded-2xl w-14 h-14 flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-emerald-600 font-bold text-sm uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">Get registered in four steps</h2>
            <p className="text-lg text-slate-500">Simple, fast, and fully digital — no physical office visits needed.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="relative flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg mb-5 group-hover:scale-110 transition-transform">
                  <span className="text-xl font-extrabold text-white">{num}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REPORT AN INCIDENT ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-red-50 via-white to-orange-50 border-y border-red-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-8 items-center">
            <div className="lg:col-span-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-200 rounded-full text-sm font-semibold text-red-700 mb-4">
                <AlertTriangle className="h-4 w-4" />
                Public reporting channel
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
                Witnessed an incident?<br />
                <span className="text-red-600">Report it in minutes.</span>
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6 max-w-xl">
                Search for the motorcycle by registration or rider ID to link your report — or file a report
                with whatever details you can remember. Location, timeline, evidence photos, and a phone
                OTP check all in one flow.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {[
                  { icon: <Search className="h-4 w-4" />, label: 'Search or skip' },
                  { icon: <MapPin className="h-4 w-4" />, label: 'Add location & time' },
                  { icon: <Smartphone className="h-4 w-4" />, label: 'OTP-verified' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 bg-white rounded-xl border border-red-100 px-3 py-2 shadow-sm">
                    <span className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                      {icon}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onNavigate('report-incident')}
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-red-600 text-white rounded-2xl font-bold text-base hover:bg-red-700 hover:shadow-xl hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <AlertTriangle className="h-5 w-5" />
                  Report an Incident
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => onNavigate('verify')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 rounded-2xl font-semibold text-base hover:shadow-lg border-2 border-slate-200 hover:border-red-300 transition-all duration-200"
                >
                  <QrVerifyIcon className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
                  Verify a Bike First
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="relative bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-7">
                <div className="absolute -top-3 -right-3 w-12 h-12 bg-red-500 rounded-2xl shadow-lg flex items-center justify-center">
                  <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-3">How it works</p>
                <div className="space-y-4">
                  {[
                    { n: '1', t: 'Search (optional)', d: 'Enter number plate or rider ID to find the bike.' },
                    { n: '2', t: 'Describe the incident', d: 'Type, timeline, location, and any witnesses you remember.' },
                    { n: '3', t: 'Verify your phone', d: 'We send an OTP to prevent malicious reports.' },
                    { n: '4', t: 'Submit securely', d: 'Admins and assigned officers take it from there.' },
                  ].map(({ n, t, d }) => (
                    <div key={n} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm">
                        {n}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{t}</p>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PORTALS ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-emerald-600 font-bold text-sm uppercase tracking-widest mb-3">Access Portals</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">A portal for every role</h2>
            <p className="text-lg text-slate-500">Tailored dashboards for owners, riders, police officers, and administrators.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <IdentityCardIcon className="h-7 w-7 text-emerald-600" strokeWidth={1.75} />, bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'Motorcycle Owner', desc: 'Manage your fleet, assign riders, track locations, and view incident history.', page: 'user-login', cta: 'Owner Login' },
              { icon: <MotorcycleIcon className="h-7 w-7 text-teal-600" strokeWidth={1.75} />, bg: 'bg-teal-50', border: 'border-teal-200', title: 'Boda Rider', desc: 'View your profile, respond to incidents, and check your compliance status.', page: 'rider-login', cta: 'Rider Login' },
              { icon: <PoliceBadgeIcon className="h-7 w-7 text-blue-600" strokeWidth={1.75} />, bg: 'bg-blue-50', border: 'border-blue-200', title: 'Police Officer', desc: 'Search registrations, issue fines, log incidents, and verify roadside compliance.', page: 'police', cta: 'Police Portal' },
              { icon: <CommandCenterIcon className="h-7 w-7 text-blue-600" strokeWidth={1.75} />, bg: 'bg-blue-50', border: 'border-blue-200', title: 'Administrator', desc: 'Full system control — users, settings, revenue, audit logs, and system configuration.', page: 'admin', cta: 'Admin Login' },
            ].map(({ icon, bg, border, title, desc, page, cta }) => (
              <div key={title} className={`rounded-2xl p-6 border-2 ${border} ${bg} flex flex-col hover:shadow-lg transition-all duration-200`}>
                <div className="mb-4">{icon}</div>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed flex-1 mb-5">{desc}</p>
                <button
                  onClick={() => onNavigate(page)}
                  className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-full text-white text-sm font-semibold mb-8 border border-white/20">
            <CheckCircle className="h-4 w-4" />
            Free to register — annual fee applies
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-5 leading-tight">
            Ready to go digital?
          </h2>
          <p className="text-lg sm:text-xl text-emerald-100 mb-10 leading-relaxed">
            Join the growing network of compliant, verified boda operators. Registration takes under 10 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onNavigate('registration-choice')}
              className="group inline-flex items-center justify-center gap-2 px-10 py-4 bg-white text-emerald-700 rounded-2xl font-bold text-base hover:bg-emerald-50 hover:scale-105 transition-all duration-200 shadow-xl"
            >
              Register Now
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => onNavigate('verify')}
              className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-transparent text-white border-2 border-white/40 rounded-2xl font-semibold text-base hover:bg-white/10 transition-all duration-200"
            >
              <QrVerifyIcon className="h-5 w-5" strokeWidth={1.75} />
              Verify a Bike
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/government-of-kenya-emblem-gok-logo-png_seeklogo-318197 (1).png" alt="Government of Kenya" className="h-10 w-10 object-contain brightness-0 invert" />
                <div>
                  <p className="text-white font-bold text-base leading-none">BMS</p>
                  <p className="text-slate-500 text-xs mt-0.5">Boda Management System</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                Kenya's digital platform for bodaboda registration, compliance, tracking, and law enforcement integration.
              </p>
              <p className="text-xs text-slate-600">
                Powered by <span className="text-emerald-400 font-semibold">Hiram Technologies</span>
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Portals</h4>
              <div className="space-y-2.5 text-sm">
                {[
                  { label: 'Register', page: 'registration-choice' },
                  { label: 'Owner Login', page: 'user-login' },
                  { label: 'Rider Login', page: 'rider-login' },
                  { label: 'Police Portal', page: 'police' },
                  { label: 'Admin Portal', page: 'admin' },
                ].map(({ label, page }) => (
                  <button key={page} onClick={() => onNavigate(page)}
                    className="block hover:text-emerald-400 transition-colors text-left">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Features</h4>
              <div className="space-y-2.5 text-sm">
                {['QR Code Verification', 'GPS Tracking', 'Incident Reporting', 'Fines Management', 'SMS Notifications', 'Audit Logs'].map(f => (
                  <p key={f} className="text-slate-500">{f}</p>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Contact</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Email</p>
                  <p className="text-slate-300">support@hiramtech.co.ke</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Phone</p>
                  <p className="text-slate-300">+254 700 000 000</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Location</p>
                  <p className="text-slate-300">Nairobi, Kenya</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <p className="text-slate-600">&copy; {new Date().getFullYear()} BMS — Boda Management System. All rights reserved.</p>
            <p className="text-slate-600">
              Built by <span className="text-emerald-400 font-semibold">Hiram Technologies</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
