import { useEffect, useMemo, useState } from 'react';
import {
  Search as SearchIcon,
  User,
  Bike,
  CircleUser as UserCircle,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  X,
  Clock,
  History,
  TrendingUp,
  Fingerprint,
  MapPin,
  Phone,
  CreditCard,
  Loader2,
  ArrowRight,
  Radio,
} from 'lucide-react';
import {
  supabase,
  type PoliceOfficerWithStation,
  type Owner,
  type Rider,
  type Motorcycle,
} from '../../lib/supabase';
import { PoliceAuthService } from '../../lib/policeAuth';
import SearchProfilePage, { type ProfileEntity } from './SearchProfilePage';

type Props = { officer: PoliceOfficerWithStation };

type SearchResults = {
  owners: Owner[];
  riders: Rider[];
  motorcycles: Motorcycle[];
};

type RecordType = 'owner' | 'rider' | 'motorcycle';
type Filter = 'all' | RecordType;

type OverviewStats = {
  totalOwners: number;
  totalRiders: number;
  totalMotorcycles: number;
  compliantMotorcycles: number;
  verifiedRiders: number;
  outstandingFines: number;
  outstandingFinesAmount: number;
  mySearchesToday: number;
  myViewsToday: number;
};

type RecentSearch = {
  id: string;
  query: string;
  created_at: string;
};

