import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, FileCheck, ShieldCheck, BadgeCheck, AlertCircle, Clock,
  Users, ArrowUp, ArrowDown, TrendingUp, Award, CalendarClock, Wrench,
} from 'lucide-react';
import { supabase, type Rider, type Motorcycle } from '../lib/supabase';
import { getLicenseExpiryStatus } from '../lib/licenseExpiry';

type Props = { riders: Rider[]; motorcycles?: Motorcycle[] };

type ComplianceFees = {
  driving_license_fee: number;
  good_conduct_fee: number;
  ntsa_inspection_fee: number;
};

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function fmtKES(n: number) { return `KES ${Math.round(n).toLocaleString()}`; }
function fmtKESShort(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(1)}k`;
  return `KES ${Math.round(n)}`;
}
function monthLabel(d: Date) { return d.toLocaleString('en-KE', { month: 'short' }); }

export default function ComplianceRevenueTab({ riders, motorcycles = [] }: Props) {
  const [fees, setFees] = useState<ComplianceFees>({
    driving_license_fee: 600,
    good_conduct_fee: 1000,
    ntsa_inspection_fee: 1500,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('category', 'general')
        .in('key', ['driving_license_fee', 'good_conduct_fee', 'ntsa_inspection_fee']);
      if (cancelled) return;
      if (data) {
        const next: ComplianceFees = { driving_license_fee: 600, good_conduct_fee: 1000, ntsa_inspection_fee: 1500 };
        for (const row of data) {
          const numeric = Number(row.value);
          if (Number.isFinite(numeric) && row.key in next) {
            (next as any)[row.key] = numeric;
          }
        }
        setFees(next);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const analytics = useMemo(() => {
    const ridersWithLicense = riders.filter(r => !!r.license_url);
    const ridersWithGC = riders.filter(r => !!r.good_conduct_url);
    const ridersWithBoth = riders.filter(r => !!r.license_url && !!r.good_conduct_url);
    const motorcyclesWithInspection = motorcycles.filter(m => !!m.inspection_certificate_url);

    const licenseRevenue = ridersWithLicense.length * fees.driving_license_fee;
    const gcRevenue = ridersWithGC.length * fees.good_conduct_fee;
    const inspectionRevenue = motorcyclesWithInspection.length * fees.ntsa_inspection_fee;
    const totalRevenue = licenseRevenue + gcRevenue + inspectionRevenue;
    const totalDocs = ridersWithLicense.length + ridersWithGC.length + motorcyclesWithInspection.length;

    // Inspection expiry buckets
    const inspectionExpired: Motorcycle[] = [];
    const inspectionDueSoon: Motorcycle[] = [];
    const inspectionValid: Motorcycle[] = [];
    for (const m of motorcyclesWithInspection) {
      if (!m.inspection_expiry) { inspectionValid.push(m); continue; }
      const days = Math.ceil((new Date(m.inspection_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days < 0) inspectionExpired.push(m);
      else if (days <= 90) inspectionDueSoon.push(m);
      else inspectionValid.push(m);
    }
    const inspectionCoverage = pct(motorcyclesWithInspection.length, motorcycles.length);

    // Expiry buckets (license)
    const expired: Rider[] = [];
    const dueThisMonth: Rider[] = [];  // 0-30 days
    const dueSoon: Rider[] = [];        // 31-90 days
    const valid: Rider[] = [];          // > 90 days
    const noExpiry: Rider[] = [];

    for (const r of ridersWithLicense) {
      if (!r.license_expiry) { noExpiry.push(r); continue; }
      const days = Math.ceil((new Date(r.license_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days < 0) expired.push(r);
      else if (days <= 30) dueThisMonth.push(r);
      else if (days <= 90) dueSoon.push(r);
      else valid.push(r);
    }

    const licenseCoverage = pct(ridersWithLicense.length, riders.length);
    const gcCoverage = pct(ridersWithGC.length, riders.length);
    const fullCompliance = pct(ridersWithBoth.length, riders.length);

    // 12-month renewal forecast — count of licenses expiring in each of next 12 months
    const now = new Date();
    const forecast: { label: string; count: number; revenue: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const count = ridersWithLicense.filter(r => {
        if (!r.license_expiry) return false;
        const d = new Date(r.license_expiry);
        return d >= start && d < end;
      }).length;
      forecast.push({ label: monthLabel(start), count, revenue: count * fees.driving_license_fee });
    }

    const potentialRenewal = expired.length * fees.driving_license_fee;
    const upcomingRenewal = (dueThisMonth.length + dueSoon.length) * fees.driving_license_fee;

    // Historical: month of good conduct issuance not known; approximate by rider.created_at when doc uploaded (best effort — riders.created_at)
    const twelveMoTrend: { label: string; license: number; goodConduct: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const licenseAdds = ridersWithLicense.filter(r => {
        const d = new Date(r.created_at);
        return d >= start && d < end;
      }).length;
      const gcAdds = ridersWithGC.filter(r => {
        const d = new Date(r.created_at);
        return d >= start && d < end;
      }).length;
      twelveMoTrend.push({
        label: monthLabel(start),
        license: licenseAdds * fees.driving_license_fee,
        goodConduct: gcAdds * fees.good_conduct_fee,
      });
    }

    // Growth: this month vs last based on trend
    const thisMonth = twelveMoTrend[twelveMoTrend.length - 1];
    const prevMonth = twelveMoTrend[twelveMoTrend.length - 2] ?? { license: 0, goodConduct: 0, label: '' };
    const thisMonthTotal = thisMonth.license + thisMonth.goodConduct;
    const prevMonthTotal = prevMonth.license + prevMonth.goodConduct;
    const growth = prevMonthTotal === 0
      ? (thisMonthTotal > 0 ? 100 : 0)
      : Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100);

    // Follow-up list
    const followUp = [...expired, ...dueThisMonth]
      .map(r => ({
        rider: r,
        status: getLicenseExpiryStatus(r.license_expiry)!,
      }))
      .sort((a, b) => a.status.daysUntilExpiry - b.status.daysUntilExpiry);

    return {
      totalRevenue, licenseRevenue, gcRevenue, inspectionRevenue, totalDocs,
      licenseCount: ridersWithLicense.length,
      gcCount: ridersWithGC.length,
      bothCount: ridersWithBoth.length,
      totalRiders: riders.length,
      inspectionCount: motorcyclesWithInspection.length,
      totalMotorcycles: motorcycles.length,
      inspectionCoverage,
      inspectionExpired, inspectionDueSoon, inspectionValid,
      licenseCoverage, gcCoverage, fullCompliance,
      expired, dueThisMonth, dueSoon, valid, noExpiry,
      potentialRenewal, upcomingRenewal,
      forecast, twelveMoTrend,
      thisMonthTotal, prevMonthTotal, growth,
      followUp,
    };
  }, [riders, motorcycles, fees]);

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
          label="3rd Party Revenue"
          value={fmtKESShort(analytics.totalRevenue)}
          hint={`${analytics.totalDocs} documents on file`}
          growth={analytics.growth}
          icon={<Wallet className="h-4 w-4 text-white" />}
          gradient="from-blue-600 to-blue-700"
        />
        <KPI
          label="Driving Licenses"
          value={fmtKESShort(analytics.licenseRevenue)}
          hint={`${analytics.licenseCount} × ${fmtKES(fees.driving_license_fee)}`}
          icon={<FileCheck className="h-4 w-4 text-white" />}
          gradient="from-emerald-600 to-emerald-700"
          progress={analytics.licenseCoverage}
        />
        <KPI
          label="Good Conduct"
          value={fmtKESShort(analytics.gcRevenue)}
          hint={`${analytics.gcCount} × ${fmtKES(fees.good_conduct_fee)}`}
          icon={<ShieldCheck className="h-4 w-4 text-white" />}
          gradient="from-teal-600 to-cyan-700"
          progress={analytics.gcCoverage}
        />
        <KPI
          label="NTSA Inspection"
          value={fmtKESShort(analytics.inspectionRevenue)}
          hint={`${analytics.inspectionCount} × ${fmtKES(fees.ntsa_inspection_fee)}`}
          icon={<Wrench className="h-4 w-4 text-white" />}
          gradient="from-indigo-600 to-indigo-700"
          progress={analytics.inspectionCoverage}
        />
        <KPI
          label="Renewal Pipeline"
          value={fmtKESShort(analytics.potentialRenewal + analytics.upcomingRenewal)}
          hint={`${analytics.expired.length} expired · ${analytics.dueThisMonth.length + analytics.dueSoon.length} due`}
          icon={<CalendarClock className="h-4 w-4 text-white" />}
          gradient="from-amber-500 to-amber-600"
        />
        <KPI
          label="Full Compliance"
          value={`${analytics.fullCompliance}%`}
          hint={`${analytics.bothCount} of ${analytics.totalRiders} riders`}
          icon={<BadgeCheck className="h-4 w-4 text-white" />}
          gradient="from-slate-800 to-slate-900"
          progress={analytics.fullCompliance}
        />
      </div>

      {/* Row 1: Document Coverage + Revenue Mix + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Document Coverage" subtitle="Compliance rate by document type" icon={<FileCheck className="h-4 w-4 text-emerald-600" />}>
          {analytics.totalRiders === 0 ? <Empty label="No riders yet" /> : (
            <div className="space-y-3 mt-1">
              <StatusBar
                label="Driving License"
                count={analytics.licenseCount}
                total={analytics.totalRiders}
                color="#059669"
                suffix={fmtKES(analytics.licenseRevenue)}
              />
              <StatusBar
                label="Good Conduct"
                count={analytics.gcCount}
                total={analytics.totalRiders}
                color="#0891b2"
                suffix={fmtKES(analytics.gcRevenue)}
              />
              <StatusBar
                label="Both Documents"
                count={analytics.bothCount}
                total={analytics.totalRiders}
                color="#2563eb"
                suffix={`${analytics.fullCompliance}% full`}
              />
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Most-held document</span>
                <span className="font-semibold text-slate-900">
                  {analytics.licenseCount >= analytics.gcCount ? 'Driving License' : 'Good Conduct'}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Revenue Mix" subtitle="Where 3rd-party revenue comes from" icon={<Award className="h-4 w-4 text-emerald-600" />}>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-100">
              <div className="flex items-center gap-1.5 text-emerald-700 mb-1">
                <FileCheck className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">Licenses</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.licenseRevenue)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{pct(analytics.licenseRevenue, Math.max(analytics.totalRevenue, 1))}% of total</p>
            </div>
            <div className="border rounded-lg p-3 bg-teal-50 border-teal-100">
              <div className="flex items-center gap-1.5 text-teal-700 mb-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">Good Conduct</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.gcRevenue)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{pct(analytics.gcRevenue, Math.max(analytics.totalRevenue, 1))}% of total</p>
            </div>
            <div className="border rounded-lg p-3 bg-indigo-50 border-indigo-100">
              <div className="flex items-center gap-1.5 text-indigo-700 mb-1">
                <Wrench className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">NTSA Inspection</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.inspectionRevenue)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{pct(analytics.inspectionRevenue, Math.max(analytics.totalRevenue, 1))}% of total</p>
            </div>
            <div className="border rounded-lg p-3 bg-amber-50 border-amber-100">
              <div className="flex items-center gap-1.5 text-amber-700 mb-1">
                <CalendarClock className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-wider font-semibold">Expired</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{fmtKESShort(analytics.potentialRenewal)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{analytics.expired.length} renewals due</p>
            </div>
          </div>
        </Card>

        <Card title="Compliance Trend" subtitle="Last 12 months (KES)" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
          <TwoLineBarChart data={analytics.twelveMoTrend.map(m => ({ label: m.label, a: m.license, b: m.goodConduct }))} />
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
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Licenses</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> Good Conduct</span>
          </div>
        </Card>
      </div>

      {/* Row 2: Expiry Health + Renewal Forecast + Follow-up */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Expiry Health" subtitle="License validity distribution" icon={<BadgeCheck className="h-4 w-4 text-emerald-600" />}>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <MiniStat label="Expired" value={analytics.expired.length} tone="red" />
            <MiniStat label="≤ 30 days" value={analytics.dueThisMonth.length} tone="amber" />
            <MiniStat label="Valid" value={analytics.valid.length + analytics.dueSoon.length} tone="emerald" />
            <MiniStat label="No expiry set" value={analytics.noExpiry.length} tone="blue" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">License compliance</span>
              <span className="font-semibold text-slate-800">{analytics.licenseCoverage}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full transition-all duration-700" style={{ width: `${analytics.licenseCoverage}%` }} />
            </div>
          </div>
        </Card>

        <Card title="Renewal Forecast" subtitle="Licenses expiring in next 12 months" icon={<CalendarClock className="h-4 w-4 text-amber-600" />}>
          <ForecastChart data={analytics.forecast} />
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Projected 12-mo renewal revenue</span>
            <span className="font-semibold text-slate-900">
              {fmtKESShort(analytics.forecast.reduce((s, m) => s + m.revenue, 0))}
            </span>
          </div>
        </Card>

        <Card title="Follow-up Queue" subtitle="Riders needing renewal outreach" icon={<AlertCircle className="h-4 w-4 text-red-600" />}>
          {analytics.followUp.length === 0 ? (
            <Empty label="No urgent renewals" />
          ) : (
            <div className="mt-1 space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {analytics.followUp.slice(0, 12).map(({ rider, status }) => (
                <div
                  key={rider.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                    status.isExpired
                      ? 'bg-red-50 border-red-100'
                      : 'bg-amber-50 border-amber-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      status.isExpired ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {(rider.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{rider.name}</p>
                      {rider.phone_number && (
                        <p className="text-[10px] text-slate-500 truncate">{rider.phone_number}</p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              ))}
              {analytics.followUp.length > 12 && (
                <p className="text-[10px] text-slate-500 text-center pt-1">
                  +{analytics.followUp.length - 12} more riders
                </p>
              )}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Recovery opportunity</span>
            <span className="font-semibold text-emerald-700">{fmtKESShort(analytics.potentialRenewal)}</span>
          </div>
        </Card>
      </div>

      {/* Row 3: Roster snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Rider Roster" subtitle="Registered vs documented" icon={<Users className="h-4 w-4 text-blue-600" />}>
          <div className="mt-1 space-y-3">
            <StatusBar
              label="With driving license"
              count={analytics.licenseCount}
              total={analytics.totalRiders}
              color="#059669"
            />
            <StatusBar
              label="With good conduct"
              count={analytics.gcCount}
              total={analytics.totalRiders}
              color="#0891b2"
            />
            <StatusBar
              label="Missing both"
              count={analytics.totalRiders - analytics.licenseCount - analytics.gcCount + analytics.bothCount}
              total={analytics.totalRiders}
              color="#94a3b8"
            />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Average fee per rider</span>
            <span className="font-semibold text-slate-800">
              {analytics.totalRiders > 0 ? fmtKES(analytics.totalRevenue / analytics.totalRiders) : fmtKES(0)}
            </span>
          </div>
        </Card>

        <Card title="Fee Schedule" subtitle="Compliance document pricing" icon={<Wallet className="h-4 w-4 text-emerald-600" />}>
          <div className="mt-1 space-y-2">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-800">Driving License</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">{fmtKES(fees.driving_license_fee)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium text-slate-800">Good Conduct Certificate</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">{fmtKES(fees.good_conduct_fee)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium text-slate-800">NTSA Inspection Certificate</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">{fmtKES(fees.ntsa_inspection_fee)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Adjust these amounts in Admin Settings &rarr; General
          </div>
        </Card>

        <Card title="This Month" subtitle="New compliance documents" icon={<Clock className="h-4 w-4 text-blue-600" />}>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-100 text-emerald-800">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Licenses</p>
              <p className="text-base font-bold mt-1">{fmtKESShort(analytics.twelveMoTrend[analytics.twelveMoTrend.length - 1]?.license || 0)}</p>
            </div>
            <div className="border rounded-lg p-3 bg-teal-50 border-teal-100 text-teal-800">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Good Conduct</p>
              <p className="text-base font-bold mt-1">{fmtKESShort(analytics.twelveMoTrend[analytics.twelveMoTrend.length - 1]?.goodConduct || 0)}</p>
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

// ── Shared subcomponents (mirroring RevenueInsights) ─────────────────────────
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

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const bg = tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100'
    : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : tone === 'red' ? 'bg-red-50 text-red-700 border-red-100'
    : 'bg-amber-50 text-amber-700 border-amber-100';
  return (
    <div className={`border rounded-lg p-2.5 text-center ${bg}`}>
      <p className="text-sm font-bold truncate">{value.toLocaleString()}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">{label}</p>
    </div>
  );
}

function TwoLineBarChart({ data }: { data: { label: string; a: number; b: number }[] }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b)));
  return (
    <div className="mt-1">
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => {
          const ha = Math.max(2, Math.round((d.a / max) * 100));
          const hb = Math.max(2, Math.round((d.b / max) * 100));
          return (
            <div key={i} className="flex-1 flex items-end justify-center gap-[2px]">
              <div className="w-1/2 bg-emerald-500/80 rounded-t transition-all duration-500" style={{ height: `${ha}%` }} title={`${d.label}: ${fmtKES(d.a)}`} />
              <div className="w-1/2 bg-teal-500/80 rounded-t transition-all duration-500" style={{ height: `${hb}%` }} title={`${d.label}: ${fmtKES(d.b)}`} />
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

function ForecastChart({ data }: { data: { label: string; count: number; revenue: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="mt-1">
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.count / max) * 100));
          return (
            <div key={i} className="flex-1 flex items-end justify-center">
              <div
                className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t transition-all duration-500"
                style={{ height: `${h}%` }}
                title={`${d.label}: ${d.count} renewals · ${fmtKES(d.revenue)}`}
              />
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
