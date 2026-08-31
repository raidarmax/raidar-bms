import { useState, useEffect, useRef } from 'react';
import { Search, Shield, Key, Building2, X, Users, Info, List, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { supabase, type PoliceOfficer, type PoliceStation, type SystemUserWithRole } from '../lib/supabase';
import bcrypt from 'bcryptjs';
import PoliceOfficersInsights from './PoliceOfficersInsights';
import PoliceOfficerDetailsModal from './PoliceOfficerDetailsModal';

type Props = {
  currentUser: SystemUserWithRole;
};

type OfficerWithStation = PoliceOfficer & { station_name?: string; county_name?: string };

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

export default function PoliceOfficerManagement({ currentUser }: Props) {
  const [view, setView] = useState<'insights' | 'directory'>('insights');
  const [stats, setStats] = useState({ total: 0, active: 0, admins: 0, inactive: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OfficerWithStation[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [allResults, setAllResults] = useState<OfficerWithStation[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [transferModal, setTransferModal] = useState<OfficerWithStation | null>(null);
  const [resetModal, setResetModal] = useState<OfficerWithStation | null>(null);
  const [viewingOfficer, setViewingOfficer] = useState<OfficerWithStation | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedTransferStation, setSelectedTransferStation] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadStats(); loadStations(); }, []);

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
      .from('police_officers')
      .select('is_active, is_station_admin');
    if (data) {
      setStats({
        total: data.length,
        active: data.filter(o => o.is_active).length,
        admins: data.filter(o => o.is_station_admin).length,
        inactive: data.filter(o => !o.is_active).length,
      });
    }
  };

  const loadStations = async () => {
    const { data } = await supabase.from('police_stations').select('*').order('station_name');
    if (data) setStations(data);
  };

  const loadPage = async (page: number, size: number) => {
    setLoadingAll(true);
    try {
      const from = (page - 1) * size;
      const to = from + size - 1;
      const { data, count } = await supabase
        .from('police_officers')
        .select('*, station:police_stations(station_name, county:kenya_counties(county_name))', { count: 'exact' })
        .order('full_name')
        .range(from, to);
      if (data) {
        const mapped = data.map((o: any) => ({
          ...o,
          station_name: o.station?.station_name || 'Unassigned',
          county_name: o.station?.county?.county_name || '',
          station: undefined,
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
        .from('police_officers')
        .select('*, station:police_stations(station_name, county:kenya_counties(county_name))')
        .or(`full_name.ilike.%${query}%,service_number.ilike.%${query}%,national_id.ilike.%${query}%,phone_number.ilike.%${query}%`)
        .order('full_name')
        .limit(50);

      if (data) {
        const mapped = data.map((o: any) => ({
          ...o,
          station_name: o.station?.station_name || 'Unassigned',
          county_name: o.station?.county?.county_name || '',
          station: undefined,
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

  const toggleStatus = async (officer: OfficerWithStation) => {
    await supabase
      .from('police_officers')
      .update({ is_active: !officer.is_active })
      .eq('id', officer.id);
    setSearchResults(prev => prev.map(o =>
      o.id === officer.id ? { ...o, is_active: !o.is_active } : o
    ));
    setAllResults(prev => prev.map(o =>
      o.id === officer.id ? { ...o, is_active: !o.is_active } : o
    ));
    loadStats();
  };

  const handleTransfer = async () => {
    if (!transferModal || !selectedTransferStation) return;
    setTransferring(true);
    await supabase
      .from('police_officers')
      .update({ station_id: selectedTransferStation, is_station_admin: false })
      .eq('id', transferModal.id);
    setTransferring(false);
    setTransferModal(null);
    setSelectedTransferStation('');
    if (showAll) loadPage(currentPage, perPage);
    else if (searchQuery.trim().length >= 3) performSearch(searchQuery.trim());
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;
    setResetting(true);
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1';
    const hash = await bcrypt.hash(tempPassword, 10);
    await supabase
      .from('police_officers')
      .update({ password_hash: hash, must_change_password: true })
      .eq('id', resetModal.id);
    setNewPassword(tempPassword);
    setResetting(false);
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

  const renderOfficerTable = (officersToRender: OfficerWithStation[]) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Officer</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Service No.</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Station</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Rank</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Last Login</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {officersToRender.map((officer) => (
            <tr key={officer.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {officer.is_station_admin && <Shield className="w-4 h-4 text-blue-500 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{officer.full_name}</p>
                    <p className="text-xs text-gray-500">{officer.phone_number}</p>
                    <p className="text-xs text-gray-400 sm:hidden">{officer.service_number}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-700 hidden sm:table-cell">{officer.service_number}</td>
              <td className="px-4 py-3 hidden md:table-cell">
                <p className="text-sm text-gray-700">{officer.station_name}</p>
                {officer.county_name && <p className="text-xs text-gray-400">{officer.county_name}</p>}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 capitalize hidden lg:table-cell">
                {officer.rank.replace(/_/g, ' ')}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${officer.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {officer.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                {officer.last_login_at ? new Date(officer.last_login_at).toLocaleDateString() : 'Never'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setViewingOfficer(officer)}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                    title="View profile"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleStatus(officer)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium ${officer.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                    title={officer.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {officer.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setTransferModal(officer)}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                    title="Transfer to another station"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setResetModal(officer); setNewPassword(null); }}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium bg-amber-50 text-amber-700 hover:bg-amber-100"
                    title="Reset password"
                  >
                    <Key className="w-3.5 h-3.5" />
                  </button>
                </div>
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
            <Users className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Police Officers</h2>
            <p className="text-sm text-gray-500">{stats.total} officers registered</p>
          </div>
        </div>
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
        <PoliceOfficersInsights />
      ) : (
        <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500 mt-1">Total Officers</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          <p className="text-xs text-slate-500 mt-1">Active</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.admins}</p>
          <p className="text-xs text-slate-500 mt-1">Station Admins</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-500">{stats.inactive}</p>
          <p className="text-xs text-slate-500 mt-1">Inactive</p>
        </div>
      </div>

      {/* Search Box - always visible */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, service number, national ID, or phone number..."
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
              {searchResults.length} officer{searchResults.length !== 1 ? 's' : ''} found
            </p>
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No officers match your search</p>
                <p className="text-sm text-slate-500 mt-1">Try a different name or service number</p>
              </div>
            ) : (
              renderOfficerTable(searchResults)
            )}
          </div>
        )}

        {!hasSearched && !searching && !isSearchActive && !showAll && (
          <div className="mt-6 flex flex-col items-center text-center py-8">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Info className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium">Search for police officers</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Type at least 3 characters to search by officer name, service number, national ID, or phone number.
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
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No officers found</p>
            </div>
          ) : (
            <>
              {renderOfficerTable(allResults)}
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

      {/* View Officer Profile Modal */}
      {viewingOfficer && (
        <PoliceOfficerDetailsModal
          officer={viewingOfficer}
          onClose={() => setViewingOfficer(null)}
        />
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Transfer Officer</h3>
              <button onClick={() => setTransferModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{transferModal.full_name}</p>
                <p className="text-xs text-gray-500">{transferModal.service_number} - Currently at {transferModal.station_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Transfer to Station</label>
                <select
                  value={selectedTransferStation}
                  onChange={(e) => setSelectedTransferStation(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select destination station</option>
                  {stations.filter(s => s.id !== transferModal.station_id).map(s => (
                    <option key={s.id} value={s.id}>{s.station_name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Note: Station admin status will be removed upon transfer.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setTransferModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={!selectedTransferStation || transferring}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {transferring ? 'Transferring...' : 'Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
              <button onClick={() => setResetModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{resetModal.full_name}</p>
                <p className="text-xs text-gray-500">{resetModal.service_number}</p>
              </div>
              {newPassword ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-800 font-medium">New Temporary Password</p>
                  <p className="text-lg font-mono font-bold text-amber-900 mt-1">{newPassword}</p>
                  <p className="text-xs text-amber-700 mt-2">Share this securely. Officer must change it on next login.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  This will generate a new temporary password for the officer. They will be required to change it on next login.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setResetModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  {newPassword ? 'Done' : 'Cancel'}
                </button>
                {!newPassword && (
                  <button
                    onClick={handleResetPassword}
                    disabled={resetting}
                    className="flex-1 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {resetting ? 'Resetting...' : 'Reset Password'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
