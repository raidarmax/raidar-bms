import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Users, ShieldAlert, MapPin, Activity, TrendingUp,
  ArrowUp, ArrowDown, CheckCircle2, AlertCircle,
  Radio, FileWarning, Map as MapIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadGoogleMaps, createCircleIcon } from '../lib/googleMaps';

// Kenya county centroids (approximate)
const COUNTY_CENTROIDS: Record<number, [number, number]> = {
  1: [-4.0435, 39.6682], 2: [-4.1734, 39.4602], 3: [-3.5107, 39.9093], 4: [-1.5236, 40.1234],
  5: [-2.2696, 40.9006], 6: [-3.3966, 38.5595], 7: [-0.4569, 39.6583], 8: [1.7488, 40.0629],
  9: [3.9186, 41.8560], 10: [2.3300, 37.9927], 11: [0.3549, 37.5822], 12: [0.0463, 37.6559],
  13: [-0.2966, 37.7239], 14: [-0.5310, 37.4577], 15: [-1.3667, 38.0106], 16: [-1.5177, 37.2634],
  17: [-1.8000, 37.6197], 18: [-0.3667, 36.3667], 19: [-0.4167, 36.9500], 20: [-0.5000, 37.2833],
  21: [-0.7833, 37.0400], 22: [-1.0331, 36.6889], 23: [3.1167, 35.6000], 24: [1.4000, 35.1119],
  25: [1.2153, 36.9541], 26: [1.0567, 34.9506], 27: [0.5143, 35.2698], 28: [0.5167, 35.5500],
  29: [0.1836, 35.1269], 30: [0.4919, 35.7458], 31: [0.4046, 36.7834], 32: [-0.3031, 36.0800],
  33: [-1.0793, 35.8709], 34: [-1.8500, 36.7833], 35: [-0.3689, 35.2831], 36: [-0.7833, 35.3417],
  37: [0.2827, 34.7519], 38: [0.0666, 34.7213], 39: [0.5636, 34.5606], 40: [0.4608, 34.1115],
  41: [0.0607, 34.2882], 42: [-0.0917, 34.7680], 43: [-0.5273, 34.4571], 44: [-1.0637, 34.4731],
  45: [-0.6817, 34.7714], 46: [-0.5633, 34.9358], 47: [-1.2921, 36.8219],
};

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(d: Date) { return d.toLocaleString('en-KE', { month: 'short' }); }

type Station = {
  id: string; station_name: string; station_code: string; station_type: 'station' | 'post';
  county_id: number; constituency_id: number | null; ward_id: number | null;
  phone_number: string | null; email: string | null; physical_address: string | null;
  gps_lat: number | null; gps_lng: number | null; is_active: boolean; created_at: string;
};

