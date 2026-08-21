import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  Search,
  Download,
  Calendar,
  LayoutDashboard,
  ListChecks,
  Ban,
  BarChart3,
  FileCheck,
  ArrowUpRight,
  Wallet,
  Landmark,
  UserCog,
  Bike,
  Clock,
  Shield,
  MapPin,
  Hash,
  CheckCircle2,
  AlertCircle,
  Eye,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { supabase, type Payment, type Owner, type Rider, type Motorcycle } from '../lib/supabase';
import PaymentReceiptModal from './PaymentReceiptModal';
import FineReceiptModal, { type FineReceiptData } from './FineReceiptModal';
import RevenueInsights from './RevenueInsights';
import ComplianceRevenueTab from './ComplianceRevenueTab';

type FineRow = {
  id: string;
  fine_reference: string | null;
  fine_amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  due_date: string | null;
  payment_reference: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  rider_national_id: string | null;
  location_description: string | null;
  notes: string | null;
  issued_by_officer_id: string | null;
  station_id: string | null;
  officer_name?: string | null;
  officer_rank?: string | null;
  officer_badge?: string | null;
  station_name?: string | null;
  offence_name?: string | null;
  offence_code?: string | null;
};

type MonthPoint = {
  label: string;
  key: string;
  registrations: number;
  fines: number;
};

type MethodStat = {
  key: 'mpesa' | 'salamapay' | 'ecitizen';
  label: string;
  color: string;
  count: number;
  revenue: number;
};

type RevenueTab = 'overview' | 'transactions' | 'fines' | 'compliance' | 'analytics';

const METHOD_META: Record<string, { label: string; color: string }> = {
  mpesa: { label: 'M-Pesa', color: '#059669' },
  salamapay: { label: 'SalamaPay', color: '#2563eb' },
  ecitizen: { label: 'eCitizen', color: '#dc2626' },
};

const PAGE_SIZE = 15;

