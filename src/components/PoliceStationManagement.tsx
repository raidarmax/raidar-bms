import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Shield, MapPin, Phone, Users, X, Building2, Search, Eye, Info, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, type PoliceStation, type PoliceOfficer, type SystemUserWithRole } from '../lib/supabase';
import { PoliceAuthService, POLICE_RANKS } from '../lib/policeAuth';
import LocalitySelector from './LocalitySelector';
import GovernmentVerificationField, { type VerifyResult } from './GovernmentVerificationField';
import PoliceStationsInsights from './PoliceStationsInsights';

type Props = {
  currentUser: SystemUserWithRole;
};

type StationWithMeta = PoliceStation & { county_name?: string };

const PAGE_SIZES = [20, 50, 100] as const;

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export default function PoliceStationManagement({ currentUser }: Props) {
  const [view, setView] = useState<'insights' | 'directory'>('insights');
  const [stats, setStats] = useState({ total: 0, active: 0, stations: 0, posts: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<PoliceStation | null>(null);
  const [stationOfficers, setStationOfficers] = useState<PoliceOfficer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StationWithMeta[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [allResults, setAllResults] = useState<StationWithMeta[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (showAll) loadPage(currentPage, perPage);
  }, [showAll, currentPage, perPage]);

  const loadStats = async () => {
    const { data } = await supabase
      .from('police_stations')
      .select('station_type, is_active');
    if (data) {
      setStats({
        total: data.length,
        active: data.filter(s => s.is_active).length,
        stations: data.filter(s => s.station_type === 'station').length,
        posts: data.filter(s => s.station_type === 'post').length,
      });
    }
  };

  const loadPage = async (page: number, size: number) => {
    setLoadingAll(true);
    try {
      const from = (page - 1) * size;
      const to = from + size - 1;
      const { data, count } = await supabase
        .from('police_stations')
        .select('*, county:kenya_counties(county_name)', { count: 'exact' })
        .order('station_name')
        .range(from, to);
      if (data) {
        const mapped = data.map((s: any) => ({
          ...s,
          county_name: s.county?.county_name || 'Unknown',
          county: undefined,
        }));
        setAllResults(mapped);
        setTotalRecords(count || 0);
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoadingAll(false);
    }
  };

  const performSearch = async (query: string) => {
    setSearching(true);
    try {
      const { data } = await supabase
        .from('police_stations')
        .select('*, county:kenya_counties(county_name)')
        .or(`station_name.ilike.%${query}%,station_code.ilike.%${query}%,phone_number.ilike.%${query}%,physical_address.ilike.%${query}%`)
        .order('station_name')
        .limit(50);

      if (data) {
        const mapped = data.map((s: any) => ({
          ...s,
          county_name: s.county?.county_name || 'Unknown',
          county: undefined,
        }));
        setSearchResults(mapped);
      } else {
        setSearchResults([]);
      }
      setHasSearched(true);
    } catch (e) {
      console.error('Search error:', e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const viewStation = async (station: PoliceStation) => {
    setSelectedStation(station);
    const { data } = await supabase
      .from('police_officers')
      .select('*')
      .eq('station_id', station.id)
      .order('is_station_admin', { ascending: false });
    setStationOfficers(data || []);
  };

  const handleShowAll = () => {
    setShowAll(true);
    setCurrentPage(1);
  };

  const handleHideAll = () => {
    setShowAll(false);
    setAllResults([]);
  };

  const totalPages = Math.ceil(totalRecords / perPage);
  const isSearchActive = searchQuery.trim().length >= 3;

  const renderStationTable = (stationsToRender: StationWithMeta[]) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Station</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Code</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">County</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Type</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Phone</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Status</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stationsToRender.map((station) => (
            <tr key={station.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{station.station_name}</p>
                    {station.physical_address && (
                      <p className="text-xs text-slate-500">{station.physical_address}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-xs font-mono text-gray-600 hidden sm:table-cell">{station.station_code}</td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-sm text-slate-700">{station.county_name}</span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  station.station_type === 'station' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {station.station_type}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{station.phone_number || '-'}</td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className={`text-xs px-2 py-0.5 rounded-full ${station.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {station.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => viewStation(station)}
                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">View</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Building2 className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Police Stations</h2>
            <p className="text-sm text-gray-500">{stats.total} stations registered</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'directory' && (
            <button
              onClick={showAll ? handleHideAll : handleShowAll}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                showAll
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <List className="h-4 w-4" />
              {showAll ? 'Hide List' : 'Show All'}
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" /> Add Station
          </button>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
        {([
          { id: 'insights', label: 'Insights' },
          { id: 'directory', label: `Directory (${stats.total})` },
        ] as const).map(t => {
          const isActive = t.id === view;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {view === 'insights' ? (
        <PoliceStationsInsights />
      ) : (
        <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500 mt-1">Total Stations</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          <p className="text-xs text-slate-500 mt-1">Active</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.stations}</p>
          <p className="text-xs text-slate-500 mt-1">Police Stations</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.posts}</p>
          <p className="text-xs text-slate-500 mt-1">Police Posts</p>
        </div>
      </div>

      {/* Search Box - always visible */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by station name, station code, address, or phone number..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {searchQuery.length > 0 && searchQuery.length < 3 && (
          <p className="text-xs text-amber-600 mt-2 font-medium">
            Type {3 - searchQuery.length} more character{3 - searchQuery.length > 1 ? 's' : ''} to search...
          </p>
        )}

        {searching && (
          <div className="mt-6 flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            <span className="ml-3 text-sm text-slate-600">Searching...</span>
          </div>
        )}

        {hasSearched && !searching && (
          <div className="mt-4">
            <p className="text-sm text-slate-500 mb-3">
              {searchResults.length} station{searchResults.length !== 1 ? 's' : ''} found
            </p>
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No stations match your search</p>
                <p className="text-sm text-slate-500 mt-1">Try a different station name or code</p>
              </div>
            ) : (
              renderStationTable(searchResults)
            )}
          </div>
        )}

        {!hasSearched && !searching && !isSearchActive && !showAll && (
          <div className="mt-6 flex flex-col items-center text-center py-8">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Info className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium">Search for police stations</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Type at least 3 characters to search by station name, station code, address, or phone number.
            </p>
          </div>
        )}
      </div>

      {/* Show All Paginated List */}
      {showAll && !isSearchActive && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold">{totalRecords > 0 ? Math.min((currentPage - 1) * perPage + 1, totalRecords) : 0}-{Math.min(currentPage * perPage, totalRecords)}</span> of <span className="font-semibold">{totalRecords.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Per page:</span>
              {PAGE_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => { setPerPage(size); setCurrentPage(1); }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    perPage === size ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {loadingAll ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
              <span className="ml-3 text-sm text-slate-600">Loading...</span>
            </div>
          ) : allResults.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No stations found</p>
            </div>
          ) : (
            <>
              {renderStationTable(allResults)}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {generatePageNumbers(currentPage, totalPages).map((page, i) =>
                      page === '...' ? (
                        <span key={`dots-${i}`} className="px-2 text-slate-400">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                            currentPage === page ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
        </>
      )}

      {showCreateModal && (
        <CreateStationModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); loadStats(); }}
        />
      )}

      {selectedStation && (
        <StationDetailModal
          station={selectedStation}
          officers={stationOfficers}
          onClose={() => setSelectedStation(null)}
          onRefresh={() => viewStation(selectedStation)}
        />
      )}
    </div>
  );
}

function CreateStationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    station_name: '',
    station_code: '',
    station_type: 'station' as 'station' | 'post',
    physical_address: '',
    phone_number: '',
    email: '',
  });
  const [locality, setLocality] = useState<{ countyId: number | null; constituencyId: number | null; wardId: number | null }>({
    countyId: null, constituencyId: null, wardId: null,
  });
  const [adminData, setAdminData] = useState({
    service_number: '',
    national_id: '',
    full_name: '',
    phone_number: '',
    rank: 'inspector',
  });
  const [idVerResult, setIdVerResult] = useState<VerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.station_name || !formData.station_code || !locality.countyId) {
      setError('Station name, code, and county are required.');
      return;
    }
    if (!adminData.service_number || !adminData.national_id || !adminData.full_name || !adminData.phone_number) {
      setError('Station admin details are required.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: station, error: stationError } = await supabase
        .from('police_stations')
        .insert({
          station_name: formData.station_name,
          station_code: formData.station_code.toUpperCase(),
          station_type: formData.station_type,
          county_id: locality.countyId,
          constituency_id: locality.constituencyId,
          ward_id: locality.wardId,
          physical_address: formData.physical_address || null,
          phone_number: formData.phone_number || null,
          email: formData.email || null,
        })
        .select()
        .single();

      if (stationError) throw stationError;

      const officer = await PoliceAuthService.registerOfficer({
        service_number: adminData.service_number.toUpperCase(),
        national_id: adminData.national_id,
        full_name: adminData.full_name,
        phone_number: adminData.phone_number,
        rank: adminData.rank,
        station_id: station.id,
        is_station_admin: true,
        id_verified: idVerResult?.verified || false,
        registered_by: station.id,
      });

      setTempPassword((officer as any)._tempPassword);
    } catch (err: any) {
      setError(err.message || 'Failed to create station');
    } finally {
      setSubmitting(false);
    }
  };

  if (tempPassword) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center">
          <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">Station Created</h3>
          <p className="text-sm text-gray-500 mt-2">{formData.station_name} ({formData.station_code})</p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 font-medium">Station Admin Temporary Password</p>
            <p className="text-lg font-mono font-bold text-amber-900 mt-1">{tempPassword}</p>
            <p className="text-xs text-amber-700 mt-2">
              Admin: {adminData.full_name} ({adminData.service_number})
            </p>
          </div>
          <button onClick={onSuccess} className="mt-6 px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-gray-900">Create Police Station</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-700">{error}</p></div>}

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Station Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station Name *</label>
                <input value={formData.station_name} onChange={(e) => setFormData(p => ({ ...p, station_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station Code *</label>
                <input value={formData.station_code} onChange={(e) => setFormData(p => ({ ...p, station_code: e.target.value.toUpperCase() }))} placeholder="NBI/KIL/001" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select value={formData.station_type} onChange={(e) => setFormData(p => ({ ...p, station_type: e.target.value as any }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="station">Police Station</option>
                  <option value="post">Police Post</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input value={formData.phone_number} onChange={(e) => setFormData(p => ({ ...p, phone_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Physical Address</label>
              <input value={formData.physical_address} onChange={(e) => setFormData(p => ({ ...p, physical_address: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <LocalitySelector countyId={locality.countyId} constituencyId={locality.constituencyId} wardId={locality.wardId} onChange={setLocality} label="Station Location" required />
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-4">
            <h4 className="font-semibold text-gray-800">Station Admin (OCS/OCPD)</h4>
            <p className="text-xs text-gray-500">This officer will manage the station and register other officers.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Number *</label>
                <input value={adminData.service_number} onChange={(e) => setAdminData(p => ({ ...p, service_number: e.target.value.toUpperCase() }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rank *</label>
                <select value={adminData.rank} onChange={(e) => setAdminData(p => ({ ...p, rank: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {POLICE_RANKS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <GovernmentVerificationField
              type="national_id"
              value={adminData.national_id}
              onChange={(val) => setAdminData(p => ({ ...p, national_id: val }))}
              onVerified={(result) => {
                setIdVerResult(result);
                if (result.verified && result.name) setAdminData(p => ({ ...p, full_name: result.name! }));
              }}
              label="National ID *"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={adminData.full_name} onChange={(e) => setAdminData(p => ({ ...p, full_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input value={adminData.phone_number} onChange={(e) => setAdminData(p => ({ ...p, phone_number: e.target.value }))} placeholder="+254..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Station & Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StationDetailModal({ station, officers, onClose, onRefresh }: {
  station: PoliceStation;
  officers: PoliceOfficer[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [officerForm, setOfficerForm] = useState({
    service_number: '',
    national_id: '',
    full_name: '',
    phone_number: '',
    rank: 'constable',
    is_station_admin: false,
  });
  const [idVerResult, setIdVerResult] = useState<VerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdOfficerName, setCreatedOfficerName] = useState('');

  const handleAddOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!officerForm.service_number || !officerForm.national_id || !officerForm.full_name || !officerForm.phone_number) {
      setError('All fields are required.');
      return;
    }
    setSubmitting(true);
    try {
      const officer = await PoliceAuthService.registerOfficer({
        service_number: officerForm.service_number.toUpperCase(),
        national_id: officerForm.national_id,
        full_name: officerForm.full_name,
        phone_number: officerForm.phone_number,
        rank: officerForm.rank,
        station_id: station.id,
        is_station_admin: officerForm.is_station_admin,
        id_verified: idVerResult?.verified || false,
        registered_by: station.id,
      });
      setCreatedOfficerName(officerForm.full_name);
      setCreatedPassword((officer as any)._tempPassword);
      setOfficerForm({ service_number: '', national_id: '', full_name: '', phone_number: '', rank: 'constable', is_station_admin: false });
      setIdVerResult(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add officer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{station.station_name}</h3>
            <p className="text-sm text-gray-500 capitalize">{station.station_type} | Code: {station.station_code}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {station.physical_address && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Address</p>
                <p className="text-sm font-medium">{station.physical_address}</p>
              </div>
            )}
            {station.phone_number && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-medium">{station.phone_number}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-medium">{station.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-sm font-medium">{new Date(station.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Officers section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">Officers ({officers.length})</h4>
              <button
                onClick={() => { setShowAddOfficer(!showAddOfficer); setCreatedPassword(null); setError(''); }}
                className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                <Plus className="w-4 h-4" />
                Add Officer
              </button>
            </div>

            {officers.length === 0 ? (
              <p className="text-sm text-gray-500">No officers registered at this station.</p>
            ) : (
              <div className="space-y-2">
                {officers.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      {o.is_station_admin && <Shield className="w-4 h-4 text-blue-500" />}
                      <div>
                        <p className="text-sm font-medium">{o.full_name}</p>
                        <p className="text-xs text-gray-500">{o.service_number} | {o.rank.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.is_station_admin && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Admin</span>}
                      <span className={`text-xs px-2 py-1 rounded-full ${o.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {o.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Officer Form */}
          {showAddOfficer && (
            <div className="border-t border-gray-200 pt-5">
              {createdPassword ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                  <Shield className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-green-900">Officer Added Successfully</h4>
                  <p className="text-sm text-green-700 mt-1">{createdOfficerName}</p>
                  <div className="mt-3 bg-white border border-green-300 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Temporary Password (share securely)</p>
                    <p className="text-lg font-mono font-bold text-gray-900">{createdPassword}</p>
                  </div>
                  <p className="text-xs text-green-700 mt-2">Officer must change this password on first login.</p>
                  <button
                    onClick={() => { setCreatedPassword(null); setShowAddOfficer(false); }}
                    className="mt-3 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddOfficer} className="space-y-4">
                  <h4 className="font-semibold text-gray-800">Register New Officer</h4>
                  <p className="text-xs text-gray-500">Add an officer to {station.station_name}. A temporary password will be generated.</p>

                  {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-700">{error}</p></div>}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Number *</label>
                      <input
                        value={officerForm.service_number}
                        onChange={(e) => setOfficerForm(p => ({ ...p, service_number: e.target.value.toUpperCase() }))}
                        placeholder="e.g. AP/12345"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rank *</label>
                      <select
                        value={officerForm.rank}
                        onChange={(e) => setOfficerForm(p => ({ ...p, rank: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        {POLICE_RANKS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <GovernmentVerificationField
                    type="national_id"
                    value={officerForm.national_id}
                    onChange={(val) => setOfficerForm(p => ({ ...p, national_id: val }))}
                    onVerified={(result) => {
                      setIdVerResult(result);
                      if (result.verified && result.name) setOfficerForm(p => ({ ...p, full_name: result.name! }));
                    }}
                    label="National ID *"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        value={officerForm.full_name}
                        onChange={(e) => setOfficerForm(p => ({ ...p, full_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                      <input
                        value={officerForm.phone_number}
                        onChange={(e) => setOfficerForm(p => ({ ...p, phone_number: e.target.value }))}
                        placeholder="+254..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={officerForm.is_station_admin}
                      onChange={(e) => setOfficerForm(p => ({ ...p, is_station_admin: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">Make this officer a Station Admin (can manage other officers)</span>
                  </label>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddOfficer(false)}
                      className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
                    >
                      {submitting ? 'Registering...' : 'Register Officer'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
