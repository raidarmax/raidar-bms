import { useEffect, useMemo, useState } from 'react';
import {
  Map as MapIcon,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpDown,
  Search,
  Trophy,
  Timer,
  Layers,
  Flame,
  MapPin,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Building2,
  Filter,
  LayoutGrid,
  Focus,
  BarChart2,
  Calendar,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadGoogleMaps, createCircleIcon } from '../lib/googleMaps';
import { useRef } from 'react';

type IncidentRow = {
  id: string;
  status: string;
  police_status: string | null;
  incident_type: string;
  county_id: number | null;
  constituency_id: number | null;
  ward_id: number | null;
  assigned_station_id: string | null;
  created_at: string;
  police_responded_at: string | null;
};

type County = { id: number; county_code: number; county_name: string; latitude: number | null; longitude: number | null };
type Constituency = { id: number; constituency_name: string; county_id: number };
type Ward = { id: number; ward_name: string; constituency_id: number };
type Station = { id: string; station_name: string; county_id: number | null };

type CountyAggregate = {
  county: County;
  total: number;
  pending: number;
  confirmed: number;
  resolved: number;
  ignored: number;
  avgResponseHours: number | null;
  topCategory: string | null;
  topCategoryCount: number;
  last30Days: number;
  categoryCounts: Record<string, number>;
};

type DrillRow = {
  id: number;
  name: string;
  subtitle?: string;
  total: number;
  pending: number;
  confirmed: number;
  resolved: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  accident: 'Accidents',
  theft: 'Theft',
  crime: 'Crime',
  traffic_violation: 'Traffic',
  speeding: 'Speeding',
  no_helmet: 'No Helmet',
  overloading: 'Overloading',
  reckless_driving: 'Reckless',
  harassment: 'Harassment',
  other: 'Other',
};

type SortKey = 'total' | 'pending' | 'resolved' | 'rate' | 'response' | 'recent' | 'name';
type DrillLevel = 'county' | 'constituency' | 'ward';