export default function PoliceSearch({ officer }: Props) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [profileEntity, setProfileEntity] = useState<ProfileEntity | null>(null);
  const [profileInitialTab, setProfileInitialTab] = useState<'overview' | 'track'>('overview');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    void loadOverview();
    void loadRecentSearches();
  }, [officer.id]);

  const loadOverview = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    const [
      ownersRes,
      ridersRes,
      motorcyclesRes,
      compliantRes,
      verifiedRes,
      outstandingRes,
      mySearchRes,
      myViewsRes,
    ] = await Promise.all([
      supabase.from('owners').select('*', { count: 'exact', head: true }),
      supabase.from('riders').select('*', { count: 'exact', head: true }),
      supabase.from('motorcycles').select('*', { count: 'exact', head: true }),
      supabase.from('motorcycles').select('*', { count: 'exact', head: true }).eq('is_compliant', true),
      supabase.from('riders').select('*', { count: 'exact', head: true }).eq('license_verified', true),
      supabase.from('fines').select('fine_amount').in('status', ['issued', 'overdue']),
      supabase
        .from('police_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('officer_id', officer.id)
        .eq('action_type', 'search')
        .gte('created_at', startIso),
      supabase
        .from('police_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('officer_id', officer.id)
        .eq('action_type', 'view_record')
        .gte('created_at', startIso),
    ]);

    const outstandingAmount = (outstandingRes.data ?? []).reduce(
      (sum: number, f: { fine_amount: number }) => sum + Number(f.fine_amount || 0),
      0,
    );

    setStats({
      totalOwners: ownersRes.count ?? 0,
      totalRiders: ridersRes.count ?? 0,
      totalMotorcycles: motorcyclesRes.count ?? 0,
      compliantMotorcycles: compliantRes.count ?? 0,
      verifiedRiders: verifiedRes.count ?? 0,
      outstandingFines: (outstandingRes.data ?? []).length,
      outstandingFinesAmount: outstandingAmount,
      mySearchesToday: mySearchRes.count ?? 0,
      myViewsToday: myViewsRes.count ?? 0,
    });
  };

  const loadRecentSearches = async () => {
    const { data } = await supabase
      .from('police_activity_logs')
      .select('id, details, created_at')
      .eq('officer_id', officer.id)
      .eq('action_type', 'search')
      .order('created_at', { ascending: false })
      .limit(8);

    const uniques = new Map<string, RecentSearch>();
    (data ?? []).forEach((row: any) => {
      const q = row?.details?.query;
      if (typeof q !== 'string' || !q.trim()) return;
      if (!uniques.has(q)) {
        uniques.set(q, { id: row.id, query: q, created_at: row.created_at });
      }
    });
    setRecentSearches(Array.from(uniques.values()).slice(0, 6));
  };

  const runSearch = async (input: string) => {
    const q = input.trim();
    if (!q) return;
    setQuery(q);
    setSearching(true);
    setResults(null);

    const [ownersRes, ridersRes, motorcyclesRes] = await Promise.all([
      supabase
        .from('owners')
        .select('*')
        .or(`national_id.eq.${q},phone_number.eq.${q},full_name.ilike.%${q}%`)
        .limit(15),
      supabase
        .from('riders')
        .select('*')
        .or(`id_number.eq.${q},phone_number.eq.${q},bms_id.eq.${q},name.ilike.%${q}%`)
        .limit(15),
      supabase
        .from('motorcycles')
        .select('*')
        .or(`registration_number.ilike.%${q}%,tracking_device_id.eq.${q}`)
        .limit(15),
    ]);

    setResults({
      owners: ownersRes.data ?? [],
      riders: ridersRes.data ?? [],
      motorcycles: motorcyclesRes.data ?? [],
    });

    await PoliceAuthService.logActivity(officer.id, 'search', null, null, { query: q });
    void loadRecentSearches();
    void loadOverview();
    setSearching(false);
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    void runSearch(query);
  };

  const viewRecord = async (type: RecordType, data: any, options?: { tab?: 'overview' | 'track' }) => {
    setProfileInitialTab(options?.tab ?? 'overview');
    setProfileEntity({ kind: type, id: data.id });
    await PoliceAuthService.logActivity(officer.id, 'view_record', type, data.id);
    if (options?.tab === 'track') {
      await PoliceAuthService.logActivity(
        officer.id,
        'track_motorcycle',
        'motorcycle',
        data.id,
        { source: 'search_results' },
      );
    }
    void loadOverview();
  };

  const totalResults = results
    ? results.owners.length + results.riders.length + results.motorcycles.length
    : 0;

  const filteredResults = useMemo(() => {
    if (!results) return null;
    if (filter === 'all') return results;
    return {
      owners: filter === 'owner' ? results.owners : [],
      riders: filter === 'rider' ? results.riders : [],
      motorcycles: filter === 'motorcycle' ? results.motorcycles : [],
    };
  }, [results, filter]);

  const compliancePct = stats && stats.totalMotorcycles
    ? Math.round((stats.compliantMotorcycles / stats.totalMotorcycles) * 100)
    : 0;
  const licensedPct = stats && stats.totalRiders
    ? Math.round((stats.verifiedRiders / stats.totalRiders) * 100)
    : 0;

  if (profileEntity) {
    return (
      <SearchProfilePage
        entity={profileEntity}
        initialTab={profileInitialTab}
        onBack={() => setProfileEntity(null)}
        onNavigate={async (next) => {
          setProfileInitialTab('overview');
          setProfileEntity(next);
          await PoliceAuthService.logActivity(officer.id, 'view_record', next.kind, next.id);
          void loadOverview();
        }}
        onTrack={async (motorcycleId) => {
          await PoliceAuthService.logActivity(
            officer.id,
            'track_motorcycle',
            'motorcycle',
            motorcycleId,
            { source: 'search_profile' },
          );
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <SearchIcon className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Records Search</h2>
            <p className="text-sm text-slate-500">
              National lookup for riders, owners, motorcycles, and fines.
              {officer.station?.station_name && (
                <span className="text-slate-600"> · {officer.station.station_name}</span>
              )}
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] font-medium text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          All searches are logged for audit
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HeroCard
          tone="emerald"
          label="Registered Riders"
          value={stats ? stats.totalRiders.toLocaleString() : '—'}
          sub={stats ? `${licensedPct}% licensed` : ' '}
          icon={<User className="h-4 w-4" />}
        />
        <HeroCard
          label="Motorcycles"
          value={stats ? stats.totalMotorcycles.toLocaleString() : '—'}
          sub={stats ? `${compliancePct}% compliant` : ' '}
          icon={<Bike className="h-4 w-4" />}
        />
        <HeroCard
          label="Owners"
          value={stats ? stats.totalOwners.toLocaleString() : '—'}
          sub="Registered accounts"
          icon={<UserCircle className="h-4 w-4" />}
        />
        <HeroCard
          tone="amber"
          label="Outstanding Fines"
          value={stats ? stats.outstandingFines.toLocaleString() : '—'}
          sub={stats ? `KES ${stats.outstandingFinesAmount.toLocaleString()}` : ' '}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <HeroCard
          label="My Searches Today"
          value={stats ? stats.mySearchesToday.toLocaleString() : '—'}
          sub="Logged for audit"
          icon={<History className="h-4 w-4" />}
        />
        <HeroCard
          label="Records Viewed Today"
          value={stats ? stats.myViewsToday.toLocaleString() : '—'}
          sub="Detail lookups"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Registration number, national ID, phone, BMS ID, tracker, or name..."
              className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </>
            ) : (
              <>
                <SearchIcon className="h-4 w-4" /> Search records
              </>
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: 'All', icon: null },
            { key: 'owner', label: 'Owners', icon: <UserCircle className="h-3.5 w-3.5" /> },
            { key: 'rider', label: 'Riders', icon: <User className="h-3.5 w-3.5" /> },
            { key: 'motorcycle', label: 'Motorcycles', icon: <Bike className="h-3.5 w-3.5" /> },
          ].map((f) => {
            const active = filter === (f.key as Filter);
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as Filter)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  active
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <Fingerprint className="h-3 w-3" />
          Tip:
          <span className="font-mono text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">KDA 123X</span>
          <span className="font-mono text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">32145678</span>
          <span className="font-mono text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">0712345678</span>
          <span className="font-mono text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">BMS-000123</span>
        </div>
      </div>

      {!results && recentSearches.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">Your recent searches</h3>
            </div>
            <span className="text-[11px] text-slate-400">Last 24 hours</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((r) => (
              <button
                key={r.id}
                onClick={() => runSearch(r.query)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700"
              >
                <SearchIcon className="h-3 w-3 text-slate-400" />
                {r.query}
                <ArrowRight className="h-3 w-3 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{totalResults}</span>{' '}
              result{totalResults !== 1 ? 's' : ''} for{' '}
              <span className="font-mono bg-slate-100 rounded px-1.5 py-0.5">{query}</span>
            </p>
            {totalResults > 0 && (
              <button
                onClick={() => {
                  setResults(null);
                  setQuery('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear results
              </button>
            )}
          </div>

          {totalResults === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <SearchIcon className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No matches found</p>
              <p className="text-xs text-slate-500">Check the spelling or try a different identifier.</p>
            </div>
          )}

          {filteredResults && filteredResults.owners.length > 0 && (
            <ResultGroup
              icon={<UserCircle className="h-4 w-4" />}
              title="Owners"
              count={filteredResults.owners.length}
              accent="emerald"
            >
              {filteredResults.owners.map((owner) => (
                <OwnerRow key={owner.id} owner={owner} onOpen={() => viewRecord('owner', owner)} />
              ))}
            </ResultGroup>
          )}

          {filteredResults && filteredResults.riders.length > 0 && (
            <ResultGroup
              icon={<User className="h-4 w-4" />}
              title="Riders"
              count={filteredResults.riders.length}
              accent="blue"
            >
              {filteredResults.riders.map((rider) => (
                <RiderRow key={rider.id} rider={rider} onOpen={() => viewRecord('rider', rider)} />
              ))}
            </ResultGroup>
          )}

          {filteredResults && filteredResults.motorcycles.length > 0 && (
            <ResultGroup
              icon={<Bike className="h-4 w-4" />}
              title="Motorcycles"
              count={filteredResults.motorcycles.length}
              accent="amber"
            >
              {filteredResults.motorcycles.map((moto) => (
                <MotorcycleRow
                  key={moto.id}
                  moto={moto}
                  onOpen={() => viewRecord('motorcycle', moto)}
                  onTrack={() => viewRecord('motorcycle', moto, { tab: 'track' })}
                />
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function HeroCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'emerald' | 'amber';
}) {
  const styles = {
    default: {
      card: 'bg-white border border-slate-200',
      icon: 'bg-slate-100 text-slate-700',
      label: 'text-slate-500',
      value: 'text-slate-900',
      sub: 'text-slate-500',
    },
    emerald: {
      card: 'bg-gradient-to-br from-emerald-600 to-emerald-700 border border-emerald-700 text-white',
      icon: 'bg-white/20 text-white',
      label: 'text-emerald-50/80',
      value: 'text-white',
      sub: 'text-emerald-50/90',
    },
    amber: {
      card: 'bg-white border border-amber-200',
      icon: 'bg-amber-100 text-amber-700',
      label: 'text-slate-500',
      value: 'text-slate-900',
      sub: 'text-amber-700',
    },
  }[tone];

  return (
    <div className={`rounded-2xl ${styles.card} p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] uppercase tracking-wider font-semibold ${styles.label}`}>{label}</p>
        <div className={`h-7 w-7 rounded-lg ${styles.icon} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className={`mt-2 text-2xl font-bold ${styles.value}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${styles.sub}`}>{sub}</p>}
    </div>
  );
}

function ResultGroup({
  icon,
  title,
  count,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accent: 'emerald' | 'blue' | 'amber';
  children: React.ReactNode;
}) {
  const dot = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
  }[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {icon}
          {title}
        </div>
        <span className="text-[11px] font-medium text-slate-500">{count} record{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function OwnerRow({ owner, onOpen }: { owner: Owner; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center justify-between gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{owner.full_name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" />{owner.national_id}</span>
          {owner.phone_number && (
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{owner.phone_number}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {owner.id_verified ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
            <ShieldCheck className="h-3 w-3" /> ID Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            <ShieldAlert className="h-3 w-3" /> Unverified
          </span>
        )}
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  );
}

function RiderRow({ rider, onOpen }: { rider: Rider; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center justify-between gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{rider.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" />{rider.id_number}</span>
          {rider.phone_number && (
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{rider.phone_number}</span>
          )}
          {rider.bms_id && (
            <span className="font-mono text-slate-500">BMS {rider.bms_id}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {rider.license_verified && (
          <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Licensed</span>
        )}
        {rider.id_verified && (
          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">ID</span>
        )}
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  );
}

function MotorcycleRow({ moto, onOpen, onTrack }: { moto: Motorcycle; onOpen: () => void; onTrack: () => void }) {
  return (
    <div className="w-full px-5 py-3 hover:bg-slate-50 flex items-center justify-between gap-4">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold text-slate-900 font-mono truncate">{moto.registration_number}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span>{[moto.make, moto.model].filter(Boolean).join(' ') || 'Unknown model'}</span>
          {moto.insurance_provider && <span>Ins: {moto.insurance_provider}</span>}
          {moto.tracking_device_id && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />Tracked</span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1.5 shrink-0">
        {moto.is_compliant ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
            <ShieldCheck className="h-3 w-3" /> Compliant
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            <ShieldAlert className="h-3 w-3" /> Non-compliant
          </span>
        )}
        {moto.tracking_device_id && (
          <button
            onClick={onTrack}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-full transition"
            title="Open live tracking"
          >
            <Radio className="h-3 w-3" /> Track
          </button>
        )}
        <button onClick={onOpen} className="p-1 rounded-md hover:bg-slate-100" title="Open profile">
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
