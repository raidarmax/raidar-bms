import { useEffect, useMemo, useState } from 'react';
import {
  Bike, ShieldCheck, FileCheck, TrendingUp, MapPin, CheckCircle2,
  FileText, ArrowUp, ArrowDown, Camera, Landmark, Radio, Signal,
  Award, AlertTriangle, Wrench, UserCheck, Calendar, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(d: Date) { return d.toLocaleString('en-KE', { month: 'short' }); }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

export default function MotorcyclesInsights() {
  const [loading, setLoading] = useState(true);
  const [motorcycles, setMotorcycles] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [counties, setCounties] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [motoRes, ownersRes, ridersRes, devicesRes, countiesRes, incidentsRes, finesRes] = await Promise.all([
        supabase.from('motorcycles').select('id, owner_id, county_id, created_at, registration_number, make, model, bike_photo_url, logbook_url, kra_pin_url, insurance_policy_number, insurance_cover_url, tracking_device_id, status, is_compliant'),
        supabase.from('owners').select('id, county_id'),
        supabase.from('riders').select('id, motorcycle_id, assignment_status'),
        supabase.from('tracking_devices').select('id, device_id, vehicle_id, status, last_heartbeat, last_connection'),
        supabase.from('kenya_counties').select('id, county_name'),
        supabase.from('incidents').select('id, motorcycle_id'),
        supabase.from('fines').select('id, motorcycle_id, status'),
      ]);
      if (cancelled) return;
      if (motoRes.error) setError(motoRes.error.message);
      setMotorcycles(motoRes.data || []);
      setOwners(ownersRes.data || []);
      setRiders(ridersRes.data || []);
      setDevices(devicesRes.data || []);
      setCounties(countiesRes.data || []);
      setIncidents(incidentsRes.data || []);
      setFines(finesRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const analytics = useMemo(() => {
    const total = motorcycles.length;

    // Verification & compliance
    const verified = motorcycles.filter(m => m.status === 'verified').length;
    const compliant = motorcycles.filter(m => m.is_compliant).length;

    // Assignment (via riders.motorcycle_id)
    const assignedIds = new Set(riders.filter(r => r.motorcycle_id).map(r => r.motorcycle_id));
    const assigned = motorcycles.filter(m => assignedIds.has(m.id)).length;

    // Tracking — motorcycles.tracking_device_id is a text code (e.g. "TRK-1234"),
    // and tracking_devices exposes both a text device_id and a vehicle_id FK.
    const withDevice = motorcycles.filter(m => m.tracking_device_id).length;
    const deviceByCode = new Map<string, any>();
    const deviceByVehicle = new Map<string, any>();
    devices.forEach(d => {
      if (d.device_id) deviceByCode.set(String(d.device_id), d);
      if (d.vehicle_id) deviceByVehicle.set(String(d.vehicle_id), d);
    });
    const now = Date.now();
    const isOnline = (d: any) => {
      if (!d) return false;
      if (d.status === 'online') return true;
      const stamp = d.last_heartbeat || d.last_connection;
      return !!(stamp && now - new Date(stamp).getTime() < 5 * 60 * 1000);
    };
    const online = motorcycles.filter(m => {
      const d = (m.tracking_device_id && deviceByCode.get(String(m.tracking_device_id))) || deviceByVehicle.get(m.id);
      return isOnline(d);
    }).length;

    // Insurance — the DB only stores policy number and cover doc for now.
    const insured = motorcycles.filter(m => m.insurance_policy_number).length;
    const withInsuranceDoc = motorcycles.filter(m => m.insurance_cover_url).length;
    const insuredAndDoc = motorcycles.filter(m => m.insurance_policy_number && m.insurance_cover_url).length;
    const missingInsuranceDoc = motorcycles.filter(m => m.insurance_policy_number && !m.insurance_cover_url).length;
    const noInsurance = total - insured;

    // Growth
    const nowDate = new Date();
    const thisKey = monthKey(nowDate);
    const prevKey = monthKey(new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1));
    const newThis = motorcycles.filter(m => monthKey(new Date(m.created_at)) === thisKey).length;
    const newPrev = motorcycles.filter(m => monthKey(new Date(m.created_at)) === prevKey).length;
    const growth = newPrev === 0 ? (newThis > 0 ? 100 : 0) : Math.round(((newThis - newPrev) / newPrev) * 100);

    const monthly: { label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      monthly.push({ label: monthLabel(d), count: 0 });
    }
    const idx = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      idx.set(monthKey(d), 11 - i);
    }
    motorcycles.forEach(m => { const i = idx.get(monthKey(new Date(m.created_at))); if (i !== undefined) monthly[i].count++; });

    // Makes and models
    const makeCounts: Record<string, number> = {};
    motorcycles.forEach(m => { if (m.make) makeCounts[m.make] = (makeCounts[m.make] || 0) + 1; });
    const topMakes = Object.entries(makeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
    const unknownMake = motorcycles.filter(m => !m.make).length;

    const modelCounts: Record<string, number> = {};
    motorcycles.forEach(m => {
      if (m.make && m.model) {
        const k = `${m.make} ${m.model}`;
        modelCounts[k] = (modelCounts[k] || 0) + 1;
      }
    });
    const topModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));

    // Insurance providers — not stored in DB currently
    const topProviders: { label: string; value: number }[] = [];

    // Documents
    const documents = [
      { key: 'bike_photo_url', label: 'Bike Photos', icon: <Camera className="h-4 w-4" />, count: motorcycles.filter(m => m.bike_photo_url).length, color: '#2563eb' },
      { key: 'logbook_url', label: 'Logbooks', icon: <FileText className="h-4 w-4" />, count: motorcycles.filter(m => m.logbook_url).length, color: '#059669' },
      { key: 'kra_pin_url', label: 'KRA PIN Certificates', icon: <Landmark className="h-4 w-4" />, count: motorcycles.filter(m => m.kra_pin_url).length, color: '#f59e0b' },
      { key: 'insurance_cover_url', label: 'Insurance Covers', icon: <ShieldCheck className="h-4 w-4" />, count: motorcycles.filter(m => m.insurance_cover_url).length, color: '#dc2626' },
    ];

    // Top counties — motorcycles.county_id can be null, so fall back to owner's county.
    const countyName = new Map<number, string>();
    counties.forEach((c: any) => countyName.set(c.id, c.county_name));
    const ownerCounty = new Map<string, number | null>();
    owners.forEach(o => ownerCounty.set(o.id, o.county_id ?? null));
    const countyCounts: Record<string, number> = {};
    let unknownCounty = 0;
    motorcycles.forEach(m => {
      const cid = m.county_id ?? (m.owner_id ? ownerCounty.get(m.owner_id) : null);
      if (!cid) { unknownCounty++; return; }
      const n = countyName.get(cid) || `County #${cid}`;
      countyCounts[n] = (countyCounts[n] || 0) + 1;
    });
    const topCounties = Object.entries(countyCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    // Incident & fine hotspots
    const incidentByMoto: Record<string, number> = {};
    incidents.forEach(i => { if (i.motorcycle_id) incidentByMoto[i.motorcycle_id] = (incidentByMoto[i.motorcycle_id] || 0) + 1; });
    const motoWithIncidents = Object.keys(incidentByMoto).length;
    const fineByMoto: Record<string, number> = {};
    fines.forEach(f => { if (f.motorcycle_id) fineByMoto[f.motorcycle_id] = (fineByMoto[f.motorcycle_id] || 0) + 1; });
    const motoWithFines = Object.keys(fineByMoto).length;

    // Registration age buckets
    const ageBuckets = { newer: 0, mid: 0, older: 0 };
    motorcycles.forEach(m => {
      const days = (now - new Date(m.created_at).getTime()) / (24 * 60 * 60 * 1000);
      if (days <= 30) ageBuckets.newer++;
      else if (days <= 180) ageBuckets.mid++;
      else ageBuckets.older++;
    });

    // Ownership: motorcycles per owner
    const perOwner: Record<string, number> = {};
    motorcycles.forEach(m => { if (m.owner_id) perOwner[m.owner_id] = (perOwner[m.owner_id] || 0) + 1; });
    const ownersWithBike = Object.keys(perOwner).length;
    const multiBikeOwners = Object.values(perOwner).filter(n => n > 1).length;

    return {
      total, verified, compliant, assigned, withDevice, online,
      insured, withInsuranceDoc, insuredAndDoc, missingInsuranceDoc, noInsurance,
      newThis, newPrev, growth, monthly,
      topMakes, unknownMake, topModels, topProviders,
      documents, topCounties, unknownCounty,
      motoWithIncidents, motoWithFines,
      ageBuckets, ownersWithBike, multiBikeOwners,
    };
  }, [motorcycles, owners, riders, devices, counties, incidents, fines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const a = analytics;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Some motorcycle data could not be loaded.</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPI
          label="Total Bikes"
          value={a.total.toLocaleString()}
          hint={`${a.newThis} this month`}
          growth={a.growth}
          icon={<Bike className="h-4 w-4 text-white" />}
          gradient="from-blue-600 to-blue-700"
        />
        <KPI
          label="Verified"
          value={`${pct(a.verified, a.total)}%`}
          hint={`${a.verified} of ${a.total}`}
          icon={<ShieldCheck className="h-4 w-4 text-white" />}
          gradient="from-emerald-600 to-emerald-700"
          progress={pct(a.verified, a.total)}
        />
        <KPI
          label="Compliant"
          value={`${pct(a.compliant, a.total)}%`}
          hint={`${a.compliant} passing checks`}
          icon={<Award className="h-4 w-4 text-white" />}
          gradient="from-teal-600 to-cyan-700"
          progress={pct(a.compliant, a.total)}
        />
        <KPI
          label="Assigned"
          value={`${pct(a.assigned, a.total)}%`}
          hint={`${a.assigned} of ${a.total} to riders`}
          icon={<UserCheck className="h-4 w-4 text-white" />}
          gradient="from-amber-500 to-amber-600"
          progress={pct(a.assigned, a.total)}
        />
        <KPI
          label="Tracked"
          value={`${pct(a.withDevice, a.total)}%`}
          hint={`${a.online} online now`}
          icon={<Radio className="h-4 w-4 text-white" />}
          gradient="from-slate-800 to-slate-900"
          progress={pct(a.withDevice, a.total)}
        />
        <KPI
          label="Insured"
          value={`${pct(a.insured, a.total)}%`}
          hint={a.missingInsuranceDoc > 0 ? `${a.missingInsuranceDoc} missing cover doc` : `${a.insured} with policy`}
          icon={<ShieldCheck className="h-4 w-4 text-white" />}
          gradient="from-red-600 to-red-700"
          progress={pct(a.insured, a.total)}
        />
      </div>

      {/* Row 2: Documents / Verification vs Compliance / Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Documents Uploaded"
          subtitle={`Out of ${a.total} motorcycles`}
          icon={<FileCheck className="h-4 w-4 text-emerald-600" />}
        >
          {a.total === 0 ? <Empty label="No motorcycles yet" /> : (
            <div className="space-y-3 mt-1">
              {a.documents.map(d => (
                <DocumentRow key={d.key} icon={d.icon} label={d.label} count={d.count} total={a.total} color={d.color} />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Verification vs Compliance"
          subtitle="Where bikes stand in review"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        >
          {a.total === 0 ? <Empty label="No motorcycles yet" /> : (
            <div className="space-y-3 mt-1">
              <VerifyRow label="Admin-verified" done={a.verified} total={a.total} color="#059669" />
              <VerifyRow label="Marked compliant" done={a.compliant} total={a.total} color="#2563eb" />
              <VerifyRow label="Assigned to rider" done={a.assigned} total={a.total} color="#f59e0b" />
              <VerifyRow label="Has tracking device" done={a.withDevice} total={a.total} color="#0ea5e9" />
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">
                  <p className="text-lg font-bold text-amber-700">{a.total - a.verified}</p>
                  <p className="text-[10px] uppercase tracking-wider text-amber-700/80">Pending review</p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-100 p-2">
                  <p className="text-lg font-bold text-red-700">{a.total - a.compliant}</p>
                  <p className="text-[10px] uppercase tracking-wider text-red-700/80">Non-compliant</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Registration Growth"
          subtitle="Last 12 months"
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
        >
          <MiniBarChart data={a.monthly} />
          <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{a.newThis}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">This month</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{a.newPrev}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Last month</p>
            </div>
            <div>
              <p className={`text-lg font-bold inline-flex items-center gap-0.5 ${a.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {a.growth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(a.growth)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Growth</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3: Makes + Models + Insurance status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Fleet by Make"
          subtitle="Manufacturer distribution"
          icon={<Wrench className="h-4 w-4 text-blue-600" />}
        >
          {a.topMakes.length === 0 ? <Empty label="No make data yet" /> : (
            <>
              <BarList data={a.topMakes} color="#2563eb" />
              {a.unknownMake > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  {a.unknownMake} motorcycle(s) missing make information.
                </div>
              )}
            </>
          )}
        </Card>

        <Card
          title="Popular Models"
          subtitle="Top registered variants"
          icon={<Bike className="h-4 w-4 text-emerald-600" />}
        >
          {a.topModels.length === 0 ? <Empty label="Model data missing" /> : (
            <BarList data={a.topModels} color="#059669" />
          )}
        </Card>

        <Card
          title="Insurance Health"
          subtitle="Policies and cover documents"
          icon={<ShieldCheck className="h-4 w-4 text-red-600" />}
        >
          <div className="grid grid-cols-3 gap-2 mt-1">
            <MiniStat label="Policy + Doc" value={a.insuredAndDoc} total={a.total} tone="emerald" />
            <MiniStat label="Policy only" value={a.missingInsuranceDoc} total={a.total} tone="amber" />
            <MiniStat label="No policy" value={a.noInsurance} total={a.total} tone="red" />
          </div>
          <div className="mt-4 space-y-3">
            <VerifyRow label="Has policy number" done={a.insured} total={a.total} color="#059669" />
            <VerifyRow label="Has insurance cover doc" done={a.withInsuranceDoc} total={a.total} color="#2563eb" />
          </div>
          {a.missingInsuranceDoc > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p>{a.missingInsuranceDoc} bike(s) list a policy but no uploaded cover document.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: Tracking + Counties + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Tracking Coverage"
          subtitle="Device installation & health"
          icon={<Signal className="h-4 w-4 text-blue-600" />}
        >
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-4xl font-bold text-slate-900">{a.withDevice}</p>
            <p className="text-xs text-slate-500">of {a.total} motorcycles</p>
          </div>
          <div className="mt-4 space-y-3">
            <VerifyRow label="Fitted with device" done={a.withDevice} total={a.total} color="#059669" />
            <VerifyRow label="Currently online" done={a.online} total={Math.max(a.total, 1)} color="#2563eb" />
            <VerifyRow label="Without any device" done={a.total - a.withDevice} total={Math.max(a.total, 1)} color="#94a3b8" />
          </div>
        </Card>

        <Card
          title="Top Counties"
          subtitle="Fleet distribution by locality"
          icon={<MapPin className="h-4 w-4 text-emerald-600" />}
        >
          {a.topCounties.length === 0 ? <Empty label="No locality data" /> : (
            <BarList data={a.topCounties} color="#0ea5e9" />
          )}
          {a.unknownCounty > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              {a.unknownCounty} bike(s) have no county on the motorcycle or owner record.
            </div>
          )}
        </Card>

        <Card
          title="Risk & Enforcement"
          subtitle="Bikes flagged in incidents or fines"
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
        >
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{a.motoWithIncidents}</p>
              <p className="text-[10px] uppercase tracking-wider text-amber-700/80 mt-1">In incidents</p>
              <p className="text-[10px] text-amber-700/70 mt-0.5">{pct(a.motoWithIncidents, a.total)}% of fleet</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{a.motoWithFines}</p>
              <p className="text-[10px] uppercase tracking-wider text-red-700/80 mt-1">With fines</p>
              <p className="text-[10px] text-red-700/70 mt-0.5">{pct(a.motoWithFines, a.total)}% of fleet</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              Fleet age
            </p>
            <div className="space-y-2">
              <VerifyRow label="< 30 days old" done={a.ageBuckets.newer} total={Math.max(a.total, 1)} color="#059669" />
              <VerifyRow label="1–6 months" done={a.ageBuckets.mid} total={Math.max(a.total, 1)} color="#2563eb" />
              <VerifyRow label="> 6 months" done={a.ageBuckets.older} total={Math.max(a.total, 1)} color="#f59e0b" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────
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

function DocumentRow({ icon, label, count, total, color }: { icon: JSX.Element; label: string; count: number; total: number; color: string }) {
  const p = pct(count, total);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <span style={{ color }}>{icon}</span>
          {label}
        </div>
        <span className="text-slate-500 tabular-nums">{count}/{total} · {p}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
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