export default function PoliceStationsInsights() {
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState<Station[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [counties, setCounties] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stationsRes, officersRes, finesRes, incidentsRes, verifRes, countiesRes] = await Promise.all([
        supabase.from('police_stations').select('id, station_name, station_code, station_type, county_id, constituency_id, ward_id, phone_number, email, physical_address, gps_lat, gps_lng, is_active, created_at'),
        supabase.from('police_officers').select('id, station_id, is_active, is_station_admin, id_verified'),
        supabase.from('fines').select('id, station_id, status, fine_amount, issued_at'),
        supabase.from('incidents').select('id, assigned_station_id, police_status, created_at'),
        supabase.from('police_verification_logs').select('id, station_id, verification_result, created_at'),
        supabase.from('kenya_counties').select('id, county_name'),
      ]);
      if (cancelled) return;
      setStations((stationsRes.data as Station[]) || []);
      setOfficers(officersRes.data || []);
      setFines(finesRes.data || []);
      setIncidents(incidentsRes.data || []);
      setVerifications(verifRes.data || []);
      setCounties(countiesRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const a = useMemo(() => {
    const totalStations = stations.length;
    const activeStations = stations.filter(s => s.is_active).length;
    const fullStations = stations.filter(s => s.station_type === 'station').length;
    const posts = stations.filter(s => s.station_type === 'post').length;
    const withGps = stations.filter(s => s.gps_lat != null && s.gps_lng != null).length;
    const withContact = stations.filter(s => s.phone_number || s.email).length;

    const totalOfficers = officers.length;
    const activeOfficers = officers.filter(o => o.is_active).length;
    const officersByStation: Record<string, number> = {};
    officers.forEach(o => { if (o.station_id) officersByStation[o.station_id] = (officersByStation[o.station_id] || 0) + 1; });

    // Cases handled = fines + incidents assigned/handled by station
    const finesByStation: Record<string, number> = {};
    fines.forEach(f => { if (f.station_id) finesByStation[f.station_id] = (finesByStation[f.station_id] || 0) + 1; });
    const incidentsByStation: Record<string, number> = {};
    incidents.forEach(i => { if (i.assigned_station_id) incidentsByStation[i.assigned_station_id] = (incidentsByStation[i.assigned_station_id] || 0) + 1; });
    const verifsByStation: Record<string, number> = {};
    verifications.forEach(v => { if (v.station_id) verifsByStation[v.station_id] = (verifsByStation[v.station_id] || 0) + 1; });

    const casesByStation: Record<string, number> = {};
    stations.forEach(s => {
      casesByStation[s.id] = (finesByStation[s.id] || 0) + (incidentsByStation[s.id] || 0);
    });
    const totalCases = Object.values(casesByStation).reduce((s, v) => s + v, 0);
    const totalFines = fines.length;
    const totalIncidents = incidents.length;
    const totalVerifs = verifications.length;

    // Coverage: how many of the 47 counties have >=1 station
    const countyStations: Record<number, number> = {};
    stations.forEach(s => { if (s.county_id) countyStations[s.county_id] = (countyStations[s.county_id] || 0) + 1; });
    const countiesCovered = Object.keys(countyStations).length;
    const totalCounties = counties.length || 47;

    // Growth
    const now = new Date();
    const thisKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const newThis = stations.filter(s => monthKey(new Date(s.created_at)) === thisKey).length;
    const newPrev = stations.filter(s => monthKey(new Date(s.created_at)) === prevKey).length;
    const growth = newPrev === 0 ? (newThis > 0 ? 100 : 0) : Math.round(((newThis - newPrev) / newPrev) * 100);

    // Fines growth
    const finesThis = fines.filter(f => monthKey(new Date(f.issued_at)) === thisKey).length;
    const finesPrev = fines.filter(f => monthKey(new Date(f.issued_at)) === prevKey).length;
    const finesGrowth = finesPrev === 0 ? (finesThis > 0 ? 100 : 0) : Math.round(((finesThis - finesPrev) / finesPrev) * 100);

    // Case status breakdown
    const paidFines = fines.filter(f => f.status === 'paid').length;
    const overdueFines = fines.filter(f => f.status === 'overdue').length;
    const issuedFines = fines.filter(f => f.status === 'issued').length;
    const openIncidents = incidents.filter(i => ['unassigned', 'assigned', 'investigating'].includes(i.police_status || 'unassigned')).length;
    const resolvedIncidents = incidents.filter(i => ['resolved', 'closed'].includes(i.police_status || '')).length;

    // Top busiest stations
    const countyName = new Map<number, string>();
    counties.forEach((c: any) => countyName.set(c.id, c.county_name));
    const stationRows = stations.map(s => ({
      station: s,
      countyName: countyName.get(s.county_id) || `County #${s.county_id}`,
      officers: officersByStation[s.id] || 0,
      fines: finesByStation[s.id] || 0,
      incidents: incidentsByStation[s.id] || 0,
      verifications: verifsByStation[s.id] || 0,
      total: casesByStation[s.id] || 0,
    }));
    const busiest = [...stationRows].sort((x, y) => y.total - x.total).slice(0, 6);

    // Top counties by station count
    const topCounties = Object.entries(countyStations)
      .map(([id, count]) => ({ label: countyName.get(Number(id)) || `County #${id}`, value: count }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 8);

    // Officers per station distribution
    const stationsWithOfficers = stations.filter(s => (officersByStation[s.id] || 0) > 0).length;
    const stationsNoOfficers = totalStations - stationsWithOfficers;
    const avgOfficersPerStation = totalStations > 0 ? Math.round((totalOfficers / totalStations) * 10) / 10 : 0;
    const casesPerStation = totalStations > 0 ? Math.round((totalCases / totalStations) * 10) / 10 : 0;

    // 12-month case volume
    const monthly: { label: string; count: number }[] = [];
    const idx = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({ label: monthLabel(d), count: 0 });
      idx.set(monthKey(d), 11 - i);
    }
    fines.forEach(f => { const i = idx.get(monthKey(new Date(f.issued_at))); if (i !== undefined) monthly[i].count++; });
    incidents.forEach(x => { const i = idx.get(monthKey(new Date(x.created_at))); if (i !== undefined) monthly[i].count++; });

    // Map points — use station GPS when present, else jitter around county centroid.
    const perCountyCount: Record<number, number> = {};
    const mapPoints = stations.map(s => {
      let lat = s.gps_lat != null ? Number(s.gps_lat) : null;
      let lng = s.gps_lng != null ? Number(s.gps_lng) : null;
      let synthetic = false;
      if ((lat == null || lng == null) && s.county_id && COUNTY_CENTROIDS[s.county_id]) {
        const [clat, clng] = COUNTY_CENTROIDS[s.county_id];
        const n = perCountyCount[s.county_id] || 0;
        perCountyCount[s.county_id] = n + 1;
        // Deterministic jitter so stations in same county don't overlap.
        const angle = (n * 137.5) * (Math.PI / 180);
        const radius = 0.05 + n * 0.015;
        lat = clat + Math.sin(angle) * radius;
        lng = clng + Math.cos(angle) * radius;
        synthetic = true;
      }
      if (lat == null || lng == null) return null;
      return {
        s, lat, lng, synthetic,
        cases: casesByStation[s.id] || 0,
        officers: officersByStation[s.id] || 0,
      };
    }).filter(Boolean) as Array<{ s: Station; lat: number; lng: number; synthetic: boolean; cases: number; officers: number }>;

    return {
      totalStations, activeStations, fullStations, posts, withGps, withContact,
      totalOfficers, activeOfficers, avgOfficersPerStation,
      totalCases, totalFines, totalIncidents, totalVerifs, casesPerStation,
      countiesCovered, totalCounties,
      paidFines, overdueFines, issuedFines, openIncidents, resolvedIncidents,
      busiest, topCounties, monthly,
      stationsWithOfficers, stationsNoOfficers,
      newThis, newPrev, growth, finesThis, finesPrev, finesGrowth,
      mapPoints,
    };
  }, [stations, officers, fines, incidents, verifications, counties]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const maxCases = Math.max(1, ...a.mapPoints.map(p => p.cases));

  return (
    <div className="space-y-5">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPI label="Stations" value={a.totalStations.toLocaleString()} hint={`${a.newThis} new this month`} growth={a.growth} icon={<Building2 className="h-4 w-4 text-white" />} gradient="from-blue-600 to-blue-700" />
        <KPI label="Active" value={`${pct(a.activeStations, a.totalStations)}%`} hint={`${a.activeStations} of ${a.totalStations}`} icon={<CheckCircle2 className="h-4 w-4 text-white" />} gradient="from-emerald-600 to-emerald-700" progress={pct(a.activeStations, a.totalStations)} />
        <KPI label="Officers" value={a.totalOfficers.toLocaleString()} hint={`${a.avgOfficersPerStation} avg per station`} icon={<Users className="h-4 w-4 text-white" />} gradient="from-teal-600 to-cyan-700" />
        <KPI label="Cases Handled" value={a.totalCases.toLocaleString()} hint={`${a.totalFines} fines · ${a.totalIncidents} incidents`} growth={a.finesGrowth} icon={<ShieldAlert className="h-4 w-4 text-white" />} gradient="from-amber-500 to-amber-600" />
        <KPI label="County Coverage" value={`${pct(a.countiesCovered, a.totalCounties)}%`} hint={`${a.countiesCovered} of ${a.totalCounties} counties`} icon={<MapPin className="h-4 w-4 text-white" />} gradient="from-slate-800 to-slate-900" progress={pct(a.countiesCovered, a.totalCounties)} />
        <KPI label="Verifications" value={a.totalVerifs.toLocaleString()} hint="Documents checked at stations" icon={<CheckCircle2 className="h-4 w-4 text-white" />} gradient="from-red-600 to-red-700" />
      </div>

      {/* MAP */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Nationwide Coverage</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Marker size = cases handled · click a station for details
              {a.withGps < a.totalStations && (
                <span className="text-amber-600">
                  {' '}· {a.totalStations - a.withGps} station(s) placed at county centroid (no GPS on record)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <LegendDot color="#059669" label="Active" />
            <LegendDot color="#94a3b8" label="Inactive" />
            <LegendDot color="#dc2626" label="High load" />
          </div>
        </div>
        <div className="h-[420px] w-full">
          {a.mapPoints.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">No station locations available</div>
          ) : (
            <PoliceStationsMap mapPoints={a.mapPoints} maxCases={maxCases} />
          )}
        </div>
      </div>

      {/* Row: Station types, Case status, Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Station Composition" subtitle="Stations, posts, and readiness" icon={<Building2 className="h-4 w-4 text-blue-600" />}>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <MiniStat label="Full Stations" value={a.fullStations} total={a.totalStations} tone="blue" />
            <MiniStat label="Police Posts" value={a.posts} total={a.totalStations} tone="amber" />
          </div>
          <div className="mt-4 space-y-3">
            <VerifyRow label="Currently active" done={a.activeStations} total={a.totalStations} color="#059669" />
            <VerifyRow label="Has phone or email" done={a.withContact} total={a.totalStations} color="#2563eb" />
            <VerifyRow label="GPS coordinates captured" done={a.withGps} total={a.totalStations} color="#f59e0b" />
            <VerifyRow label="With officers assigned" done={a.stationsWithOfficers} total={a.totalStations} color="#0ea5e9" />
          </div>
          {a.stationsNoOfficers > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              {a.stationsNoOfficers} station(s) have no officers registered.
            </div>
          )}
        </Card>

        <Card title="Case Status" subtitle="Enforcement across all stations" icon={<ShieldAlert className="h-4 w-4 text-red-600" />}>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <MiniStat label="Paid" value={a.paidFines} total={Math.max(a.totalFines, 1)} tone="emerald" />
            <MiniStat label="Issued" value={a.issuedFines} total={Math.max(a.totalFines, 1)} tone="blue" />
            <MiniStat label="Overdue" value={a.overdueFines} total={Math.max(a.totalFines, 1)} tone="red" />
          </div>
          <div className="mt-4 space-y-3">
            <VerifyRow label="Fines paid" done={a.paidFines} total={Math.max(a.totalFines, 1)} color="#059669" />
            <VerifyRow label="Open incidents" done={a.openIncidents} total={Math.max(a.totalIncidents, 1)} color="#f59e0b" />
            <VerifyRow label="Resolved incidents" done={a.resolvedIncidents} total={Math.max(a.totalIncidents, 1)} color="#2563eb" />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Avg cases per station</span>
            <span className="font-semibold text-slate-900">{a.casesPerStation}</span>
          </div>
        </Card>

        <Card title="Case Volume" subtitle="Last 12 months (fines + incidents)" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
          <MiniBarChart data={a.monthly} />
          <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{a.finesThis + a.newThis}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">This month</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{a.finesPrev}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Last month</p>
            </div>
            <div>
              <p className={`text-lg font-bold inline-flex items-center gap-0.5 ${a.finesGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {a.finesGrowth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(a.finesGrowth)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Fines growth</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row: Busiest stations + Top counties + Officers coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Busiest Stations" subtitle="Ranked by total cases handled" icon={<Activity className="h-4 w-4 text-amber-600" />}>
          {a.busiest.length === 0 || a.busiest[0].total === 0 ? (
            <Empty label="No case activity yet" />
          ) : (
            <div className="space-y-3 mt-1">
              {a.busiest.map(row => (
                <div key={row.station.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="min-w-0">
                      <p className="text-slate-800 font-medium truncate">{row.station.station_name}</p>
                      <p className="text-[10px] text-slate-500">{row.countyName} · {row.officers} officer(s)</p>
                    </div>
                    <span className="text-slate-700 font-semibold tabular-nums shrink-0">{row.total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct(row.total, a.busiest[0].total)}%`, background: '#f59e0b' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Coverage by County" subtitle="Where stations are concentrated" icon={<MapPin className="h-4 w-4 text-blue-600" />}>
          {a.topCounties.length === 0 ? <Empty label="No station data" /> : (
            <BarList data={a.topCounties} color="#2563eb" />
          )}
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Counties without a station</span>
            <span className="font-semibold text-slate-900">{Math.max(0, a.totalCounties - a.countiesCovered)}</span>
          </div>
        </Card>

        <Card title="Recent Verifications" subtitle="Documents checked at stations" icon={<Radio className="h-4 w-4 text-emerald-600" />}>
          <div className="text-center py-3">
            <p className="text-4xl font-bold text-slate-900">{a.totalVerifs}</p>
            <p className="text-xs text-slate-500 mt-1">Total verifications on file</p>
          </div>
          <div className="mt-2 space-y-3">
            <VerifyRow
              label="Verified successfully"
              done={verifications.filter(v => v.verification_result === 'verified').length}
              total={Math.max(a.totalVerifs, 1)}
              color="#059669"
            />
            <VerifyRow
              label="Failed / rejected"
              done={verifications.filter(v => v.verification_result === 'failed').length}
              total={Math.max(a.totalVerifs, 1)}
              color="#dc2626"
            />
          </div>
          {a.totalVerifs === 0 && (
            <div className="mt-3 text-xs text-slate-500 flex items-start gap-2">
              <FileWarning className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              No document verifications logged yet. Encourage officers to log every check.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Subcomponents (self-contained) ─────────────────────────────────────────
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
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
          <div key={c.label} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-3">
            <span className="text-xs font-medium text-slate-700 truncate">{c.label}</span>
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

type StationMapPoint = {
  s: { id: string; station_name: string; station_code: string; station_type: string; is_active: boolean; phone_number: string | null };
  lat: number;
  lng: number;
  synthetic: boolean;
  cases: number;
  officers: number;
};

function PoliceStationsMap({ mapPoints, maxCases }: { mapPoints: StationMapPoint[]; maxCases: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!containerRef.current || mapPoints.length === 0) return;
    let cancelled = false;
    const objects: any[] = [];

    loadGoogleMaps().then((google) => {
      if (cancelled || !containerRef.current) return;

      const bounds = new google.maps.LatLngBounds();
      mapPoints.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));

      const map = new google.maps.Map(containerRef.current, {
        center: { lat: 0.5, lng: 37.5 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      mapPoints.forEach(p => {
        const intensity = p.cases / maxCases;
        const color = !p.s.is_active ? '#94a3b8'
          : intensity > 0.6 ? '#dc2626'
          : intensity > 0.25 ? '#f59e0b'
          : '#059669';
        const radius = 8 + intensity * 16;
        const icon = createCircleIcon(google, radius, color, p.synthetic ? 0.5 : 0.75);

        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map, icon,
          title: p.s.station_name,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-size:12px;min-width:180px">
            <strong style="font-size:13px">${p.s.station_name}</strong><br/>
            <span style="color:#64748b;font-family:monospace">${p.s.station_code}</span>
            <div style="margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:2px">
              <span>Type: ${p.s.station_type}</span>
              <span>Status: ${p.s.is_active ? 'Active' : 'Inactive'}</span>
              <span>Cases: ${p.cases}</span>
              <span>Officers: ${p.officers}</span>
            </div>
            ${p.s.phone_number ? `<div style="margin-top:4px">${p.s.phone_number}</div>` : ''}
            ${p.synthetic ? '<div style="margin-top:4px;color:#d97706;font-size:10px">GPS approximated from county</div>' : ''}
          </div>`,
        });

        marker.addListener('click', () => infoWindow.open(map, marker));
        objects.push(marker, infoWindow);
      });

      map.fitBounds(bounds, 40);
    }).catch((e) => {
      if (!cancelled) setError(e.message);
    });

    return () => {
      cancelled = true;
      objects.forEach(o => { o.setMap?.(null); o.close?.(); });
    };
  }, [mapPoints, maxCases]);

  if (error) {
    return <div className="h-full flex items-center justify-center text-red-500 text-sm">Map error: {error}</div>;
  }

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}