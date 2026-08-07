import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, DollarSign, Plus, CreditCard as Edit3, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, Clock, X, TrendingUp, Users, Building2, FileText, Eye, Info, Ban, LayoutDashboard, BarChart3, MapPin, Filter, RotateCcw, Calendar, ChevronLeft, ChevronRight, Ticket } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FinesInsights from './FinesInsights';
import FineReceiptModal, { type FineReceiptData } from './FineReceiptModal';

type TrafficOffence = {
  id: string;
  offence_code: string;
  offence_name: string;
  description: string;
  fine_amount: number;
  category: string;
  is_active: boolean;
  applicable_incident_types: string[];
  is_finable_default: boolean;
  created_at: string;
};

type FineRecord = {
  id: string;
  fine_reference: string;
  fine_amount: number;
  status: string;
  rider_name: string;
  rider_phone: string;
  rider_national_id: string;
  location_description: string;
  issued_at: string;
  due_date: string;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  incident_id: string | null;
  origin: 'standalone' | 'from_incident';
  offence?: { offence_name: string; offence_code: string };
  officer?: { full_name: string; service_number: string; rank?: string | null; badge_number?: string | null };
  station?: { station_name: string };
  county?: { county_name: string };
};

const INCIDENT_TYPES: { value: string; label: string }[] = [
  { value: 'accident', label: 'Accident' },
  { value: 'crime', label: 'Crime' },
  { value: 'traffic_violation', label: 'Traffic violation' },
  { value: 'theft', label: 'Theft' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'speeding', label: 'Speeding' },
  { value: 'reckless_driving', label: 'Reckless driving' },
  { value: 'no_helmet', label: 'No helmet' },
  { value: 'overloading', label: 'Overloading' },
  { value: 'other', label: 'Other' },
];

type SubTab = 'overview' | 'offences' | 'fines' | 'officers';

const CATEGORIES = [
  { value: 'traffic', label: 'Traffic', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'documentation', label: 'Documentation', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'safety', label: 'Safety', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'public_order', label: 'Public Order', color: 'bg-teal-50 text-teal-700 border-teal-200' },
];

export default function FinesManagement() {
  const [subTab, setSubTab] = useState<SubTab>('overview');

  const TABS = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'offences' as const, label: 'Offense Classes', icon: FileText },
    { id: 'fines' as const, label: 'Issued Fines', icon: DollarSign },
    { id: 'officers' as const, label: 'Officer Activity', icon: Users },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <DollarSign className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Fines Management</h2>
          <p className="text-sm text-slate-500">Manage offenses, view fines, and track enforcement</p>
        </div>
      </div>

      {/* Sub-tabs (underlined) */}
      <div className="border-b border-slate-200 sticky top-0 bg-white z-10 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {subTab === 'overview' && <FinesInsights />}
      {subTab === 'offences' && <OffencesPanel />}
      {subTab === 'fines' && <FinesListPanel />}
      {subTab === 'officers' && <OfficerActivityPanel />}
    </div>
  );
}

