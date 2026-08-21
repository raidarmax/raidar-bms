import { useEffect, useMemo, useState } from 'react';
import {
  Users, ShieldCheck, FileCheck, TrendingUp, MapPin, CheckCircle2,
  FileText, ArrowUp, ArrowDown, Sparkles, Award, AlertTriangle, Camera,
  BadgeCheck, CreditCard, Bike, Landmark,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Variant = 'owners' | 'riders';

const OWNER_WEIGHTS = {
  full_name: 5, national_id: 5, phone_number: 5,
  id_verified: 10, kra_pin: 5, kra_pin_verified: 5,
  next_of_kin_name: 5, next_of_kin_phone: 5,
  county: 5,
  motorcycle_registration: 10, motorcycle_make: 5, motorcycle_model: 5,
  insurance_number: 5,
  bike_photo: 7, logbook: 7, kra_pin_doc: 5, insurance_cover: 6,
} as const;

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

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(d: Date) {
  return d.toLocaleString('en-KE', { month: 'short' });
}

export default function OwnersRidersInsights({ variant }: { variant: Variant }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [motorcycles, setMotorcycles] = useState<any[]>([]);
  const [counties, setCounties] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (variant === 'owners') {
        const [ownersRes, motoRes, countiesRes] = await Promise.all([
          supabase.from('owners').select('id, created_at, county_id, otp_verified, id_verified, kra_pin, kra_pin_verified, next_of_kin_name, next_of_kin_phone, phone_number, national_id, full_name, profile_photo_url'),
          supabase.from('motorcycles').select('id, owner_id, registration_number, make, model, insurance_policy_number, bike_photo_url, logbook_url, kra_pin_url, insurance_cover_url, status, is_compliant'),
          supabase.from('kenya_counties').select('id, county_name'),
        ]);
        if (cancelled) return;
        setRows(ownersRes.data || []);
        setMotorcycles(motoRes.data || []);
        setCounties(countiesRes.data || []);
      } else {
        const [ridersRes, countiesRes] = await Promise.all([
          supabase.from('riders').select('id, created_at, county_id, assignment_status, license_verified, id_verified, kra_pin, kra_pin_verified, license_number, phone_number, id_number, name, next_of_kin_name, next_of_kin_phone, photo_url, license_url, good_conduct_url, id_copy_url'),
          supabase.from('kenya_counties').select('id, county_name'),
        ]);
        if (cancelled) return;
        setRows(ridersRes.data || []);
        setCounties(countiesRes.data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [variant]);

  const ownerToMoto = useMemo(() => {
    const m = new Map<string, any>();
    motorcycles.forEach(x => { if (x.owner_id && !m.has(x.owner_id)) m.set(x.owner_id, x); });
    return m;
  }, [motorcycles]);

  const analytics = useMemo(() => {
    const total = rows.length;
    const scores = rows.map(r => variant === 'owners' ? scoreOwner(r, ownerToMoto.get(r.id) || null) : scoreRider(r));
    const avgCompletion = total ? Math.round(scores.reduce((s, v) => s + v, 0) / total) : 0;

    const buckets = { low: 0, medium: 0, high: 0, complete: 0 };
    scores.forEach(s => {
      if (s >= 100) buckets.complete++;
      else if (s >= 75) buckets.high++;
      else if (s >= 40) buckets.medium++;
      else buckets.low++;
    });

    // Verification stats
    const idVerified = rows.filter(r => r.id_verified).length;
    const kraVerified = rows.filter(r => r.kra_pin_verified).length;
    const licenseVerified = variant === 'riders' ? rows.filter(r => r.license_verified).length : 0;
    const otpVerified = variant === 'owners' ? rows.filter(r => r.otp_verified).length : 0;

    // Growth (this month vs last month)
    const now = new Date();
    const thisKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const newThis = rows.filter(r => monthKey(new Date(r.created_at)) === thisKey).length;
    const newPrev = rows.filter(r => monthKey(new Date(r.created_at)) === prevKey).length;
    const growth = newPrev === 0 ? (newThis > 0 ? 100 : 0) : Math.round(((newThis - newPrev) / newPrev) * 100);

    // 12-month buckets
    const monthly: { label: string; key: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({ label: monthLabel(d), key: monthKey(d), count: 0 });
    }
    const idx = new Map(monthly.map((b, i) => [b.key, i]));
    rows.forEach(r => { const i = idx.get(monthKey(new Date(r.created_at))); if (i !== undefined) monthly[i].count++; });

    // Document upload rates
    let documents: { key: string; label: string; icon: JSX.Element; count: number; color: string }[];
    if (variant === 'riders') {
      documents = [
        { key: 'photo_url', label: 'Profile Photos', icon: <Camera className="h-4 w-4" />, count: rows.filter(r => r.photo_url).length, color: '#2563eb' },
        { key: 'license_url', label: 'Driving Licenses', icon: <CreditCard className="h-4 w-4" />, count: rows.filter(r => r.license_url).length, color: '#059669' },
        { key: 'good_conduct_url', label: 'Good Conduct', icon: <BadgeCheck className="h-4 w-4" />, count: rows.filter(r => r.good_conduct_url).length, color: '#f59e0b' },
        { key: 'id_copy_url', label: 'ID Copies', icon: <FileText className="h-4 w-4" />, count: rows.filter(r => r.id_copy_url).length, color: '#dc2626' },
      ];
    } else {
      const linkedMotos = rows.map(r => ownerToMoto.get(r.id)).filter(Boolean);
      documents = [
        { key: 'profile_photo_url', label: 'Owner Profile Photos', icon: <Camera className="h-4 w-4" />, count: rows.filter(r => r.profile_photo_url).length, color: '#2563eb' },
        { key: 'bike_photo_url', label: 'Bike Photos', icon: <Bike className="h-4 w-4" />, count: linkedMotos.filter(m => m.bike_photo_url).length, color: '#0ea5e9' },
        { key: 'logbook_url', label: 'Motorcycle Logbooks', icon: <FileText className="h-4 w-4" />, count: linkedMotos.filter(m => m.logbook_url).length, color: '#059669' },
        { key: 'kra_pin_url', label: 'KRA PIN Certificates', icon: <Landmark className="h-4 w-4" />, count: linkedMotos.filter(m => m.kra_pin_url).length, color: '#f59e0b' },
        { key: 'insurance_cover_url', label: 'Insurance Covers', icon: <ShieldCheck className="h-4 w-4" />, count: linkedMotos.filter(m => m.insurance_cover_url).length, color: '#dc2626' },
      ];
    }

    // Assignment (riders only)
    const assignment: Record<string, number> = {};
    if (variant === 'riders') {
      rows.forEach(r => { const k = r.assignment_status || 'Unassigned'; assignment[k] = (assignment[k] || 0) + 1; });
    }

    // Compliance (linked motorcycle) — owners only
    const motorcyclesLinked = variant === 'owners' ? rows.filter(r => ownerToMoto.has(r.id)).length : 0;
    const motorcyclesCompliant = variant === 'owners'
      ? Array.from(ownerToMoto.values()).filter(m => m.is_compliant).length
      : 0;
    const motorcyclesVerified = variant === 'owners'
      ? Array.from(ownerToMoto.values()).filter(m => m.status === 'verified').length
      : 0;

    // Top counties
    const countyName = new Map<number, string>();
    counties.forEach((c: any) => countyName.set(c.id, c.county_name));
    const countyCounts: Record<string, number> = {};
    rows.forEach(r => {
      if (!r.county_id) return;
      const n = countyName.get(r.county_id) || `County #${r.county_id}`;
      countyCounts[n] = (countyCounts[n] || 0) + 1;
    });
    const topCounties = Object.entries(countyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));

    return {
      total, avgCompletion, buckets, scores,
      idVerified, kraVerified, licenseVerified, otpVerified,
      newThis, newPrev, growth,
      monthly, documents, assignment,
      motorcyclesLinked, motorcyclesCompliant, motorcyclesVerified,
      topCounties,
    };
  }, [rows, ownerToMoto, counties, variant]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const label = variant === 'owners' ? 'Owners' : 'Riders';
  const nonPurpleGradient = variant === 'owners' ? 'from-blue-600 to-blue-700' : 'from-emerald-600 to-emerald-700';

  return (
    <div className="space-y-5">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KPI
          label={`Total ${label}`}
          value={analytics.total.toLocaleString()}
          hint={`${analytics.newThis} this month`}
          growth={analytics.growth}
          icon={<Users className="h-4 w-4 text-white" />}
          gradient={nonPurpleGradient}
        />
        <KPI
          label="Avg Profile"
          value={`${analytics.avgCompletion}%`}
          hint={`${analytics.buckets.complete} fully complete`}
          icon={<Sparkles className="h-4 w-4 text-white" />}
          gradient="from-teal-600 to-cyan-700"
          progress={analytics.avgCompletion}
        />
        <KPI
          label="ID Verified"
          value={`${pct(analytics.idVerified, analytics.total)}%`}
          hint={`${analytics.idVerified} of ${analytics.total}`}
          icon={<ShieldCheck className="h-4 w-4 text-white" />}
          gradient="from-emerald-600 to-emerald-700"
          progress={pct(analytics.idVerified, analytics.total)}
        />
        <KPI
          label="KRA Verified"
          value={`${pct(analytics.kraVerified, analytics.total)}%`}
          hint={`${analytics.kraVerified} of ${analytics.total}`}
          icon={<Landmark className="h-4 w-4 text-white" />}
          gradient="from-amber-500 to-amber-600"
          progress={pct(analytics.kraVerified, analytics.total)}
        />
        {variant === 'riders' ? (
          <KPI
            label="License Verified"
            value={`${pct(analytics.licenseVerified, analytics.total)}%`}
            hint={`${analytics.licenseVerified} of ${analytics.total}`}
            icon={<CreditCard className="h-4 w-4 text-white" />}
            gradient="from-slate-800 to-slate-900"
            progress={pct(analytics.licenseVerified, analytics.total)}
          />
        ) : (
          <KPI
            label="Motorcycles Linked"
            value={`${pct(analytics.motorcyclesLinked, analytics.total)}%`}
            hint={`${analytics.motorcyclesLinked} of ${analytics.total} owners`}
            icon={<Bike className="h-4 w-4 text-white" />}
            gradient="from-slate-800 to-slate-900"
            progress={pct(analytics.motorcyclesLinked, analytics.total)}
          />
        )}
      </div>

      {/* Row: Profile completion distribution + Documents + Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Profile Completeness"
          subtitle="Distribution across all records"
          icon={<Award className="h-4 w-4 text-emerald-600" />}
        >
          {analytics.total === 0 ? (
            <Empty label="No records yet" />
          ) : (
            <div className="space-y-3 mt-1">
              <CompletionBar label="Fully complete (100%)" count={analytics.buckets.complete} total={analytics.total} color="#059669" />
              <CompletionBar label="Near complete (75–99%)" count={analytics.buckets.high} total={analytics.total} color="#2563eb" />
              <CompletionBar label="In progress (40–74%)" count={analytics.buckets.medium} total={analytics.total} color="#f59e0b" />
              <CompletionBar label="Just started (< 40%)" count={analytics.buckets.low} total={analytics.total} color="#dc2626" />
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Average profile completion</span>
                <span className="font-semibold text-slate-900">{analytics.avgCompletion}%</span>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Documents Uploaded"
          subtitle={`Out of ${analytics.total} ${label.toLowerCase()}`}
          icon={<FileCheck className="h-4 w-4 text-emerald-600" />}
        >
          {analytics.total === 0 ? (
            <Empty label="No records yet" />
          ) : (
            <div className="space-y-3 mt-1">
              {analytics.documents.map(d => (
                <DocumentRow
                  key={d.key}
                  icon={d.icon}
                  label={d.label}
                  count={d.count}
                  total={analytics.total}
                  color={d.color}
                />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Registration Growth"
          subtitle="Last 12 months"
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
        >
          <MiniBarChart data={analytics.monthly} />
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
              <p className={`text-lg font-bold inline-flex items-center gap-0.5 ${analytics.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {analytics.growth >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(analytics.growth)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Growth</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row: Assignment/Fleet + Top Counties + Verification snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {variant === 'riders' ? (
          <Card
            title="Assignment Status"
            subtitle="Riders currently matched to motorcycles"
            icon={<Bike className="h-4 w-4 text-blue-600" />}
          >
            {Object.keys(analytics.assignment).length === 0 ? (
              <Empty label="No riders yet" />
            ) : (
              <div className="space-y-3 mt-1">
                {Object.entries(analytics.assignment).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium">{k}</span>
                      <span className="text-slate-500">{v} · {pct(v, analytics.total)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct(v, analytics.total)}%`,
                          background: k.toLowerCase().includes('assign') && !k.toLowerCase().includes('un') ? '#059669' : '#f59e0b',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card
            title="Fleet Health"
            subtitle="Motorcycles linked to owners"
            icon={<Bike className="h-4 w-4 text-blue-600" />}
          >
            <div className="grid grid-cols-3 gap-2 mt-1">
              <MiniStat label="Linked" value={analytics.motorcyclesLinked} total={analytics.total} tone="blue" />
              <MiniStat label="Verified" value={analytics.motorcyclesVerified} total={Math.max(analytics.motorcyclesLinked, 1)} tone="emerald" />
              <MiniStat label="Compliant" value={analytics.motorcyclesCompliant} total={Math.max(analytics.motorcyclesLinked, 1)} tone="amber" />
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p>
                {analytics.total - analytics.motorcyclesLinked > 0
                  ? `${analytics.total - analytics.motorcyclesLinked} owner(s) have no motorcycle on record yet.`
                  : 'Every registered owner has at least one motorcycle linked.'}
              </p>
            </div>
          </Card>
        )}

        <Card
          title="Top Counties"
          subtitle="Where records are concentrated"
          icon={<MapPin className="h-4 w-4 text-emerald-600" />}
        >
          {analytics.topCounties.length === 0 ? (
            <Empty label="No locality data" />
          ) : (
            <div className="space-y-2 mt-1">
              {analytics.topCounties.map(c => {
                const p = pct(c.value, Math.max(...analytics.topCounties.map(x => x.value), 1));
                return (
                  <div key={c.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
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

        <Card
          title="Verification Snapshot"
          subtitle="Government identity checks"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        >
          <div className="space-y-3 mt-1">
            <VerifyRow label="National ID Verified" done={analytics.idVerified} total={analytics.total} color="#059669" />
            <VerifyRow label="KRA PIN Verified" done={analytics.kraVerified} total={analytics.total} color="#2563eb" />
            {variant === 'riders' ? (
              <VerifyRow label="Driving License Verified" done={analytics.licenseVerified} total={analytics.total} color="#f59e0b" />
            ) : (
              <VerifyRow label="Phone (OTP) Verified" done={analytics.otpVerified} total={analytics.total} color="#f59e0b" />
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Records failing all three checks may need admin follow-up.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

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

function CompletionBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const p = pct(count, total);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="text-slate-500">{count} · {p}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
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
