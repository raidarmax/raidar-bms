import { useEffect, useMemo, useState } from 'react';
import {
  Users, ShieldCheck, Activity, TrendingUp, ArrowUp, ArrowDown,
  CheckCircle2, Lock, Award, Building2, AlertTriangle, UserCheck,
  Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(d: Date) { return d.toLocaleString('en-KE', { month: 'short' }); }

const RANK_LABELS: Record<string, string> = {
  constable: 'Constable',
  corporal: 'Corporal',
  sergeant: 'Sergeant',
  senior_sergeant: 'Senior Sergeant',
  inspector: 'Inspector',
  chief_inspector: 'Chief Inspector',
  superintendent: 'Superintendent',
  senior_superintendent: 'Senior Superintendent',
  commissioner: 'Commissioner',
};
const RANK_ORDER = [
  'constable', 'corporal', 'sergeant', 'senior_sergeant', 'inspector',
  'chief_inspector', 'superintendent', 'senior_superintendent', 'commissioner',
];

export default function PoliceOfficersInsights() {
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [counties, setCounties] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [verifs, setVerifs] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [officersRes, stationsRes, countiesRes, finesRes, verifsRes, actRes] = await Promise.all([
        supabase.from('police_officers').select('id, service_number, full_name, rank, station_id, is_active, is_station_admin, id_verified, must_change_password, last_login_at, failed_login_attempts, locked_until, created_at'),
        supabase.from('police_stations').select('id, station_name, county_id, is_active'),
        supabase.from('kenya_counties').select('id, county_name'),
        supabase.from('fines').select('id, issued_by_officer_id, issued_at, status'),
        supabase.from('police_verification_logs').select('id, officer_id, verification_result, created_at'),
        supabase.from('police_activity_logs').select('id, officer_id, action_type, created_at'),
      ]);
      if (cancelled) return;
      setOfficers(officersRes.data || []);
      setStations(stationsRes.data || []);
      setCounties(countiesRes.data || []);
      setFines(finesRes.data || []);
      setVerifs(verifsRes.data || []);
      setActivity(actRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const a = useMemo(() => {
    const total = officers.length;
    const active = officers.filter(o => o.is_active).length;
    const verified = officers.filter(o => o.id_verified).length;
    const stationAdmins = officers.filter(o => o.is_station_admin).length;
    const now = Date.now();
    const locked = officers.filter(o => o.locked_until && new Date(o.locked_until).getTime() > now).length;
    const mustChangePw = officers.filter(o => o.must_change_password).length;

    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const activeThisWeek = officers.filter(o => o.last_login_at && (now - new Date(o.last_login_at).getTime()) < oneWeek).length;
    const activeThisMonth = officers.filter(o => o.last_login_at && (now - new Date(o.last_login_at).getTime()) < oneMonth).length;
    const neverLoggedIn = officers.filter(o => !o.last_login_at).length;

    // Growth
    const nowD = new Date();
    const thisKey = monthKey(nowD);
    const prevKey = monthKey(new Date(nowD.getFullYear(), nowD.getMonth() - 1, 1));
    const newThis = officers.filter(o => monthKey(new Date(o.created_at)) === thisKey).length;
    const newPrev = officers.filter(o => monthKey(new Date(o.created_at)) === prevKey).length;
    const growth = newPrev === 0 ? (newThis > 0 ? 100 : 0) : Math.round(((newThis - newPrev) / newPrev) * 100);

    // Rank distribution
    const rankCounts: Record<string, number> = {};
    officers.forEach(o => { rankCounts[o.rank] = (rankCounts[o.rank] || 0) + 1; });
    const rankBreakdown = RANK_ORDER
      .filter(r => rankCounts[r])
      .map(r => ({ label: RANK_LABELS[r], value: rankCounts[r] }));

    // Officers per station (workload)
    const officersByStation: Record<string, number> = {};
    officers.forEach(o => { if (o.station_id) officersByStation[o.station_id] = (officersByStation[o.station_id] || 0) + 1; });
    const stationName = new Map(stations.map(s => [s.id, s.station_name]));
    const stationCounty = new Map(stations.map(s => [s.id, s.county_id]));
    const countyName = new Map(counties.map((c: any) => [c.id, c.county_name]));
    const topStations = Object.entries(officersByStation)
      .map(([id, n]) => ({ label: stationName.get(id) || 'Unknown', value: n }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 6);

    // Officers per county
    const officersByCounty: Record<number, number> = {};
    officers.forEach(o => {
      const c = stationCounty.get(o.station_id);
      if (c) officersByCounty[c] = (officersByCounty[c] || 0) + 1;
    });
    const topCounties = Object.entries(officersByCounty)
      .map(([id, n]) => ({ label: countyName.get(Number(id)) as string || `County #${id}`, value: n }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 6);

    // Performance: fines issued and verifications performed
    const finesByOfficer: Record<string, number> = {};
    fines.forEach(f => { if (f.issued_by_officer_id) finesByOfficer[f.issued_by_officer_id] = (finesByOfficer[f.issued_by_officer_id] || 0) + 1; });
    const verifsByOfficer: Record<string, number> = {};
    verifs.forEach(v => { if (v.officer_id) verifsByOfficer[v.officer_id] = (verifsByOfficer[v.officer_id] || 0) + 1; });

    const performers = officers.map(o => ({
      officer: o,
      fines: finesByOfficer[o.id] || 0,
      verifs: verifsByOfficer[o.id] || 0,
      total: (finesByOfficer[o.id] || 0) + (verifsByOfficer[o.id] || 0),
      station: stationName.get(o.station_id) || '—',
    }));
    const topPerformers = [...performers].sort((x, y) => y.total - x.total).slice(0, 6);

    // Activity totals & growth
    const totalFines = fines.length;
    const finesThis = fines.filter(f => monthKey(new Date(f.issued_at)) === thisKey).length;
    const finesPrev = fines.filter(f => monthKey(new Date(f.issued_at)) === prevKey).length;
    const finesGrowth = finesPrev === 0 ? (finesThis > 0 ? 100 : 0) : Math.round(((finesThis - finesPrev) / finesPrev) * 100);

    const totalVerifs = verifs.length;
    const verifsOk = verifs.filter(v => v.verification_result === 'verified').length;

    // 12-month activity volume (logins + verifications + fines)
    const monthly: { label: string; count: number }[] = [];
    const idx = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
      monthly.push({ label: monthLabel(d), count: 0 });
      idx.set(monthKey(d), 11 - i);
    }
    activity.forEach(x => { const i = idx.get(monthKey(new Date(x.created_at))); if (i !== undefined) monthly[i].count++; });

    // Action breakdown
    const actionCounts: Record<string, number> = {};
    activity.forEach(x => { actionCounts[x.action_type] = (actionCounts[x.action_type] || 0) + 1; });
    const topActions = Object.entries(actionCounts)
      .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 6);

    return {
      total, active, verified, stationAdmins, locked, mustChangePw,
      activeThisWeek, activeThisMonth, neverLoggedIn,
      newThis, newPrev, growth,
      rankBreakdown, topStations, topCounties, topPerformers,
      totalFines, finesThis, finesPrev, finesGrowth,
      totalVerifs, verifsOk,
      monthly, topActions,
    };
  }, [officers, stations, counties, fines, verifs, activity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPI label="Total Officers" value={a.total.toLocaleString()} hint={`${a.newThis} onboarded this month`} growth={a.growth} icon={<Users className="h-4 w-4 text-white" />} gradient="from-blue-600 to-blue-700" />
        <KPI label="Active" value={`${pct(a.active, a.total)}%`} hint={`${a.active} of ${a.total}`} icon={<CheckCircle2 className="h-4 w-4 text-white" />} gradient="from-emerald-600 to-emerald-700" progress={pct(a.active, a.total)} />
        <KPI label="ID Verified" value={`${pct(a.verified, a.total)}%`} hint={`${a.verified} passed IPRS`} icon={<ShieldCheck className="h-4 w-4 text-white" />} gradient="from-teal-600 to-cyan-700" progress={pct(a.verified, a.total)} />
        <KPI label="Station Admins" value={a.stationAdmins.toLocaleString()} hint={`${pct(a.stationAdmins, a.total)}% of officers`} icon={<Award className="h-4 w-4 text-white" />} gradient="from-amber-500 to-amber-600" />
        <KPI label="Fines Issued" value={a.totalFines.toLocaleString()} hint={`${a.finesThis} this month`} growth={a.finesGrowth} icon={<Activity className="h-4 w-4 text-white" />} gradient="from-slate-800 to-slate-900" />
        <KPI label="Active Weekly" value={`${pct(a.activeThisWeek, a.total)}%`} hint={`${a.activeThisWeek} logged in < 7d`} icon={<UserCheck className="h-4 w-4 text-white" />} gradient="from-red-600 to-red-700" progress={pct(a.activeThisWeek, a.total)} />
      </div>

      {/* Row: Rank distribution + Account health + Activity chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Rank Distribution" subtitle="Chain of command breakdown" icon={<Award className="h-4 w-4 text-blue-600" />}>
          {a.rankBreakdown.length === 0 ? <Empty label="No officers yet" /> : (
            <BarList data={a.rankBreakdown} color="#2563eb" />
          )}
        </Card>

        <Card title="Account Health" subtitle="Security & readiness signals" icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <MiniStat label="Active" value={a.active} total={a.total} tone="emerald" />
            <MiniStat label="Verified" value={a.verified} total={a.total} tone="blue" />
            <MiniStat label="Locked" value={a.locked} total={a.total} tone="red" />
            <MiniStat label="Password reset due" value={a.mustChangePw} total={a.total} tone="amber" />
          </div>
          <div className="mt-4 space-y-3">
            <VerifyRow label="Logged in this week" done={a.activeThisWeek} total={a.total} color="#059669" />
            <VerifyRow label="Logged in this month" done={a.activeThisMonth} total={a.total} color="#2563eb" />
            <VerifyRow label="Never logged in" done={a.neverLoggedIn} total={a.total} color="#dc2626" />
          </div>
        </Card>

        <Card title="Activity Trend" subtitle="Actions logged, last 12 months" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
          <MiniBarChart data={a.monthly} />
          <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{a.finesThis}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Fines this mo.</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{a.totalVerifs}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Verifications</p>
            </div>
            <div>
              <p className={`text-lg font-bold inline-flex items-center gap-0.5 ${a.finesGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {a.finesGrowth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(a.finesGrowth)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Growth</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row: Top performers + Officers per station + Officers per county */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top Performers" subtitle="Fines + verifications combined" icon={<Activity className="h-4 w-4 text-amber-600" />}>
          {a.topPerformers.length === 0 || a.topPerformers[0].total === 0 ? (
            <Empty label="No enforcement activity yet" />
          ) : (
            <div className="space-y-3 mt-1">
              {a.topPerformers.map(row => (
                <div key={row.officer.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="min-w-0">
                      <p className="text-slate-800 font-medium truncate">{row.officer.full_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {RANK_LABELS[row.officer.rank] || row.officer.rank} · {row.station}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-slate-700 font-semibold tabular-nums">{row.total}</p>
                      <p className="text-[10px] text-slate-500">{row.fines}F · {row.verifs}V</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct(row.total, a.topPerformers[0].total)}%`, background: '#f59e0b' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Officers per Station" subtitle="Where staffing is concentrated" icon={<Building2 className="h-4 w-4 text-blue-600" />}>
          {a.topStations.length === 0 ? <Empty label="No stations with officers" /> : (
            <BarList data={a.topStations} color="#0ea5e9" />
          )}
        </Card>

        <Card title="Officers by County" subtitle="Distribution across Kenya" icon={<Building2 className="h-4 w-4 text-emerald-600" />}>
          {a.topCounties.length === 0 ? <Empty label="No officer locations" /> : (
            <BarList data={a.topCounties} color="#059669" />
          )}
        </Card>
      </div>

      {/* Row: Action types + Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Action Types" subtitle="What officers are doing in the app" icon={<Activity className="h-4 w-4 text-blue-600" />}>
          {a.topActions.length === 0 ? <Empty label="No activity logged" /> : (
            <BarList data={a.topActions} color="#2563eb" />
          )}
        </Card>

        <Card title="Watchlist" subtitle="Accounts that may need attention" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <Lock className="h-4 w-4 text-red-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-700">{a.locked}</p>
              <p className="text-[10px] uppercase tracking-wider text-red-700/80">Locked</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
              <Clock className="h-4 w-4 text-amber-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-amber-700">{a.mustChangePw}</p>
              <p className="text-[10px] uppercase tracking-wider text-amber-700/80">PW reset</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
              <UserCheck className="h-4 w-4 text-slate-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-slate-800">{a.neverLoggedIn}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-600">Never logged in</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
              <ShieldCheck className="h-4 w-4 text-blue-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-blue-700">{a.total - a.verified}</p>
              <p className="text-[10px] uppercase tracking-wider text-blue-700/80">Unverified</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Officers listed here should be prioritized for onboarding follow-up or account review.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────
function KPI({ label, value, hint, growth, gradient, icon, progress }: {
  label: string; value: string; hint?: string; growth?: number; gradient: string; icon: JSX.Element; progress?: number;
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

function VerifyRow({ label, done, total, color }: { label: string; done: number; total: number; color: string }) {
  const p = pct(done, total);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="text-slate-500 tabular-nums">{done}/{total} · {p}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function BarList({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="space-y-2 mt-1">
      {data.map(c => {
        const p = pct(c.value, max);
        return (
          <div key={c.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3">
            <span className="text-xs font-medium text-slate-700 truncate capitalize">{c.label}</span>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
            </div>
            <span className="text-xs font-semibold text-slate-800 tabular-nums w-8 text-right">{c.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const p = pct(value, total);
  const bg = tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100'
    : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100'
    : 'bg-red-50 text-red-700 border-red-100';
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
              <div className="w-full bg-blue-500/80 hover:bg-blue-600 rounded-t transition-all duration-500" style={{ height: `${h}%` }} title={`${d.label}: ${d.count}`} />
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
