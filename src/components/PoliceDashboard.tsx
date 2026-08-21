import { useState, useEffect, useRef } from 'react';
import { Search, Users, Activity, LogOut, Bell, Lock, Menu, X, User, Camera, Save, Pencil, TrendingUp, ChevronRight, MapPin, BadgeCheck, ChevronLeft } from 'lucide-react';
import {
  IncidentAlertIcon,
  TrafficFineIcon,
  QrVerifyIcon,
  PoliceBadgeIcon,
  ComplianceCheckIcon,
  CommandCenterIcon,
} from './icons/BrandIcons';
import { supabase, type PoliceOfficerWithStation, type Fine, type Incident } from '../lib/supabase';
import { PoliceAuthService } from '../lib/policeAuth';
import PoliceIncidents from './police/PoliceIncidents';
import PoliceFines from './police/PoliceFines';
import PoliceSearch from './police/PoliceSearch';
import PoliceVerify from './police/PoliceVerify';
import PoliceOfficers from './police/PoliceOfficers';

type PoliceDashboardProps = {
  officer: PoliceOfficerWithStation;
  onLogout: () => void;
};

type NavItem = {
  id: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: CommandCenterIcon },
  { id: 'incidents', label: 'Incidents', icon: IncidentAlertIcon },
  { id: 'fines', label: 'Fines', icon: TrafficFineIcon },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'verify', label: 'Verify Documents', icon: QrVerifyIcon },
  { id: 'officers', label: 'Officers', icon: PoliceBadgeIcon, adminOnly: true },
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'profile', label: 'My Profile', icon: User },
];