function formatKES(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function DonutChart({ data, centerLabel }: { data: { label: string; value: number; color: string }[]; centerLabel?: string }) {
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
        <text x="70" y="66" textAnchor="middle" fontSize="11" fill="#94a3b8">{centerLabel || 'TOTAL'}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">{total.toLocaleString()}</text>
      </svg>
      <div className="space-y-1.5 min-w-[140px]">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 flex-1 truncate">{s.label}</span>
            <span className="font-semibold text-slate-800">{s.value.toLocaleString()}</span>
            <span className="text-slate-400 w-9 text-right">({total > 0 ? Math.round((s.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Monthly stacked bars (registrations + fines) ──────────────────────────────
function RevenueTrendChart({ points }: { points: MonthPoint[] }) {
  if (points.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No revenue data yet</div>;
  }

  const width = 420, height = 170, padL = 32, padR = 12, padT = 12, padB = 26;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(...points.map(p => p.registrations + p.fines), 1);
  const barW = chartW / points.length * 0.55;
  const step = chartW / points.length;

  const yTicks = 3;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxVal / yTicks) * i));

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-full">
        <defs>
          <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="fineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {ticks.map((t) => {
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
          const total = p.registrations + p.fines;
          const totalH = (total / maxVal) * chartH;
          const regH = (p.registrations / maxVal) * chartH;
          const fineH = (p.fines / maxVal) * chartH;
          const x = padL + i * step + step / 2 - barW / 2;
          const yTop = padT + chartH - totalH;
          const yFine = padT + chartH - fineH;
          return (
            <g key={p.key}>
              {p.registrations > 0 && (
                <rect x={x} y={yTop} width={barW} height={regH} fill="url(#regGrad)" rx={2}>
                  <title>{p.label}: Registrations {formatKES(p.registrations)}</title>
                </rect>
              )}
              {p.fines > 0 && (
                <rect x={x} y={yFine} width={barW} height={fineH} fill="url(#fineGrad)" rx={2}>
                  <title>{p.label}: Fines {formatKES(p.fines)}</title>
                </rect>
              )}
              <text x={x + barW / 2} y={height - padB + 12} fontSize="9" fill="#64748b" textAnchor="middle">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 justify-center mt-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#059669' }} />
          <span className="text-slate-600">Registrations</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#d97706' }} />
          <span className="text-slate-600">Fines Collected</span>
        </div>
      </div>
    </div>
  );
}

// ── Growth Sparkline ──────────────────────────────────────────────────────────
function Sparkline({ values, color = '#059669' }: { values: number[]; color?: string }) {
  if (values.length === 0) return null;
  const w = 100, h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ');
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polygon points={areaPoints} fill={color} fillOpacity="0.12" />
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default function RevenueView() {
  const [activeTab, setActiveTab] = useState<RevenueTab>('overview');
  const [loading, setLoading] = useState(true);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [fines, setFines] = useState<FineRow[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [paymentsRes, finesRes, ownersRes, ridersRes, motorcyclesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .eq('payment_status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('fines')
          .select(`
            id,
            fine_reference,
            fine_amount,
            status,
            issued_at,
            paid_at,
            due_date,
            payment_reference,
            rider_name,
            rider_phone,
            rider_national_id,
            location_description,
            notes,
            issued_by_officer_id,
            station_id,
            officer:police_officers!fines_issued_by_officer_id_fkey(full_name, rank, badge_number),
            station:police_stations!fines_station_id_fkey(station_name),
            offence:traffic_offences!fines_offence_id_fkey(offence_name, offence_code)
          `)
          .order('issued_at', { ascending: false }),
        supabase.from('owners').select('*'),
        supabase.from('riders').select('*'),
        supabase.from('motorcycles').select('*'),
      ]);

      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (finesRes.data) {
        const normalized = (finesRes.data as any[]).map(f => ({
          ...f,
          officer_name: f.officer?.full_name ?? null,
          officer_rank: f.officer?.rank ?? null,
          officer_badge: f.officer?.badge_number ?? null,
          station_name: f.station?.station_name ?? null,
          offence_name: f.offence?.offence_name ?? null,
          offence_code: f.offence?.offence_code ?? null,
        }));
        setFines(normalized);
      }
      if (ownersRes.data) setOwners(ownersRes.data);
      if (ridersRes.data) setRiders(ridersRes.data);
      if (motorcyclesRes.data) setMotorcycles(motorcyclesRes.data);
    } catch (e) {
      console.error('Error loading revenue data:', e);
    } finally {
      setLoading(false);
    }
  };

  const derived = useMemo(() => {
    const regRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const finesCollected = fines.filter(f => f.status === 'paid').reduce((s, f) => s + f.fine_amount, 0);
    const finesOutstanding = fines.filter(f => f.status === 'issued' || f.status === 'overdue').reduce((s, f) => s + f.fine_amount, 0);
    const finesOverdue = fines.filter(f => f.status === 'overdue').reduce((s, f) => s + f.fine_amount, 0);

    const totalRevenue = regRevenue + finesCollected;

    const methodStats: MethodStat[] = (['mpesa', 'salamapay', 'ecitizen'] as const).map(k => {
      const rows = payments.filter(p => p.payment_method === k);
      return {
        key: k,
        label: METHOD_META[k].label,
        color: METHOD_META[k].color,
        count: rows.length,
        revenue: rows.reduce((s, p) => s + Number(p.amount), 0),
      };
    });

    const ownerRows = payments.filter(p => p.user_type === 'owner');
    const riderRows = payments.filter(p => p.user_type === 'rider');
    const ownerRevenue = ownerRows.reduce((s, p) => s + Number(p.amount), 0);
    const riderRevenue = riderRows.reduce((s, p) => s + Number(p.amount), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthReg = payments
      .filter(p => new Date(p.created_at) >= monthStart)
      .reduce((s, p) => s + Number(p.amount), 0);
    const prevMonthReg = payments
      .filter(p => {
        const d = new Date(p.created_at);
        return d >= prevMonthStart && d < monthStart;
      })
      .reduce((s, p) => s + Number(p.amount), 0);

    const thisMonthFines = fines
      .filter(f => f.status === 'paid' && f.paid_at && new Date(f.paid_at) >= monthStart)
      .reduce((s, f) => s + f.fine_amount, 0);

    const thisMonthTotal = thisMonthReg + thisMonthFines;
    const growth = prevMonthReg > 0 ? Math.round(((thisMonthReg - prevMonthReg) / prevMonthReg) * 100) : (thisMonthReg > 0 ? 100 : 0);

    // 6-month trend
    const months: MonthPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const k = monthKey(d);
      const reg = payments
        .filter(p => {
          const pd = new Date(p.created_at);
          return pd >= d && pd < next;
        })
        .reduce((s, p) => s + Number(p.amount), 0);
      const fineRev = fines
        .filter(f => f.status === 'paid' && f.paid_at && new Date(f.paid_at) >= d && new Date(f.paid_at) < next)
        .reduce((s, f) => s + f.fine_amount, 0);
      months.push({ label: monthLabel(d), key: k, registrations: reg, fines: fineRev });
    }

    const collectionRate = fines.length > 0
      ? Math.round((fines.filter(f => f.status === 'paid').length / fines.length) * 100)
      : 0;

    return {
      totalRevenue,
      regRevenue,
      finesCollected,
      finesOutstanding,
      finesOverdue,
      methodStats,
      ownerCount: ownerRows.length,
      riderCount: riderRows.length,
      ownerRevenue,
      riderRevenue,
      thisMonthTotal,
      thisMonthReg,
      thisMonthFines,
      growth,
      months,
      collectionRate,
      fineCount: fines.length,
      paidFineCount: fines.filter(f => f.status === 'paid').length,
      totalTransactions: payments.length,
    };
  }, [payments, fines]);

  const TABS = [
    { key: 'overview' as const, label: 'Overview', icon: LayoutDashboard, count: null },
    { key: 'transactions' as const, label: 'Registrations', icon: ListChecks, count: payments.length },
    { key: 'fines' as const, label: 'Fines Revenue', icon: Ban, count: fines.filter(f => f.status === 'paid').length },
    { key: 'compliance' as const, label: 'Compliance', icon: FileCheck, count: null },
    { key: 'analytics' as const, label: 'Analytics', icon: BarChart3, count: null },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        <span className="ml-3 text-slate-600">Loading revenue data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Wallet className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">System Revenue</h2>
            <p className="text-sm text-slate-500">
              Registrations and fines collections across the platform
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <TrendingUp className={`h-4 w-4 ${derived.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
          <span className={`text-sm font-semibold ${derived.growth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {derived.growth >= 0 ? '+' : ''}{derived.growth}% vs last month
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 sticky top-0 bg-white z-10 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mb-px">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && <RevenueInsights />}
      {activeTab === 'transactions' && (
        <TransactionsTab payments={payments} owners={owners} riders={riders} />
      )}
      {activeTab === 'fines' && <FinesRevenueTab fines={fines} derived={derived} />}
      {activeTab === 'compliance' && <ComplianceRevenueTab riders={riders} motorcycles={motorcycles} />}
      {activeTab === 'analytics' && <AnalyticsTab derived={derived} payments={payments} />}
    </div>
  );
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab({ derived, onOpenTab }: { derived: any; onOpenTab: (t: RevenueTab) => void }) {
  return (
    <div className="space-y-6">
      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-6 w-6 text-white/90" />
            <ArrowUpRight className="h-4 w-4 text-white/70" />
          </div>
          <p className="text-3xl font-bold">{formatKES(derived.totalRevenue)}</p>
          <p className="text-sm text-white/90 mt-1">Total System Revenue</p>
          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
            <span className="text-white/80">This month</span>
            <span className="font-semibold">{formatKES(derived.thisMonthTotal)}</span>
          </div>
        </div>

        <button
          onClick={() => onOpenTab('transactions')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <CreditCard className="h-6 w-6 text-emerald-600" />
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              REGISTRATIONS
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatKES(derived.regRevenue)}</p>
          <p className="text-sm text-slate-500 mt-1">{derived.totalTransactions} transactions</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Share</span>
            <span className="font-semibold text-slate-800">
              {derived.totalRevenue > 0 ? Math.round((derived.regRevenue / derived.totalRevenue) * 100) : 0}%
            </span>
          </div>
        </button>

        <button
          onClick={() => onOpenTab('fines')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <Ban className="h-6 w-6 text-amber-600" />
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              FINES
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatKES(derived.finesCollected)}</p>
          <p className="text-sm text-slate-500 mt-1">{derived.paidFineCount} of {derived.fineCount} paid</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Collection rate</span>
            <span className="font-semibold text-slate-800">{derived.collectionRate}%</span>
          </div>
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-6 w-6 text-red-600" />
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              OUTSTANDING
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatKES(derived.finesOutstanding)}</p>
          <p className="text-sm text-slate-500 mt-1">Uncollected fines</p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Overdue</span>
            <span className="font-semibold text-red-600">{formatKES(derived.finesOverdue)}</span>
          </div>
        </div>
      </div>

      {/* Trend + method breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Revenue Trend</h3>
              <p className="text-xs text-slate-500">Last 6 months, stacked by source</p>
            </div>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>
          <RevenueTrendChart points={derived.months} />

          {/* Owner vs Rider split — folded into the trend card */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">Registrations by user type</p>
                <p className="text-[10px] text-slate-400">Volume and revenue breakdown</p>
              </div>
              <p className="text-[10px] text-slate-400">
                {(derived.ownerCount + derived.riderCount).toLocaleString()} total
              </p>
            </div>
            <UserTypeSplitBar
              ownerCount={derived.ownerCount}
              riderCount={derived.riderCount}
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <UserCog className="h-3.5 w-3.5 text-emerald-700" />
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                    Owners
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-slate-900">{derived.ownerCount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">KES 350 ea</p>
                </div>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  {formatKES(derived.ownerRevenue)}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bike className="h-3.5 w-3.5 text-blue-700" />
                  <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider">
                    Riders
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-slate-900">{derived.riderCount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">KES 100 ea</p>
                </div>
                <p className="text-xs font-semibold text-blue-700 mt-0.5">
                  {formatKES(derived.riderRevenue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Payment Methods</h3>
              <p className="text-xs text-slate-500">Registration channel mix</p>
            </div>
          </div>
          <DonutChart
            data={derived.methodStats.map((m: MethodStat) => ({ label: m.label, value: m.count, color: m.color }))}
            centerLabel="PAYMENTS"
          />
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            {derived.methodStats.map((m: MethodStat) => (
              <div key={m.key} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{m.label} revenue</span>
                <span className="font-semibold text-slate-800">{formatKES(m.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserTypeSplitBar({ ownerCount, riderCount }: { ownerCount: number; riderCount: number }) {
  const total = ownerCount + riderCount;
  if (total === 0) {
    return <div className="h-4 bg-slate-100 rounded-full" />;
  }
  const ownerPct = (ownerCount / total) * 100;
  const riderPct = (riderCount / total) * 100;
  return (
    <div className="h-4 rounded-full overflow-hidden flex bg-slate-100">
      {ownerPct > 0 && (
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center"
          style={{ width: `${ownerPct}%` }}
        >
          {ownerPct > 15 && <span className="text-[9px] font-bold text-white">{Math.round(ownerPct)}%</span>}
        </div>
      )}
      {riderPct > 0 && (
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center"
          style={{ width: `${riderPct}%` }}
        >
          {riderPct > 15 && <span className="text-[9px] font-bold text-white">{Math.round(riderPct)}%</span>}
        </div>
      )}
    </div>
  );
}

// ── TRANSACTIONS TAB ──────────────────────────────────────────────────────────
function TransactionsTab({ payments, owners, riders }: { payments: Payment[]; owners: Owner[]; riders: Rider[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'mpesa' | 'salamapay' | 'ecitizen'>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'owner' | 'rider'>('all');
  const [page, setPage] = useState(1);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  const getUserName = (payment: Payment): string => {
    if (payment.user_type === 'owner') {
      return owners.find(o => o.id === payment.user_id)?.full_name || 'Unknown Owner';
    }
    return riders.find(r => r.id === payment.user_id)?.name || 'Unknown Rider';
  };

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      if (userTypeFilter !== 'all' && p.user_type !== userTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = getUserName(p).toLowerCase();
        return (
          name.includes(q) ||
          p.transaction_reference.toLowerCase().includes(q) ||
          p.phone_number.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payments, searchQuery, methodFilter, userTypeFilter, owners, riders]);

  useEffect(() => { setPage(1); }, [searchQuery, methodFilter, userTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary = useMemo(() => {
    const totalAmount = filtered.reduce((s, p) => s + Number(p.amount), 0);
    const ownerRows = filtered.filter(p => p.user_type === 'owner');
    const riderRows = filtered.filter(p => p.user_type === 'rider');
    const ownerCount = ownerRows.length;
    const riderCount = riderRows.length;
    const ownerRevenue = ownerRows.reduce((s, p) => s + Number(p.amount), 0);
    const riderRevenue = riderRows.reduce((s, p) => s + Number(p.amount), 0);
    const methods = (['mpesa', 'salamapay', 'ecitizen'] as const).map(k => {
      const rows = filtered.filter(p => p.payment_method === k);
      return {
        key: k,
        label: METHOD_META[k].label,
        color: METHOD_META[k].color,
        count: rows.length,
        revenue: rows.reduce((s, p) => s + Number(p.amount), 0),
      };
    });
    const avgTicket = filtered.length > 0 ? Math.round(totalAmount / filtered.length) : 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = filtered.filter(p => new Date(p.created_at) >= monthStart);
    const thisMonthRevenue = thisMonth.reduce((s, p) => s + Number(p.amount), 0);
    return {
      totalAmount,
      ownerCount,
      riderCount,
      ownerRevenue,
      riderRevenue,
      methods,
      avgTicket,
      thisMonthCount: thisMonth.length,
      thisMonthRevenue,
    };
  }, [filtered]);

  const exportToCSV = () => {
    const headers = ['Date', 'Reference', 'User Type', 'Name', 'Year', 'Phone', 'Method', 'Amount'];
    const csv = [
      headers.join(','),
      ...filtered.map(p => [
        new Date(p.created_at).toLocaleString(),
        p.transaction_reference,
        p.user_type,
        `"${getUserName(p).replace(/"/g, '""')}"`,
        p.payment_year,
        p.phone_number,
        p.payment_method.toUpperCase(),
        p.amount.toFixed(2),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, reference, or phone..."
              className="w-full pl-12 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-slate-500 self-center mr-1">Method:</span>
          {(['all', 'mpesa', 'salamapay', 'ecitizen'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                methodFilter === m
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {m === 'all' ? 'All' : METHOD_META[m]?.label || m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 self-center mr-1">User:</span>
          {(['all', 'owner', 'rider'] as const).map(u => (
            <button
              key={u}
              onClick={() => setUserTypeFilter(u)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all capitalize ${
                userTypeFilter === u
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {u === 'all' ? 'All' : u + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary — reflects current filters */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Filtered Summary</h3>
              <p className="text-xs text-slate-500">
                {filtered.length.toLocaleString()} of {payments.length.toLocaleString()} registrations
              </p>
            </div>
            <Wallet className="h-4 w-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Revenue</p>
              <p className="text-xl font-bold text-emerald-600">{formatKES(summary.totalAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Transactions</p>
              <p className="text-xl font-bold text-slate-900">{filtered.length.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Avg Ticket</p>
              <p className="text-xl font-bold text-slate-900">{formatKES(summary.avgTicket)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">This Month</p>
              <p className="text-xl font-bold text-slate-900">{summary.thisMonthCount}</p>
              <p className="text-[10px] text-slate-500">{formatKES(summary.thisMonthRevenue)}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Registrations by user type</p>
              <p className="text-[10px] text-slate-400">
                {(summary.ownerCount + summary.riderCount).toLocaleString()} in view
              </p>
            </div>
            <UserTypeSplitBar
              ownerCount={summary.ownerCount}
              riderCount={summary.riderCount}
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <UserCog className="h-3.5 w-3.5 text-emerald-700" />
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                    Owners
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-slate-900">{summary.ownerCount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">KES 350 ea</p>
                </div>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  {formatKES(summary.ownerRevenue)}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bike className="h-3.5 w-3.5 text-blue-700" />
                  <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider">
                    Riders
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-slate-900">{summary.riderCount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">KES 100 ea</p>
                </div>
                <p className="text-xs font-semibold text-blue-700 mt-0.5">
                  {formatKES(summary.riderRevenue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Payment Channels</h3>
              <p className="text-xs text-slate-500">Within current filters</p>
            </div>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </div>
          {summary.methods.every(m => m.count === 0) ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              No transactions match
            </div>
          ) : (
            <div className="space-y-3">
              {summary.methods.map(m => {
                const maxRev = Math.max(...summary.methods.map(x => x.revenue), 1);
                const pct = (m.revenue / maxRev) * 100;
                const share = summary.totalAmount > 0
                  ? Math.round((m.revenue / summary.totalAmount) * 100)
                  : 0;
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                        <span className="font-medium text-slate-700">{m.label}</span>
                        <span className="text-slate-400">({m.count})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-800">{formatKES(m.revenue)}</span>
                        <span className="text-slate-400 ml-1">({share}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(pct, m.revenue > 0 ? 4 : 0)}%`, background: m.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Transactions</p>
            <p className="text-xs text-slate-500">
              {filtered.length.toLocaleString()} results
            </p>
          </div>
          <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
        </div>

        {pageItems.length === 0 ? (
          <div className="text-center py-16">
            <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No transactions match your filters</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pageItems.map(p => {
              const methodMeta = METHOD_META[p.payment_method] ?? { label: p.payment_method, color: '#64748b' };
              const isOwner = p.user_type === 'owner';
              const created = new Date(p.created_at);
              return (
                <li
                  key={p.id}
                  className="group px-5 py-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isOwner
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {getUserName(p)
                        .split(' ')
                        .map(w => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {getUserName(p)}
                        </p>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            isOwner
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                              : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                          }`}
                        >
                          {isOwner ? 'Owner' : 'Rider'}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{
                            background: `${methodMeta.color}12`,
                            color: methodMeta.color,
                          }}
                        >
                          {methodMeta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Hash className="h-3 w-3 text-slate-400" />
                          <span className="font-mono">{p.transaction_reference}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {p.phone_number}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {created.toLocaleDateString()} · {created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="h-3 w-3 text-slate-400" />
                          Year {p.payment_year}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-emerald-600 tabular-nums">
                        {formatKES(Number(p.amount))}
                      </p>
                    </div>

                    <button
                      onClick={() => setReceiptPayment(p)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <p className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-800">{page}</span> of {totalPages}
            </p>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          payerName={getUserName(receiptPayment)}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </div>
  );
}

// ── FINES REVENUE TAB ─────────────────────────────────────────────────────────
function FinesRevenueTab({ fines, derived }: { fines: FineRow[]; derived: any }) {
  const statusBreakdown = useMemo(() => {
    const statuses = ['paid', 'issued', 'overdue', 'disputed', 'cancelled'];
    return statuses.map(s => {
      const rows = fines.filter(f => f.status === s);
      const amount = rows.reduce((sum, f) => sum + f.fine_amount, 0);
      return { status: s, count: rows.length, amount };
    }).filter(x => x.count > 0);
  }, [fines]);

  const now = new Date();
  const trendData = useMemo(() => {
    const months: { label: string; issued: number; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const issued = fines
        .filter(f => new Date(f.issued_at) >= d && new Date(f.issued_at) < next)
        .reduce((s, f) => s + f.fine_amount, 0);
      const collected = fines
        .filter(f => f.status === 'paid' && f.paid_at && new Date(f.paid_at) >= d && new Date(f.paid_at) < next)
        .reduce((s, f) => s + f.fine_amount, 0);
      months.push({ label: monthLabel(d), issued, collected });
    }
    return months;
  }, [fines]);

  const statusColors: Record<string, string> = {
    paid: '#059669',
    issued: '#2563eb',
    overdue: '#dc2626',
    disputed: '#d97706',
    cancelled: '#94a3b8',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">COLLECTED</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatKES(derived.finesCollected)}</p>
          <p className="text-xs text-slate-500 mt-1">{derived.paidFineCount} fines paid</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <Clock className="h-5 w-5 text-amber-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">OUTSTANDING</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatKES(derived.finesOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">Awaiting collection</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <Ban className="h-5 w-5 text-red-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">OVERDUE</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatKES(derived.finesOverdue)}</p>
          <p className="text-xs text-slate-500 mt-1">Past due date</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <BarChart3 className="h-5 w-5 text-slate-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">RATE</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{derived.collectionRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Collection efficiency</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Fines: Issued vs Collected</h3>
              <p className="text-xs text-slate-500">6-month history</p>
            </div>
          </div>
          <FinesIssuedVsCollectedChart points={trendData} />
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Status Breakdown</h3>
          <p className="text-xs text-slate-500 mb-3">All fines by lifecycle stage</p>
          {statusBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No fines yet</div>
          ) : (
            <DonutChart
              data={statusBreakdown.map(s => ({
                label: s.status.charAt(0).toUpperCase() + s.status.slice(1),
                value: s.count,
                color: statusColors[s.status] || '#64748b',
              }))}
              centerLabel="FINES"
            />
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Collection Health</h3>
        <div className="space-y-3">
          {statusBreakdown.map(s => (
            <div key={s.status} className="flex items-center gap-3">
              <span
                className="text-xs font-medium capitalize w-20 text-slate-600 flex-shrink-0"
              >
                {s.status}
              </span>
              <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max((s.amount / (derived.finesCollected + derived.finesOutstanding || 1)) * 100, 4)}%`,
                    background: statusColors[s.status],
                  }}
                >
                  <span className="text-[10px] font-bold text-white">{s.count}</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-800 w-24 text-right flex-shrink-0">
                {formatKES(s.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <FinesActivityList fines={fines} />
    </div>
  );
}

function FinesActivityList({ fines }: { fines: FineRow[] }) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'issued' | 'overdue'>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(10);
  const [receiptFine, setReceiptFine] = useState<FineReceiptData | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fines.filter(f => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (f.rider_name ?? '').toLowerCase().includes(q) ||
        (f.rider_phone ?? '').toLowerCase().includes(q) ||
        (f.officer_name ?? '').toLowerCase().includes(q) ||
        (f.fine_reference ?? '').toLowerCase().includes(q) ||
        (f.station_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [fines, statusFilter, query]);

  const statusStyles: Record<string, { bg: string; text: string; ring: string; icon: JSX.Element }> = {
    paid: {
      bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    issued: {
      bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200',
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    overdue: {
      bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    disputed: {
      bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    cancelled: {
      bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200',
      icon: <Ban className="h-3.5 w-3.5" />,
    },
  };

  const filters: { key: typeof statusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'issued', label: 'Outstanding' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Fines Activity</h3>
          <p className="text-xs text-slate-500">
            Who paid, who issued, and where — most recent first
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rider, officer, reference..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setStatusFilter(f.key); setVisible(10); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Ban className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No fines match your filters</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {filtered.slice(0, visible).map(f => {
              const style = statusStyles[f.status] ?? statusStyles.issued;
              const officerLabel = f.officer_name
                ? `${f.officer_rank ?? 'Officer'} ${f.officer_name}`.trim()
                : 'Unknown officer';
              const initials = (f.rider_name || '?')
                .split(' ')
                .map(w => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              return (
                <li key={f.id} className="group py-3 hover:bg-slate-50/60 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ${style.bg} ${style.text} ${style.ring}`}
                    >
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {f.rider_name || 'Unknown rider'}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${style.bg} ${style.text} ${style.ring}`}
                        >
                          {style.icon}
                          {f.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        {f.rider_phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {f.rider_phone}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Shield className="h-3 w-3 text-slate-400" />
                          {officerLabel}
                          {f.officer_badge && (
                            <span className="text-slate-400">#{f.officer_badge}</span>
                          )}
                        </span>
                        {f.station_name && (
                          <span className="inline-flex items-center gap-1">
                            <Landmark className="h-3 w-3 text-slate-400" />
                            {f.station_name}
                          </span>
                        )}
                        {f.fine_reference && (
                          <span className="inline-flex items-center gap-1">
                            <Hash className="h-3 w-3 text-slate-400" />
                            <span className="font-mono">{f.fine_reference}</span>
                          </span>
                        )}
                        {f.location_description && (
                          <span className="inline-flex items-center gap-1 truncate max-w-xs">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {f.location_description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-slate-900 tabular-nums">
                        {formatKES(f.fine_amount)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Issued {new Date(f.issued_at).toLocaleDateString()}
                      </p>
                      {f.status === 'paid' && f.paid_at && (
                        <p className="text-[10px] text-emerald-600 font-medium">
                          Paid {new Date(f.paid_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => setReceiptFine(f as FineReceiptData)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {Math.min(visible, filtered.length)} of {filtered.length}
            </p>
            {visible < filtered.length && (
              <button
                onClick={() => setVisible(v => v + 10)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Show more
              </button>
            )}
          </div>
        </>
      )}

      {receiptFine && (
        <FineReceiptModal
          fine={receiptFine}
          onClose={() => setReceiptFine(null)}
        />
      )}
    </div>
  );
}

function FinesIssuedVsCollectedChart({ points }: { points: { label: string; issued: number; collected: number }[] }) {
  if (points.length === 0 || points.every(p => p.issued === 0 && p.collected === 0)) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No fines data</div>;
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
              <rect x={x - barW - 2} y={padT + chartH - issuedH} width={barW} height={issuedH} fill="#f59e0b" rx={2}>
                <title>{p.label} issued: {formatKES(p.issued)}</title>
              </rect>
              <rect x={x + 2} y={padT + chartH - collectedH} width={barW} height={collectedH} fill="#059669" rx={2}>
                <title>{p.label} collected: {formatKES(p.collected)}</title>
              </rect>
              <text x={x} y={height - padB + 12} fontSize="9" fill="#64748b" textAnchor="middle">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 justify-center mt-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#f59e0b' }} />
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

// ── ANALYTICS TAB ─────────────────────────────────────────────────────────────
function AnalyticsTab({ derived, payments }: { derived: any; payments: Payment[] }) {
  const monthsRegistrations = derived.months.map((m: MonthPoint) => m.registrations);
  const monthsFines = derived.months.map((m: MonthPoint) => m.fines);

  const yearBreakdown = useMemo(() => {
    const grouped: Record<string, { count: number; amount: number }> = {};
    payments.forEach(p => {
      const y = String(p.payment_year || 'Unknown');
      if (!grouped[y]) grouped[y] = { count: 0, amount: 0 };
      grouped[y].count++;
      grouped[y].amount += Number(p.amount);
    });
    return Object.entries(grouped)
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [payments]);

  const avgTicket = payments.length > 0
    ? Math.round(derived.regRevenue / payments.length)
    : 0;

  const projection = derived.thisMonthTotal > 0
    ? Math.round(derived.thisMonthTotal * (30 / Math.max(1, new Date().getDate())))
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Registrations MoM</span>
            <Sparkline values={monthsRegistrations} color="#059669" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatKES(monthsRegistrations[monthsRegistrations.length - 1] || 0)}</p>
          <p className="text-xs text-slate-500 mt-1">Latest month</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Fines MoM</span>
            <Sparkline values={monthsFines} color="#d97706" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatKES(monthsFines[monthsFines.length - 1] || 0)}</p>
          <p className="text-xs text-slate-500 mt-1">Collected this month</p>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/70">Projected (30d)</span>
            <ArrowUpRight className="h-4 w-4 text-white/70" />
          </div>
          <p className="text-2xl font-bold">{formatKES(projection)}</p>
          <p className="text-xs text-white/60 mt-1">Extrapolated from current pace</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Revenue Composition</h3>
          <p className="text-xs text-slate-500 mb-4">How each source contributes to total</p>
          <div className="space-y-3">
            <CompositionRow label="Owner Registrations" value={derived.ownerRevenue} total={derived.totalRevenue} color="#059669" />
            <CompositionRow label="Rider Registrations" value={derived.riderRevenue} total={derived.totalRevenue} color="#2563eb" />
            <CompositionRow label="Fines Collected" value={derived.finesCollected} total={derived.totalRevenue} color="#d97706" />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-500">Avg transaction</p>
              <p className="text-base font-semibold text-slate-800">{formatKES(avgTicket)}</p>
            </div>
            <div>
              <p className="text-slate-500">Fines coverage</p>
              <p className="text-base font-semibold text-slate-800">
                {derived.regRevenue > 0 ? Math.round((derived.finesCollected / derived.regRevenue) * 100) : 0}%
                <span className="text-xs text-slate-400 font-normal ml-1">of registrations</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Payment Year Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">Registrations split by year</p>
          {yearBreakdown.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No data</div>
          ) : (
            <div className="space-y-2">
              {yearBreakdown.map(y => {
                const max = Math.max(...yearBreakdown.map(x => x.amount), 1);
                const pct = (y.amount / max) * 100;
                return (
                  <div key={y.year} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 w-16 flex-shrink-0">{y.year}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-end pr-2 rounded-full"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">{y.count}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 w-24 text-right flex-shrink-0">
                      {formatKES(y.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Payment Method Performance</h3>
        <p className="text-xs text-slate-500 mb-4">Volume and revenue by channel</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {derived.methodStats.map((m: MethodStat) => {
            const share = derived.totalTransactions > 0 ? Math.round((m.count / derived.totalTransactions) * 100) : 0;
            return (
              <div key={m.key} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: m.color }}>{m.label}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${m.color}15`, color: m.color }}>
                    {share}%
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900">{m.count}</p>
                <p className="text-xs text-slate-500">transactions</p>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="text-sm font-semibold text-slate-800">{formatKES(m.revenue)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompositionRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-800">{formatKES(value)} <span className="text-slate-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
