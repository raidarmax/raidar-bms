import { useState } from 'react';
import {
  Menu, X, AlertTriangle, ShieldCheck, User, Bike, Shield, Sparkles,
} from 'lucide-react';

type AuthHeaderProps = {
  onNavigate: (page: string) => void;
  variant?: 'light' | 'dark';
  activePage?: string;
};

type NavTone = 'default' | 'danger';

type NavLink = {
  label: string;
  page: string;
  Icon: typeof ShieldCheck;
  tone?: NavTone;
};

const NAV_LINKS: NavLink[] = [
  { label: 'Verify', page: 'verify', Icon: ShieldCheck },
  { label: 'Report Incident', page: 'report-incident', Icon: AlertTriangle, tone: 'danger' },
  { label: 'Owner Login', page: 'user-login', Icon: User },
  { label: 'Rider Login', page: 'rider-login', Icon: Bike },
  { label: 'Admin', page: 'admin', Icon: Shield },
];

export default function AuthHeader({ onNavigate, variant = 'light', activePage }: AuthHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = variant === 'dark';

  const linkClasses = (page: string, tone?: NavTone) => {
    const isActive = activePage === page;

    if (isActive) {
      if (tone === 'danger') {
        return dark
          ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40'
          : 'bg-red-50 text-red-700 ring-1 ring-red-200';
      }
      return dark
        ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40'
        : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    }

    if (tone === 'danger') {
      return dark
        ? 'text-red-300/90 hover:text-red-200 hover:bg-red-500/10'
        : 'text-red-600 hover:text-red-700 hover:bg-red-50';
    }
    return dark
      ? 'text-slate-300 hover:text-white hover:bg-white/10'
      : 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50';
  };

  return (
    <nav
      className={`sticky top-0 z-50 backdrop-blur-xl border-b font-display ${
        dark
          ? 'bg-slate-950/85 border-slate-800/70 shadow-[0_1px_0_0_rgba(255,255,255,0.04)]'
          : 'bg-white/85 border-slate-200/70 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 sm:h-24">
          <button
            onClick={() => onNavigate('home')}
            className="group flex flex-col items-start leading-none"
          >
            <img
              src="/bms_f_logo.png"
              alt="BMS"
              className="h-[2.8rem] sm:h-[3.2rem] w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span className="mt-1 text-[9px] sm:text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500">
              Boda Management System
            </span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, page, Icon, tone }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold tracking-tight transition-all duration-200 ${linkClasses(page, tone)}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.4} />
                <span>{label}</span>
              </button>
            ))}
            <button
              onClick={() => onNavigate('registration-choice')}
              className={`group relative ml-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold tracking-tight transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 ${
                activePage === 'registration-choice'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white'
              }`}
            >
              <Sparkles className="h-4 w-4 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.6} />
              Register Now
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`md:hidden p-2 rounded-xl transition-colors ${
              dark ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" strokeWidth={2.4} /> : <Menu className="h-6 w-6" strokeWidth={2.4} />}
          </button>
        </div>

        {mobileOpen && (
          <div className={`md:hidden pb-4 pt-2 space-y-1 border-t font-display ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
            {NAV_LINKS.map(({ label, page, Icon, tone }) => (
              <button
                key={page}
                onClick={() => {
                  onNavigate(page);
                  setMobileOpen(false);
                }}
                className={`w-full inline-flex items-center gap-3 text-left px-4 py-3 rounded-xl text-sm font-bold tracking-tight transition-colors ${linkClasses(page, tone)}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.4} />
                {label}
              </button>
            ))}
            <div className="pt-2">
              <button
                onClick={() => {
                  onNavigate('registration-choice');
                  setMobileOpen(false);
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-extrabold tracking-tight shadow-md"
              >
                <Sparkles className="h-4 w-4" strokeWidth={2.6} />
                Register Now
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