export default function CountyIncidentsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedCountyId, setSelectedCountyId] = useState<number | null>(null);
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('county');
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'byCounty'>('overview');
  const [focusCountyId, setFocusCountyId] = useState<number | null>(null);
  const [countyFilterQuery, setCountyFilterQuery] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        incRes,
        countyRes,
        constRes,
        wardRes,
        stationRes,
      ] = await Promise.all([
        supabase
          .from('incidents')
          .select('id, status, police_status, incident_type, county_id, constituency_id, ward_id, assigned_station_id, created_at, police_responded_at'),
        supabase.from('kenya_counties').select('id, county_code, county_name, latitude, longitude').order('county_name'),
        supabase.from('kenya_constituencies').select('id, constituency_name, county_id'),
        supabase.from('kenya_wards').select('id, ward_name, constituency_id'),
        supabase.from('police_stations').select('id, station_name, county_id'),
      ]);

      setIncidents(incRes.data || []);
      setCounties(countyRes.data || []);
      setConstituencies(constRes.data || []);
      setWards(wardRes.data || []);
      setStations(stationRes.data || []);
    } catch (e) {
      console.error('Failed to load county incidents:', e);
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const countyById = useMemo(() => new Map(counties.map(c => [c.id, c])), [counties]);
  const constituencyById = useMemo(() => new Map(constituencies.map(c => [c.id, c])), [constituencies]);
  const wardById = useMemo(() => new Map(wards.map(w => [w.id, w])), [wards]);
  const stationById = useMemo(() => new Map(stations.map(s => [s.id, s])), [stations]);

  const aggregates: CountyAggregate[] = useMemo(() => {
    const map = new Map<number, CountyAggregate>();
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const c of counties) {
      map.set(c.id, {
        county: c,
        total: 0,
        pending: 0,
        confirmed: 0,
        resolved: 0,
        ignored: 0,
        avgResponseHours: null,
        topCategory: null,
        topCategoryCount: 0,
        last30Days: 0,
        categoryCounts: {},
      });
    }

    const responseByCounty = new Map<number, number[]>();

    for (const inc of incidents) {
      let cid = inc.county_id;
      if (!cid && inc.assigned_station_id) {
        const st = stationById.get(inc.assigned_station_id);
        if (st?.county_id) cid = st.county_id;
      }
      if (!cid) continue;
      const agg = map.get(cid);
      if (!agg) continue;
      agg.total++;

      if (inc.status === 'pending') agg.pending++;
      else if (inc.status === 'confirmed') agg.confirmed++;
      else if (inc.status === 'resolved') agg.resolved++;
      else if (inc.status === 'ignored') agg.ignored++;

      const cat = inc.incident_type || 'other';
      agg.categoryCounts[cat] = (agg.categoryCounts[cat] || 0) + 1;

      if (new Date(inc.created_at).getTime() >= thirtyDaysAgo) {
        agg.last30Days++;
      }

      if (inc.police_responded_at && inc.created_at) {
        const diff =
          new Date(inc.police_responded_at).getTime() - new Date(inc.created_at).getTime();
        if (diff > 0) {
          const arr = responseByCounty.get(cid) ?? [];
          arr.push(diff / (1000 * 60 * 60));
          responseByCounty.set(cid, arr);
        }
      }
    }

    for (const agg of map.values()) {
      let topCat: string | null = null;
      let topCount = 0;
      for (const [cat, n] of Object.entries(agg.categoryCounts)) {
        if (n > topCount) {
          topCount = n;
          topCat = cat;
        }
      }
      agg.topCategory = topCat;
      agg.topCategoryCount = topCount;

      const times = responseByCounty.get(agg.county.id);
      if (times && times.length) {
        agg.avgResponseHours = times.reduce((s, t) => s + t, 0) / times.length;
      }
    }

    return Array.from(map.values()).filter(a => a.total > 0);
  }, [incidents, counties, stationById]);

  const filteredSortedAgg = useMemo(() => {
    let rows = aggregates;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(a => a.county.county_name.toLowerCase().includes(q));
    }
    const sorted = [...rows].sort((a, b) => {
      const rateA = a.total ? (a.resolved / a.total) * 100 : 0;
      const rateB = b.total ? (b.resolved / b.total) * 100 : 0;
      let cmp = 0;
      switch (sortKey) {
        case 'total': cmp = a.total - b.total; break;
        case 'pending': cmp = a.pending - b.pending; break;
        case 'resolved': cmp = a.resolved - b.resolved; break;
        case 'rate': cmp = rateA - rateB; break;
        case 'response':
          cmp = (a.avgResponseHours ?? Number.MAX_SAFE_INTEGER) - (b.avgResponseHours ?? Number.MAX_SAFE_INTEGER);
          break;
        case 'recent': cmp = a.last30Days - b.last30Days; break;
        case 'name': cmp = a.county.county_name.localeCompare(b.county.county_name); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [aggregates, searchQuery, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const totalIncidents = aggregates.reduce((s, a) => s + a.total, 0);
    const totalResolved = aggregates.reduce((s, a) => s + a.resolved, 0);
    const totalPending = aggregates.reduce((s, a) => s + a.pending, 0);
    const active = aggregates.length;
    const topCounty = aggregates.slice().sort((a, b) => b.total - a.total)[0] || null;
    const worst = aggregates
      .filter(a => a.total >= 3)
      .sort((a, b) => a.resolved / a.total - b.resolved / b.total)[0] || null;
    const withResponse = aggregates.filter(a => a.avgResponseHours != null);
    const avgResponse = withResponse.length
      ? withResponse.reduce((s, a) => s + (a.avgResponseHours || 0), 0) / withResponse.length
      : null;
    const hotspot = aggregates.slice().sort((a, b) => b.last30Days - a.last30Days)[0] || null;
    return {
      totalIncidents,
      totalResolved,
      totalPending,
      active,
      topCounty,
      worst,
      avgResponse,
      hotspot,
      resolutionRate: totalIncidents > 0 ? Math.round((totalResolved / totalIncidents) * 100) : 0,
    };
  }, [aggregates]);

  const selectedAgg = useMemo(() => {
    if (!selectedCountyId) return null;
    return aggregates.find(a => a.county.id === selectedCountyId) || null;
  }, [selectedCountyId, aggregates]);

  const topCategoriesInSelected = useMemo(() => {
    if (!selectedAgg) return [];
    return Object.entries(selectedAgg.categoryCounts)
      .map(([cat, n]) => ({ cat, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [selectedAgg]);

  const drillRows: DrillRow[] = useMemo(() => {
    if (drillLevel === 'county') {
      return aggregates.map(a => ({
        id: a.county.id,
        name: a.county.county_name,
        total: a.total,
        pending: a.pending,
        confirmed: a.confirmed,
        resolved: a.resolved,
      }));
    }

    if (drillLevel === 'constituency') {
      const map = new Map<number, DrillRow>();
      for (const inc of incidents) {
        let matchesCounty = true;
        if (selectedCountyId) {
          let cid = inc.county_id;
          if (!cid && inc.assigned_station_id) {
            const st = stationById.get(inc.assigned_station_id);
            if (st?.county_id) cid = st.county_id;
          }
          matchesCounty = cid === selectedCountyId;
        }
        if (!matchesCounty || !inc.constituency_id) continue;
        const con = constituencyById.get(inc.constituency_id);
        if (!con) continue;
        const county = countyById.get(con.county_id);
        const existing = map.get(con.id) ?? {
          id: con.id,
          name: con.constituency_name,
          subtitle: county?.county_name,
          total: 0,
          pending: 0,
          confirmed: 0,
          resolved: 0,
        };
        existing.total++;
        if (inc.status === 'pending') existing.pending++;
        else if (inc.status === 'confirmed') existing.confirmed++;
        else if (inc.status === 'resolved') existing.resolved++;
        map.set(con.id, existing);
      }
      return Array.from(map.values());
    }

    const map = new Map<number, DrillRow>();
    for (const inc of incidents) {
      let matches = true;
      if (selectedConstituencyId) matches = inc.constituency_id === selectedConstituencyId;
      else if (selectedCountyId) {
        let cid = inc.county_id;
        if (!cid && inc.assigned_station_id) {
          const st = stationById.get(inc.assigned_station_id);
          if (st?.county_id) cid = st.county_id;
        }
        matches = cid === selectedCountyId;
      }
      if (!matches || !inc.ward_id) continue;
      const w = wardById.get(inc.ward_id);
      if (!w) continue;
      const con = constituencyById.get(w.constituency_id);
      const existing = map.get(w.id) ?? {
        id: w.id,
        name: w.ward_name,
        subtitle: con?.constituency_name,
        total: 0,
        pending: 0,
        confirmed: 0,
        resolved: 0,
      };
      existing.total++;
      if (inc.status === 'pending') existing.pending++;
      else if (inc.status === 'confirmed') existing.confirmed++;
      else if (inc.status === 'resolved') existing.resolved++;
      map.set(w.id, existing);
    }
    return Array.from(map.values());
  }, [drillLevel, aggregates, incidents, selectedCountyId, selectedConstituencyId, stationById, countyById, constituencyById, wardById]);

  const sortedDrill = useMemo(() => drillRows.slice().sort((a, b) => b.total - a.total), [drillRows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const maxTotal = Math.max(1, ...aggregates.map(a => a.total));
  const maxDrill = Math.max(1, ...sortedDrill.map(r => r.total));

  const formatHours = (h: number | null) => {
    if (h == null) return 'N/A';
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${h.toFixed(1)}h`;
    return `${(h / 24).toFixed(1)}d`;
  };

  const resolutionColor = (rate: number) => {
    if (rate >= 75) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (rate >= 40) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const handleDrillClick = (row: DrillRow) => {
    if (drillLevel === 'county') {
      setSelectedCountyId(row.id);
      setSelectedConstituencyId(null);
      setDrillLevel('constituency');
    } else if (drillLevel === 'constituency') {
      setSelectedConstituencyId(row.id);
      setDrillLevel('ward');
    }
  };

  const drillUp = () => {
    if (drillLevel === 'ward') {
      setSelectedConstituencyId(null);
      setDrillLevel('constituency');
    } else if (drillLevel === 'constituency') {
      setSelectedCountyId(null);
      setDrillLevel('county');
    }
  };

  const resetDrill = () => {
    setSelectedCountyId(null);
    setSelectedConstituencyId(null);
    setDrillLevel('county');
  };

  const selectedCountyObj = selectedCountyId ? countyById.get(selectedCountyId) : null;
  const selectedConstituencyObj = selectedConstituencyId ? constituencyById.get(selectedConstituencyId) : null;

  const totalWithGeo = useMemo(() => {
    return incidents.filter(i => {
      if (i.county_id) return true;
      if (i.assigned_station_id) {
        const s = stationById.get(i.assigned_station_id);
        return !!s?.county_id;
      }
      return false;
    }).length;
  }, [incidents, stationById]);

  const focusCountyData = useMemo(() => {
    if (!focusCountyId) return null;
    const county = countyById.get(focusCountyId);
    if (!county) return null;

    const countyIncidents = incidents.filter(i => {
      if (i.county_id === focusCountyId) return true;
      if (!i.county_id && i.assigned_station_id) {
        const s = stationById.get(i.assigned_station_id);
        return s?.county_id === focusCountyId;
      }
      return false;
    });

    const total = countyIncidents.length;
    const pending = countyIncidents.filter(i => i.status === 'pending').length;
    const confirmed = countyIncidents.filter(i => i.status === 'confirmed').length;
    const resolved = countyIncidents.filter(i => i.status === 'resolved').length;
    const ignored = countyIncidents.filter(i => i.status === 'ignored').length;

    const responseTimes: number[] = [];
    for (const inc of countyIncidents) {
      if (inc.police_responded_at && inc.created_at) {
        const diff =
          new Date(inc.police_responded_at).getTime() - new Date(inc.created_at).getTime();
        if (diff > 0) responseTimes.push(diff / (1000 * 60 * 60));
      }
    }
    const avgResponseHours = responseTimes.length
      ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
      : null;

    const categoryCounts: Record<string, number> = {};
    for (const inc of countyIncidents) {
      const cat = inc.incident_type || 'other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const categories = Object.entries(categoryCounts)
      .map(([cat, n]) => ({ cat, n }))
      .sort((a, b) => b.n - a.n);

    const constituencyMap = new Map<number, DrillRow>();
    for (const inc of countyIncidents) {
      if (!inc.constituency_id) continue;
      const con = constituencyById.get(inc.constituency_id);
      if (!con) continue;
      const existing = constituencyMap.get(con.id) ?? {
        id: con.id,
        name: con.constituency_name,
        total: 0,
        pending: 0,
        confirmed: 0,
        resolved: 0,
      };
      existing.total++;
      if (inc.status === 'pending') existing.pending++;
      else if (inc.status === 'confirmed') existing.confirmed++;
      else if (inc.status === 'resolved') existing.resolved++;
      constituencyMap.set(con.id, existing);
    }
    const constituenciesList = Array.from(constituencyMap.values()).sort((a, b) => b.total - a.total);

    const wardMap = new Map<number, DrillRow>();
    for (const inc of countyIncidents) {
      if (!inc.ward_id) continue;
      const w = wardById.get(inc.ward_id);
      if (!w) continue;
      const con = constituencyById.get(w.constituency_id);
      const existing = wardMap.get(w.id) ?? {
        id: w.id,
        name: w.ward_name,
        subtitle: con?.constituency_name,
        total: 0,
        pending: 0,
        confirmed: 0,
        resolved: 0,
      };
      existing.total++;
      if (inc.status === 'pending') existing.pending++;
      else if (inc.status === 'confirmed') existing.confirmed++;
      else if (inc.status === 'resolved') existing.resolved++;
      wardMap.set(w.id, existing);
    }
    const wardsList = Array.from(wardMap.values()).sort((a, b) => b.total - a.total);

    const stationMap = new Map<string, { id: string; name: string; total: number; resolved: number; pending: number }>();
    for (const inc of countyIncidents) {
      if (!inc.assigned_station_id) continue;
      const s = stationById.get(inc.assigned_station_id);
      if (!s) continue;
      const existing = stationMap.get(s.id) ?? { id: s.id, name: s.station_name, total: 0, resolved: 0, pending: 0 };
      existing.total++;
      if (inc.status === 'resolved') existing.resolved++;
      else if (inc.status === 'pending') existing.pending++;
      stationMap.set(s.id, existing);
    }
    const stationsList = Array.from(stationMap.values()).sort((a, b) => b.total - a.total);

    const now = new Date();
    const monthly: { label: string; total: number; resolved: number; pending: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const monthIncidents = countyIncidents.filter(inc => {
        const t = new Date(inc.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      monthly.push({
        label,
        total: monthIncidents.length,
        resolved: monthIncidents.filter(x => x.status === 'resolved').length,
        pending: monthIncidents.filter(x => x.status === 'pending').length,
      });
    }

    const last30Ms = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const last30Days = countyIncidents.filter(i => new Date(i.created_at).getTime() >= last30Ms).length;
    const prev30Days = countyIncidents.filter(i => {
      const t = new Date(i.created_at).getTime();
      return t >= last30Ms - 30 * 24 * 60 * 60 * 1000 && t < last30Ms;
    }).length;
    const trend = prev30Days > 0 ? Math.round(((last30Days - prev30Days) / prev30Days) * 100) : null;

    return {
      county,
      total,
      pending,
      confirmed,
      resolved,
      ignored,
      avgResponseHours,
      categories,
      constituencies: constituenciesList,
      wards: wardsList,
      stations: stationsList,
      monthly,
      last30Days,
      trend,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    };
  }, [focusCountyId, incidents, countyById, constituencyById, wardById, stationById]);

  const filteredCountyOptions = useMemo(() => {
    const q = countyFilterQuery.trim().toLowerCase();
    return counties
      .filter(c => aggregates.some(a => a.county.id === c.id))
      .filter(c => !q || c.county_name.toLowerCase().includes(q))
      .sort((a, b) => a.county_name.localeCompare(b.county_name));
  }, [counties, aggregates, countyFilterQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        <span className="ml-3 text-sm text-slate-600">Loading geography analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Failed to load geography data</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={load}
              className="mt-3 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (aggregates.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <MapIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-700 font-medium">No county-linked incidents yet</p>
        <p className="text-sm text-slate-500 mt-1">
          Assign incidents to a police station to auto-tag them by county.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* View mode toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex bg-slate-100 border border-slate-200 rounded-lg p-1 self-start">
          <button
            onClick={() => setViewMode('overview')}
            className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'overview'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            All Counties
          </button>
          <button
            onClick={() => setViewMode('byCounty')}
            className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'byCounty'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Focus className="h-3.5 w-3.5" />
            By County
          </button>
        </div>

        {viewMode === 'byCounty' && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={focusCountyId ?? ''}
                onChange={(e) => setFocusCountyId(e.target.value ? Number(e.target.value) : null)}
                className="pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[220px] appearance-none bg-white"
              >
                <option value="">Select a county...</option>
                {filteredCountyOptions.map(c => {
                  const agg = aggregates.find(a => a.county.id === c.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.county_name}{agg ? ` (${agg.total})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            {focusCountyId && (
              <button
                onClick={() => setFocusCountyId(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Clear filter"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {viewMode === 'byCounty' ? (
        <CountyFocusView
          data={focusCountyData}
          formatHours={formatHours}
          countyOptions={filteredCountyOptions}
          countyFilterQuery={countyFilterQuery}
          setCountyFilterQuery={setCountyFilterQuery}
          onSelectCounty={setFocusCountyId}
          allAggregates={aggregates}
        />
      ) : (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <MapIcon className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
              Counties
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">{kpis.active}</p>
          <p className="text-xs opacity-90 mt-0.5">of {counties.length} tracked</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <CheckCircle className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
              Resolution
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">{kpis.resolutionRate}%</p>
          <p className="text-xs opacity-90 mt-0.5">
            {kpis.totalResolved.toLocaleString()} of {kpis.totalIncidents.toLocaleString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <Clock className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
              Pending
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">{kpis.totalPending.toLocaleString()}</p>
          <p className="text-xs opacity-90 mt-0.5">awaiting action</p>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <Timer className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
              Avg Response
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">{formatHours(kpis.avgResponse)}</p>
          <p className="text-xs opacity-90 mt-0.5">across counties</p>
        </div>
      </div>

      {/* Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {kpis.topCounty && (
          <button
            onClick={() => { setSelectedCountyId(kpis.topCounty!.county.id); setDrillLevel('county'); }}
            className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              Highest Volume
            </div>
            <p className="text-lg font-bold text-slate-900 mt-1.5">
              {kpis.topCounty.county.county_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {kpis.topCounty.total.toLocaleString()} incidents
            </p>
          </button>
        )}

        {kpis.hotspot && kpis.hotspot.last30Days > 0 && (
          <button
            onClick={() => { setSelectedCountyId(kpis.hotspot!.county.id); setDrillLevel('county'); }}
            className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-red-300 hover:shadow-sm transition"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Flame className="h-3.5 w-3.5 text-red-500" />
              30-Day Hotspot
            </div>
            <p className="text-lg font-bold text-slate-900 mt-1.5">
              {kpis.hotspot.county.county_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {kpis.hotspot.last30Days} incidents in last 30 days
            </p>
          </button>
        )}

        {kpis.worst && (
          <button
            onClick={() => { setSelectedCountyId(kpis.worst!.county.id); setDrillLevel('county'); }}
            className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300 hover:shadow-sm transition"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Needs Attention
            </div>
            <p className="text-lg font-bold text-slate-900 mt-1.5">
              {kpis.worst.county.county_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {Math.round((kpis.worst.resolved / kpis.worst.total) * 100)}% resolved -
              {' '}{kpis.worst.pending} pending
            </p>
          </button>
        )}
      </div>

      {/* Incidents Distribution Map */}
      <IncidentsDistributionMap
        aggregates={aggregates.map(a => ({
          county: a.county,
          total: a.total,
          pending: a.pending,
          investigating: a.confirmed,
          resolved: a.resolved,
          severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
        }))}
        maxTotal={maxTotal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top counties bar chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Top 10 Counties by Incident Volume
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Stacked breakdown by status. Tap to inspect a county.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {aggregates
              .slice()
              .sort((a, b) => b.total - a.total)
              .slice(0, 10)
              .map((a, i) => {
                const width = (a.total / maxTotal) * 100;
                const rate = a.total ? Math.round((a.resolved / a.total) * 100) : 0;
                const isSelected = selectedCountyId === a.county.id;
                return (
                  <button
                    key={a.county.id}
                    onClick={() => { setSelectedCountyId(a.county.id); setDrillLevel('county'); }}
                    className={`w-full text-left rounded-lg p-2 transition-colors border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                          i === 0
                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                            : i === 1
                            ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white'
                            : i === 2
                            ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {a.county.county_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">{rate}% resolved</span>
                            <span className="font-bold text-slate-900">{a.total}</span>
                          </div>
                        </div>
                        <div
                          className="flex h-2 bg-slate-100 rounded-full overflow-hidden"
                          style={{ width: `${Math.max(width, 8)}%` }}
                        >
                          {a.resolved > 0 && (
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${(a.resolved / a.total) * 100}%` }}
                              title={`${a.resolved} resolved`}
                            />
                          )}
                          {a.confirmed > 0 && (
                            <div
                              className="h-full bg-red-500"
                              style={{ width: `${(a.confirmed / a.total) * 100}%` }}
                              title={`${a.confirmed} confirmed`}
                            />
                          )}
                          {a.pending > 0 && (
                            <div
                              className="h-full bg-amber-500"
                              style={{ width: `${(a.pending / a.total) * 100}%` }}
                              title={`${a.pending} pending`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-emerald-500" />
              Resolved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-red-500" />
              Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-amber-500" />
              Pending
            </span>
          </div>
        </div>

        {/* Selected county detail */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-blue-600" />
            County Detail
          </h3>
          {selectedAgg ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Selected</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedAgg.county.county_name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  County Code {selectedAgg.county.county_code.toString().padStart(3, '0')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-lg font-bold text-slate-900">{selectedAgg.total}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5">
                  <p className="text-xs text-emerald-700">Resolved</p>
                  <p className="text-lg font-bold text-emerald-700">{selectedAgg.resolved}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5">
                  <p className="text-xs text-amber-700">Pending</p>
                  <p className="text-lg font-bold text-amber-700">{selectedAgg.pending}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2.5">
                  <p className="text-xs text-red-700">Confirmed</p>
                  <p className="text-lg font-bold text-red-700">{selectedAgg.confirmed}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">Resolution Rate</span>
                  <span className="font-semibold text-slate-800">
                    {Math.round((selectedAgg.resolved / selectedAgg.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                    style={{
                      width: `${(selectedAgg.resolved / selectedAgg.total) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Avg response</span>
                  <span className="font-semibold text-slate-800">
                    {formatHours(selectedAgg.avgResponseHours)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Last 30 days</span>
                  <span className="font-semibold text-slate-800">
                    {selectedAgg.last30Days}
                  </span>
                </div>
              </div>

              {topCategoriesInSelected.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Top Categories
                  </p>
                  <div className="space-y-1.5">
                    {topCategoriesInSelected.map(({ cat, n }) => {
                      const pct = Math.round((n / selectedAgg.total) * 100);
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-slate-600">
                              {CATEGORY_LABEL[cat] || cat}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {n} <span className="text-slate-400 font-normal">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <MapIcon className="h-9 w-9 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">Select a county</p>
              <p className="text-xs text-slate-400 mt-1">
                Tap a bar, callout, or table row to see details.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Geographic drill-down */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-900">Geographic Drill-down</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Resolved</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500" />Confirmed</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500" />Pending</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {(['county', 'constituency', 'ward'] as DrillLevel[]).map(level => {
              const disabled =
                (level === 'constituency' && !selectedCountyId && drillLevel !== 'constituency') ||
                (level === 'ward' && !selectedConstituencyId && drillLevel !== 'ward');
              return (
                <button
                  key={level}
                  onClick={() => !disabled && setDrillLevel(level)}
                  disabled={disabled}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                    drillLevel === level
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          {(selectedCountyObj || selectedConstituencyObj) && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <button
                onClick={resetDrill}
                className="hover:text-slate-900 hover:underline transition-colors"
              >
                All Kenya
              </button>
              {selectedCountyObj && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <span className={selectedConstituencyObj ? '' : 'font-semibold text-slate-800'}>
                    {selectedCountyObj.county_name}
                  </span>
                </>
              )}
              {selectedConstituencyObj && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <span className="font-semibold text-slate-800">
                    {selectedConstituencyObj.constituency_name}
                  </span>
                </>
              )}
              <button
                onClick={drillUp}
                className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
            </div>
          )}
        </div>

        {sortedDrill.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-9 w-9 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">
              No {drillLevel} data in this scope
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {drillLevel !== 'county' && 'Try selecting a different area or drilling up.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedDrill.slice(0, 12).map((row, idx) => {
              const width = (row.total / maxDrill) * 100;
              const rate = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;
              const rateColor =
                rate >= 75 ? 'text-emerald-600' :
                rate >= 40 ? 'text-amber-600' : 'text-red-600';
              const actionable = drillLevel !== 'ward';
              return (
                <button
                  key={row.id}
                  onClick={() => actionable && handleDrillClick(row)}
                  className={`w-full text-left group rounded-lg p-2 transition-colors ${
                    actionable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' :
                      idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                      idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{row.name}</p>
                          {row.subtitle && (
                            <p className="text-[11px] text-slate-500 truncate">{row.subtitle}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold text-slate-800">{row.total}</span>
                          {actionable && (
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          )}
                        </div>
                      </div>
                      <div className="flex h-2 bg-slate-100 rounded-full overflow-hidden" style={{ width: `${Math.max(width, 15)}%` }}>
                        {row.resolved > 0 && (
                          <div className="h-full bg-emerald-500" style={{ width: `${(row.resolved / row.total) * 100}%` }} />
                        )}
                        {row.confirmed > 0 && (
                          <div className="h-full bg-red-500" style={{ width: `${(row.confirmed / row.total) * 100}%` }} />
                        )}
                        {row.pending > 0 && (
                          <div className="h-full bg-amber-500" style={{ width: `${(row.pending / row.total) * 100}%` }} />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span className={`font-semibold ${rateColor}`}>{rate}% resolved</span>
                        {row.pending > 0 && <span>{row.pending} pending</span>}
                        {row.confirmed > 0 && <span className="text-red-600">{row.confirmed} confirmed</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {sortedDrill.length > 12 && (
              <p className="text-xs text-slate-400 text-center pt-2">
                +{sortedDrill.length - 12} more not shown
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sortable county table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">County Comparison</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredSortedAgg.length} counties with incidents. Click a column to sort.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search county..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <SortHeader label="County" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                <SortHeader label="Total" align="right" active={sortKey === 'total'} dir={sortDir} onClick={() => toggleSort('total')} />
                <SortHeader label="Pending" align="right" active={sortKey === 'pending'} dir={sortDir} onClick={() => toggleSort('pending')} />
                <SortHeader label="Resolved" align="right" active={sortKey === 'resolved'} dir={sortDir} onClick={() => toggleSort('resolved')} />
                <SortHeader label="Rate" align="right" active={sortKey === 'rate'} dir={sortDir} onClick={() => toggleSort('rate')} />
                <SortHeader label="Avg Response" align="right" active={sortKey === 'response'} dir={sortDir} onClick={() => toggleSort('response')} />
                <SortHeader label="Last 30d" align="right" active={sortKey === 'recent'} dir={sortDir} onClick={() => toggleSort('recent')} />
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Top Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSortedAgg.map((a) => {
                const rate = Math.round((a.resolved / a.total) * 100);
                const isSelected = selectedCountyId === a.county.id;
                return (
                  <tr
                    key={a.county.id}
                    onClick={() => { setSelectedCountyId(a.county.id); setDrillLevel('county'); }}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium text-slate-900">{a.county.county_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {a.county.county_code.toString().padStart(3, '0')}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                      {a.total}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-amber-700 font-semibold">
                      {a.pending || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-emerald-700 font-semibold">
                      {a.resolved || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${resolutionColor(rate)}`}
                      >
                        {rate}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-slate-700 font-mono">
                      {formatHours(a.avgResponseHours)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm">
                      <span
                        className={`text-xs font-semibold ${
                          a.last30Days > 0 ? 'text-red-600' : 'text-slate-400'
                        }`}
                      >
                        {a.last30Days}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {a.topCategory ? (
                        <span className="text-xs text-slate-600">
                          {CATEGORY_LABEL[a.topCategory] || a.topCategory}
                          <span className="text-slate-400 ml-1">({a.topCategoryCount})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredSortedAgg.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    No counties match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data quality hint */}
      {incidents.length > 0 && totalWithGeo < incidents.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-800">
            <p className="font-semibold">
              {incidents.length - totalWithGeo} incident{incidents.length - totalWithGeo !== 1 ? 's' : ''} without location data
            </p>
            <p className="text-amber-700 text-xs mt-0.5">
              Assign these to a police station to auto-tag them with county, constituency, and ward.
            </p>
          </div>
        </div>
      )}

      {/* Coverage stat */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {stations.length.toLocaleString()} police stations mapped
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {constituencies.length.toLocaleString()} constituencies · {wards.length.toLocaleString()} wards
        </span>
      </div>
      </>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-slate-900 transition-colors ${
          active ? 'text-slate-900' : ''
        }`}
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${active ? 'text-blue-600' : 'text-slate-300'} ${
            active && dir === 'asc' ? 'rotate-180' : ''
          } transition-transform`}
        />
      </button>
    </th>
  );
}

type FocusData = {
  county: County;
  total: number;
  pending: number;
  confirmed: number;
  resolved: number;
  ignored: number;
  avgResponseHours: number | null;
  categories: { cat: string; n: number }[];
  constituencies: DrillRow[];
  wards: DrillRow[];
  stations: { id: string; name: string; total: number; resolved: number; pending: number }[];
  monthly: { label: string; total: number; resolved: number; pending: number }[];
  last30Days: number;
  trend: number | null;
  resolutionRate: number;
};

function CountyFocusView({
  data,
  formatHours,
  countyOptions,
  countyFilterQuery,
  setCountyFilterQuery,
  onSelectCounty,
  allAggregates,
}: {
  data: FocusData | null;
  formatHours: (h: number | null) => string;
  countyOptions: County[];
  countyFilterQuery: string;
  setCountyFilterQuery: (v: string) => void;
  onSelectCounty: (id: number | null) => void;
  allAggregates: CountyAggregate[];
}) {
  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-4">
            <Focus className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-700 font-semibold">Choose a county</p>
            <p className="text-sm text-slate-500 mt-1">
              Pick a county below to see focused incident analytics for that area.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={countyFilterQuery}
              onChange={(e) => setCountyFilterQuery(e.target.value)}
              placeholder="Search counties..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {countyOptions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No counties match.</p>
            ) : (
              countyOptions.map(c => {
                const agg = allAggregates.find(a => a.county.id === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectCounty(c.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.county_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Code {c.county_code.toString().padStart(3, '0')}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {agg?.total ?? 0}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  const maxMonthly = Math.max(1, ...data.monthly.map(m => m.total));
  const maxCat = Math.max(1, ...data.categories.map(c => c.n));
  const maxConstituency = Math.max(1, ...data.constituencies.map(c => c.total));
  const maxWard = Math.max(1, ...data.wards.map(w => w.total));
  const maxStation = Math.max(1, ...data.stations.map(s => s.total));

  const trendPositive = data.trend != null && data.trend > 0;
  const trendNegative = data.trend != null && data.trend < 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
              County Focus
            </p>
            <h2 className="text-2xl font-bold mt-1">{data.county.county_name}</h2>
            <p className="text-xs opacity-90 mt-0.5">
              Code {data.county.county_code.toString().padStart(3, '0')} · {data.total.toLocaleString()} total incidents
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80 uppercase tracking-wider">Resolution</p>
            <p className="text-3xl font-bold mt-0.5">{data.resolutionRate}%</p>
            <p className="text-xs opacity-90 mt-0.5">
              {data.resolved.toLocaleString()} of {data.total.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-900">{data.total.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Total Incidents</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-700">{data.pending.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Pending</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{data.confirmed.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Confirmed</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{data.resolved.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Resolved</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700 flex items-baseline gap-1">
            {formatHours(data.avgResponseHours)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Avg Response</p>
        </div>
      </div>

      {/* Trend + 30-day */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Last 30 Days
            </span>
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{data.last30Days}</p>
          {data.trend != null && (
            <p
              className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
                trendPositive ? 'text-red-600' : trendNegative ? 'text-emerald-600' : 'text-slate-500'
              }`}
            >
              <TrendingUp
                className={`h-3 w-3 ${trendNegative ? 'rotate-180' : ''} transition-transform`}
              />
              {data.trend > 0 ? '+' : ''}{data.trend}% vs previous 30d
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Coverage
            </span>
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            {data.constituencies.length}
            <span className="text-slate-400 text-sm font-normal"> constituencies</span>
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {data.wards.length} wards · {data.stations.length} stations
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Top Category
            </span>
            <BarChart2 className="h-3.5 w-3.5 text-slate-400" />
          </div>
          {data.categories[0] ? (
            <>
              <p className="text-lg font-bold text-slate-900">
                {CATEGORY_LABEL[data.categories[0].cat] || data.categories[0].cat}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {data.categories[0].n} incidents ({Math.round((data.categories[0].n / data.total) * 100)}%)
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No categorized incidents</p>
          )}
        </div>
      </div>

      {/* Monthly trend */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              6-Month Trend
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly incident volume for {data.county.county_name}
            </p>
          </div>
        </div>
        <div className="flex items-end gap-3 h-40">
          {data.monthly.map(m => {
            const h = maxMonthly > 0 ? (m.total / maxMonthly) * 100 : 0;
            const rh = m.total > 0 ? (m.resolved / m.total) * h : 0;
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] font-semibold text-slate-700">{m.total}</span>
                <div className="w-full bg-slate-100 rounded-t-md overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(h, 4)}%` }}>
                  <div className="w-full bg-emerald-500" style={{ height: `${rh}%` }} />
                  <div className="w-full flex-1 bg-blue-500/70" />
                </div>
                <span className="text-[10px] text-slate-500">{m.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-blue-500/70" />
            Total
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" />
            Resolved
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Categories */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-blue-600" />
            Categories in {data.county.county_name}
          </h3>
          {data.categories.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">No categorized incidents.</div>
          ) : (
            <div className="space-y-2">
              {data.categories.slice(0, 8).map(c => {
                const pct = Math.round((c.n / data.total) * 100);
                const width = (c.n / maxCat) * 100;
                return (
                  <div key={c.cat}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium">
                        {CATEGORY_LABEL[c.cat] || c.cat}
                      </span>
                      <span className="text-slate-500">
                        <span className="font-semibold text-slate-800">{c.n}</span>
                        <span className="ml-1 text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Constituencies */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-blue-600" />
            Constituencies ({data.constituencies.length})
          </h3>
          {data.constituencies.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              No incidents tagged to a constituency yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.constituencies.map((c, i) => {
                const width = (c.total / maxConstituency) * 100;
                const rate = c.total > 0 ? Math.round((c.resolved / c.total) * 100) : 0;
                return (
                  <div key={c.id} className="p-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm font-medium text-slate-800 flex-1 truncate">{c.name}</p>
                      <span className="text-sm font-bold text-slate-800">{c.total}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-7" style={{ width: `${Math.max(width, 10)}%` }}>
                      {c.resolved > 0 && (
                        <div className="h-full bg-emerald-500 inline-block" style={{ width: `${(c.resolved / c.total) * 100}%` }} />
                      )}
                      {c.confirmed > 0 && (
                        <div className="h-full bg-red-500 inline-block" style={{ width: `${(c.confirmed / c.total) * 100}%` }} />
                      )}
                      {c.pending > 0 && (
                        <div className="h-full bg-amber-500 inline-block" style={{ width: `${(c.pending / c.total) * 100}%` }} />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 ml-7 mt-0.5">
                      {rate}% resolved
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top wards */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-blue-600" />
            Top Wards ({data.wards.length})
          </h3>
          {data.wards.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              No incidents tagged to a ward yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {data.wards.slice(0, 15).map((w, i) => {
                const width = (w.total / maxWard) * 100;
                return (
                  <div key={w.id} className="flex items-center gap-2 p-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{w.name}</p>
                          {w.subtitle && (
                            <p className="text-[10px] text-slate-400 truncate">{w.subtitle}</p>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-800 ml-2">{w.total}</span>
                      </div>
                      <div
                        className="h-1.5 bg-slate-100 rounded-full overflow-hidden"
                        style={{ width: `${Math.max(width, 10)}%` }}
                      >
                        <div className="h-full bg-blue-500" style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stations */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-blue-600" />
            Police Stations ({data.stations.length})
          </h3>
          {data.stations.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              No incidents assigned to a station yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.stations.slice(0, 15).map((s, i) => {
                const width = (s.total / maxStation) * 100;
                const rate = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
                return (
                  <div key={s.id} className="p-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm font-medium text-slate-800 flex-1 truncate">{s.name}</p>
                      <span className="text-sm font-bold text-slate-800">{s.total}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-7">
                      <div
                        className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-1"
                        style={{ maxWidth: `${Math.max(width, 15)}%` }}
                      >
                        <div className="h-full bg-blue-500" style={{ width: '100%' }} />
                      </div>
                      <span className={`text-[10px] font-semibold ${
                        rate >= 75 ? 'text-emerald-600' : rate >= 40 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {rate}% resolved
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type MapAggregate = {
  county: County;
  total: number;
  pending: number;
  investigating: number;
  resolved: number;
  severityCounts: { low: number; medium: number; high: number; critical: number };
};

function IncidentsDistributionMap({ aggregates, maxTotal }: { aggregates: MapAggregate[]; maxTotal: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const objects: any[] = [];

    loadGoogleMaps().then((google) => {
      if (cancelled || !containerRef.current) return;

      const points = aggregates.filter(a => a.county.latitude && a.county.longitude);
      if (points.length === 0) return;

      const bounds = new google.maps.LatLngBounds();
      points.forEach(a => bounds.extend({ lat: a.county.latitude!, lng: a.county.longitude! }));

      const map = new google.maps.Map(containerRef.current, {
        center: { lat: 0.5, lng: 37.5 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'administrative.country', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', stylers: [{ visibility: 'simplified' }] },
        ],
      });

      points.forEach(a => {
        const intensity = a.total / maxTotal;
        const color = intensity > 0.6 ? '#dc2626'
          : intensity > 0.3 ? '#f59e0b'
          : intensity > 0.1 ? '#eab308'
          : '#22c55e';
        const radius = 10 + intensity * 35;
        const icon = createCircleIcon(google, radius, color, 0.7);

        const marker = new google.maps.Marker({
          position: { lat: a.county.latitude!, lng: a.county.longitude! },
          map, icon,
          title: `${a.county.county_name}: ${a.total} incidents`,
        });

        const severityBreakdown = [
          a.severityCounts.critical > 0 ? `Critical: ${a.severityCounts.critical}` : '',
          a.severityCounts.high > 0 ? `High: ${a.severityCounts.high}` : '',
          a.severityCounts.medium > 0 ? `Medium: ${a.severityCounts.medium}` : '',
          a.severityCounts.low > 0 ? `Low: ${a.severityCounts.low}` : '',
        ].filter(Boolean).join(' · ');

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="min-width:200px;padding:4px">
            <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">${a.county.county_name}</div>
            <div style="font-size:13px;color:#334155;margin-bottom:6px">
              <strong style="font-size:20px;color:${color}">${a.total}</strong> incident${a.total !== 1 ? 's' : ''}
            </div>
            <div style="display:flex;gap:8px;font-size:11px;color:#64748b;margin-bottom:4px">
              <span>Pending: ${a.pending}</span>
              <span>Investigating: ${a.investigating}</span>
              <span>Resolved: ${a.resolved}</span>
            </div>
            ${severityBreakdown ? `<div style="font-size:11px;color:#6474848b;padding-top:4px;border-top:1px solid #e2e8f0">${severityBreakdown}</div>` : ''}
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
  }, [aggregates, maxTotal]);

  if (error) {
    return (
      <div className="h-[480px] flex items-center justify-center text-red-500 text-sm bg-slate-50 rounded-xl border border-slate-200">
        Map error: {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Incidents Distribution Map</h3>
          <p className="text-xs text-slate-500 mt-0.5">Geographic overlay of incidents across Kenya — click a marker for details</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-500" /> Low</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-yellow-500" /> Moderate</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" /> High</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-600" /> Critical</span>
        </div>
      </div>
      <div ref={containerRef} style={{ height: '480px', width: '100%' }} />
    </div>
  );
}