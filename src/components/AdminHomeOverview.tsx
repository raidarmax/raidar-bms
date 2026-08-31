import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUp,
  ArrowDown,
  Ban,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import {
  CommunityIcon,
  MotorcycleIcon,
  LicenseCardIcon,
  RevenueVaultIcon,
  PoliceStationIcon,
  PoliceBadgeIcon,
  IncidentAlertIcon,
  GpsBeaconIcon,
  TrafficFineIcon,
  DocumentValidatedIcon,
} from './icons/BrandIcons';
import { supabase } from '../lib/supabase';

type Bucket = { label: string; key: string; owners: number; riders: number; motorcycles: number; revenue: number; fines: number; compliance: number };
type StatusSlice = { label: string; value: number; color: string };

const KENYA_COUNTIES_TOTAL = 47;

function formatKES(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${Math.round(n).toLocaleString()}`;
}

function formatTargetPct(pct: number) {
  if (pct === 0) return '0';
  if (pct >= 100) return '100';
  if (pct >= 10) return pct.toFixed(1).replace(/\.0$/, '');
  const rounded = Number(pct.toFixed(3));
  return rounded.toString();
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString('en-KE', { month: 'short' });
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Profile-completion weights — mirror of OwnerProfileCompletion.tsx
const OWNER_WEIGHTS = {
  full_name: 5, national_id: 5, phone_number: 5,
  id_verified: 10, kra_pin: 5, kra_pin_verified: 5,
  next_of_kin_name: 5, next_of_kin_phone: 5,
  county: 5,
  motorcycle_registration: 10, motorcycle_make: 5, motorcycle_model: 5,
  insurance_number: 5,
  bike_photo: 7, logbook: 7, kra_pin_doc: 5, insurance_cover: 6,
} as const;

// Profile-completion weights — mirror of RiderProfileCompletion.tsx
const RIDER_WEIGHTS = {
  name: 5, id_number: 5, phone_number: 5,
  id_verified: 10, kra_pin: 5, kra_pin_verified: 5,
  license_number: 8, license_verified: 7,
  next_of_kin_name: 5, next_of_kin_phone: 5,
  county: 5,
  photo_url: 8, license_url: 8, good_conduct_url: 8, id_copy_url: 6,
} as const;

function scoreOwner(o: any, m: any | null): number {
  let pct = 0;
  if (o.full_name) pct += OWNER_WEIGHTS.full_name;
  if (o.national_id) pct += OWNER_WEIGHTS.national_id;
  if (o.phone_number) pct += OWNER_WEIGHTS.phone_number;
  if (o.id_verified) pct += OWNER_WEIGHTS.id_verified;
  if (o.kra_pin) pct += OWNER_WEIGHTS.kra_pin;
  if (o.kra_pin_verified) pct += OWNER_WEIGHTS.kra_pin_verified;
  if (o.next_of_kin_name) pct += OWNER_WEIGHTS.next_of_kin_name;
  if (o.next_of_kin_phone) pct += OWNER_WEIGHTS.next_of_kin_phone;
  if (o.county_id) pct += OWNER_WEIGHTS.county;
  if (m) {
    if (m.registration_number) pct += OWNER_WEIGHTS.motorcycle_registration;
    if (m.make) pct += OWNER_WEIGHTS.motorcycle_make;
    if (m.model) pct += OWNER_WEIGHTS.motorcycle_model;
    if (m.insurance_policy_number) pct += OWNER_WEIGHTS.insurance_number;
    if (m.bike_photo_url) pct += OWNER_WEIGHTS.bike_photo;
    if (m.logbook_url) pct += OWNER_WEIGHTS.logbook;
    if (m.kra_pin_url) pct += OWNER_WEIGHTS.kra_pin_doc;
    if (m.insurance_cover_url) pct += OWNER_WEIGHTS.insurance_cover;
  }
  return pct;
}

function scoreRider(r: any): number {
  let pct = 0;
  if (r.name) pct += RIDER_WEIGHTS.name;
  if (r.id_number) pct += RIDER_WEIGHTS.id_number;
  if (r.phone_number) pct += RIDER_WEIGHTS.phone_number;
  if (r.id_verified) pct += RIDER_WEIGHTS.id_verified;
  if (r.kra_pin) pct += RIDER_WEIGHTS.kra_pin;
  if (r.kra_pin_verified) pct += RIDER_WEIGHTS.kra_pin_verified;
  if (r.license_number) pct += RIDER_WEIGHTS.license_number;
  if (r.license_verified) pct += RIDER_WEIGHTS.license_verified;
  if (r.next_of_kin_name) pct += RIDER_WEIGHTS.next_of_kin_name;
  if (r.next_of_kin_phone) pct += RIDER_WEIGHTS.next_of_kin_phone;
  if (r.county_id) pct += RIDER_WEIGHTS.county;
  if (r.photo_url) pct += RIDER_WEIGHTS.photo_url;
  if (r.license_url) pct += RIDER_WEIGHTS.license_url;
  if (r.good_conduct_url) pct += RIDER_WEIGHTS.good_conduct_url;
  if (r.id_copy_url) pct += RIDER_WEIGHTS.id_copy_url;
  return pct;
}

export default function AdminHomeOverview() {
  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [motorcycles, setMotorcycles] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [counties, setCounties] = useState<any[]>([]);
  const [registrationTarget, setRegistrationTarget] = useState<number>(10000);
  const [drivingLicenseFee, setDrivingLicenseFee] = useState<number>(600);
  const [goodConductFee, setGoodConductFee] = useState<number>(1000);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [
        ownersRes,
        ridersRes,
        motorcyclesRes,
        paymentsRes,
        finesRes,
        incidentsRes,
        devicesRes,
        stationsRes,
        officersRes,
        countiesRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from('owners').select('id, created_at, county_id, otp_verified, id_verified, kra_pin, kra_pin_verified, next_of_kin_name, next_of_kin_phone, phone_number, national_id, full_name'),
        supabase.from('riders').select('id, created_at, county_id, assignment_status, license_verified, id_verified, kra_pin, kra_pin_verified, license_number, phone_number, id_number, name, next_of_kin_name, next_of_kin_phone, photo_url, license_url, good_conduct_url, id_copy_url'),
        supabase.from('motorcycles').select('id, created_at, county_id, status, is_compliant, registration_number, make, model, insurance_policy_number, bike_photo_url, logbook_url, kra_pin_url, insurance_cover_url, owner_id'),
        supabase.from('payments').select('id, amount, payment_method, payment_status, created_at, completed_at, user_type').eq('payment_status', 'completed'),
        supabase.from('fines').select('id, fine_amount, status, issued_at, paid_at, county_id, offence:traffic_offences!fines_offence_id_fkey(offence_name)'),
        supabase.from('incidents').select('id, status, incident_type, county_id, created_at'),
        supabase.from('tracking_devices').select('id, status, last_heartbeat'),
        supabase.from('police_stations').select('id, county_id, is_active'),
        supabase.from('police_officers').select('id, is_active'),
        supabase.from('kenya_counties').select('id, county_name'),
        supabase.from('system_settings').select('key, value').eq('category', 'general').in('key', ['registration_target', 'driving_license_fee', 'good_conduct_fee']),
      ]);

      if (cancelled) return;
      setOwners(ownersRes.data || []);
      setRiders(ridersRes.data || []);
      setMotorcycles(motorcyclesRes.data || []);
      setPayments(paymentsRes.data || []);
      setFines(finesRes.data || []);
      setIncidents(incidentsRes.data || []);
      setDevices(devicesRes.data || []);
      setStations(stationsRes.data || []);
      setOfficers(officersRes.data || []);
      setCounties(countiesRes.data || []);
      for (const row of settingsRes.data || []) {
        const numeric = Number(row.value);
        if (!Number.isFinite(numeric) || numeric <= 0) continue;
        if (row.key === 'registration_target') setRegistrationTarget(numeric);
        else if (row.key === 'driving_license_fee') setDrivingLicenseFee(numeric);
        else if (row.key === 'good_conduct_fee') setGoodConductFee(numeric);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const monthlyBuckets: Bucket[] = useMemo(() => {
    const buckets: Bucket[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        label: monthLabel(d),
        key: monthKey(d),
        owners: 0,
        riders: 0,
        motorcycles: 0,
        revenue: 0,
        fines: 0,
        compliance: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    owners.forEach(o => { const k = monthKey(new Date(o.created_at)); const i = idx.get(k); if (i !== undefined) buckets[i].owners++; });
    riders.forEach(r => { const k = monthKey(new Date(r.created_at)); const i = idx.get(k); if (i !== undefined) buckets[i].riders++; });
    motorcycles.forEach(m => { const k = monthKey(new Date(m.created_at)); const i = idx.get(k); if (i !== undefined) buckets[i].motorcycles++; });
    payments.forEach(p => { const k = monthKey(new Date(p.completed_at || p.created_at)); const i = idx.get(k); if (i !== undefined) buckets[i].revenue += Number(p.amount) || 0; });
    fines.forEach(f => {
      if (f.status === 'paid' && f.paid_at) {
        const k = monthKey(new Date(f.paid_at));
        const i = idx.get(k);
        if (i !== undefined) buckets[i].fines += Number(f.fine_amount) || 0;
      }
    });
    riders.forEach(r => {
      const k = monthKey(new Date(r.created_at));
      const i = idx.get(k);
      if (i === undefined) return;
      if (r.license_url) buckets[i].compliance += drivingLicenseFee;
      if (r.good_conduct_url) buckets[i].compliance += goodConductFee;
    });
    return buckets;
  }, [owners, riders, motorcycles, payments, fines, drivingLicenseFee, goodConductFee]);

  const totals = useMemo(() => {
    const totalReg = owners.length + riders.length + motorcycles.length;
    const revenueTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
    const finesCollected = fines.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.fine_amount), 0);
    const finesOutstanding = fines.filter(f => f.status === 'issued' || f.status === 'overdue').reduce((s, f) => s + Number(f.fine_amount), 0);
    const licenseHolders = riders.filter(r => !!r.license_url).length;
    const gcHolders = riders.filter(r => !!r.good_conduct_url).length;
    const licenseRevenue = licenseHolders * drivingLicenseFee;
    const gcRevenue = gcHolders * goodConductFee;
    const complianceRevenue = licenseRevenue + gcRevenue;
    const totalRevenue = revenueTotal + finesCollected + complianceRevenue;

    // Compliance = average profile-completion score across owners + riders,
    // using the SAME weights as OwnerProfileCompletion and RiderProfileCompletion.
    const ownerMotorcycle = new Map<string, any>();
    motorcycles.forEach(m => { if (m.owner_id && !ownerMotorcycle.has(m.owner_id)) ownerMotorcycle.set(m.owner_id, m); });

    const ownerScores = owners.map(o => scoreOwner(o, ownerMotorcycle.get(o.id) || null));
    const riderScores = riders.map(r => scoreRider(r));
    const allScores = [...ownerScores, ...riderScores];
    const complianceRate = allScores.length
      ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
      : 0;
    const fullyCompliant = allScores.filter(s => s >= 100).length;
    const inProgress = allScores.filter(s => s >= 60 && s < 100).length;
    const incomplete = allScores.filter(s => s < 60).length;

    const openIncidents = incidents.filter(i => ['pending', 'confirmed'].includes(i.status)).length;
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length;

    const countyIds = new Set<number>();
    owners.forEach(o => o.county_id && countyIds.add(o.county_id));
    riders.forEach(r => r.county_id && countyIds.add(r.county_id));
    motorcycles.forEach(m => m.county_id && countyIds.add(m.county_id));

    // Growth: last month vs prior month
    const last = monthlyBuckets[monthlyBuckets.length - 1];
    const prev = monthlyBuckets[monthlyBuckets.length - 2];
    const lastReg = (last?.owners ?? 0) + (last?.riders ?? 0) + (last?.motorcycles ?? 0);
    const prevReg = (prev?.owners ?? 0) + (prev?.riders ?? 0) + (prev?.motorcycles ?? 0);
    const regGrowth = prevReg === 0 ? (lastReg > 0 ? 100 : 0) : Math.round(((lastReg - prevReg) / prevReg) * 100);
    const lastRev = (last?.revenue ?? 0) + (last?.fines ?? 0) + (last?.compliance ?? 0);
    const prevRev = (prev?.revenue ?? 0) + (prev?.fines ?? 0) + (prev?.compliance ?? 0);
    const revGrowth = prevRev === 0 ? (lastRev > 0 ? 100 : 0) : Math.round(((lastRev - prevRev) / prevRev) * 100);

    // Target progress — keep 3 decimals of precision so tiny slices are visible
    const rawTargetPct = registrationTarget > 0
      ? Math.min(100, (totalReg / registrationTarget) * 100)
      : 0;
    const targetPct = Math.round(rawTargetPct * 1000) / 1000;
    const targetRemaining = Math.max(0, registrationTarget - totalReg);

    return {
      totalReg,
      totalRevenue,
      revenueTotal,
      finesCollected,
      finesOutstanding,
      complianceRevenue,
      licenseRevenue,
      gcRevenue,
      licenseHolders,
      gcHolders,
      complianceRate,
      fullyCompliant,
      inProgress,
      incomplete,
      openIncidents,
      resolvedIncidents,
      countiesActive: countyIds.size,
      regGrowth,
      revGrowth,
      targetPct,
      targetRemaining,
    };
  }, [owners, riders, motorcycles, payments, fines, incidents, monthlyBuckets, registrationTarget, drivingLicenseFee, goodConductFee]);

  const paymentChannels: StatusSlice[] = useMemo(() => {
    const meta: Record<string, { label: string; color: string }> = {
      mpesa: { label: 'M-Pesa', color: '#059669' },
      salamapay: { label: 'SalamaPay', color: '#2563eb' },
      ecitizen: { label: 'eCitizen', color: '#dc2626' },
    };
    const acc: Record<string, number> = {};
    payments.forEach(p => { acc[p.payment_method] = (acc[p.payment_method] || 0) + Number(p.amount); });
    return Object.entries(acc)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: meta[k]?.label ?? k, value: v, color: meta[k]?.color ?? '#64748b' }));
  }, [payments]);

  const finesStatusSlices: StatusSlice[] = useMemo(() => {
    const colors: Record<string, string> = {
      paid: '#059669',
      issued: '#2563eb',
      overdue: '#dc2626',
      disputed: '#d97706',
      cancelled: '#94a3b8',
    };
    const acc: Record<string, number> = {};
    fines.forEach(f => { acc[f.status] = (acc[f.status] || 0) + 1; });
    return Object.entries(acc).map(([k, v]) => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      color: colors[k] ?? '#64748b',
    }));
  }, [fines]);

  const topOffences = useMemo(() => {
    const acc: Record<string, number> = {};
    fines.forEach(f => {
      const name = f.offence?.offence_name || 'Unclassified';
      acc[name] = (acc[name] || 0) + 1;
    });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [fines]);

  const incidentByStatus: StatusSlice[] = useMemo(() => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#2563eb',
      resolved: '#059669',
      ignored: '#94a3b8',
    };
    const acc: Record<string, number> = {};
    incidents.forEach(i => { acc[i.status] = (acc[i.status] || 0) + 1; });
    return Object.entries(acc).map(([k, v]) => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      color: colors[k] ?? '#64748b',
    }));
  }, [incidents]);

  const incidentByType = useMemo(() => {
    const acc: Record<string, number> = {};
    incidents.forEach(i => { acc[i.incident_type] = (acc[i.incident_type] || 0) + 1; });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }));
  }, [incidents]);

  const topCounties = useMemo(() => {
    const nameById = new Map<number, string>(counties.map((c: any) => [c.id, c.county_name]));
    const acc = new Map<number, number>();
    const add = (id: number | null | undefined) => { if (!id) return; acc.set(id, (acc.get(id) || 0) + 1); };
    owners.forEach(o => add(o.county_id));
    riders.forEach(r => add(r.county_id));
    motorcycles.forEach(m => add(m.county_id));
    return Array.from(acc.entries())
      .map(([id, v]) => ({ label: nameById.get(id) || `County ${id}`, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [counties, owners, riders, motorcycles]);

  const deviceStatus = useMemo(() => {
    const now = Date.now();
    const online = devices.filter(d => d.last_heartbeat && (now - new Date(d.last_heartbeat).getTime()) < 5 * 60 * 1000).length;
    const offline = devices.length - online;
    const active = devices.filter(d => d.status === 'active' || d.status === 'connected').length;
    return { total: devices.length, online, offline, active };
  }, [devices]);

  const activityFeed = useMemo(() => {
    const events: { id: string; icon: JSX.Element; color: string; title: string; subtitle: string; ts: string }[] = [];
    payments.slice(0, 8).forEach(p => events.push({
      id: 'p-' + p.id,
      icon: <TrafficFineIcon className="h-3.5 w-3.5" />,
      color: 'text-emerald-700 bg-emerald-100',
      title: `${p.user_type === 'owner' ? 'Owner' : 'Rider'} paid registration`,
      subtitle: formatKES(Number(p.amount)) + ' · ' + p.payment_method,
      ts: p.completed_at || p.created_at,
    }));
    fines.slice(0, 8).forEach(f => events.push({
      id: 'f-' + f.id,
      icon: f.status === 'paid' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />,
      color: f.status === 'paid' ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100',
      title: f.status === 'paid' ? 'Fine paid' : 'Fine issued',
      subtitle: formatKES(Number(f.fine_amount)) + (f.offence?.offence_name ? ` · ${f.offence.offence_name}` : ''),
      ts: f.paid_at || f.issued_at,
    }));
    incidents.slice(0, 8).forEach(i => events.push({
      id: 'i-' + i.id,
      icon: <IncidentAlertIcon className="h-3.5 w-3.5" />,
      color: 'text-amber-700 bg-amber-100',
      title: `Incident reported (${i.incident_type.replace(/_/g, ' ')})`,
      subtitle: i.status,
      ts: i.created_at,
    }));
    return events
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 10);
  }, [payments, fines, incidents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Loading dashboard insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/40 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Command Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Live snapshot across registrations, revenue, enforcement, and fleet.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <HeroKPI
          label="Registrations"
          value={totals.totalReg.toLocaleString()}
          hint={`${owners.length} owners · ${riders.length} riders · ${motorcycles.length} bikes`}
          growth={totals.regGrowth}
          gradient="from-blue-600 to-blue-700"
          icon={<CommunityIcon className="h-4 w-4 text-white" />}
          spark={monthlyBuckets.map(b => b.owners + b.riders + b.motorcycles)}
          sparkColor="rgba(255,255,255,0.9)"
        />
        <HeroKPI
          label="Revenue"
          value={formatKES(totals.totalRevenue)}
          hint={`${formatKES(totals.revenueTotal)} regs · ${formatKES(totals.complianceRevenue)} compliance`}
          growth={totals.revGrowth}
          gradient="from-emerald-600 to-emerald-700"
          icon={<RevenueVaultIcon className="h-4 w-4 text-white" />}
          spark={monthlyBuckets.map(b => b.revenue + b.fines + b.compliance)}
          sparkColor="rgba(255,255,255,0.9)"
        />
        <HeroKPI
          label="Target Progress"
          value={`${formatTargetPct(totals.targetPct)}%`}
          hint={`${totals.targetRemaining.toLocaleString()} to reach ${registrationTarget.toLocaleString()}`}
          gradient="from-teal-600 to-cyan-700"
          icon={<TrendingUp className="h-4 w-4 text-white" />}
          progress={totals.targetPct}
        />
        <HeroKPI
          label="Compliance"
          value={`${totals.complianceRate}%`}
          hint={`${totals.fullyCompliant} complete · ${totals.incomplete} low`}
          gradient="from-slate-800 to-slate-900"
          icon={<PoliceBadgeIcon className="h-4 w-4 text-white" />}
          progress={totals.complianceRate}
        />
        <HeroKPI
          label="Open Incidents"
          value={totals.openIncidents.toString()}
          hint={`${totals.resolvedIncidents} resolved`}
          gradient="from-amber-500 to-amber-600"
          icon={<IncidentAlertIcon className="h-4 w-4 text-white" />}
          spark={monthlyBuckets.map((_, i) => incidents.filter(x => monthKey(new Date(x.created_at)) === monthlyBuckets[i].key).length)}
          sparkColor="rgba(255,255,255,0.85)"
        />
        <HeroKPI
          label="Counties"
          value={`${totals.countiesActive}/${KENYA_COUNTIES_TOTAL}`}
          hint={`${Math.round((totals.countiesActive / KENYA_COUNTIES_TOTAL) * 100)}% reach`}
          gradient="from-rose-600 to-rose-700"
          icon={<MapPin className="h-4 w-4 text-white" />}
          progress={Math.round((totals.countiesActive / KENYA_COUNTIES_TOTAL) * 100)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Top Counties by Registrations"
            subtitle="Where the fleet lives"
            icon={<MapPin className="h-4 w-4 text-emerald-600" />}
          />
          {topCounties.length === 0 ? (
            <EmptyState label="No locality data yet" />
          ) : (
            <HorizontalBars data={topCounties} accent="#2563eb" />
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Top Traffic Offences"
            subtitle="Most-cited violations"
            icon={<DocumentValidatedIcon className="h-4 w-4 text-red-600" />}
          />
          {topOffences.length === 0 ? (
            <EmptyState label="No offences recorded" />
          ) : (
            <HorizontalBars data={topOffences} accent="#dc2626" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Police Coverage"
            subtitle="Stations & officers on duty"
            icon={<PoliceStationIcon className="h-4 w-4 text-slate-700" />}
          />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <StatCard
              icon={<PoliceStationIcon className="h-4 w-4" />}
              label="Stations"
              value={stations.length.toLocaleString()}
              hint={`${stations.filter((s: any) => s.is_active).length} active`}
              accent="bg-slate-900 text-white"
            />
            <StatCard
              icon={<LicenseCardIcon className="h-4 w-4" />}
              label="Officers"
              value={officers.length.toLocaleString()}
              hint={`${officers.filter((o: any) => o.is_active).length} active`}
              accent="bg-emerald-600 text-white"
            />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-600">Coverage across counties</p>
              <p className="text-xs font-mono text-slate-500">{new Set(stations.map((s: any) => s.county_id)).size}/{KENYA_COUNTIES_TOTAL}</p>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-slate-800 to-slate-900 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (new Set(stations.map((s: any) => s.county_id)).size / KENYA_COUNTIES_TOTAL) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Incidents Breakdown"
            subtitle="Status vs type"
            icon={<IncidentAlertIcon className="h-4 w-4 text-amber-600" />}
          />
          {incidents.length === 0 ? (
            <EmptyState label="No incidents on record" />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 mt-1">
                {incidentByStatus.map(s => (
                  <div key={s.label} className="flex-1 text-center rounded-lg py-2 border border-slate-100">
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <HorizontalBars data={incidentByType} accent="#f59e0b" />
            </>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Fleet & Tracking"
            subtitle="Device health"
            icon={<GpsBeaconIcon className="h-4 w-4 text-blue-600" />}
          />
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-4xl font-bold text-slate-900">{deviceStatus.total}</p>
            <p className="text-xs text-slate-500">registered devices</p>
          </div>
          <div className="mt-4 space-y-2">
            <StatusBar
              icon={<GpsBeaconIcon className="h-3 w-3" />}
              label="Online (last 5m)"
              value={deviceStatus.online}
              total={Math.max(deviceStatus.total, 1)}
              color="#059669"
            />
            <StatusBar
              icon={<Clock className="h-3 w-3" />}
              label="Offline"
              value={deviceStatus.offline}
              total={Math.max(deviceStatus.total, 1)}
              color="#94a3b8"
            />
            <StatusBar
              icon={<MotorcycleIcon className="h-3 w-3" />}
              label="Motorcycles tracked"
              value={motorcycles.filter((m: any) => m.status === 'verified').length}
              total={Math.max(motorcycles.length, 1)}
              color="#2563eb"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Registration Growth"
            subtitle="Owners, riders, and motorcycles registered per month"
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          />
          <MultiLineChart
            points={monthlyBuckets}
            series={[
              { key: 'owners', label: 'Owners', color: '#059669' },
              { key: 'riders', label: 'Riders', color: '#2563eb' },
              { key: 'motorcycles', label: 'Motorcycles', color: '#f59e0b' },
            ]}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Payment Channels"
            subtitle="Revenue by processor"
            icon={<Activity className="h-4 w-4 text-emerald-600" />}
          />
          {paymentChannels.length === 0 ? (
            <EmptyState label="No payments yet" />
          ) : (
            <>
              <DonutChart data={paymentChannels} centerLabel={formatKES(totals.revenueTotal)} centerSub="revenue" />
              <div className="mt-3 space-y-1.5">
                {paymentChannels.map(c => {
                  const share = totals.revenueTotal ? Math.round((c.value / totals.revenueTotal) * 100) : 0;
                  return (
                    <div key={c.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      <span className="font-medium text-slate-700 flex-1">{c.label}</span>
                      <span className="text-slate-500">{share}%</span>
                      <span className="font-semibold text-slate-800 w-20 text-right">{formatKES(c.value)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Revenue Streams"
            subtitle="Registrations, compliance, and fines collected each month"
            icon={<RevenueVaultIcon className="h-4 w-4 text-emerald-600" />}
          />
          <StackedBarChart
            points={monthlyBuckets}
            series={[
              { key: 'revenue', label: 'Registrations', color: '#059669' },
              { key: 'compliance', label: 'Compliance', color: '#0891b2' },
              { key: 'fines', label: 'Fines', color: '#dc2626' },
            ]}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <SectionHeader
            title="Enforcement Snapshot"
            subtitle="Fines by lifecycle"
            icon={<Ban className="h-4 w-4 text-red-600" />}
          />
          {finesStatusSlices.length === 0 ? (
            <EmptyState label="No fines issued yet" />
          ) : (
            <>
              <DonutChart data={finesStatusSlices} centerLabel={fines.length.toString()} centerSub="fines" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat label="Collected" value={formatKES(totals.finesCollected)} tone="emerald" />
                <MiniStat label="Outstanding" value={formatKES(totals.finesOutstanding)} tone="red" />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <SectionHeader
          title="Compliance Revenue"
          subtitle="3rd-party document fees collected from riders"
          icon={<DocumentValidatedIcon className="h-4 w-4 text-cyan-600" />}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-4">
            <p className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold">Total Compliance</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatKES(totals.complianceRevenue)}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {totals.licenseHolders + totals.gcHolders} documents on file
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Driving Licenses</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatKES(totals.licenseRevenue)}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {totals.licenseHolders} × {formatKES(drivingLicenseFee)}
            </p>
          </div>
          <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
            <p className="text-[10px] uppercase tracking-wider text-teal-700 font-semibold">Good Conduct</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatKES(totals.gcRevenue)}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {totals.gcHolders} × {formatKES(goodConductFee)}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Share of total revenue</span>
          <span className="font-semibold text-slate-900">
            {totals.totalRevenue > 0
              ? Math.round((totals.complianceRevenue / totals.totalRevenue) * 100)
              : 0}
            %
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <SectionHeader
          title="Live Activity"
          subtitle="Latest events across payments, fines, and incidents"
          icon={<Activity className="h-4 w-4 text-emerald-600" />}
        />
        {activityFeed.length === 0 ? (
          <EmptyState label="No activity yet" />
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {activityFeed.map(ev => (
              <li key={ev.id} className="py-2.5 flex items-center gap-3">
                <span className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${ev.color}`}>
                  {ev.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{ev.title}</p>
                  <p className="text-xs text-slate-500 truncate">{ev.subtitle}</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(ev.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

// ── SUBCOMPONENTS ─────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: JSX.Element }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
      {label}
    </div>
  );
}

