import { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, CheckCircle2, Clock, AlertTriangle, TrendingUp, MapPin, Building2,
  Users, ArrowUp, ArrowDown, Award, Ban, FileText, ShieldAlert,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type FineRow = {
  fine_amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  county_id: number | null;
  station_id: string | null;
  offence_id: string | null;
  issued_by_officer_id: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: '#059669' },
  issued: { label: 'Issued', color: '#2563eb' },
  overdue: { label: 'Overdue', color: '#dc2626' },
  disputed: { label: 'Disputed', color: '#d97706' },
  cancelled: { label: 'Cancelled', color: '#94a3b8' },
};

const CATEGORY_LABELS: Record<string, string> = {
  traffic: 'Traffic',
  documentation: 'Documentation',
  safety: 'Safety',
  public_order: 'Public Order',
};

const CATEGORY_COLORS: Record<string, string> = {
  traffic: '#2563eb',
  documentation: '#d97706',
  safety: '#dc2626',
  public_order: '#0d9488',
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(d: Date) { return d.toLocaleString('en-KE', { month: 'short' }); }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function fmtKES(n: number) { return `KES ${Math.round(n).toLocaleString()}`; }

export default function FinesInsights() {
  const [loading, setLoading] = useState(true);
  const [fines, setFines] = useState<FineRow[]>([]);
  const [offences, setOffences] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [counties, setCounties] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [finesRes, offRes, stRes, ofRes, ctyRes] = await Promise.all([
        supabase.from('fines').select('fine_amount, status, issued_at, paid_at, county_id, station_id, offence_id, issued_by_officer_id'),
        supabase.from('traffic_offences').select('id, offence_name, category, fine_amount, is_active'),
        supabase.from('police_stations').select('id, station_name'),
        supabase.from('police_officers').select('id, full_name, rank'),
        supabase.from('kenya_counties').select('id, county_name'),
      ]);
      if (cancelled) return;
      setFines((finesRes.data || []) as any);
      setOffences(offRes.data || []);
      setStations(stRes.data || []);
      setOfficers(ofRes.data || []);
      setCounties(ctyRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const analytics = useMemo(() => {
    const total = fines.length;
    const statusCounts: Record<string, number> = { paid: 0, issued: 0, overdue: 0, disputed: 0, cancelled: 0 };
    const statusAmounts: Record<string, number> = { paid: 0, issued: 0, overdue: 0, disputed: 0, cancelled: 0 };
    let totalValue = 0;

    fines.forEach(f => {
      const s = f.status || 'issued';
      if (s in statusCounts) {
        statusCounts[s]++;
        statusAmounts[s] += Number(f.fine_amount || 0);
      }
      totalValue += Number(f.fine_amount || 0);
    });

    const collected = statusAmounts.paid;
    const outstanding = statusAmounts.issued + statusAmounts.overdue;
    const collectionRate = pct(statusCounts.paid, total);

    // Growth
    const now = new Date();
    const thisKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let issuedThis = 0, issuedPrev = 0, collectedThis = 0, collectedPrev = 0;

    // 12-month buckets
    const monthly: { label: string; key: string; issued: number; collected: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({ label: monthLabel(d), key: monthKey(d), issued: 0, collected: 0, count: 0 });
    }
    const mIdx = new Map(monthly.map((b, i) => [b.key, i]));

    fines.forEach(f => {
      const issKey = monthKey(new Date(f.issued_at));
      if (issKey === thisKey) issuedThis++;
      if (issKey === prevKey) issuedPrev++;
      const iIdx = mIdx.get(issKey);
      if (iIdx !== undefined) {
        monthly[iIdx].issued += Number(f.fine_amount || 0);
        monthly[iIdx].count++;
      }
      if (f.status === 'paid' && f.paid_at) {
        const paidKey = monthKey(new Date(f.paid_at));
        if (paidKey === thisKey) collectedThis += Number(f.fine_amount || 0);
        if (paidKey === prevKey) collectedPrev += Number(f.fine_amount || 0);
        const cIdx = mIdx.get(paidKey);
        if (cIdx !== undefined) monthly[cIdx].collected += Number(f.fine_amount || 0);
      }
    });

    const growth = issuedPrev === 0 ? (issuedThis > 0 ? 100 : 0) : Math.round(((issuedThis - issuedPrev) / issuedPrev) * 100);

    // Categories
    const offenceMap = new Map<string, any>();
    offences.forEach(o => offenceMap.set(o.id, o));
    const categoryCounts: Record<string, { count: number; amount: number }> = {};
    fines.forEach(f => {
      if (!f.offence_id) return;
      const o = offenceMap.get(f.offence_id);
      const cat = o?.category || 'other';
      if (!categoryCounts[cat]) categoryCounts[cat] = { count: 0, amount: 0 };
      categoryCounts[cat].count++;
      categoryCounts[cat].amount += Number(f.fine_amount || 0);
    });
    const categories = Object.entries(categoryCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, v]) => ({ key, label: CATEGORY_LABELS[key] || key, count: v.count, amount: v.amount, color: CATEGORY_COLORS[key] || '#64748b' }));

    // Station load
    const stationName = new Map<string, string>();
    stations.forEach(s => stationName.set(s.id, s.station_name));
    const stationLoad = new Map<string, { count: number; amount: number; collected: number }>();
    fines.forEach(f => {
      if (!f.station_id) return;
      const cur = stationLoad.get(f.station_id) || { count: 0, amount: 0, collected: 0 };
      cur.count++;
      cur.amount += Number(f.fine_amount || 0);
      if (f.status === 'paid') cur.collected += Number(f.fine_amount || 0);
      stationLoad.set(f.station_id, cur);
    });
    const topStations = Array.from(stationLoad.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([id, v]) => ({ label: stationName.get(id) || `Station ${id.slice(0, 6)}`, count: v.count, amount: v.amount, collected: v.collected }));

    // Officer top performers
    const officerName = new Map<string, string>();
    officers.forEach(o => officerName.set(o.id, o.full_name));
    const officerLoad = new Map<string, number>();
    fines.forEach(f => {
      if (!f.issued_by_officer_id) return;
      officerLoad.set(f.issued_by_officer_id, (officerLoad.get(f.issued_by_officer_id) || 0) + 1);
    });
    const topOfficers = Array.from(officerLoad.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ label: officerName.get(id) || `Officer ${id.slice(0, 6)}`, value: count }));

    // Counties
    const countyName = new Map<number, string>();
    counties.forEach((c: any) => countyName.set(c.id, c.county_name));
    const countyCounts: Record<string, number> = {};
    fines.forEach(f => {
      if (!f.county_id) return;
      const n = countyName.get(f.county_id) || `County #${f.county_id}`;
      countyCounts[n] = (countyCounts[n] || 0) + 1;
    });
    const topCounties = Object.entries(countyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));

    // Active offences
    const activeOffences = offences.filter(o => o.is_active).length;

    return {
      total, statusCounts, statusAmounts, totalValue, collected, outstanding, collectionRate,
      issuedThis, issuedPrev, growth, collectedThis, collectedPrev,
      monthly, categories, topStations, topOfficers, topCounties,
      activeOffences, totalOffences: offences.length,
    };
  }, [fines, offences, stations, officers, counties]);

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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KPI
          label="Total Fines"
          value={analytics.total.toLocaleString()}
          hint={`${analytics.issuedThis} this month`}
          growth={analytics.growth}
          icon={<FileText className="h-4 w-4 text-white" />}
          gradient="from-blue-600 to-blue-700"
        />
        <KPI
          label="Collected"
          value={fmtKES(analytics.collected)}
          hint={`${analytics.statusCounts.paid} paid`}
          icon={<CheckCircle2 className="h-4 w-4 text-white" />}
          gradient="from-emerald-600 to-emerald-700"
          progress={analytics.collectionRate}
        />
        <KPI
          label="Outstanding"
          value={fmtKES(analytics.outstanding)}
          hint={`${analytics.statusCounts.issued + analytics.statusCounts.overdue} awaiting`}
          icon={<Clock className="h-4 w-4 text-white" />}
          gradient="from-amber-500 to-amber-600"
        />
        <KPI
          label="Overdue"
          value={analytics.statusCounts.overdue.toLocaleString()}
          hint={fmtKES(analytics.statusAmounts.overdue)}
          icon={<AlertTriangle className="h-4 w-4 text-white" />}
          gradient="from-red-600 to-red-700"
          progress={pct(analytics.statusCounts.overdue, analytics.total)}
        />
        <KPI
          label="Collection Rate"
          value={`${analytics.collectionRate}%`}
          hint={`${analytics.activeOffences}/${analytics.totalOffences} active offences`}
          icon={<TrendingUp className="h-4 w-4 text-white" />}
          gradient="from-teal-600 to-cyan-700"
          progress={analytics.collectionRate}
        />
      </div>

      {/* Row 1: Status + Categories + Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Fine Status" subtitle="Distribution of issued fines" icon={<Award className="h-4 w-4 text-emerald-600" />}>
          {analytics.total === 0 ? <Empty label="No fines yet" /> : (
            <div className="space-y-3 mt-1">
              {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                <StatusBar
                  key={k}
                  label={cfg.label}
                  count={analytics.statusCounts[k]}
                  total={analytics.total}
                  color={cfg.color}
                  suffix={fmtKES(analytics.statusAmounts[k])}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Offence Categories" subtitle="Breakdown by category" icon={<ShieldAlert className="h-4 w-4 text-emerald-600" />}>
          {analytics.categories.length === 0 ? <Empty label="No fines yet" /> : (
            <div className="space-y-3 mt-1">
              {analytics.categories.map(c => (
                <StatusBar
                  key={c.key}
                  label={c.label}
                  count={c.count}
                  total={analytics.total}
                  color={c.color}
                  suffix={fmtKES(c.amount)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Issued vs Collected" subtitle="Last 12 months (KES)" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
          <TwoLineBarChart data={analytics.monthly.map(m => ({ label: m.label, a: m.issued, b: m.collected }))} />
          <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{fmtKES(analytics.collectedThis)}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Collected M2M</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{analytics.issuedThis}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Issued this mo</p>
            </div>
            <div>
              <p className={`text-lg font-bold inline-flex items-center gap-0.5 ${analytics.growth >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                {analytics.growth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(analytics.growth)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Growth</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500 justify-center">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Issued</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Collected</span>
          </div>
        </Card>
      </div>

      {/* Row 2: Stations + Officers + Counties */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top Stations by Enforcement" subtitle="Fines issued per station" icon={<Building2 className="h-4 w-4 text-blue-600" />}>
          {analytics.topStations.length === 0 ? <Empty label="No station data" /> : (
            <div className="space-y-2 mt-1">
              {analytics.topStations.map(s => {
                const p = pct(s.count, Math.max(...analytics.topStations.map(x => x.count), 1));
                return (
                  <div key={s.label} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 truncate" title={s.label}>{s.label}</span>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-700" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums w-8 text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Top Officers" subtitle="Most active enforcers" icon={<Users className="h-4 w-4 text-blue-600" />}>
          {analytics.topOfficers.length === 0 ? <Empty label="No officer data" /> : (
            <div className="space-y-2 mt-1">
              {analytics.topOfficers.map(o => {
                const p = pct(o.value, Math.max(...analytics.topOfficers.map(x => x.value), 1));
                return (
                  <div key={o.label} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 truncate">{o.label}</span>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full transition-all duration-700" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums w-8 text-right">{o.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Top Counties" subtitle="Where fines are concentrated" icon={<MapPin className="h-4 w-4 text-emerald-600" />}>
          {analytics.topCounties.length === 0 ? <Empty label="No locality data" /> : (
            <div className="space-y-2 mt-1">
              {analytics.topCounties.map(c => {
                const p = pct(c.value, Math.max(...analytics.topCounties.map(x => x.value), 1));
                return (
                  <div key={c.label} className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 truncate">{c.label}</span>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums w-8 text-right">{c.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Recovery snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Recovery Snapshot" subtitle="Value flow of fines" icon={<DollarSign className="h-4 w-4 text-emerald-600" />}>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <MiniStat label="Total Value" value={analytics.totalValue} isCurrency tone="blue" />
            <MiniStat label="Collected" value={analytics.collected} isCurrency tone="emerald" />
            <MiniStat label="At Risk" value={analytics.statusAmounts.overdue} isCurrency tone="amber" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-start gap-2">
            <Ban className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
            <p>
              {analytics.statusCounts.disputed > 0
                ? `${analytics.statusCounts.disputed} disputed fine(s) need admin review.`
                : 'No disputes pending review.'}
            </p>
          </div>
        </Card>

        <Card title="This vs Last Month" subtitle="Fines momentum" icon={<TrendingUp className="h-4 w-4 text-blue-600" />}>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="border rounded-lg p-3 bg-blue-50 border-blue-100 text-blue-800">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Issued</p>
              <p className="text-xl font-bold mt-1">{analytics.issuedThis}</p>
              <p className="text-[10px] mt-0.5 opacity-70">vs {analytics.issuedPrev} prev</p>
            </div>
            <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-100 text-emerald-800">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Collected</p>
              <p className="text-xl font-bold mt-1">{fmtKES(analytics.collectedThis)}</p>
              <p className="text-[10px] mt-0.5 opacity-70">vs {fmtKES(analytics.collectedPrev)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Collection follows fine issuance by ~14 days on average.
          </div>
        </Card>

        <Card title="Enforcement Coverage" subtitle="Where the system reaches" icon={<Building2 className="h-4 w-4 text-blue-600" />}>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <MiniStat label="Stations" value={analytics.topStations.length} total={Math.max(stations.length, 1)} tone="blue" />
            <MiniStat label="Officers" value={analytics.topOfficers.length} total={Math.max(officers.length, 1)} tone="emerald" />
            <MiniStat label="Counties" value={analytics.topCounties.length} total={Math.max(counties.length, 1)} tone="amber" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Wider coverage indicates a healthier enforcement footprint.
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

function MiniStat({ label, value, total, tone, isCurrency }: { label: string; value: number; total?: number; tone: 'blue' | 'emerald' | 'amber'; isCurrency?: boolean }) {
  const p = total !== undefined ? pct(value, total) : null;
  const bg = tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100'
    : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : 'bg-amber-50 text-amber-700 border-amber-100';
  const display = isCurrency ? fmtKES(value) : value.toLocaleString();
  return (
    <div className={`border rounded-lg p-2.5 text-center ${bg}`}>
      <p className="text-sm font-bold truncate" title={display}>{display}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">{label}</p>
      {p !== null && <p className="text-[10px] mt-0.5 opacity-70">{p}%</p>}
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
              <div className="w-1/2 bg-blue-500/80 rounded-t transition-all duration-500" style={{ height: `${ha}%` }} title={`${d.label} issued: ${fmtKES(d.a)}`} />
              <div className="w-1/2 bg-emerald-500/80 rounded-t transition-all duration-500" style={{ height: `${hb}%` }} title={`${d.label} collected: ${fmtKES(d.b)}`} />
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
