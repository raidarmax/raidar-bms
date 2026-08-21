import { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Building2,
  Shield,
  ChevronRight,
  ChevronLeft,
  Award,
  TrendingUp,
  AlertCircle,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
type IncidentRow = {
  id: string;
  status: string;
  police_status: string | null;
  incident_type: string;
  county_id: number | null;
  constituency_id: number | null;
  ward_id: number | null;
  assigned_station_id: string | null;
  assigned_officer_id: string | null;
  created_at: string;
  police_responded_at: string | null;
};

type County = { id: number; county_name: string };
type Constituency = { id: number; constituency_name: string; county_id: number };
type Ward = { id: number; ward_name: string; constituency_id: number };
type Station = { id: string; station_name: string; county_id: number | null };
type Officer = { id: string; full_name: string; rank: string | null; badge_number: string | null; station_id: string | null };

type LocationLevel = 'county' | 'constituency' | 'ward';

type AggRow = {
  id: string | number;
  name: string;
  total: number;
  resolved: number;
  pending: number;
  confirmed: number;
  subtitle?: string;
};

// ─── Aggregation helpers ──────────────────────────────────────────────────────
function aggregate<T extends { id: string | number; name: string; subtitle?: string }>(
  incidents: IncidentRow[],
  bucket: (i: IncidentRow) => T | null
): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const inc of incidents) {
    const b = bucket(inc);
    if (!b) continue;
    const key = String(b.id);
    const existing = map.get(key) ?? {
      id: b.id,
      name: b.name,
      subtitle: b.subtitle,
      total: 0,
      resolved: 0,
      pending: 0,
      confirmed: 0,
    };
    existing.total++;
    if (inc.status === 'resolved') existing.resolved++;
    else if (inc.status === 'confirmed') existing.confirmed++;
    else if (inc.status === 'pending') existing.pending++;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ─── Horizontal ranked bar ────────────────────────────────────────────────────
function RankedBar({ rank, row, max, onClick, actionable }: {
  rank: number;
  row: AggRow;
  max: number;
  onClick?: () => void;
  actionable?: boolean;
}) {
  const pct = max > 0 ? (row.total / max) * 100 : 0;
  const resolutionRate = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;
  const rateColor =
    resolutionRate >= 75 ? 'text-emerald-600' :
    resolutionRate >= 40 ? 'text-amber-600' : 'text-red-600';

  const rankBg =
    rank === 1 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' :
    rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
    rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
    'bg-slate-100 text-slate-600';

  const Wrapper: any = actionable ? 'button' : 'div';

  return (
    <Wrapper
      onClick={actionable ? onClick : undefined}
      className={`w-full text-left group ${actionable ? 'hover:bg-slate-50 cursor-pointer' : ''} rounded-lg p-2 transition-colors`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rankBg}`}>
          {rank}
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
              {actionable && <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />}
            </div>
          </div>
          {/* Stacked bar: resolved (green) | confirmed (red) | pending (amber) */}
          <div className="flex h-2 bg-slate-100 rounded-full overflow-hidden" style={{ width: `${Math.max(pct, 15)}%` }}>
            {row.resolved > 0 && (
              <div className="h-full bg-emerald-500" style={{ width: `${(row.resolved / row.total) * 100}%` }} title={`${row.resolved} resolved`} />
            )}
            {row.confirmed > 0 && (
              <div className="h-full bg-red-500" style={{ width: `${(row.confirmed / row.total) * 100}%` }} title={`${row.confirmed} confirmed`} />
            )}
            {row.pending > 0 && (
              <div className="h-full bg-amber-500" style={{ width: `${(row.pending / row.total) * 100}%` }} title={`${row.pending} pending`} />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
            <span className={`font-semibold ${rateColor}`}>{resolutionRate}% resolved</span>
            {row.pending > 0 && <span>{row.pending} pending</span>}
            {row.confirmed > 0 && <span className="text-red-600">{row.confirmed} confirmed</span>}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message, hint }: { icon: any; message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-9 w-9 text-slate-300 mb-2" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Resolved</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500" />Confirmed</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500" />Pending</span>
    </div>
  );
}

// ─── Main analytics component ─────────────────────────────────────────────────
type Props = { className?: string; view?: 'all' | 'geography' | 'personnel' };

export default function IncidentsAnalytics({ className, view = 'all' }: Props) {
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);

  // Geographic drill-down state
  const [geoLevel, setGeoLevel] = useState<LocationLevel>('county');
  const [selectedCountyId, setSelectedCountyId] = useState<number | null>(null);
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [
        { data: incData },
        { data: countyData },
        { data: constData },
        { data: wardData },
        { data: stationData },
        { data: officerData },
      ] = await Promise.all([
        supabase
          .from('incidents')
          .select('id, status, police_status, incident_type, county_id, constituency_id, ward_id, assigned_station_id, assigned_officer_id, created_at, police_responded_at'),
        supabase.from('kenya_counties').select('id, county_name').order('county_name'),
        supabase.from('kenya_constituencies').select('id, constituency_name, county_id'),
        supabase.from('kenya_wards').select('id, ward_name, constituency_id'),
        supabase.from('police_stations').select('id, station_name, county_id'),
        supabase.from('police_officers').select('id, full_name, rank, badge_number, station_id'),
      ]);
      setIncidents(incData || []);
      setCounties(countyData || []);
      setConstituencies(constData || []);
      setWards(wardData || []);
      setStations(stationData || []);
      setOfficers(officerData || []);
    } catch (e) {
      console.error('Error loading incident analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  // Lookup maps
  const countyById = useMemo(() => new Map(counties.map(c => [c.id, c])), [counties]);
  const constituencyById = useMemo(() => new Map(constituencies.map(c => [c.id, c])), [constituencies]);
  const wardById = useMemo(() => new Map(wards.map(w => [w.id, w])), [wards]);
  const stationById = useMemo(() => new Map(stations.map(s => [s.id, s])), [stations]);

  // Filter incidents by drill-down selection
  const scopedIncidents = useMemo(() => {
    return incidents.filter(i => {
      if (selectedConstituencyId && i.constituency_id !== selectedConstituencyId) return false;
      if (selectedCountyId && i.county_id !== selectedCountyId) return false;
      return true;
    });
  }, [incidents, selectedCountyId, selectedConstituencyId]);

  // Geographic aggregation
  const geoRows: AggRow[] = useMemo(() => {
    if (geoLevel === 'county') {
      return aggregate(scopedIncidents, (i) => {
        if (!i.county_id) return null;
        const c = countyById.get(i.county_id);
        return c ? { id: c.id, name: c.county_name } : null;
      });
    }
    if (geoLevel === 'constituency') {
      return aggregate(scopedIncidents, (i) => {
        if (!i.constituency_id) return null;
        const c = constituencyById.get(i.constituency_id);
        if (!c) return null;
        const county = countyById.get(c.county_id);
        return { id: c.id, name: c.constituency_name, subtitle: county?.county_name };
      });
    }
    return aggregate(scopedIncidents, (i) => {
      if (!i.ward_id) return null;
      const w = wardById.get(i.ward_id);
      if (!w) return null;
      const con = constituencyById.get(w.constituency_id);
      return { id: w.id, name: w.ward_name, subtitle: con?.constituency_name };
    });
  }, [scopedIncidents, geoLevel, countyById, constituencyById, wardById]);

  // Top stations (over all incidents)
  const stationRows: AggRow[] = useMemo(() => {
    return aggregate(incidents, (i) => {
      if (!i.assigned_station_id) return null;
      const s = stationById.get(i.assigned_station_id);
      if (!s) return null;
      const county = s.county_id ? countyById.get(s.county_id) : undefined;
      return { id: s.id, name: s.station_name, subtitle: county?.county_name };
    });
  }, [incidents, stationById, countyById]);

  // Top officers (over all incidents) — with additional metric: avg response time
  const officerRows = useMemo(() => {
    const byOfficer = new Map<string, {
      officer: Officer;
      total: number;
      resolved: number;
      pending: number;
      confirmed: number;
      responseTimes: number[];
    }>();

    for (const inc of incidents) {
      if (!inc.assigned_officer_id) continue;
      const officer = officers.find(o => o.id === inc.assigned_officer_id);
      if (!officer) continue;
      const existing = byOfficer.get(officer.id) ?? {
        officer, total: 0, resolved: 0, pending: 0, confirmed: 0, responseTimes: []
      };
      existing.total++;
      if (inc.status === 'resolved') existing.resolved++;
      else if (inc.status === 'confirmed') existing.confirmed++;
      else if (inc.status === 'pending') existing.pending++;
      if (inc.police_responded_at && inc.created_at) {
        const diff = new Date(inc.police_responded_at).getTime() - new Date(inc.created_at).getTime();
        if (diff > 0) existing.responseTimes.push(diff);
      }
      byOfficer.set(officer.id, existing);
    }

    return Array.from(byOfficer.values())
      .map(row => {
        const avgResponseMs = row.responseTimes.length > 0
          ? row.responseTimes.reduce((s, t) => s + t, 0) / row.responseTimes.length
          : null;
        const station = row.officer.station_id ? stationById.get(row.officer.station_id) : undefined;
        return {
          ...row,
          avgResponseMs,
          stationName: station?.station_name,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [incidents, officers, stationById]);

  // Selected location context
  const selectedCounty = selectedCountyId ? countyById.get(selectedCountyId) : null;
  const selectedConstituency = selectedConstituencyId ? constituencyById.get(selectedConstituencyId) : null;

  const maxGeo = geoRows[0]?.total ?? 0;
  const maxStation = stationRows[0]?.total ?? 0;
  const maxOfficer = officerRows[0]?.total ?? 0;

  const handleGeoClick = (row: AggRow) => {
    if (geoLevel === 'county') {
      setSelectedCountyId(Number(row.id));
      setGeoLevel('constituency');
    } else if (geoLevel === 'constituency') {
      setSelectedConstituencyId(Number(row.id));
      setGeoLevel('ward');
    }
  };

  const resetDrilldown = () => {
    setSelectedCountyId(null);
    setSelectedConstituencyId(null);
    setGeoLevel('county');
  };

  const drillUp = () => {
    if (geoLevel === 'ward') {
      setSelectedConstituencyId(null);
      setGeoLevel('constituency');
    } else if (geoLevel === 'constituency') {
      setSelectedCountyId(null);
      setGeoLevel('county');
    }
  };

  // Summary metrics for hero row
  const totalWithGeo = incidents.filter(i => i.county_id).length;
  const totalStations = stationRows.length;
  const totalOfficers = officerRows.length;

  const topCounty = geoRows.length > 0 && geoLevel === 'county' ? geoRows[0] : null;

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  if (loading) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-8 ${className ?? ''}`}>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
          <span className="ml-3 text-sm text-slate-600">Loading regional analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Hero context row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-emerald-700" />
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Geo-tagged</span>
          </div>
          <p className="text-2xl font-bold text-emerald-900">{totalWithGeo}</p>
          <p className="text-xs text-emerald-700/70">of {incidents.length} incidents mapped</p>
          {topCounty && (
            <p className="text-[11px] text-emerald-700 mt-1">
              Top county: <span className="font-semibold">{topCounty.name}</span> ({topCounty.total})
            </p>
          )}
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-blue-700" />
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Active Stations</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{totalStations}</p>
          <p className="text-xs text-blue-700/70">handling assigned cases</p>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-violet-700" />
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">Assigned Officers</span>
          </div>
          <p className="text-2xl font-bold text-violet-900">{totalOfficers}</p>
          <p className="text-xs text-violet-700/70">with active caseloads</p>
        </div>
      </div>

      {/* Geographic Hotspots */}
      {(view === 'all' || view === 'geography') && (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">Geographic Hotspots</h3>
          </div>
          <StatusLegend />
        </div>

        {/* Breadcrumb + tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Level tabs */}
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {(['county', 'constituency', 'ward'] as LocationLevel[]).map(level => {
              const disabled =
                (level === 'constituency' && geoLevel === 'ward' && !selectedConstituencyId) ||
                (level === 'ward' && geoLevel === 'constituency' && !selectedCountyId);
              return (
                <button
                  key={level}
                  onClick={() => setGeoLevel(level)}
                  disabled={disabled}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                    geoLevel === level
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          {/* Breadcrumb */}
          {(selectedCounty || selectedConstituency) && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <button
                onClick={resetDrilldown}
                className="hover:text-slate-900 hover:underline transition-colors"
              >
                All Kenya
              </button>
              {selectedCounty && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <span className={selectedConstituency ? '' : 'font-semibold text-slate-800'}>
                    {selectedCounty.county_name}
                  </span>
                </>
              )}
              {selectedConstituency && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <span className="font-semibold text-slate-800">{selectedConstituency.constituency_name}</span>
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

        {geoRows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            message="No location-tagged incidents yet"
            hint="Incidents assigned to a police station are auto-tagged with county, constituency, and ward"
          />
        ) : (
          <div className="space-y-1.5">
            {geoRows.slice(0, 10).map((row, idx) => (
              <RankedBar
                key={row.id}
                rank={idx + 1}
                row={row}
                max={maxGeo}
                actionable={geoLevel !== 'ward'}
                onClick={() => handleGeoClick(row)}
              />
            ))}
            {geoRows.length > 10 && (
              <p className="text-xs text-slate-400 text-center pt-2">
                +{geoRows.length - 10} more {geoLevel}{geoRows.length - 10 !== 1 ? 'ies' : 'y'} not shown
              </p>
            )}
          </div>
        )}
      </div>
      )}

      {/* Two-column leaderboard */}
      {(view === 'all' || view === 'personnel') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Stations */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">Top Police Stations</h3>
            </div>
            <span className="text-[11px] text-slate-500">By caseload</span>
          </div>

          {stationRows.length === 0 ? (
            <EmptyState
              icon={Building2}
              message="No stations have assigned cases yet"
              hint="Once incidents are routed, stations will appear here"
            />
          ) : (
            <div className="space-y-1.5">
              {stationRows.slice(0, 10).map((row, idx) => (
                <RankedBar key={row.id} rank={idx + 1} row={row} max={maxStation} />
              ))}
            </div>
          )}
        </div>

        {/* Top Officers with response time */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">Top Officers</h3>
            </div>
            <span className="text-[11px] text-slate-500">By caseload & response</span>
          </div>

          {officerRows.length === 0 ? (
            <EmptyState
              icon={Users}
              message="No officers have assigned cases yet"
              hint="Officers will appear as incidents are assigned"
            />
          ) : (
            <div className="space-y-2">
              {officerRows.slice(0, 10).map((row, idx) => {
                const resolutionRate = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;
                const rateColor =
                  resolutionRate >= 75 ? 'bg-emerald-100 text-emerald-700' :
                  resolutionRate >= 40 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700';

                const rankBg =
                  idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' :
                  idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                  idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                  'bg-slate-100 text-slate-600';

                return (
                  <div key={row.officer.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rankBg}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {row.officer.rank && <span className="text-slate-500 font-normal">{row.officer.rank} </span>}
                            {row.officer.full_name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {row.stationName ?? 'Unassigned station'}
                            {row.officer.badge_number && <span className="text-slate-400"> · #{row.officer.badge_number}</span>}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${rateColor}`}>
                          {resolutionRate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-600">
                          <span className="font-bold text-slate-800">{row.total}</span> cases
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span className="font-semibold">{row.resolved}</span> resolved
                        </span>
                        {row.pending > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <span className="font-semibold">{row.pending}</span> pending
                          </span>
                        )}
                        {row.avgResponseMs !== null && (
                          <span className="flex items-center gap-1 text-slate-500 ml-auto">
                            <TrendingUp className="h-3 w-3" />
                            {formatDuration(row.avgResponseMs)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Data quality hint */}
      {incidents.length > 0 && totalWithGeo < incidents.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-800">
            <p className="font-semibold">
              {incidents.length - totalWithGeo} incident{incidents.length - totalWithGeo !== 1 ? 's' : ''} without location data
            </p>
            <p className="text-amber-700 text-xs mt-0.5">
              Assign these to a police station to auto-tag them with county, constituency, and ward for richer analytics.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