function HeroKPI({
  label,
  value,
  hint,
  growth,
  gradient,
  icon,
  spark,
  sparkColor,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  growth?: number;
  gradient: string;
  icon: JSX.Element;
  spark?: number[];
  sparkColor?: string;
  progress?: number;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${gradient} p-3 text-white shadow-sm`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="h-7 w-7 rounded-md bg-white/15 flex items-center justify-center">{icon}</div>
        {growth !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
            growth >= 0 ? 'bg-white/20 text-white' : 'bg-black/25 text-white'
          }`}>
            {growth >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/80">{label}</p>
      <p className="text-lg lg:text-xl font-bold leading-tight mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-white/75 mt-1 truncate">{hint}</p>}

      {spark && spark.length > 0 && (
        <div className="mt-2">
          <Sparkline values={spark} color={sparkColor || 'rgba(255,255,255,0.85)'} />
        </div>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/90 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null;
  const width = 120, height = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MultiLineChart({
  points,
  series,
}: {
  points: Bucket[];
  series: { key: keyof Bucket; label: string; color: string }[];
}) {
  const width = 640, height = 220;
  const padL = 34, padR = 12, padT = 12, padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(1, ...series.flatMap(s => points.map(p => Number(p[s.key]))));
  const step = points.length > 1 ? chartW / (points.length - 1) : chartW;
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxVal / ticks) * i));

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-3 mb-1">
        {series.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
          </div>
        ))}
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        {tickVals.map(t => {
          const y = padT + chartH - (t / maxVal) * chartH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
              <text x={padL - 6} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                {t >= 1000 ? `${(t / 1000).toFixed(0)}K` : t}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => (
          <text
            key={p.key + '-x'}
            x={padL + i * step}
            y={height - 10}
            fontSize="9"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {p.label}
          </text>
        ))}
        {series.map((s, si) => {
          const yOffset = (si - (series.length - 1) / 2) * 2.5;
          const line = points
            .map((p, i) => `${padL + i * step},${padT + chartH - (Number(p[s.key]) / maxVal) * chartH + yOffset}`)
            .join(' ');
          const areaPath = `M ${padL},${padT + chartH} L ${line.split(' ').join(' L ')} L ${padL + (points.length - 1) * step},${padT + chartH} Z`;
          return (
            <g key={s.label}>
              <path d={areaPath} fill={s.color} opacity="0.08" />
              <polyline points={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
              {points.map((p, i) => (
                <circle
                  key={p.key + s.label}
                  cx={padL + i * step}
                  cy={padT + chartH - (Number(p[s.key]) / maxVal) * chartH + yOffset}
                  r={2.5}
                  fill={s.color}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StackedBarChart({
  points,
  series,
}: {
  points: Bucket[];
  series: { key: keyof Bucket; label: string; color: string }[];
}) {
  const width = 640, height = 220;
  const padL = 42, padR = 12, padT = 12, padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const totals = points.map(p => series.reduce((s, ser) => s + Number(p[ser.key]), 0));
  const maxVal = Math.max(1, ...totals);
  const step = chartW / points.length;
  const barW = step * 0.5;
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxVal / ticks) * i));

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-3 mb-1">
        {series.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
          </div>
        ))}
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        {tickVals.map(t => {
          const y = padT + chartH - (t / maxVal) * chartH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
              <text x={padL - 6} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                {t >= 1_000_000 ? `${(t / 1_000_000).toFixed(1)}M` : t >= 1_000 ? `${(t / 1_000).toFixed(0)}K` : t}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const cx = padL + i * step + step / 2;
          let cursor = padT + chartH;
          return (
            <g key={p.key}>
              {series.map(s => {
                const h = (Number(p[s.key]) / maxVal) * chartH;
                cursor -= h;
                return (
                  <rect
                    key={s.label}
                    x={cx - barW / 2}
                    y={cursor}
                    width={barW}
                    height={h}
                    fill={s.color}
                    rx={2}
                  />
                );
              })}
              <text x={cx} y={height - 10} fontSize="9" fill="#94a3b8" textAnchor="middle">{p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({
  data,
  centerLabel,
  centerSub,
}: {
  data: StatusSlice[];
  centerLabel?: string;
  centerSub?: string;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const inner = 46;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let start = -Math.PI / 2;
  const paths = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const end = start + angle;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const xi1 = cx + inner * Math.cos(end);
    const yi1 = cy + inner * Math.sin(end);
    const xi2 = cx + inner * Math.cos(start);
    const yi2 = cy + inner * Math.sin(start);
    const large = angle > Math.PI ? 1 : 0;
    const p = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2} Z`;
    start = end;
    return { d: p, color: d.color, label: d.label };
  });
  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map(p => (
          <path key={p.label} d={p.d} fill={p.color} stroke="white" strokeWidth={1.5} />
        ))}
      </svg>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-lg font-bold text-slate-900 leading-none">{centerLabel}</p>
          {centerSub && <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{centerSub}</p>}
        </div>
      )}
    </div>
  );
}

function HorizontalBars({ data, accent }: { data: { label: string; value: number }[]; accent: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-slate-600 flex-1 truncate capitalize" title={d.label}>{d.label}</span>
          <div className="w-40 md:w-56 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, background: accent }}
            />
          </div>
          <span className="text-xs font-bold text-slate-800 w-10 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${accent}`}>{icon}</div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'red' | 'slate' }) {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  } as const;
  return (
    <div className={`rounded-lg border p-2 ${toneMap[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function StatusBar({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: JSX.Element;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = Math.min(100, Math.round((value / total) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <span className="font-semibold text-slate-800 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}