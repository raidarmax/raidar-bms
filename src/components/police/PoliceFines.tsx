import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DollarSign, Plus, Search, AlertCircle, CheckCircle, Clock, X, LayoutDashboard, Ticket,
  BarChart3, TrendingUp, AlertTriangle, FileText, Users, Building2, Filter, RotateCcw,
  Calendar, ChevronLeft, ChevronRight, Eye, MapPin,
} from 'lucide-react';
import { supabase, type PoliceOfficerWithStation, type TrafficOffence, type Rider, type Motorcycle } from '../../lib/supabase';
import { PoliceAuthService } from '../../lib/policeAuth';
import LocalitySelector from '../LocalitySelector';
import FineReceiptModal, { type FineReceiptData } from '../FineReceiptModal';

type Props = { officer: PoliceOfficerWithStation };

type FineRow = {
  id: string;
  fine_reference: string;
  fine_amount: number;
  status: string;
  rider_name: string;
  rider_phone: string;
  rider_national_id: string | null;
  location_description: string | null;
  issued_at: string;
  due_date: string;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  incident_id: string | null;
  origin: 'standalone' | 'from_incident';
  offence?: { offence_name: string; offence_code: string; category?: string } | null;
  officer?: { full_name: string; service_number: string; rank?: string | null; badge_number?: string | null } | null;
  station?: { station_name: string } | null;
  county?: { county_name: string } | null;
};

type SubTab = 'overview' | 'fines' | 'officers';

