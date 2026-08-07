import { useState, useEffect, useCallback, useRef } from 'react';
import { usePersistedState } from '../lib/navigationMemory';
import {
  Search,
  Users,
  Bike,
  FileText,
  AlertTriangle,
  Info,
  List,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Calendar,
  CaseSensitive,
  AlertOctagon,
  X,
} from 'lucide-react';

export type SortField = 'created_at' | 'name' | 'incidents';
export type SortDir = 'asc' | 'desc';
export type SortOption = { field: SortField; dir: SortDir };

type SearchableListProps = {
  icon: 'owners' | 'motorcycles' | 'riders' | 'incidents';
  title: string;
  totalCount: number;
  placeholder: string;
  onSearch: (query: string) => Promise<any[]>;
  onLoadPage?: (page: number, perPage: number, sort: SortOption) => Promise<{ data: any[]; total: number }>;
  renderResults: (results: any[]) => React.ReactNode;
  stats?: { label: string; value: string | number; color?: string }[];
  nameLabel?: string;
  stateKey?: string;
};

const ICONS = {
  owners: Users,
  motorcycles: Bike,
  riders: FileText,
  incidents: AlertTriangle,
};

const PAGE_SIZES = [20, 50, 100] as const;

export default function SearchableList({
  icon,
  title,
  totalCount,
  placeholder,
  onSearch,
  onLoadPage,
  renderResults,
  stats,
  nameLabel = 'Name',
  stateKey,
}: SearchableListProps) {
  const [query, setQuery] = usePersistedState<string>(stateKey ? `${stateKey}.query` : null, '');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAll, setShowAll] = usePersistedState<boolean>(stateKey ? `${stateKey}.showAll` : null, false);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [currentPage, setCurrentPage] = usePersistedState<number>(stateKey ? `${stateKey}.page` : null, 1);
  const [perPage, setPerPage] = usePersistedState<number>(stateKey ? `${stateKey}.perPage` : null, 20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortField, setSortField] = usePersistedState<SortField>(stateKey ? `${stateKey}.sortField` : null, 'created_at');
  const [sortDir, setSortDir] = usePersistedState<SortDir>(stateKey ? `${stateKey}.sortDir` : null, 'desc');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = ICONS[icon];

  const executeSearch = useCallback(async (searchTerm: string) => {
    if (searchTerm.trim().length < 3) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    try {
      const data = await onSearch(searchTerm.trim());
      setResults(data);
      setHasSearched(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [onSearch]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      executeSearch(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, executeSearch]);

  const loadPage = useCallback(async (page: number, size: number, sort: SortOption) => {
    if (!onLoadPage) return;
    setLoadingAll(true);
    try {
      const result = await onLoadPage(page, size, sort);
      setAllResults(result.data);
      setTotalRecords(result.total);
    } catch (e) {
      console.error('Load page error:', e);
    } finally {
      setLoadingAll(false);
    }
  }, [onLoadPage]);

  useEffect(() => {
    if (showAll && onLoadPage) {
      loadPage(currentPage, perPage, { field: sortField, dir: sortDir });
    }
  }, [showAll, currentPage, perPage, sortField, sortDir, loadPage, onLoadPage]);

  const handleShowAll = () => {
    setShowAll(true);
    setCurrentPage(1);
  };

  const handleHideAll = () => {
    setShowAll(false);
    setAllResults([]);
  };

  const handlePerPageChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalRecords / perPage);
  const isSearchActive = query.trim().length >= 3;

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{title}</h2>
            <p className="text-sm text-slate-500">{totalCount.toLocaleString()} total records</p>
          </div>
        </div>
        {onLoadPage && (
          <button
            onClick={showAll ? handleHideAll : handleShowAll}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm ${
              showAll
                ? 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <List className="h-4 w-4" />
            {showAll ? 'Hide List' : 'Browse All'}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
            >
              <p className={`text-2xl font-bold ${stat.color || 'text-slate-900'} tabular-nums`}>
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-12 pr-11 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {query.length > 0 && query.length < 3 && (
            <p className="text-xs text-amber-600 mt-2 font-medium">
              Type {3 - query.length} more character{3 - query.length > 1 ? 's' : ''} to search...
            </p>
          )}
        </div>

        {searching && (
          <div className="px-6 pb-6 flex items-center justify-center py-8 border-t border-slate-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            <span className="ml-3 text-sm text-slate-600">Searching...</span>
          </div>
        )}

        {hasSearched && !searching && (
          <div className="border-t border-slate-100">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-600 font-medium">
                {results.length} result{results.length !== 1 ? 's' : ''} for
                <span className="ml-1 text-slate-900 font-semibold">"{query}"</span>
              </p>
            </div>
            <div className="p-2">
              {results.length === 0 ? (
                <div className="text-center py-10">
                  <Icon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-700 font-medium">No records match your search</p>
                  <p className="text-sm text-slate-500 mt-1">Try a different search term</p>
                </div>
              ) : (
                renderResults(results)
              )}
            </div>
          </div>
        )}

        {!hasSearched && !searching && !isSearchActive && !showAll && (
          <div className="px-6 pb-8 flex flex-col items-center text-center pt-2 border-t border-slate-100 mt-1">
            <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mt-6 mb-4">
              <Info className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-slate-800 font-semibold">Search to find records</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Type at least 3 characters to search. Or click <span className="font-semibold text-emerald-700">Browse All</span> to list everything.
            </p>
          </div>
        )}
      </div>

      {/* Show All — Paginated Directory */}
      {showAll && !isSearchActive && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <p className="text-sm text-slate-600">
                Showing{' '}
                <span className="font-semibold text-slate-900 tabular-nums">
                  {totalRecords > 0 ? Math.min((currentPage - 1) * perPage + 1, totalRecords) : 0}
                  –{Math.min(currentPage * perPage, totalRecords)}
                </span>{' '}
                of <span className="font-semibold text-slate-900 tabular-nums">{totalRecords.toLocaleString()}</span>
              </p>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Sort segmented control */}
                <div className="inline-flex items-center bg-white rounded-full border border-slate-200 shadow-sm p-1 gap-0.5">
                  <span className="pl-3 pr-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    Sort
                  </span>
                  <SortButton
                    active={sortField === 'created_at'}
                    dir={sortField === 'created_at' ? sortDir : null}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Date"
                    onClick={() => handleSortChange('created_at')}
                  />
                  <SortButton
                    active={sortField === 'name'}
                    dir={sortField === 'name' ? sortDir : null}
                    icon={<CaseSensitive className="h-3.5 w-3.5" />}
                    label={nameLabel}
                    onClick={() => handleSortChange('name')}
                  />
                  {(icon === 'motorcycles' || icon === 'riders') && (
                    <SortButton
                      active={sortField === 'incidents'}
                      dir={sortField === 'incidents' ? sortDir : null}
                      icon={<AlertOctagon className="h-3.5 w-3.5" />}
                      label="Incidents"
                      onClick={() => handleSortChange('incidents')}
                    />
                  )}
                </div>

                {/* Per-page segmented control */}
                <div className="inline-flex items-center bg-white rounded-full border border-slate-200 shadow-sm p-1 gap-0.5">
                  <span className="pl-3 pr-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rows</span>
                  {PAGE_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => handlePerPageChange(size)}
                      className={`min-w-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                        perPage === size
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-2 sm:p-3">
            {loadingAll ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
                <span className="ml-3 text-sm text-slate-600">Loading...</span>
              </div>
            ) : allResults.length === 0 ? (
              <div className="text-center py-12">
                <Icon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-700 font-medium">No records found</p>
              </div>
            ) : (
              renderResults(allResults)
            )}
          </div>

          {/* Pagination */}
          {!loadingAll && allResults.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <div className="flex items-center gap-1">
                {generatePageNumbers(currentPage, totalPages).map((page, i) =>
                  page === '...' ? (
                    <span key={`dots-${i}`} className="px-2 text-slate-400 text-sm">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`w-8 h-8 text-sm font-semibold rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortButton({
  active,
  dir,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  dir: SortDir | null;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
        active
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
      title={active ? `Sorted ${dir === 'asc' ? 'ascending' : 'descending'} — click to reverse` : `Sort by ${label}`}
    >
      {icon}
      {label}
      {active && (
        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/25">
          {dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        </span>
      )}
    </button>
  );
}

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