function OverviewPanel() {
  const [stats, setStats] = useState({
    totalFines: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
    fineCount: 0,
    paidCount: 0,
    overdueCount: 0,
    issuedThisMonth: 0,
    collectedThisMonth: 0,
    disputedCount: 0,
    cancelledCount: 0,
  });
  const [topOffences, setTopOffences] = useState<{ offence_name: string; count: number; amount: number }[]>([]);
  const [topStations, setTopStations] = useState<{ station_name: string; count: number; collected: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ label: string; issued: number; collected: number; count: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; count: number; amount: number }[]>([]);
  const [topCounties, setTopCounties] = useState<{ name: string; count: number; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOverview(); }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [finesRes, offencesRes, stationsRes, countiesRes] = await Promise.all([
        supabase.from('fines').select('fine_amount, status, issued_at, paid_at, county_id'),
        supabase.from('fines').select('fine_amount, status, offence:traffic_offences(offence_name, category)'),
        supabase.from('fines').select('fine_amount, status, station:police_stations(station_name)'),
        supabase.from('fines').select('fine_amount, county_id, county:kenya_counties(county_name)'),
      ]);

      const finesData = finesRes.data;
      if (finesData) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const paid = finesData.filter(f => f.status === 'paid');
        const overdue = finesData.filter(f => f.status === 'overdue');
        const outstanding = finesData.filter(f => f.status === 'issued' || f.status === 'overdue');
        const disputed = finesData.filter(f => f.status === 'disputed');
        const cancelled = finesData.filter(f => f.status === 'cancelled');

        setStats({
          totalFines: finesData.reduce((s, f) => s + f.fine_amount, 0),
          totalCollected: paid.reduce((s, f) => s + f.fine_amount, 0),
          totalOutstanding: outstanding.reduce((s, f) => s + f.fine_amount, 0),
          totalOverdue: overdue.reduce((s, f) => s + f.fine_amount, 0),
          fineCount: finesData.length,
          paidCount: paid.length,
          overdueCount: overdue.length,
          issuedThisMonth: finesData.filter(f => f.issued_at >= monthStart).length,
          collectedThisMonth: paid.filter(f => f.paid_at && f.paid_at >= monthStart).reduce((s, f) => s + f.fine_amount, 0),
          disputedCount: disputed.length,
          cancelledCount: cancelled.length,
        });

        // Monthly trend (6 months)
        const months: { label: string; issued: number; collected: number; count: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          const rowsIssued = finesData.filter(f => {
            const dt = new Date(f.issued_at);
            return dt >= d && dt < next;
          });
          const collectedInMonth = finesData
            .filter(f => f.status === 'paid' && f.paid_at && new Date(f.paid_at) >= d && new Date(f.paid_at) < next)
            .reduce((s, f) => s + f.fine_amount, 0);
          months.push({
            label,
            issued: rowsIssued.reduce((s, f) => s + f.fine_amount, 0),
            collected: collectedInMonth,
            count: rowsIssued.length,
          });
        }
        setMonthlyTrend(months);
      }

      if (offencesRes.data) {
        // Category breakdown
        const catGrouped: Record<string, { count: number; amount: number }> = {};
        const offenceGrouped: Record<string, { count: number; amount: number }> = {};
        offencesRes.data.forEach((f: any) => {
          const cat = f.offence?.category || 'uncategorized';
          const name = f.offence?.offence_name || 'Unknown';
          if (!catGrouped[cat]) catGrouped[cat] = { count: 0, amount: 0 };
          catGrouped[cat].count++;
          catGrouped[cat].amount += f.fine_amount;
          if (!offenceGrouped[name]) offenceGrouped[name] = { count: 0, amount: 0 };
          offenceGrouped[name].count++;
          offenceGrouped[name].amount += f.fine_amount;
        });
        setCategoryBreakdown(
          Object.entries(catGrouped)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.count - a.count)
        );
        setTopOffences(
          Object.entries(offenceGrouped)
            .map(([offence_name, data]) => ({ offence_name, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        );
      }

      if (stationsRes.data) {
        const grouped: Record<string, { count: number; collected: number }> = {};
        stationsRes.data.forEach((f: any) => {
          const name = f.station?.station_name || 'Unassigned';
          if (!grouped[name]) grouped[name] = { count: 0, collected: 0 };
          grouped[name].count++;
          if (f.status === 'paid') grouped[name].collected += f.fine_amount;
        });
        setTopStations(
          Object.entries(grouped)
            .map(([station_name, data]) => ({ station_name, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        );
      }

      if (countiesRes.data) {
        const grouped: Record<string, { count: number; amount: number }> = {};
        countiesRes.data.forEach((f: any) => {
          const name = f.county?.county_name || 'Unassigned';
          if (!grouped[name]) grouped[name] = { count: 0, amount: 0 };
          grouped[name].count++;
          grouped[name].amount += f.fine_amount;
        });
        setTopCounties(
          Object.entries(grouped)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        );
      }
    } catch (e) {
      console.error('Error loading overview:', e);
    } finally {
      setLoading(false);
    }
  };

  const collectionRate = useMemo(() => {
    return stats.fineCount > 0 ? Math.round((stats.paidCount / stats.fineCount) * 100) : 0;
  }, [stats]);

  const CATEGORY_COLORS: Record<string, string> = {
    traffic: '#2563eb',
    documentation: '#d97706',
    safety: '#dc2626',
    public_order: '#0d9488',
    uncategorized: '#94a3b8',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
        <span className="ml-3 text-sm text-slate-600">Loading overview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-6 w-6 text-white/90" />
            <span className="text-[10px] font-bold text-white/80 tracking-wider">COLLECTED</span>
          </div>
          <p className="text-3xl font-bold">KES {stats.totalCollected.toLocaleString()}</p>
          <p className="text-sm text-white/90 mt-1">{stats.paidCount} paid fines</p>
          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
            <span className="text-white/80">Collection rate</span>
            <span className="font-semibold">{collectionRate}%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-6 w-6 text-slate-500" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">TOTAL</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">KES {stats.totalFines.toLocaleString()}</p>
          <p className="text-sm text-slate-500 mt-1">{stats.fineCount} fines issued</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">This month</span>
            <span className="font-semibold text-slate-800">{stats.issuedThisMonth} new</span>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-6 w-6 text-amber-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">OUTSTANDING</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">KES {stats.totalOutstanding.toLocaleString()}</p>
          <p className="text-sm text-slate-500 mt-1">Awaiting collection</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Disputed</span>
            <span className="font-semibold text-slate-800">{stats.disputedCount}</span>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">OVERDUE</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">KES {stats.totalOverdue.toLocaleString()}</p>
          <p className="text-sm text-slate-500 mt-1">{stats.overdueCount} past due</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Cancelled</span>
            <span className="font-semibold text-slate-800">{stats.cancelledCount}</span>
          </div>
        </div>
      </div>

      {/* Monthly trend + Collection rate donut */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Enforcement Trend</h3>
              <p className="text-xs text-slate-500">Issued vs collected over the last 6 months</p>
            </div>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>
          <FinesTrendChart points={monthlyTrend} />
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-500">This month</p>
              <p className="text-sm font-semibold text-slate-800">{stats.issuedThisMonth} fines</p>
            </div>
            <div>
              <p className="text-slate-500">Revenue MTD</p>
              <p className="text-sm font-semibold text-emerald-600">KES {stats.collectedThisMonth.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500">Avg fine</p>
              <p className="text-sm font-semibold text-slate-800">
                KES {stats.fineCount > 0 ? Math.round(stats.totalFines / stats.fineCount).toLocaleString() : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Category Mix</h3>
          <p className="text-xs text-slate-500 mb-3">Fines grouped by offense class</p>
          {categoryBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data yet</div>
          ) : (
            <FinesDonut
              data={categoryBreakdown.map(c => ({
                label: c.category.replace('_', ' '),
                value: c.count,
                color: CATEGORY_COLORS[c.category] || '#94a3b8',
              }))}
            />
          )}
        </div>
      </div>

      {/* Category breakdown bars + Collection health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Offense Categories</h3>
          <p className="text-xs text-slate-500 mb-4">Volume and revenue by category</p>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No fines data yet</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((c) => {
                const maxAmt = Math.max(...categoryBreakdown.map(x => x.amount), 1);
                const pct = (c.amount / maxAmt) * 100;
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c.category] || '#94a3b8' }} />
                        <span className="text-sm font-medium text-slate-700 capitalize">{c.category.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-400">({c.count})</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">KES {c.amount.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(pct, 4)}%`, background: CATEGORY_COLORS[c.category] || '#94a3b8' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Collection Health</h3>
          <p className="text-xs text-slate-500 mb-4">Where fine values sit in the lifecycle</p>
          <CollectionHealthBar
            paid={stats.totalCollected}
            outstanding={stats.totalOutstanding - stats.totalOverdue}
            overdue={stats.totalOverdue}
          />
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-slate-500">Paid</p>
              <p className="text-sm font-bold text-emerald-600">{stats.paidCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Pending</p>
              <p className="text-sm font-bold text-amber-600">{stats.fineCount - stats.paidCount - stats.overdueCount - stats.cancelledCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Overdue</p>
              <p className="text-sm font-bold text-red-600">{stats.overdueCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top offences + Top stations + Geography */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Top Offences</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">Most frequently issued</p>
          {topOffences.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {topOffences.map((o, i) => {
                const maxCount = Math.max(...topOffences.map(x => x.count), 1);
                const pct = (o.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-medium text-slate-700 truncate flex-1 mr-2">{o.offence_name}</span>
                      <span className="font-semibold text-slate-800 whitespace-nowrap">{o.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Top Stations</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">Ranked by enforcement volume</p>
          {topStations.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {topStations.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-200 text-slate-700' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{s.station_name}</p>
                    <p className="text-xs text-slate-500">{s.count} fines</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 whitespace-nowrap">
                    KES {s.collected.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Top Counties</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">Geographic distribution</p>
          {topCounties.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {topCounties.map((c, i) => {
                const maxAmt = Math.max(...topCounties.map(x => x.amount), 1);
                const pct = (c.amount / maxAmt) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-medium text-slate-700 truncate flex-1 mr-2">{c.name}</span>
                      <span className="font-semibold text-slate-800 whitespace-nowrap">
                        KES {c.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FinesTrendChart({ points }: { points: { label: string; issued: number; collected: number; count: number }[] }) {
  if (points.length === 0 || points.every(p => p.issued === 0)) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No trend data yet</div>;
  }
  const width = 420, height = 170, padL = 32, padR = 12, padT = 12, padB = 26;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(...points.map(p => Math.max(p.issued, p.collected)), 1);
  const step = chartW / points.length;
  const barW = step * 0.32;

  const ticks = 3;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxVal / ticks) * i));

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-full">
        <defs>
          <linearGradient id="finesIssuedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="finesCollectedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {tickVals.map((t) => {
          const y = padT + chartH - (t / maxVal) * chartH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
              <text x={padL - 4} y={y + 3} fontSize="8" fill="#94a3b8" textAnchor="end">
                {t >= 1000 ? `${(t / 1000).toFixed(0)}K` : t}
              </text>
            </g>
          );
        })}

        {points.map((p, i) => {
          const x = padL + i * step + step / 2;
          const issuedH = (p.issued / maxVal) * chartH;
          const collectedH = (p.collected / maxVal) * chartH;
          return (
            <g key={p.label}>
              <rect x={x - barW - 2} y={padT + chartH - issuedH} width={barW} height={issuedH} fill="url(#finesIssuedGrad)" rx={2}>
                <title>{p.label} issued: KES {p.issued.toLocaleString()} ({p.count} fines)</title>
              </rect>
              <rect x={x + 2} y={padT + chartH - collectedH} width={barW} height={collectedH} fill="url(#finesCollectedGrad)" rx={2}>
                <title>{p.label} collected: KES {p.collected.toLocaleString()}</title>
              </rect>
              <text x={x} y={height - padB + 12} fontSize="9" fill="#64748b" textAnchor="middle">{p.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 justify-center mt-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#d97706' }} />
          <span className="text-slate-600">Issued</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#059669' }} />
          <span className="text-slate-600">Collected</span>
        </div>
      </div>
    </div>
  );
}

function FinesDonut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data yet</div>;
  }
  const cx = 70, cy = 70, r = 52, innerR = 32;
  let angle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const ix1 = cx + innerR * Math.cos(angle);
    const iy1 = cy + innerR * Math.sin(angle);
    const ix2 = cx + innerR * Math.cos(angle - sweep);
    const iy2 = cy + innerR * Math.sin(angle - sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...d,
      path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`,
    };
  });
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {slices.map((s) => (
          <path key={s.label} d={s.path} fill={s.color} stroke="white" strokeWidth="2">
            <title>{s.label}: {s.value}</title>
          </path>
        ))}
        <text x="70" y="66" textAnchor="middle" fontSize="11" fill="#94a3b8">TOTAL</text>
        <text x="70" y="82" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">{total}</text>
      </svg>
      <div className="space-y-1.5 min-w-[120px]">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 flex-1 capitalize truncate">{s.label}</span>
            <span className="font-semibold text-slate-800">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollectionHealthBar({ paid, outstanding, overdue }: { paid: number; outstanding: number; overdue: number }) {
  const total = paid + outstanding + overdue;
  if (total === 0) {
    return <div className="flex items-center justify-center h-24 text-slate-400 text-sm">No fines yet</div>;
  }
  const paidPct = (paid / total) * 100;
  const outPct = (outstanding / total) * 100;
  const overPct = (overdue / total) * 100;
  return (
    <div className="space-y-3">
      <div className="h-6 rounded-full overflow-hidden flex bg-slate-100">
        {paidPct > 0 && (
          <div className="h-full bg-emerald-500 flex items-center justify-center" style={{ width: `${paidPct}%` }}>
            {paidPct > 12 && <span className="text-[10px] font-bold text-white">{Math.round(paidPct)}%</span>}
          </div>
        )}
        {outPct > 0 && (
          <div className="h-full bg-amber-500 flex items-center justify-center" style={{ width: `${outPct}%` }}>
            {outPct > 12 && <span className="text-[10px] font-bold text-white">{Math.round(outPct)}%</span>}
          </div>
        )}
        {overPct > 0 && (
          <div className="h-full bg-red-500 flex items-center justify-center" style={{ width: `${overPct}%` }}>
            {overPct > 12 && <span className="text-[10px] font-bold text-white">{Math.round(overPct)}%</span>}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-500">Collected</span>
          <span className="font-semibold text-slate-800 ml-auto">KES {paid.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-500">Pending</span>
          <span className="font-semibold text-slate-800 ml-auto">KES {outstanding.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-slate-500">Overdue</span>
          <span className="font-semibold text-slate-800 ml-auto">KES {overdue.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function OffencesPanel() {
  const [offences, setOffences] = useState<TrafficOffence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOffence, setEditingOffence] = useState<TrafficOffence | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => { loadOffences(); }, []);

  const loadOffences = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('traffic_offences')
      .select('*')
      .order('category')
      .order('offence_name');
    if (data) setOffences(data);
    setLoading(false);
  };

  const toggleActive = async (offence: TrafficOffence) => {
    await supabase
      .from('traffic_offences')
      .update({ is_active: !offence.is_active })
      .eq('id', offence.id);
    setOffences(prev => prev.map(o =>
      o.id === offence.id ? { ...o, is_active: !o.is_active } : o
    ));
  };

  const filtered = filterCategory === 'all'
    ? offences
    : offences.filter(o => o.category === filterCategory);

  const getCategoryStyle = (cat: string) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found?.color || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{offences.length} offense classes defined</p>
        <button
          onClick={() => { setEditingOffence(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> Add Offense
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
            filterCategory === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          All ({offences.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = offences.filter(o => o.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                filterCategory === cat.value ? 'bg-slate-800 text-white border-slate-800' : cat.color
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Offense</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Amount (KES)</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((offence) => (
                  <tr key={offence.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{offence.offence_code}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{offence.offence_name}</p>
                      {offence.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{offence.description}</p>
                      )}
                      {(offence.applicable_incident_types?.length || 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {offence.applicable_incident_types.slice(0, 3).map((t) => {
                            const label = INCIDENT_TYPES.find((it) => it.value === t)?.label || t;
                            return (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                {label}
                              </span>
                            );
                          })}
                          {offence.applicable_incident_types.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              +{offence.applicable_incident_types.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${getCategoryStyle(offence.category)}`}>
                        {offence.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {offence.fine_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${offence.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {offence.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingOffence(offence); setShowForm(true); }}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(offence)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                          title={offence.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {offence.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <OffenceFormModal
          offence={editingOffence}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadOffences(); }}
        />
      )}
    </div>
  );
}

function OffenceFormModal({ offence, onClose, onSaved }: {
  offence: TrafficOffence | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    offence_code: offence?.offence_code || '',
    offence_name: offence?.offence_name || '',
    description: offence?.description || '',
    fine_amount: offence?.fine_amount || 500,
    category: offence?.category || 'traffic',
    is_active: offence?.is_active ?? true,
    applicable_incident_types: offence?.applicable_incident_types || [],
    is_finable_default: offence?.is_finable_default ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleIncidentType = (value: string) => {
    setForm((p) => ({
      ...p,
      applicable_incident_types: p.applicable_incident_types.includes(value)
        ? p.applicable_incident_types.filter((t) => t !== value)
        : [...p.applicable_incident_types, value],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.offence_code || !form.offence_name || !form.fine_amount) {
      setError('Code, name, and amount are required.');
      return;
    }
    setSubmitting(true);
    try {
      if (offence) {
        const { error: err } = await supabase
          .from('traffic_offences')
          .update({
            offence_code: form.offence_code.toUpperCase(),
            offence_name: form.offence_name,
            description: form.description,
            fine_amount: form.fine_amount,
            category: form.category,
            is_active: form.is_active,
            applicable_incident_types: form.applicable_incident_types,
            is_finable_default: form.is_finable_default,
          })
          .eq('id', offence.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('traffic_offences')
          .insert({
            offence_code: form.offence_code.toUpperCase(),
            offence_name: form.offence_name,
            description: form.description,
            fine_amount: form.fine_amount,
            category: form.category,
            is_active: form.is_active,
            applicable_incident_types: form.applicable_incident_types,
            is_finable_default: form.is_finable_default,
          });
        if (err) throw err;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save offense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{offence ? 'Edit Offense' : 'Add New Offense'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-700">{error}</p></div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Offense Code *</label>
              <input
                value={form.offence_code}
                onChange={(e) => setForm(p => ({ ...p, offence_code: e.target.value.toUpperCase() }))}
                placeholder="TF016"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Offense Name *</label>
            <input
              value={form.offence_name}
              onChange={(e) => setForm(p => ({ ...p, offence_name: e.target.value }))}
              placeholder="e.g. Operating without side mirrors"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional description of the offense..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fine Amount (KES) *</label>
            <input
              type="number"
              min={0}
              value={form.fine_amount}
              onChange={(e) => setForm(p => ({ ...p, fine_amount: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Applicable Incident Types</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  When resolving one of these incident types, this offense will be suggested first. Leave all unchecked to apply to any incident type.
                </p>
              </div>
              {form.applicable_incident_types.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, applicable_incident_types: [] }))}
                  className="text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INCIDENT_TYPES.map((t) => {
                const checked = form.applicable_incident_types.includes(t.value);
                return (
                  <label
                    key={t.value}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIncidentType(t.value)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300"
                    />
                    <span className="font-medium">{t.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg bg-white cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={form.is_finable_default}
              onChange={(e) => setForm(p => ({ ...p, is_finable_default: e.target.checked }))}
              className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300"
            />
            <div>
              <p className="text-sm font-medium text-slate-800">Suggest as default fine</p>
              <p className="text-xs text-slate-500 mt-0.5">
                When enabled, officers will see this offense pre-selected when resolving matching incidents.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Active (available for officers to issue)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? 'Saving...' : offence ? 'Update Offense' : 'Create Offense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FinesListPanel() {
  const PAGE_SIZE = 20;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countyId, setCountyId] = useState<string>('all');
  const [stationId, setStationId] = useState<string>('all');
  const [offenceId, setOffenceId] = useState<string>('all');
  const [officerId, setOfficerId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [fines, setFines] = useState<FineRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, paid: 0, outstanding: 0, overdue: 0 });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedFine, setSelectedFine] = useState<FineRecord | null>(null);
  const [receiptFine, setReceiptFine] = useState<FineReceiptData | null>(null);

  const [counties, setCounties] = useState<{ id: number; county_name: string }[]>([]);
  const [stations, setStations] = useState<{ id: string; station_name: string; county_id: number | null }[]>([]);
  const [offences, setOffences] = useState<{ id: string; offence_name: string; offence_code: string }[]>([]);
  const [officers, setOfficers] = useState<{ id: string; full_name: string; service_number: string }[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [c, s, o, off] = await Promise.all([
        supabase.from('kenya_counties').select('id, county_name').order('county_name'),
        supabase.from('police_stations').select('id, station_name, county_id').eq('is_active', true).order('station_name'),
        supabase.from('traffic_offences').select('id, offence_name, offence_code').order('offence_name'),
        supabase.from('police_officers').select('id, full_name, service_number').eq('is_active', true).order('full_name').limit(500),
      ]);
      setCounties(c.data || []);
      setStations(s.data || []);
      setOffences(o.data || []);
      setOfficers(off.data || []);
    })();
  }, []);

  const filteredStations = useMemo(() => {
    if (countyId === 'all') return stations;
    return stations.filter((s) => String(s.county_id) === countyId);
  }, [stations, countyId]);

  const loadFines = useCallback(async () => {
    setLoading(true);
    try {
      let base = supabase
        .from('fines')
        .select(
          '*, offence:traffic_offences(offence_name, offence_code), officer:police_officers(full_name, service_number, rank, badge_number), station:police_stations(station_name), county:kenya_counties(county_name)',
          { count: 'exact' }
        )
        .order('issued_at', { ascending: false });

      const q = searchQuery.trim();
      if (q.length >= 3) {
        base = base.or(
          `fine_reference.ilike.%${q}%,rider_name.ilike.%${q}%,rider_phone.ilike.%${q}%,rider_national_id.ilike.%${q}%,location_description.ilike.%${q}%`
        );
      }
      if (statusFilter !== 'all') base = base.eq('status', statusFilter);
      if (countyId !== 'all') base = base.eq('county_id', Number(countyId));
      if (stationId !== 'all') base = base.eq('station_id', stationId);
      if (offenceId !== 'all') base = base.eq('offence_id', offenceId);
      if (officerId !== 'all') base = base.eq('issued_by_officer_id', officerId);
      if (dateFrom) base = base.gte('issued_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        base = base.lte('issued_at', end.toISOString());
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await base.range(from, to);
      setFines(data || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.error('Failed to load fines:', e);
      setFines([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, countyId, stationId, offenceId, officerId, dateFrom, dateTo, page]);

  const loadSummary = useCallback(async () => {
    let base = supabase.from('fines').select('fine_amount, status');
    const q = searchQuery.trim();
    if (q.length >= 3) {
      base = base.or(
        `fine_reference.ilike.%${q}%,rider_name.ilike.%${q}%,rider_phone.ilike.%${q}%,rider_national_id.ilike.%${q}%,location_description.ilike.%${q}%`
      );
    }
    if (statusFilter !== 'all') base = base.eq('status', statusFilter);
    if (countyId !== 'all') base = base.eq('county_id', Number(countyId));
    if (stationId !== 'all') base = base.eq('station_id', stationId);
    if (offenceId !== 'all') base = base.eq('offence_id', offenceId);
    if (officerId !== 'all') base = base.eq('issued_by_officer_id', officerId);
    if (dateFrom) base = base.gte('issued_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      base = base.lte('issued_at', end.toISOString());
    }
    const { data } = await base;
    if (data) {
      const total = data.reduce((s, f: any) => s + Number(f.fine_amount || 0), 0);
      const paid = data.filter((f: any) => f.status === 'paid').reduce((s, f: any) => s + Number(f.fine_amount || 0), 0);
      const outstanding = data.filter((f: any) => f.status === 'issued').reduce((s, f: any) => s + Number(f.fine_amount || 0), 0);
      const overdue = data.filter((f: any) => f.status === 'overdue').reduce((s, f: any) => s + Number(f.fine_amount || 0), 0);
      setSummary({ total, paid, outstanding, overdue });
    } else {
      setSummary({ total: 0, paid: 0, outstanding: 0, overdue: 0 });
    }
  }, [searchQuery, statusFilter, countyId, stationId, offenceId, officerId, dateFrom, dateTo]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadFines();
      loadSummary();
    }, searchQuery ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadFines, loadSummary, searchQuery]);

  useEffect(() => { setPage(0); }, [searchQuery, statusFilter, countyId, stationId, offenceId, officerId, dateFrom, dateTo]);

  useEffect(() => {
    if (countyId !== 'all' && stationId !== 'all') {
      const stillValid = filteredStations.some((s) => s.id === stationId);
      if (!stillValid) setStationId('all');
    }
  }, [countyId, filteredStations, stationId]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCountyId('all');
    setStationId('all');
    setOffenceId('all');
    setOfficerId('all');
    setDateFrom('');
    setDateTo('');
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    countyId !== 'all',
    stationId !== 'all',
    offenceId !== 'all',
    officerId !== 'all',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'issued': return 'bg-blue-100 text-blue-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'disputed': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  const openTicket = (fine: FineRecord) => {
    const receipt: FineReceiptData = {
      id: fine.id,
      fine_reference: fine.fine_reference,
      fine_amount: fine.fine_amount,
      status: fine.status,
      issued_at: fine.issued_at,
      paid_at: fine.paid_at,
      due_date: fine.due_date,
      payment_reference: fine.payment_reference,
      rider_name: fine.rider_name,
      rider_phone: fine.rider_phone,
      rider_national_id: fine.rider_national_id,
      location_description: fine.location_description,
      notes: fine.notes,
      officer_name: fine.officer?.full_name ?? null,
      officer_rank: fine.officer?.rank ?? null,
      officer_badge: fine.officer?.badge_number || fine.officer?.service_number || null,
      station_name: fine.station?.station_name ?? null,
      offence_name: fine.offence?.offence_name ?? null,
      offence_code: fine.offence?.offence_code ?? null,
    };
    setReceiptFine(receipt);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, rider, phone, ID or location..."
              className="w-full pl-12 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
              showFilters || activeFilterCount > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'issued', label: 'Issued' },
            { value: 'paid', label: 'Paid' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'disputed', label: 'Disputed' },
            { value: 'cancelled', label: 'Cancelled' },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                statusFilter === s.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> County
              </label>
              <select
                value={countyId}
                onChange={(e) => setCountyId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All counties</option>
                {counties.map((c) => (
                  <option key={c.id} value={c.id}>{c.county_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Police station
              </label>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">
                  All stations {countyId !== 'all' ? `(${filteredStations.length} in county)` : ''}
                </option>
                {filteredStations.map((s) => (
                  <option key={s.id} value={s.id}>{s.station_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Offense
              </label>
              <select
                value={offenceId}
                onChange={(e) => setOffenceId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All offenses</option>
                {offences.map((o) => (
                  <option key={o.id} value={o.id}>{o.offence_code} — {o.offence_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Officer
              </label>
              <select
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All officers</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name} ({o.service_number})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Issued from
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Issued to
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Matching fines</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">KES {summary.total.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-medium">Collected</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">KES {summary.paid.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Paid within filters</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-blue-700 font-medium">Outstanding</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">KES {summary.outstanding.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Awaiting payment</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-red-700 font-medium">Overdue</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">KES {summary.overdue.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Past due date</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            <span className="ml-3 text-sm text-slate-600">Loading fines...</span>
          </div>
        ) : fines.length === 0 ? (
          <div className="text-center py-16">
            <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No fines match your filters</p>
            <p className="text-sm text-slate-500 mt-1">Try adjusting search terms or clearing filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Rider</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Offense</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">County / Station</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden xl:table-cell">Officer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fines.map((fine) => (
                  <tr key={fine.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-700">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{fine.fine_reference}</span>
                        {fine.origin === 'from_incident' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">From incident</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{fine.rider_name}</p>
                      <p className="text-xs text-slate-500">{fine.rider_phone}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-slate-700">{fine.offence?.offence_name || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      KES {fine.fine_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getStatusStyle(fine.status)}`}>
                        {fine.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-sm text-slate-700">{(fine as any).county?.county_name || '-'}</p>
                      <p className="text-xs text-slate-500">{fine.station?.station_name || '-'}</p>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <p className="text-sm text-slate-700">{fine.officer?.full_name || '-'}</p>
                      <p className="text-xs text-slate-400">{fine.officer?.service_number || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                      {new Date(fine.issued_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setSelectedFine(fine)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          title="Quick view"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openTicket(fine)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 text-xs font-semibold transition"
                          title="View full ticket"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-600">
              Showing <span className="font-semibold text-slate-900">{pageStart}</span>–<span className="font-semibold text-slate-900">{pageEnd}</span> of <span className="font-semibold text-slate-900">{totalCount.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 px-2">
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedFine && (
        <FineDetailModal fine={selectedFine} onClose={() => setSelectedFine(null)} onViewTicket={() => { openTicket(selectedFine); setSelectedFine(null); }} />
      )}

      {receiptFine && (
        <FineReceiptModal fine={receiptFine} onClose={() => setReceiptFine(null)} />
      )}
    </div>
  );
}

function FineDetailModal({ fine, onClose, onViewTicket }: { fine: FineRecord; onClose: () => void; onViewTicket?: () => void }) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'issued': return 'bg-blue-100 text-blue-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'disputed': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Fine Details</h3>
            <p className="text-sm text-slate-500 font-mono">{fine.fine_reference}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${getStatusStyle(fine.status)}`}>
                {fine.status}
              </span>
              {fine.origin === 'from_incident' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">
                  Issued from incident
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-slate-900">KES {fine.fine_amount.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Rider</p>
              <p className="text-sm font-medium text-slate-900">{fine.rider_name}</p>
              <p className="text-xs text-slate-500">{fine.rider_phone}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">National ID</p>
              <p className="text-sm font-medium text-slate-900">{fine.rider_national_id || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Offense</p>
              <p className="text-sm font-medium text-slate-900">{fine.offence?.offence_name || '-'}</p>
              <p className="text-xs text-slate-400">{fine.offence?.offence_code}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Location</p>
              <p className="text-sm font-medium text-slate-900">{fine.location_description || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Issued By</p>
              <p className="text-sm font-medium text-slate-900">{fine.officer?.full_name || '-'}</p>
              <p className="text-xs text-slate-400">{fine.officer?.service_number}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Station</p>
              <p className="text-sm font-medium text-slate-900">{fine.station?.station_name || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Issued Date</p>
              <p className="text-sm font-medium text-slate-900">{new Date(fine.issued_at).toLocaleDateString()}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Due Date</p>
              <p className="text-sm font-medium text-slate-900">{new Date(fine.due_date).toLocaleDateString()}</p>
            </div>
          </div>

          {fine.paid_at && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs text-emerald-600">Paid on {new Date(fine.paid_at).toLocaleDateString()}</p>
              {fine.payment_reference && <p className="text-sm font-mono text-emerald-800 mt-0.5">Ref: {fine.payment_reference}</p>}
            </div>
          )}

          {fine.notes && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700">{fine.notes}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {onViewTicket && (
              <button
                onClick={onViewTicket}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 inline-flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" /> View full ticket
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfficerActivityPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [officers, setOfficers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [topEnforcers, setTopEnforcers] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadTopEnforcers(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 3) {
      setOfficers([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchOfficers(searchQuery.trim());
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const loadTopEnforcers = async () => {
    const { data } = await supabase
      .from('fines')
      .select('fine_amount, status, officer:police_officers(full_name, service_number), station:police_stations(station_name)');

    if (data) {
      const grouped: Record<string, { name: string; service: string; station: string; count: number; collected: number; total: number }> = {};
      data.forEach((f: any) => {
        const key = f.officer?.service_number || 'unknown';
        if (!grouped[key]) {
          grouped[key] = {
            name: f.officer?.full_name || 'Unknown',
            service: f.officer?.service_number || '',
            station: f.station?.station_name || '',
            count: 0,
            collected: 0,
            total: 0,
          };
        }
        grouped[key].count++;
        grouped[key].total += f.fine_amount;
        if (f.status === 'paid') grouped[key].collected += f.fine_amount;
      });
      const sorted = Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 10);
      setTopEnforcers(sorted);
    }
  };

  const searchOfficers = async (query: string) => {
    setSearching(true);
    try {
      const { data: officerData } = await supabase
        .from('police_officers')
        .select('id, full_name, service_number, station:police_stations(station_name)')
        .or(`full_name.ilike.%${query}%,service_number.ilike.%${query}%`)
        .limit(20);

      if (officerData && officerData.length > 0) {
        const officerIds = officerData.map((o: any) => o.id);
        const { data: finesData } = await supabase
          .from('fines')
          .select('issued_by_officer_id, fine_amount, status')
          .in('issued_by_officer_id', officerIds);

        const finesByOfficer: Record<string, { count: number; total: number; collected: number }> = {};
        (finesData || []).forEach((f: any) => {
          if (!finesByOfficer[f.issued_by_officer_id]) finesByOfficer[f.issued_by_officer_id] = { count: 0, total: 0, collected: 0 };
          finesByOfficer[f.issued_by_officer_id].count++;
          finesByOfficer[f.issued_by_officer_id].total += f.fine_amount;
          if (f.status === 'paid') finesByOfficer[f.issued_by_officer_id].collected += f.fine_amount;
        });

        const results = officerData.map((o: any) => ({
          ...o,
          station_name: o.station?.station_name || '-',
          fines_count: finesByOfficer[o.id]?.count || 0,
          fines_total: finesByOfficer[o.id]?.total || 0,
          fines_collected: finesByOfficer[o.id]?.collected || 0,
        }));
        setOfficers(results);
      } else {
        setOfficers([]);
      }
      setHasSearched(true);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Enforcers (Leaderboard) */}
      {topEnforcers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Enforcement Officers</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Officer</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 hidden sm:table-cell">Station</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Fines</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 hidden md:table-cell">Total</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topEnforcers.map((o, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-slate-200 text-slate-700' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-slate-900">{o.name}</p>
                      <p className="text-xs text-slate-500">{o.service}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{o.station}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-900">{o.count}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700 hidden md:table-cell">KES {o.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-emerald-600">KES {o.collected.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Officer Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search officer by name or service number..."
            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {searchQuery.length > 0 && searchQuery.length < 3 && (
          <p className="text-xs text-amber-600 mt-2 font-medium">
            Type {3 - searchQuery.length} more character{3 - searchQuery.length > 1 ? 's' : ''} to search...
          </p>
        )}

        {searching && (
          <div className="mt-6 flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            <span className="ml-3 text-sm text-slate-600">Searching...</span>
          </div>
        )}

        {hasSearched && !searching && (
          <div className="mt-4">
            <p className="text-sm text-slate-500 mb-3">{officers.length} officer{officers.length !== 1 ? 's' : ''} found</p>
            {officers.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No officers match your search</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Officer</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Station</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Fines Issued</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Total Value</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {officers.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">{o.full_name}</p>
                          <p className="text-xs text-slate-500">{o.service_number}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">{o.station_name}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{o.fines_count}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 hidden md:table-cell">KES {o.fines_total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-600">KES {o.fines_collected.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