const statusStyle = (status: string) => {
  switch (status) {
    case 'paid': return 'bg-emerald-100 text-emerald-700';
    case 'issued': return 'bg-blue-100 text-blue-700';
    case 'overdue': return 'bg-red-100 text-red-700';
    case 'disputed': return 'bg-amber-100 text-amber-700';
    case 'cancelled': return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const scopeQuery = <T extends { eq: (col: string, val: any) => T }>(query: T, officer: PoliceOfficerWithStation): T => {
  return officer.is_station_admin
    ? query.eq('station_id', officer.station_id)
    : query.eq('issued_by_officer_id', officer.id);
};

export default function PoliceFines({ officer }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [showIssueModal, setShowIssueModal] = useState(false);

  const scopeLabel = officer.is_station_admin ? officer.station.station_name : 'You';
  const scopeSubtitle = officer.is_station_admin
    ? 'Station-wide enforcement and revenue'
    : 'Your personal enforcement activity';

  const TABS: { id: SubTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'fines', label: 'Issued Fines', icon: DollarSign },
    ...(officer.is_station_admin
      ? ([{ id: 'officers', label: 'Officer Activity', icon: Users }] as const)
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Traffic Fines</h2>
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{scopeLabel}</span> · {scopeSubtitle}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Issue Fine
        </button>
      </div>

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

      {subTab === 'overview' && <OverviewPanel officer={officer} />}
      {subTab === 'fines' && <FinesListPanel officer={officer} />}
      {subTab === 'officers' && officer.is_station_admin && <OfficerActivityPanel officer={officer} />}

      {showIssueModal && (
        <IssueFineModal
          officer={officer}
          onClose={() => setShowIssueModal(false)}
          onSuccess={() => { setShowIssueModal(false); }}
        />
      )}
    </div>
  );
}

/* -------------------------------- OVERVIEW -------------------------------- */

function OverviewPanel({ officer }: { officer: PoliceOfficerWithStation }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFines: 0, totalCollected: 0, totalOutstanding: 0, totalOverdue: 0,
    fineCount: 0, paidCount: 0, overdueCount: 0, issuedThisMonth: 0,
    collectedThisMonth: 0, disputedCount: 0, cancelledCount: 0,
  });
  const [monthlyTrend, setMonthlyTrend] = useState<{ label: string; issued: number; collected: number; count: number }[]>([]);
  const [topOffences, setTopOffences] = useState<{ offence_name: string; count: number; amount: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; count: number; amount: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let base = supabase.from('fines').select('fine_amount, status, issued_at, paid_at, offence:traffic_offences(offence_name, category)');
        base = scopeQuery(base as any, officer);
        const { data } = await base;

        if (data) {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const paid = data.filter((f: any) => f.status === 'paid');
          const overdue = data.filter((f: any) => f.status === 'overdue');
          const outstanding = data.filter((f: any) => f.status === 'issued' || f.status === 'overdue');
          const disputed = data.filter((f: any) => f.status === 'disputed');
          const cancelled = data.filter((f: any) => f.status === 'cancelled');

          setStats({
            totalFines: data.reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0),
            totalCollected: paid.reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0),
            totalOutstanding: outstanding.reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0),
            totalOverdue: overdue.reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0),
            fineCount: data.length,
            paidCount: paid.length,
            overdueCount: overdue.length,
            issuedThisMonth: data.filter((f: any) => f.issued_at >= monthStart).length,
            collectedThisMonth: paid.filter((f: any) => f.paid_at && f.paid_at >= monthStart).reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0),
            disputedCount: disputed.length,
            cancelledCount: cancelled.length,
          });

          const months: { label: string; issued: number; collected: number; count: number }[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const rowsIssued = data.filter((f: any) => {
              const dt = new Date(f.issued_at);
              return dt >= d && dt < next;
            });
            const collectedInMonth = data
              .filter((f: any) => f.status === 'paid' && f.paid_at && new Date(f.paid_at) >= d && new Date(f.paid_at) < next)
              .reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0);
            months.push({
              label,
              issued: rowsIssued.reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0),
              collected: collectedInMonth,
              count: rowsIssued.length,
            });
          }
          setMonthlyTrend(months);

          const offenceGrouped: Record<string, { count: number; amount: number }> = {};
          const catGrouped: Record<string, { count: number; amount: number }> = {};
          data.forEach((f: any) => {
            const name = f.offence?.offence_name || 'Unknown';
            const cat = f.offence?.category || 'uncategorized';
            if (!offenceGrouped[name]) offenceGrouped[name] = { count: 0, amount: 0 };
            offenceGrouped[name].count++;
            offenceGrouped[name].amount += Number(f.fine_amount || 0);
            if (!catGrouped[cat]) catGrouped[cat] = { count: 0, amount: 0 };
            catGrouped[cat].count++;
            catGrouped[cat].amount += Number(f.fine_amount || 0);
          });
          setTopOffences(
            Object.entries(offenceGrouped)
              .map(([offence_name, d]) => ({ offence_name, ...d }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
          );
          setCategoryBreakdown(
            Object.entries(catGrouped)
              .map(([category, d]) => ({ category, ...d }))
              .sort((a, b) => b.count - a.count)
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [officer.id, officer.station_id, officer.is_station_admin]);

  const collectionRate = useMemo(
    () => (stats.fineCount > 0 ? Math.round((stats.paidCount / stats.fineCount) * 100) : 0),
    [stats]
  );

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

  if (stats.fineCount === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
          <Ticket className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No fines yet</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          {officer.is_station_admin
            ? 'No fines have been issued by officers at this station yet.'
            : 'You have not issued any fines yet. Issue your first ticket to get started.'}
        </p>
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
          <p className="text-2xl md:text-3xl font-bold">KES {stats.totalCollected.toLocaleString()}</p>
          <p className="text-sm text-white/90 mt-1">{stats.paidCount} paid</p>
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
          <p className="text-2xl md:text-3xl font-bold text-slate-900">KES {stats.totalFines.toLocaleString()}</p>
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
          <p className="text-2xl md:text-3xl font-bold text-slate-900">KES {stats.totalOutstanding.toLocaleString()}</p>
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
          <p className="text-2xl md:text-3xl font-bold text-slate-900">KES {stats.totalOverdue.toLocaleString()}</p>
          <p className="text-sm text-slate-500 mt-1">{stats.overdueCount} past due</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Cancelled</span>
            <span className="font-semibold text-slate-800">{stats.cancelledCount}</span>
          </div>
        </div>
      </div>

      {/* Trend + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Enforcement Trend</h3>
              <p className="text-xs text-slate-500">Issued vs collected over the last 6 months</p>
            </div>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>
          <TrendChart points={monthlyTrend} />
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
            <Donut
              data={categoryBreakdown.map(c => ({
                label: c.category.replace('_', ' '),
                value: c.count,
                color: CATEGORY_COLORS[c.category] || '#94a3b8',
              }))}
            />
          )}
        </div>
      </div>

      {/* Top offenses + Collection health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
    </div>
  );
}

/* --------------------------------- CHARTS --------------------------------- */

function TrendChart({ points }: { points: { label: string; issued: number; collected: number; count: number }[] }) {
  if (points.length === 0 || points.every(p => p.issued === 0 && p.collected === 0)) {
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
          <linearGradient id="pfIssued" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="pfCollected" x1="0" y1="0" x2="0" y2="1">
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
              <rect x={x - barW - 2} y={padT + chartH - issuedH} width={barW} height={issuedH} fill="url(#pfIssued)" rx={2}>
                <title>{p.label} issued: KES {p.issued.toLocaleString()} ({p.count} fines)</title>
              </rect>
              <rect x={x + 2} y={padT + chartH - collectedH} width={barW} height={collectedH} fill="url(#pfCollected)" rx={2}>
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

function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
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

/* -------------------------------- FINES LIST ------------------------------ */

function FinesListPanel({ officer }: { officer: PoliceOfficerWithStation }) {
  const PAGE_SIZE = 20;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [offenceId, setOffenceId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [fines, setFines] = useState<FineRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, paid: 0, outstanding: 0, overdue: 0 });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedFine, setSelectedFine] = useState<FineRow | null>(null);
  const [receiptFine, setReceiptFine] = useState<FineReceiptData | null>(null);

  const [offences, setOffences] = useState<{ id: string; offence_name: string; offence_code: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('traffic_offences').select('id, offence_name, offence_code').order('offence_name');
      setOffences(data || []);
    })();
  }, []);

  const loadFines = useCallback(async () => {
    setLoading(true);
    try {
      let base = supabase
        .from('fines')
        .select(
          '*, offence:traffic_offences(offence_name, offence_code, category), officer:police_officers(full_name, service_number, rank, badge_number), station:police_stations(station_name), county:kenya_counties(county_name)',
          { count: 'exact' }
        )
        .order('issued_at', { ascending: false });

      base = scopeQuery(base as any, officer);

      const q = searchQuery.trim();
      if (q.length >= 3) {
        base = base.or(
          `fine_reference.ilike.%${q}%,rider_name.ilike.%${q}%,rider_phone.ilike.%${q}%,rider_national_id.ilike.%${q}%,location_description.ilike.%${q}%`
        );
      }
      if (statusFilter !== 'all') base = base.eq('status', statusFilter);
      if (offenceId !== 'all') base = base.eq('offence_id', offenceId);
      if (dateFrom) base = base.gte('issued_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        base = base.lte('issued_at', end.toISOString());
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await base.range(from, to);
      setFines((data as FineRow[]) || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.error('Failed to load fines', e);
      setFines([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [officer, searchQuery, statusFilter, offenceId, dateFrom, dateTo, page]);

  const loadSummary = useCallback(async () => {
    let base = supabase.from('fines').select('fine_amount, status');
    base = scopeQuery(base as any, officer);
    const q = searchQuery.trim();
    if (q.length >= 3) {
      base = base.or(
        `fine_reference.ilike.%${q}%,rider_name.ilike.%${q}%,rider_phone.ilike.%${q}%,rider_national_id.ilike.%${q}%,location_description.ilike.%${q}%`
      );
    }
    if (statusFilter !== 'all') base = base.eq('status', statusFilter);
    if (offenceId !== 'all') base = base.eq('offence_id', offenceId);
    if (dateFrom) base = base.gte('issued_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      base = base.lte('issued_at', end.toISOString());
    }
    const { data } = await base;
    if (data) {
      const total = data.reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0);
      const paid = data.filter((f: any) => f.status === 'paid').reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0);
      const outstanding = data.filter((f: any) => f.status === 'issued').reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0);
      const overdue = data.filter((f: any) => f.status === 'overdue').reduce((s: number, f: any) => s + Number(f.fine_amount || 0), 0);
      setSummary({ total, paid, outstanding, overdue });
    } else {
      setSummary({ total: 0, paid: 0, outstanding: 0, overdue: 0 });
    }
  }, [officer, searchQuery, statusFilter, offenceId, dateFrom, dateTo]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadFines();
      loadSummary();
    }, searchQuery ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadFines, loadSummary, searchQuery]);

  useEffect(() => { setPage(0); }, [searchQuery, statusFilter, offenceId, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setOffenceId('all');
    setDateFrom('');
    setDateTo('');
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    offenceId !== 'all',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  const openTicket = (fine: FineRow) => {
    setReceiptFine({
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
    });
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
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
                  {officer.is_station_admin && (
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden xl:table-cell">Officer</th>
                  )}
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
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">
                            From incident
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{fine.rider_name}</p>
                      <p className="text-xs text-slate-500">{fine.rider_phone}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-slate-700">{fine.offence?.offence_name || '-'}</p>
                      {fine.offence?.offence_code && (
                        <p className="text-xs text-slate-400 font-mono">{fine.offence.offence_code}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      KES {fine.fine_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusStyle(fine.status)}`}>
                        {fine.status}
                      </span>
                    </td>
                    {officer.is_station_admin && (
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <p className="text-sm text-slate-700">{fine.officer?.full_name || '-'}</p>
                        <p className="text-xs text-slate-400">{fine.officer?.service_number || ''}</p>
                      </td>
                    )}
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
        <FineDetailModal
          fine={selectedFine}
          onClose={() => setSelectedFine(null)}
          onViewTicket={() => { openTicket(selectedFine); setSelectedFine(null); }}
        />
      )}

      {receiptFine && <FineReceiptModal fine={receiptFine} onClose={() => setReceiptFine(null)} />}
    </div>
  );
}

function FineDetailModal({ fine, onClose, onViewTicket }: { fine: FineRow; onClose: () => void; onViewTicket?: () => void }) {
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
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusStyle(fine.status)}`}>
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
              {fine.offence?.offence_code && (
                <p className="text-xs text-slate-400 font-mono">{fine.offence.offence_code}</p>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Location</p>
              <p className="text-sm font-medium text-slate-900">{fine.location_description || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Issued by</p>
              <p className="text-sm font-medium text-slate-900">{fine.officer?.full_name || '-'}</p>
              <p className="text-xs text-slate-400">{fine.officer?.service_number}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Station</p>
              <p className="text-sm font-medium text-slate-900">{fine.station?.station_name || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Issued date</p>
              <p className="text-sm font-medium text-slate-900">{new Date(fine.issued_at).toLocaleDateString()}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Due date</p>
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
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{fine.notes}</p>
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

/* ---------------------------- OFFICER ACTIVITY ---------------------------- */

function OfficerActivityPanel({ officer }: { officer: PoliceOfficerWithStation }) {
  const [rows, setRows] = useState<{ id: string; name: string; service: string; count: number; total: number; collected: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('fines')
          .select('issued_by_officer_id, fine_amount, status, officer:police_officers(id, full_name, service_number)')
          .eq('station_id', officer.station_id);

        const grouped: Record<string, { id: string; name: string; service: string; count: number; total: number; collected: number }> = {};
        (data || []).forEach((f: any) => {
          const id = f.officer?.id || f.issued_by_officer_id || 'unknown';
          if (!grouped[id]) {
            grouped[id] = {
              id,
              name: f.officer?.full_name || 'Unknown',
              service: f.officer?.service_number || '',
              count: 0, total: 0, collected: 0,
            };
          }
          grouped[id].count++;
          grouped[id].total += Number(f.fine_amount || 0);
          if (f.status === 'paid') grouped[id].collected += Number(f.fine_amount || 0);
        });

        setRows(Object.values(grouped).sort((a, b) => b.count - a.count));
      } finally {
        setLoading(false);
      }
    })();
  }, [officer.station_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
        <span className="ml-3 text-sm text-slate-600">Loading officer activity...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-700 font-medium">No officer activity yet</p>
        <p className="text-sm text-slate-500 mt-1">Fines issued by officers at this station will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Station Enforcement Leaderboard</h3>
          <p className="text-xs text-slate-500">Officers at {officer.station.station_name} ranked by fines issued</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Officer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Fines</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Total value</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Collected</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Collection rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((o, i) => {
              const rate = o.total > 0 ? Math.round((o.collected / o.total) * 100) : 0;
              const isMe = o.id === officer.id;
              return (
                <tr key={o.id} className={`transition-colors ${isMe ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-slate-200 text-slate-700' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{o.name}</p>
                        <p className="text-xs text-slate-500">{o.service}</p>
                      </div>
                      {isMe && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">You</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{o.count}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 hidden md:table-cell">KES {o.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-600">KES {o.collected.toLocaleString()}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                        <div className="h-full bg-emerald-500" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{rate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------- ISSUE FINE MODAL --------------------------- */

function IssueFineModal({ officer, onClose, onSuccess }: { officer: PoliceOfficerWithStation; onClose: () => void; onSuccess: () => void }) {
  const [offences, setOffences] = useState<TrafficOffence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ riders: Rider[]; motorcycles: Motorcycle[] }>({ riders: [], motorcycles: [] });
  const [selectedOffence, setSelectedOffence] = useState<TrafficOffence | null>(null);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderNationalId, setRiderNationalId] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [locationDesc, setLocationDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [locality, setLocality] = useState<{ countyId: number | null; constituencyId: number | null; wardId: number | null }>({
    countyId: officer.station.county_id,
    constituencyId: officer.station.constituency_id,
    wardId: officer.station.ward_id,
  });
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState<string | null>(null);
  const [responsibility, setResponsibility] = useState<'rider' | 'owner' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('traffic_offences').select('*').eq('is_active', true).order('offence_code');
      setOffences(data || []);
    })();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    const [ridersRes, motorcyclesRes] = await Promise.all([
      supabase.from('riders').select('*').or(`id_number.eq.${q},phone_number.eq.${q},bms_id.eq.${q},name.ilike.%${q}%`).limit(5),
      supabase.from('motorcycles').select('*, owner:owners(*)').or(`registration_number.ilike.%${q}%`).limit(5),
    ]);
    setSearchResults({ riders: ridersRes.data || [], motorcycles: motorcyclesRes.data || [] });
  };

  const selectRider = (rider: Rider) => {
    setRiderName(rider.name);
    setRiderPhone(rider.phone_number || '');
    setRiderNationalId(rider.id_number);
    setSelectedRiderId(rider.id);
    setResponsibility('rider');
    if (rider.motorcycle_id) {
      supabase
        .from('motorcycles')
        .select('*, owner:owners(*)')
        .eq('id', rider.motorcycle_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSelectedMotorcycleId(data.id);
            if (data.owner) {
              setOwnerPhone(data.owner.phone_number || '');
              setSelectedOwnerId(data.owner.id);
            }
          }
        });
    }
  };

  const selectMotorcycle = async (motorcycle: any) => {
    setSelectedMotorcycleId(motorcycle.id);
    if (motorcycle.owner) {
      setOwnerPhone(motorcycle.owner.phone_number || '');
      setSelectedOwnerId(motorcycle.owner.id);
    }
    const { data: assignedRider } = await supabase
      .from('riders')
      .select('*')
      .eq('motorcycle_id', motorcycle.id)
      .maybeSingle();

    if (assignedRider) {
      setRiderName(assignedRider.name);
      setRiderPhone(assignedRider.phone_number || '');
      setRiderNationalId(assignedRider.id_number || '');
      setSelectedRiderId(assignedRider.id);
      setResponsibility('rider');
    } else if (motorcycle.owner) {
      setRiderName(motorcycle.owner.full_name || '');
      setRiderPhone(motorcycle.owner.phone_number || '');
      setRiderNationalId(motorcycle.owner.id_number || '');
      setSelectedRiderId(null);
      setResponsibility('owner');
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!selectedOffence) { setError('Please select an offence'); return; }
    if (!riderName.trim()) { setError('Rider name is required'); return; }
    if (!riderPhone.trim()) { setError('Rider phone is required'); return; }

    setSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const { count } = await supabase.from('fines').select('id', { count: 'exact', head: true });
      const fineRef = `FN-${year}-${String((count || 0) + 1).padStart(5, '0')}`;

      const { data: insertedFine, error: insertError } = await supabase.from('fines').insert({
        fine_reference: fineRef,
        offence_id: selectedOffence.id,
        issued_by_officer_id: officer.id,
        station_id: officer.station_id,
        rider_id: selectedRiderId,
        owner_id: selectedOwnerId,
        motorcycle_id: selectedMotorcycleId,
        rider_name: riderName,
        rider_phone: riderPhone,
        rider_national_id: riderNationalId || null,
        owner_phone: ownerPhone || null,
        fine_amount: selectedOffence.fine_amount,
        location_description: locationDesc || null,
        county_id: locality.countyId,
        constituency_id: locality.constituencyId,
        ward_id: locality.wardId,
        notes: notes || null,
      }).select().maybeSingle();

      if (insertError) throw insertError;

      if (selectedRiderId && insertedFine) {
        await supabase.from('rider_notifications').insert({
          rider_id: selectedRiderId,
          type: 'fine_issued',
          title: 'New Traffic Fine Issued',
          message: `You have been issued fine ${fineRef} of KES ${selectedOffence.fine_amount.toLocaleString()} for "${selectedOffence.offence_name}". Please pay within 14 days.`,
          metadata: {
            fine_id: insertedFine.id,
            fine_reference: fineRef,
            fine_amount: selectedOffence.fine_amount,
            offence_name: selectedOffence.offence_name,
            station_name: officer.station.station_name,
          },
        });
      }

      await PoliceAuthService.logActivity(officer.id, 'issue_fine', 'fine', null, {
        fine_reference: fineRef,
        offence: selectedOffence.offence_name,
        amount: selectedOffence.fine_amount,
        rider: riderName,
      });

      try {
        await supabase.functions.invoke('send-fine-sms', {
          body: {
            fine_reference: fineRef,
            rider_phone: riderPhone,
            owner_phone: ownerPhone || null,
            rider_name: riderName,
            offence_name: selectedOffence.offence_name,
            fine_amount: selectedOffence.fine_amount,
            station_name: officer.station.station_name,
            officer_service_number: officer.service_number,
          },
        });
      } catch (smsErr) {
        console.error('SMS send failed:', smsErr);
      }

      setSuccess(fineRef);
      setTimeout(onSuccess, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to issue fine');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Fine Issued Successfully</h3>
          <p className="text-sm text-slate-500 mt-2">Reference: <span className="font-mono font-bold">{success}</span></p>
          <p className="text-xs text-slate-400 mt-1">SMS notification sent to rider</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Ticket className="h-4.5 w-4.5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Issue Traffic Fine</h3>
              <p className="text-xs text-slate-500">{officer.station.station_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search Rider/Motorcycle (optional)</label>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Registration, ID number, phone, or BMS ID"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              />
              <button onClick={handleSearch} className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200">
                <Search className="w-4 h-4" />
              </button>
            </div>
            {(searchResults.riders.length > 0 || searchResults.motorcycles.length > 0) && (
              <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {searchResults.riders.map((r) => (
                  <button key={r.id} onClick={() => selectRider(r)} className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-sm">
                    <span className="font-medium">{r.name}</span> <span className="text-slate-500">- {r.id_number}</span>
                  </button>
                ))}
                {searchResults.motorcycles.map((m: any) => (
                  <button key={m.id} onClick={() => selectMotorcycle(m)} className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-sm">
                    <span className="font-medium">{m.registration_number}</span> {m.owner && <span className="text-slate-500">- Owner: {m.owner.full_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Offence *</label>
            <select
              value={selectedOffence?.id || ''}
              onChange={(e) => setSelectedOffence(offences.find(o => o.id === e.target.value) || null)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select offence</option>
              {offences.map((o) => (
                <option key={o.id} value={o.id}>{o.offence_name} - KES {o.fine_amount.toLocaleString()}</option>
              ))}
            </select>
            {selectedOffence && (
              <p className="text-sm text-emerald-600 font-semibold mt-1">Fine Amount: KES {selectedOffence.fine_amount.toLocaleString()}</p>
            )}
          </div>

          {responsibility && (
            <div className={`p-3 rounded-lg border text-sm ${
              responsibility === 'rider'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              {responsibility === 'rider' ? (
                <><span className="font-semibold">Assigned rider found.</span> Fine will be issued to the rider; both rider and owner will be notified.</>
              ) : (
                <><span className="font-semibold">No rider assigned.</span> Owner takes responsibility for this fine.</>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rider Name *</label>
              <input value={riderName} onChange={(e) => setRiderName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rider Phone *</label>
              <input value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} placeholder="+254..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rider National ID</label>
              <input value={riderNationalId} onChange={(e) => setRiderNationalId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Owner Phone</label>
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="If different from rider" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Location Description
            </label>
            <input value={locationDesc} onChange={(e) => setLocationDesc(e.target.value)} placeholder="e.g., Moi Avenue near GPO" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>

          <LocalitySelector
            countyId={locality.countyId}
            constituencyId={locality.constituencyId}
            wardId={locality.wardId}
            onChange={setLocality}
            label="Fine Location"
            compact
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {submitting ? 'Issuing...' : <><Ticket className="w-4 h-4" /> Issue Fine & Send SMS</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