export default function PoliceDashboard({ officer, onLogout }: PoliceDashboardProps) {
  const [activeView, setActiveViewRaw] = useState(() => {
    const saved = localStorage.getItem('policeActiveView');
    const valid = ['dashboard','incidents','fines','search','verify','officers','activity','profile'];
    return (saved && valid.includes(saved)) ? saved : 'dashboard';
  });
  const setActiveView = (view: string) => {
    localStorage.setItem('policeActiveView', view);
    setActiveViewRaw(view);
  };
  const [showPasswordModal, setShowPasswordModal] = useState(officer.must_change_password);
  const [stats, setStats] = useState({
    newIncidents: 0,
    activeIncidents: 0,
    finesToday: 0,
    finesMonth: 0,
    verificationsToday: 0,
    totalFineRevenue: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [recentFines, setRecentFines] = useState<Fine[]>([]);
  const [notifications, setNotifications] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('police.sidebar.collapsed') === 'true');
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('police.sidebar.collapsed', String(next));
  };

  useEffect(() => {
    if (!showPasswordModal) {
      loadDashboardData();
    }
  }, [showPasswordModal]);

  const loadDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [incidentsRes, finesRes, finesMonthRes, verificationsRes, notifRes] = await Promise.all([
      supabase.from('incidents')
        .select('*')
        .eq('assigned_station_id', officer.station_id)
        .in('police_status', ['assigned', 'investigating'])
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('fines')
        .select('*')
        .eq('station_id', officer.station_id)
        .gte('issued_at', today)
        .order('issued_at', { ascending: false }),
      supabase.from('fines')
        .select('fine_amount')
        .eq('station_id', officer.station_id)
        .gte('issued_at', monthStart),
      supabase.from('police_verification_logs')
        .select('id')
        .eq('station_id', officer.station_id)
        .gte('created_at', today),
      supabase.from('incident_police_notifications')
        .select('id')
        .eq('station_id', officer.station_id)
        .eq('is_read', false),
    ]);

    const monthFines = finesMonthRes.data || [];
    const totalRev = monthFines.reduce((sum, f) => sum + (f.fine_amount || 0), 0);

    setStats({
      newIncidents: (incidentsRes.data || []).filter(i => i.police_status === 'assigned').length,
      activeIncidents: (incidentsRes.data || []).length,
      finesToday: (finesRes.data || []).length,
      finesMonth: monthFines.length,
      verificationsToday: (verificationsRes.data || []).length,
      totalFineRevenue: totalRev,
    });

    setRecentIncidents(incidentsRes.data || []);
    setRecentFines((finesRes.data || []).slice(0, 5));
    setNotifications((notifRes.data || []).length);
  };

  const filteredNavItems = NAV_ITEMS.filter(item => !item.adminOnly || officer.is_station_admin);

  const renderContent = () => {
    switch (activeView) {
      case 'incidents':
        return <PoliceIncidents officer={officer} />;
      case 'fines':
        return <PoliceFines officer={officer} />;
      case 'search':
        return <PoliceSearch officer={officer} />;
      case 'verify':
        return <PoliceVerify officer={officer} />;
      case 'officers':
        return officer.is_station_admin ? <PoliceOfficers officer={officer} /> : null;
      case 'activity':
        return <ActivityLog officer={officer} />;
      case 'profile':
        return <PoliceProfile officer={officer} />;
      default:
        return <DashboardHome stats={stats} recentIncidents={recentIncidents} recentFines={recentFines} onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {showPasswordModal && (
        <PasswordChangeModal officerId={officer.id} onComplete={() => setShowPasswordModal(false)} />
      )}

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transform transition-all duration-200 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4 border-b border-slate-200 shrink-0 justify-between">
          <div className="flex items-center min-w-0">
            <img
              src="/bms_f_logo.png"
              alt="BMS"
              className="h-10 w-auto max-w-[150px] object-contain flex-shrink-0"
            />
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Officer profile */}
        <div className={`px-4 py-3 border-b border-slate-200 bg-slate-50/60 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-white shadow-sm">
              {officer.profile_photo_url ? (
                <img src={officer.profile_photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">{officer.full_name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{officer.full_name}</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 capitalize">
                  <span className="truncate">{officer.rank.replace(/_/g, ' ')}</span>
                  {officer.is_station_admin && (
                    <span className="ml-0.5 px-1 py-px rounded bg-emerald-100 text-emerald-700 font-semibold text-[9px] uppercase tracking-wider shrink-0">Admin</span>
                  )}
                </div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <p className="text-[10px] text-slate-500 truncate mt-1.5 flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />
              {officer.station.station_name}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setMobileMenuOpen(false); }}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-left transition-all text-sm font-display ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                {!sidebarCollapsed && <span className="flex-1">{item.label}</span>}
                {!sidebarCollapsed && item.id === 'incidents' && notifications > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-500 text-white'
                  }`}>
                    {notifications > 9 ? '9+' : notifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-200 p-3 shrink-0 space-y-2">
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition font-medium"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={() => { localStorage.removeItem('policeActiveView'); onLogout(); }}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} min-w-0 transition-all duration-200`}>
        <header className="bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-6 py-3 sticky top-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg lg:hidden">
                <Menu className="w-5 h-5 text-slate-700" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>BMS · Police</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{officer.station.station_name}</span>
                </div>
                <h1 className="text-base lg:text-xl font-bold text-slate-900 capitalize leading-tight truncate font-display">
                  {activeView === 'dashboard' ? `Welcome, ${officer.full_name.split(' ')[0]}` : filteredNavItems.find(i => i.id === activeView)?.label}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <button
                className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
                onClick={() => setActiveView('incidents')}
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {notifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {notifications > 9 ? '9+' : notifications}
                  </span>
                )}
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <BadgeCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900 leading-none">{officer.service_number}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Service No.</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

function DashboardHome({ stats, recentIncidents, recentFines, onNavigate }: {
  stats: any;
  recentIncidents: Incident[];
  recentFines: Fine[];
  onNavigate: (view: string) => void;
}) {
  const statCards = [
    {
      label: 'New Incidents',
      value: stats.newIncidents,
      hint: 'Awaiting action',
      gradient: 'from-red-500 to-rose-600',
      icon: IncidentAlertIcon,
      onClick: () => onNavigate('incidents'),
    },
    {
      label: 'Active Cases',
      value: stats.activeIncidents,
      hint: 'Under investigation',
      gradient: 'from-amber-500 to-orange-600',
      icon: PoliceBadgeIcon,
      onClick: () => onNavigate('incidents'),
    },
    {
      label: 'Fines Today',
      value: stats.finesToday,
      hint: 'Issued today',
      gradient: 'from-blue-500 to-blue-700',
      icon: TrafficFineIcon,
      onClick: () => onNavigate('fines'),
    },
    {
      label: 'Fines This Month',
      value: stats.finesMonth,
      hint: 'Monthly count',
      gradient: 'from-emerald-500 to-teal-600',
      icon: TrendingUp,
      onClick: () => onNavigate('fines'),
    },
    {
      label: 'Verifications Today',
      value: stats.verificationsToday,
      hint: 'Documents checked',
      gradient: 'from-slate-600 to-slate-800',
      icon: ComplianceCheckIcon,
      onClick: () => onNavigate('verify'),
    },
    {
      label: 'Monthly Revenue',
      value: `KES ${stats.totalFineRevenue.toLocaleString()}`,
      hint: 'Fines collected value',
      gradient: 'from-cyan-500 to-blue-600',
      icon: TrafficFineIcon,
      onClick: () => onNavigate('fines'),
    },
  ];

  const quickActions = [
    { label: 'Verify Documents', icon: QrVerifyIcon, view: 'verify', accent: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
    { label: 'Search Records', icon: Search, view: 'search', accent: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
    { label: 'Issue Fine', icon: TrafficFineIcon, view: 'fines', accent: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
    { label: 'View Incidents', icon: IncidentAlertIcon, view: 'incidents', accent: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero briefing */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
        <div className="absolute right-6 top-4 opacity-20">
          <img src="/bms_f_logo.png" alt="BMS" className="h-14 w-auto object-contain" />
        </div>
        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-semibold">Station Briefing</p>
          <h2 className="text-2xl font-bold mt-1">Today at a glance</h2>
          <p className="text-sm text-emerald-50/90 mt-1 max-w-xl leading-relaxed">
            {stats.newIncidents > 0
              ? `You have ${stats.newIncidents} new incident${stats.newIncidents === 1 ? '' : 's'} awaiting your attention and ${stats.activeIncidents} case${stats.activeIncidents === 1 ? '' : 's'} currently active.`
              : stats.activeIncidents > 0
                ? `${stats.activeIncidents} case${stats.activeIncidents === 1 ? ' is' : 's are'} in progress. No new incidents right now.`
                : 'No active incidents. Use this time to catch up on verifications and searches.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.view}
                  onClick={() => onNavigate(a.view)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur text-xs font-semibold text-white border border-white/10 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <button
              key={i}
              onClick={card.onClick}
              className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} p-4 text-left text-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all`}
            >
              <div className="absolute -right-3 -bottom-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon className="h-16 w-16" />
              </div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-4 w-4 text-white/80" />
                  <ChevronRight className="h-3.5 w-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-2xl font-bold leading-tight">{card.value}</p>
                <p className="text-[11px] font-semibold text-white/90 mt-1">{card.label}</p>
                <p className="text-[10px] text-white/60 mt-0.5">{card.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <IncidentAlertIcon className="h-3.5 w-3.5 text-red-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Active Incidents</h3>
            </div>
            <button onClick={() => onNavigate('incidents')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              View all
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentIncidents.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No active incidents</p>
            ) : (
              recentIncidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => onNavigate('incidents')}
                  className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {incident.case_number && (
                        <span className="text-[10px] font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                          {incident.case_number}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-slate-900 capitalize">{incident.incident_type.replace(/_/g, ' ')}</p>
                    </div>
                    {incident.location && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="h-2.5 w-2.5" />
                        {incident.location}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    incident.police_status === 'assigned' ? 'bg-amber-100 text-amber-700' :
                    incident.police_status === 'investigating' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {incident.police_status?.replace(/_/g, ' ') || 'unassigned'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrafficFineIcon className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Recent Fines</h3>
            </div>
            <button onClick={() => onNavigate('fines')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              View all
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentFines.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No fines issued today</p>
            ) : (
              recentFines.map((fine) => (
                <button
                  key={fine.id}
                  onClick={() => onNavigate('fines')}
                  className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{fine.rider_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{fine.fine_reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">KES {fine.fine_amount.toLocaleString()}</p>
                    <p className={`text-[10px] font-semibold capitalize ${
                      fine.status === 'paid' ? 'text-emerald-600' :
                      fine.status === 'overdue' ? 'text-red-600' :
                      'text-amber-600'
                    }`}>{fine.status}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PoliceProfile({ officer }: { officer: PoliceOfficerWithStation }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoUrl, setPhotoUrl] = useState(officer.profile_photo_url);
  const [form, setForm] = useState({
    full_name: officer.full_name,
    phone_number: officer.phone_number,
    email: officer.email ?? '',
  });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Photo must be a JPEG, PNG, or WebP image. HEIC and other formats are not supported — please export as JPEG first.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`Photo is ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 5MB — please compress or crop the image before uploading.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPhotoUploading(true);
    try {
      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const ext = extMap[file.type] || 'jpg';
      const path = `${officer.id}/profile.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('police-profiles')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('police-profiles')
        .getPublicUrl(path);

      const url = `${publicUrl}?t=${Date.now()}`;
      const { error: dbError } = await supabase
        .from('police_officers')
        .update({ profile_photo_url: url })
        .eq('id', officer.id);

      if (dbError) throw dbError;

      setPhotoUrl(url);
      setSuccess('Profile photo updated.');
    } catch (err: any) {
      setError('Failed to upload photo: ' + (err?.message ?? 'Unknown error'));
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!form.phone_number.trim()) {
      setError('Phone number is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    const { error: dbError } = await supabase
      .from('police_officers')
      .update({
        full_name: form.full_name.trim(),
        phone_number: form.phone_number.trim(),
        email: form.email.trim() || null,
      })
      .eq('id', officer.id);

    setSaving(false);
    if (dbError) {
      setError('Failed to save: ' + dbError.message);
    } else {
      setSuccess('Profile updated successfully.');
      setEditing(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }

    setPwSaving(true);
    try {
      await PoliceAuthService.changePassword(officer.id, pwForm.current, pwForm.next);
      setPwSuccess('Password changed successfully.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      setPwError(err.message ?? 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
          {!editing ? (
            <button
              onClick={() => { setEditing(true); setSuccess(''); setError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setError(''); setForm({ full_name: officer.full_name, phone_number: officer.phone_number, email: officer.email ?? '' }); }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">{success}</div>
        )}

        {/* Photo + Identity */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-blue-100 border-2 border-blue-200 overflow-hidden flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-blue-700 font-bold text-2xl">{(form.full_name || officer.full_name).charAt(0).toUpperCase()}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
              title="Upload photo"
            >
              {photoUploading ? (
                <div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{form.full_name}</p>
            <p className="text-sm text-gray-500 capitalize">{officer.rank.replace(/_/g, ' ')}</p>
            <p className="text-xs text-blue-600 mt-0.5">{officer.service_number}</p>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
            {editing ? (
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <p className="text-sm font-medium text-gray-900 bg-slate-50 rounded-lg px-3 py-2">{form.full_name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone Number</label>
            {editing ? (
              <input
                type="tel"
                value={form.phone_number}
                onChange={(e) => setForm(f => ({ ...f, phone_number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <p className="text-sm font-medium text-gray-900 bg-slate-50 rounded-lg px-3 py-2">{form.phone_number}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email Address</label>
            {editing ? (
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <p className="text-sm font-medium text-gray-900 bg-slate-50 rounded-lg px-3 py-2">{form.email || <span className="text-gray-400 italic">Not set</span>}</p>
            )}
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Service Number</p>
            <p className="text-sm font-semibold text-gray-900">{officer.service_number}</p>
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">National ID</p>
            <p className="text-sm font-semibold text-gray-900">{officer.national_id}</p>
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Station</p>
            <p className="text-sm font-semibold text-gray-900">{officer.station.station_name}</p>
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Role</p>
            <p className="text-sm font-semibold text-gray-900">{officer.is_station_admin ? 'Station Admin' : 'Officer'}</p>
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last Login</p>
            <p className="text-sm font-semibold text-gray-900">
              {officer.last_login_at ? new Date(officer.last_login_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <Lock className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
        </div>

        {pwError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{pwError}</div>
        )}
        {pwSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">{pwSuccess}</div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))}
              required
              minLength={8}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={pwSaving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {pwSaving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ActivityLog({ officer }: { officer: PoliceOfficerWithStation }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const query = supabase
      .from('police_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!officer.is_station_admin) {
      query.eq('officer_id', officer.id);
    } else {
      query.in('officer_id', [officer.id]);
    }

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading activity...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-5 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Activity Log</h3>
      </div>
      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {logs.length === 0 ? (
          <p className="p-5 text-sm text-gray-500 text-center">No activity recorded</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">{log.action_type.replace('_', ' ')}</p>
                {log.target_type && <p className="text-xs text-gray-500">Target: {log.target_type}</p>}
              </div>
              <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PasswordChangeModal({ officerId, onComplete }: { officerId: string; onComplete: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await PoliceAuthService.changePassword(officerId, currentPassword, newPassword);
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
            <p className="text-sm text-gray-500">You must change your password on first login.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
