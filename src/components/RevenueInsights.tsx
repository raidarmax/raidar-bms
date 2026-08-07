import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, CheckCircle2, Clock, ArrowUp, ArrowDown,
  Award, CreditCard, Bike, UserCog, Landmark, Ban, FileCheck, ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Payment = {
  amount: number;
  payment_status: string;
  payment_method: string | null;
  user_type: string | null;
  created_at: string;
};

type FineRow = {
  fine_amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
};

type RiderRow = {
  license_url: string | null;
  good_conduct_url: string | null;
  created_at: string;
};

type ComplianceFees = {
  driving_license_fee: number;
  good_conduct_fee: number;
};

const METHOD_META: Record<string, { label: string; color: string; gradient: string }> = {
  mpesa: { label: 'M-Pesa', color: '#059669', gradient: 'from-emerald-600 to-emerald-700' },
  salamapay: { label: 'SalamaPay', color: '#2563eb', gradient: 'from-blue-600 to-blue-700' },
  ecitizen: { label: 'eCitizen', color: '#dc2626', gradient: 'from-red-600 to-red-700' },
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(d: Date) { return d.toLocaleString('en-KE', { month: 'short' }); }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function fmtKES(n: number) { return `KES ${Math.round(n).toLocaleString()}`; }
function fmtKESShort(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(1)}k`;
  return `KES ${Math.round(n)}`;
}

export default function RevenueInsights() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fines, setFines] = useState<FineRow[]>([]);
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [fees, setFees] = useState<ComplianceFees>({
    driving_license_fee: 600,
    good_conduct_fee: 1000,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [payRes, fineRes, riderRes, settingsRes] = await Promise.all([
        supabase.from('payments').select('amount, payment_status, payment_method, user_type, created_at').eq('payment_status', 'completed'),
        supabase.from('fines').select('fine_amount, status, issued_at, paid_at'),
        supabase.from('riders').select('license_url, good_conduct_url, created_at'),
        supabase
          .from('system_settings')
          .select('key, value')
          .eq('category', 'general')
          .in('key', ['driving_license_fee', 'good_conduct_fee']),
      ]);
      if (cancelled) return;
      setPayments((payRes.data || []) as any);
      setFines((fineRes.data || []) as any);
      setRiders((riderRes.data || []) as any);
      if (settingsRes.data) {
        const next: ComplianceFees = { driving_license_fee: 600, good_conduct_fee: 1000 };
        for (const row of settingsRes.data as { key: string; value: unknown }[]) {
          const numeric = Number(row.value);
          if (Number.isFinite(numeric) && row.key in next) {
            (next as Record<string, number>)[row.key] = numeric;
          }
        }
        setFees(next);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const analytics = useMemo(() => {
    const regRevenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const finesCollected = fines.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.fine_amount || 0), 0);
    const finesOutstanding = fines.filter(f => f.status === 'issued' || f.status === 'overdue').reduce((s, f) => s + Number(f.fine_amount || 0), 0);
    const finesOverdue = fines.filter(f => f.status === 'overdue').reduce((s, f) => s + Number(f.fine_amount || 0), 0);

    // Compliance (3rd-party document) revenue
    const ridersWithLicense = riders.filter(r => !!r.license_url);
    const ridersWithGC = riders.filter(r => !!r.good_conduct_url);
    const licenseRevenue = ridersWithLicense.length * fees.driving_license_fee;
    const gcRevenue = ridersWithGC.length * fees.good_conduct_fee;
    const complianceRevenue = licenseRevenue + gcRevenue;
    const complianceDocs = ridersWithLicense.length + ridersWithGC.length;

    const totalRevenue = regRevenue + finesCollected + complianceRevenue;
    const totalTransactions = payments.length + fines.filter(f => f.status === 'paid').length + complianceDocs;

    // Payment methods
    const methods = (['mpesa', 'salamapay', 'ecitizen'] as const).map(k => {
      const rows = payments.filter(p => p.payment_method === k);
      return {
        key: k,
        label: METHOD_META[k].label,
        color: METHOD_META[k].color,
        gradient: METHOD_META[k].gradient,
        count: rows.length,
        revenue: rows.reduce((s, p) => s + Number(p.amount || 0), 0),
      };
    });

    // Owner vs Rider
    const ownerRows = payments.filter(p => p.user_type === 'owner');
    const riderRows = payments.filter(p => p.user_type === 'rider');
    const ownerRevenue = ownerRows.reduce((s, p) => s + Number(p.amount || 0), 0);
    const riderRevenue = riderRows.reduce((s, p) => s + Number(p.amount || 0), 0);

    // Growth (this month vs last)
    const now = new Date();
    const thisKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const thisMonthReg = payments
      .filter(p => monthKey(new Date(p.created_at)) === thisKey)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const prevMonthReg = payments
      .filter(p => monthKey(new Date(p.created_at)) === prevKey)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const thisMonthFines = fines
      .filter(f => f.status === 'paid' && f.paid_at && monthKey(new Date(f.paid_at)) === thisKey)
      .reduce((s, f) => s + Number(f.fine_amount || 0), 0);
    const prevMonthFines = fines
      .filter(f => f.status === 'paid' && f.paid_at && monthKey(new Date(f.paid_at)) === prevKey)
      .reduce((s, f) => s + Number(f.fine_amount || 0), 0);

    const thisMonthCompliance =
      ridersWithLicense.filter(r => monthKey(new Date(r.created_at)) === thisKey).length * fees.driving_license_fee +
      ridersWithGC.filter(r => monthKey(new Date(r.created_at)) === thisKey).length * fees.good_conduct_fee;
    const prevMonthCompliance =
      ridersWithLicense.filter(r => monthKey(new Date(r.created_at)) === prevKey).length * fees.driving_license_fee +
      ridersWithGC.filter(r => monthKey(new Date(r.created_at)) === prevKey).length * fees.good_conduct_fee;

    const thisMonthTotal = thisMonthReg + thisMonthFines + thisMonthCompliance;
    const prevMonthTotal = prevMonthReg + prevMonthFines + prevMonthCompliance;
    const growth = prevMonthTotal === 0 ? (thisMonthTotal > 0 ? 100 : 0) : Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100);

    // 12-month buckets
    const monthly: { label: string; key: string; registrations: number; fines: number; compliance: number; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({ label: monthLabel(d), key: monthKey(d), registrations: 0, fines: 0, compliance: 0, total: 0 });
    }
    const mIdx = new Map(monthly.map((b, i) => [b.key, i]));
    payments.forEach(p => {
      const i = mIdx.get(monthKey(new Date(p.created_at)));
      if (i !== undefined) {
        monthly[i].registrations += Number(p.amount || 0);
        monthly[i].total += Number(p.amount || 0);
      }
    });
    fines.forEach(f => {
      if (f.status !== 'paid' || !f.paid_at) return;
      const i = mIdx.get(monthKey(new Date(f.paid_at)));
      if (i !== undefined) {
        monthly[i].fines += Number(f.fine_amount || 0);
        monthly[i].total += Number(f.fine_amount || 0);
      }
    });
    ridersWithLicense.forEach(r => {
      const i = mIdx.get(monthKey(new Date(r.created_at)));
      if (i !== undefined) {
        monthly[i].compliance += fees.driving_license_fee;
        monthly[i].total += fees.driving_license_fee;
      }
    });
    ridersWithGC.forEach(r => {
      const i = mIdx.get(monthKey(new Date(r.created_at)));
      if (i !== undefined) {
        monthly[i].compliance += fees.good_conduct_fee;
        monthly[i].total += fees.good_conduct_fee;
      }
    });

    // Collection rate
    const totalFines = fines.length;
    const paidFineCount = fines.filter(f => f.status === 'paid').length;
    const collectionRate = pct(paidFineCount, totalFines);

    // Method dominance
    const totalMethodRevenue = methods.reduce((s, m) => s + m.revenue, 0);

    return {
      totalRevenue, regRevenue, finesCollected, finesOutstanding, finesOverdue,
      complianceRevenue, licenseRevenue, gcRevenue, complianceDocs,
      licenseCount: ridersWithLicense.length, gcCount: ridersWithGC.length,
      methods, totalMethodRevenue,
      ownerCount: ownerRows.length, riderCount: riderRows.length,
      ownerRevenue, riderRevenue,
      thisMonthTotal, prevMonthTotal, thisMonthReg, thisMonthFines, thisMonthCompliance,
      growth, monthly,
      collectionRate, totalFines, paidFineCount,
      totalTransactions,
    };
  }, [payments, fines, riders, fees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPI
          label="Total Revenue"
          value={fmtKESShort(analytics.totalRevenue)}
          hint={`${analytics.totalTransactions} transactions`}
          growth={analytics.growth}
          icon={<Wallet className="h-4 w-4 text-white" />}
          gradient="from-emerald-600 to-emerald-700"
        />
        <KPI
          label="Registration Fees"
          value={fmtKESShort(analytics.regRevenue)}
          hint={`${payments.length} payments`}
          icon={<CreditCard className="h-4 w-4 text-white" />}
          gradient="from-blue-600 to-blue-700"
          progress={pct(analytics.regRevenue, Math.max(analytics.totalRevenue, 1))}
        />
        <KPI
          label="Fines Collected"
          value={fmtKESShort(analytics.finesCollected)}
          hint={`${analytics.paidFineCount} of ${analytics.totalFines}`}
          icon={<CheckCircle2 className="h-4 w-4 text-white" />}
          gradient="from-teal-600 to-cyan-700"
          progress={analytics.collectionRate}
        />
        <KPI
          label="Compliance Fees"
          value={fmtKESShort(analytics.complianceRevenue)}
          hint={`${analytics.complianceDocs} documents on file`}
          icon={<ShieldCheck className="h-4 w-4 text-white" />}
          gradient="from-sky-600 to-blue-700"
          progress={pct(analytics.complianceRevenue, Math.max(analytics.totalRevenue, 1))}
        />
        <KPI
          label="Outstanding"
          value={fmtKESShort(analytics.finesOutstanding)}
          hint={`${fmtKESShort(analytics.finesOverdue)} overdue`}
          icon={<Clock className="h-4 w-4 text-white" />}
          gradient="from-amber-500 to-amber-600"
        />
        <KPI
          label="This Month"
          value={fmtKESShort(analytics.thisMonthTotal)}
          hint={`vs ${fmtKESShort(analytics.prevMonthTotal)} prev`}
          icon={<TrendingUp className="h-4 w-4 text-white" />}
          gradient="from-slate-800 to-slate-900"
          growth={analytics.growth}
        />
      </div>

      {/* Row 1: Payment methods + revenue mix + growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Payment Methods" subtitle="Registration revenue by channel" icon={<CreditCard className="h-4 w-4 text-emerald-600" />}>
          {analytics.totalMethodRevenue === 0 ? <Empty label="No payments yet" /> : (
            <div className="space-y-3 mt-1">
              {analytics.methods.map(m => (
                <StatusBar
                  key={m.key}
                  label={m.label}
                  count={m.count}
                  total={payments.length}
                  color={m.color}
                  suffix={fmtKES(m.revenue)}
                />
              ))}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Preferred</span>
                <span className="font-semibold text-slate-900">
                  {analytics.methods.slice().sort((a, b) => b.revenue - a.revenue)[0]?.label || '—'}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Revenue Mix" subtitle="Where the money comes from" icon={<Award className="h-4 w-4 text-emerald-600" />}>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="border rounded-lg p-3 bg-blue-50 border-blue-100">
              <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                <Landmark className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">Owners</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.ownerRevenue)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{analytics.ownerCount} payments</p>
            </div>
            <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-100">
              <div className="flex items-center gap-1.5 text-emerald-700 mb-1">
                <Bike className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">Riders</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.riderRevenue)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{analytics.riderCount} payments</p>
            </div>
            <div className="border rounded-lg p-3 bg-teal-50 border-teal-100">
              <div className="flex items-center gap-1.5 text-teal-700 mb-1">
                <CreditCard className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">Registration</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.regRevenue)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{pct(analytics.regRevenue, Math.max(analytics.totalRevenue, 1))}% of total</p>
            </div>
            <div className="border rounded-lg p-3 bg-amber-50 border-amber-100">
              <div className="flex items-center gap-1.5 text-amber-700 mb-1">
                <Ban className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">Fines</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.finesCollected)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{pct(analytics.finesCollected, Math.max(analytics.totalRevenue, 1))}% of total</p>
            </div>
            <div className="border rounded-lg p-3 bg-sky-50 border-sky-100 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-sky-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <p className="text-[10px] uppercase tracking-wider font-semibold">Compliance</p>
                </div>
                <p className="text-[10px] text-slate-500">{pct(analytics.complianceRevenue, Math.max(analytics.totalRevenue, 1))}% of total</p>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.complianceRevenue)}</p>
                <p className="text-[10px] text-slate-500">
                  <span className="font-semibold text-emerald-700">{fmtKESShort(analytics.licenseRevenue)}</span> licenses ·{' '}
                  <span className="font-semibold text-teal-700">{fmtKESShort(analytics.gcRevenue)}</span> good conduct
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Revenue Trend" subtitle="Last 12 months (KES)" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
          <TwoLineBarChart data={analytics.monthly.map(m => ({ label: m.label, a: m.registrations, b: m.fines, c: m.compliance }))} />
          <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-slate-900">{fmtKESShort(analytics.thisMonthTotal)}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">This month</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{fmtKESShort(analytics.prevMonthTotal)}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Last month</p>
            </div>
            <div>
              <p className={`text-sm font-bold inline-flex items-center gap-0.5 ${analytics.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {analytics.growth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(analytics.growth)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Growth</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500 justify-center">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Registrations</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Fines</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Compliance</span>
          </div>
        </Card>
      </div>

      {/* Row 2: KPIs summary + Fines health + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Collection Health" subtitle="Fines paid vs outstanding" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <MiniStat label="Collected" value={analytics.finesCollected} isCurrency tone="emerald" />
            <MiniStat label="Pending" value={analytics.finesOutstanding} isCurrency tone="amber" />
            <MiniStat label="Overdue" value={analytics.finesOverdue} isCurrency tone="red" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">Fine collection rate</span>
              <span className="font-semibold text-slate-800">{analytics.collectionRate}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full transition-all duration-700" style={{ width: `${analytics.collectionRate}%` }} />
            </div>
          </div>
        </Card>

        <Card title="Owner vs Rider Revenue" subtitle="Registration segment split" icon={<UserCog className="h-4 w-4 text-blue-600" />}>
          <div className="mt-1 space-y-3">
            <StatusBar
              label="Owners"
              count={analytics.ownerCount}
              total={payments.length}
              color="#2563eb"
              suffix={fmtKES(analytics.ownerRevenue)}
            />
            <StatusBar
              label="Riders"
              count={analytics.riderCount}
              total={payments.length}
              color="#059669"
              suffix={fmtKES(analytics.riderRevenue)}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Average payment</span>
            <span className="font-semibold text-slate-800">
              {payments.length > 0 ? fmtKES(analytics.regRevenue / payments.length) : fmtKES(0)}
            </span>
          </div>
        </Card>

        <Card title="This Month" subtitle="Momentum snapshot" icon={<Clock className="h-4 w-4 text-blue-600" />}>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div className="border rounded-lg p-3 bg-blue-50 border-blue-100 text-blue-800">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Registrations</p>
              <p className="text-base font-bold mt-1">{fmtKESShort(analytics.thisMonthReg)}</p>
            </div>
            <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-100 text-emerald-800">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Fines</p>
              <p className="text-base font-bold mt-1">{fmtKESShort(analytics.thisMonthFines)}</p>
            </div>
            <div className="border rounded-lg p-3 bg-sky-50 border-sky-100 text-sky-800">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Compliance</p>
              <p className="text-base font-bold mt-1">{fmtKESShort(analytics.thisMonthCompliance)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Total this month</span>
              <span className={`font-semibold inline-flex items-center gap-0.5 ${analytics.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {analytics.growth >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {fmtKESShort(analytics.thisMonthTotal)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Shared subcomponents ────────────────────────────────────────────────────
function KPI({ label, value, hint, growth, gradient, icon, progress }: {
  label: string; value: string; hint?: string; growth?: number;
  gradient: string; icon: JSX.Element; progress?: number;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${gradient} p-3 text-white shadow-sm`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="h-7 w-7 rounded-md bg-white/15 flex items-center justify-center">{icon}</div>
        {growth !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${growth >= 0 ? 'bg-white/20' : 'bg-black/25'}`}>
            {growth >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/80">{label}</p>
      <p className="text-lg lg:text-xl font-bold leading-tight mt-0.5 truncate">{value}</p>
      {hint && <p className="text-[10px] text-white/75 mt-1 truncate">{hint}</p>}
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/90 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}

function Card({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: JSX.Element; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="flex items-center justify-center h-32 text-slate-400 text-sm">{label}</div>;
}

function StatusBar({ label, count, total, color, suffix }: { label: string; count: number; total: number; color: string; suffix?: string }) {
  const p = pct(count, total);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="text-slate-500 tabular-nums">{suffix ? `${count} · ${suffix}` : `${count} · ${p}%`}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, isCurrency }: { label: string; value: number; tone: 'blue' | 'emerald' | 'amber' | 'red'; isCurrency?: boolean }) {
  const bg = tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100'
    : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : tone === 'red' ? 'bg-red-50 text-red-700 border-red-100'
    : 'bg-amber-50 text-amber-700 border-amber-100';
  const display = isCurrency ? fmtKESShort(value) : value.toLocaleString();
  return (
    <div className={`border rounded-lg p-2.5 text-center ${bg}`}>
      <p className="text-sm font-bold truncate" title={isCurrency ? fmtKES(value) : String(value)}>{display}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">{label}</p>
    </div>
  );
}

function TwoLineBarChart({ data }: { data: { label: string; a: number; b: number; c?: number }[] }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b, d.c ?? 0)));
  const hasC = data.some(d => (d.c ?? 0) > 0);
  return (
    <div className="mt-1">
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => {
          const ha = Math.max(2, Math.round((d.a / max) * 100));
          const hb = Math.max(2, Math.round((d.b / max) * 100));
          const hc = hasC ? Math.max(2, Math.round(((d.c ?? 0) / max) * 100)) : 0;
          return (
            <div key={i} className="flex-1 flex items-end justify-center gap-[2px]">
              <div className={`${hasC ? 'w-1/3' : 'w-1/2'} bg-blue-500/80 rounded-t transition-all duration-500`} style={{ height: `${ha}%` }} title={`${d.label} · Registrations: ${fmtKES(d.a)}`} />
              <div className={`${hasC ? 'w-1/3' : 'w-1/2'} bg-emerald-500/80 rounded-t transition-all duration-500`} style={{ height: `${hb}%` }} title={`${d.label} · Fines: ${fmtKES(d.b)}`} />
              {hasC && (
                <div className="w-1/3 bg-sky-500/80 rounded-t transition-all duration-500" style={{ height: `${hc}%` }} title={`${d.label} · Compliance: ${fmtKES(d.c ?? 0)}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-slate-500">{d.label}</div>
        ))}
      </div>
    </div>
  );
}
