import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ShieldCheck, TrendingUp, MapPin, CheckCircle2,
  Clock, ArrowUp, ArrowDown, Award, Building2, XCircle, ListChecks,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Incident = {
  id: string;
  incident_type: string;
  status: string;
  police_status: string | null;
  assigned_station_id: string | null;
  county_id: number | null;
  created_at: string;
  incident_date: string;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#dc2626',
  resolved: '#059669',
  ignored: '#94a3b8',
};

const CATEGORY_LABELS: Record<string, string> = {
  accident: 'Accident',
  theft: 'Theft',
  crime: 'Crime',
  traffic_violation: 'Traffic Violation',
  speeding: 'Speeding',
  no_helmet: 'No Helmet',
  overloading: 'Overloading',
  reckless_driving: 'Reckless Driving',
  harassment: 'Harassment',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  accident: '#dc2626',
  theft: '#ea580c',
  crime: '#0891b2',
  traffic_violation: '#d97706',
  speeding: '#2563eb',
  no_helmet: '#ca8a04',
  overloading: '#0d9488',
  reckless_driving: '#e11d48',
  harassment: '#db2777',
  other: '#64748b',
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(d: Date) { return d.toLocaleString('en-KE', { month: 'short' }); }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

export default function IncidentsInsights() {
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [counties, setCounties] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [incRes, stRes, ctyRes] = await Promise.all([
        supabase.from('incidents').select('id, incident_type, status, police_status, assigned_station_id, county_id, created_at, incident_date, updated_at'),
        supabase.from('police_stations').select('id, station_name, county_id'),
        supabase.from('kenya_counties').select('id, county_name'),
      ]);
      if (cancelled) return;
      setIncidents((incRes.data || []) as any);
      setStations(stRes.data || []);
      setCounties(ctyRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const analytics = useMemo(() => {
    const total = incidents.length;
    const statusCounts = { pending: 0, confirmed: 0, resolved: 0, ignored: 0 } as Record<string, number>;
    const categoryCounts: Record<string, number> = {};
    const policeStatus = { unassigned: 0, assigned: 0, investigating: 0, resolved: 0, closed: 0 } as Record<string, number>;
    const now = new Date();
    const thisKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let newThis = 0;
    let newPrev = 0;

    // 12-month buckets
    const monthly: { label: string; key: string; total: number; resolved: number; pending: number; confirmed: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({ label: monthLabel(d), key: monthKey(d), total: 0, resolved: 0, pending: 0, confirmed: 0 });
    }
    const mIdx = new Map(monthly.map((b, i) => [b.key, i]));

    // Time to resolve (avg hours)
    let resolveSum = 0;
    let resolveN = 0;

    incidents.forEach(inc => {
      if (inc.status in statusCounts) statusCounts[inc.status]++;
      categoryCounts[inc.incident_type] = (categoryCounts[inc.incident_type] || 0) + 1;
      const ps = inc.police_status || 'unassigned';
      if (ps in policeStatus) policeStatus[ps]++;
      const ck = monthKey(new Date(inc.created_at));
      if (ck === thisKey) newThis++;
      if (ck === prevKey) newPrev++;
      const i = mIdx.get(ck);
      if (i !== undefined) {
        monthly[i].total++;
        if (inc.status === 'resolved') monthly[i].resolved++;
        else if (inc.status === 'pending') monthly[i].pending++;
        else if (inc.status === 'confirmed') monthly[i].confirmed++;
      }
      if (inc.status === 'resolved' && inc.updated_at && inc.created_at) {
        const hrs = (new Date(inc.updated_at).getTime() - new Date(inc.created_at).getTime()) / 36e5;
        if (hrs >= 0) { resolveSum += hrs; resolveN++; }
      }
    });

    const growth = newPrev === 0 ? (newThis > 0 ? 100 : 0) : Math.round(((newThis - newPrev) / newPrev) * 100);
    const resolutionRate = pct(statusCounts.resolved, total);
    const avgResolveHrs = resolveN > 0 ? Math.round(resolveSum / resolveN) : 0;

    // Top categories
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, count]) => ({ key, label: CATEGORY_LABELS[key] || key, count, color: CATEGORY_COLORS[key] || '#64748b' }));

    // Station load
    const stationName = new Map<string, string>();
    stations.forEach(s => stationName.set(s.id, s.station_name));
    const stationLoad = new Map<string, number>();
    const assignedCount = incidents.filter(i => i.assigned_station_id).length;
    incidents.forEach(inc => {
      if (!inc.assigned_station_id) return;
      stationLoad.set(inc.assigned_station_id, (stationLoad.get(inc.assigned_station_id) || 0) + 1);
    });
    const busiest = Array.from(stationLoad.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ label: stationName.get(id) || `Station ${id.slice(0, 6)}`, value: count }));

    // County breakdown
    const countyName = new Map<number, string>();
    counties.forEach((c: any) => countyName.set(c.id, c.county_name));
    const countyCounts: Record<string, number> = {};
    incidents.forEach(inc => {
      if (!inc.county_id) return;
      const n = countyName.get(inc.county_id) || `County #${inc.county_id}`;
      countyCounts[n] = (countyCounts[n] || 0) + 1;
    });
    const topCounties = Object.entries(countyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));

    return {
      total, statusCounts, categoryCounts, policeStatus,
      newThis, newPrev, growth, resolutionRate, avgResolveHrs,
      monthly, topCategories, busiest, topCounties, assignedCount,
    };
  }, [incidents, stations, counties]);

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
          label="Total Incidents"
          value={analytics.total.toLocaleString()}
          hint={`${analytics.newThis} this month`}
          growth={analytics.growth}
          icon={<AlertTriangle className="h-4 w-4 text-white" />}
          gradient="from-red-600 to-red-700"
        />
        <KPI
          label="Resolution Rate"
          value={`${analytics.resolutionRate}%`}
          hint={`${analytics.statusCounts.resolved} resolved`}
          icon={<CheckCircle2 className="h-4 w-4 text-white" />}
          gradient="from-emerald-600 to-emerald-700"
          progress={analytics.resolutionRate}
        />
        <KPI
          label="Pending Review"
          value={analytics.statusCounts.pending.toLocaleString()}
          hint={`${pct(analytics.statusCounts.pending, analytics.total)}% of total`}
          icon={<Clock className="h-4 w-4 text-white" />}
          gradient="from-amber-500 to-amber-600"
          progress={pct(analytics.statusCounts.pending, analytics.total)}
        />
        <KPI
          label="Confirmed"
          value={analytics.statusCounts.confirmed.toLocaleString()}
          hint={`${pct(analytics.statusCounts.confirmed, analytics.total)}% of total`}
          icon={<ShieldCheck className="h-4 w-4 text-white" />}
          gradient="from-slate-800 to-slate-900"
          progress={pct(analytics.statusCounts.confirmed, analytics.total)}
        />
        <KPI
          label="Avg Resolve Time"
          value={analytics.avgResolveHrs > 48 ? `${Math.round(analytics.avgResolveHrs / 24)}d` : `${analytics.avgResolveHrs}h`}
          hint={analytics.avgResolveHrs > 0 ? `Across ${analytics.statusCounts.resolved} cases` : 'No data yet'}
          icon={<TrendingUp className="h-4 w-4 text-white" />}
          gradient="from-teal-600 to-cyan-700"
        />
      </div>

      {/* Row 1: Status distribution + Incident types + Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Status Distribution" subtitle="Case lifecycle overview" icon={<Award className="h-4 w-4 text-emerald-600" />}>
          {analytics.total === 0 ? <Empty label="No incidents yet" /> : (
            <div className="space-y-3 mt-1">
              <StatusBar label="Pending" count={analytics.statusCounts.pending} total={analytics.total} color={STATUS_COLORS.pending} />
              <StatusBar label="Confirmed" count={analytics.statusCounts.confirmed} total={analytics.total} color={STATUS_COLORS.confirmed} />
              <StatusBar label="Resolved" count={analytics.statusCounts.resolved} total={analytics.total} color={STATUS_COLORS.resolved} />
              <StatusBar label="Dismissed" count={analytics.statusCounts.ignored} total={analytics.total} color={STATUS_COLORS.ignored} />
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Overall resolution</span>
                <span className="font-semibold text-slate-900">{analytics.resolutionRate}%</span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Top Incident Types" subtitle="Most reported categories" icon={<ListChecks className="h-4 w-4 text-emerald-600" />}>
          {analytics.topCategories.length === 0 ? <Empty label="No incidents yet" /> : (
            <div className="space-y-3 mt-1">
              {analytics.topCategories.map(c => (
                <StatusBar key={c.key} label={c.label} count={c.count} total={analytics.total} color={c.color} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Incident Growth" subtitle="Last 12 months" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
          <MiniBarChart data={analytics.monthly.map(m => ({ label: m.label, count: m.total }))} />
          <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{analytics.newThis}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">This month</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{analytics.newPrev}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Last month</p>
            </div>
            <div>
              <p className={`text-lg font-bold inline-flex items-center gap-0.5 ${analytics.growth >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {analytics.growth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(analytics.growth)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Growth</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Police routing + Busiest stations + Counties */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Police Routing" subtitle="Assignment to enforcement" icon={<ShieldCheck className="h-4 w-4 text-blue-600" />}>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <MiniStat label="Assigned" value={analytics.assignedCount} total={Math.max(analytics.total, 1)} tone="blue" />
            <MiniStat label="Investigating" value={analytics.policeStatus.investigating} total={Math.max(analytics.assignedCount, 1)} tone="amber" />
            <MiniStat label="Closed" value={analytics.policeStatus.closed + analytics.policeStatus.resolved} total={Math.max(analytics.assignedCount, 1)} tone="emerald" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-start gap-2">
            <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
            <p>
              {analytics.policeStatus.unassigned > 0
                ? `${analytics.policeStatus.unassigned} incident(s) awaiting station assignment.`
                : 'All incidents have been routed to a police station.'}
            </p>
          </div>
        </Card>

        <Card title="Busiest Stations" subtitle="Where cases pile up" icon={<Building2 className="h-4 w-4 text-blue-600" />}>
          {analytics.busiest.length === 0 ? <Empty label="No assignments yet" /> : (
            <div className="space-y-2 mt-1">
              {analytics.busiest.map(s => {
                const p = pct(s.value, Math.max(...analytics.busiest.map(x => x.value), 1));
                return (
                  <div key={s.label} className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 truncate">{s.label}</span>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all duration-700" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums w-8 text-right">{s.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Top Counties" subtitle="Where incidents concentrate" icon={<MapPin className="h-4 w-4 text-emerald-600" />}>
          {analytics.topCounties.length === 0 ? <Empty label="No locality data" /> : (
            <div className="space-y-2 mt-1">
              {analytics.topCounties.map(c => {
                const p = pct(c.value, Math.max(...analytics.topCounties.map(x => x.value), 1));
                return (
                  <div key={c.label} className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 truncate">{c.label}</span>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-700" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums w-8 text-right">{c.value}</span>
                  </div>
                );
              })}
            </div>
          )}
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
      <p className="text-lg lg:text-xl font-bold leading-tight mt-0.5">{value}</p>
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

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const p = pct(count, total);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="text-slate-500 tabular-nums">{count} · {p}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'blue' | 'emerald' | 'amber' }) {
  const p = pct(value, total);
  const bg = tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100'
    : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : 'bg-amber-50 text-amber-700 border-amber-100';
  return (
    <div className={`border rounded-lg p-2.5 text-center ${bg}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-[10px] mt-0.5 opacity-70">{p}%</p>
    </div>
  );
}

function MiniBarChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="mt-1">
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.count / max) * 100));
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              <div className="w-full bg-red-500/80 hover:bg-red-600 rounded-t transition-all duration-500" style={{ height: `${h}%` }} title={`${d.label}: ${d.count}`} />
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
