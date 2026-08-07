import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Download, Activity, BarChart3, ScrollText, LogIn, LogOut, PlusCircle, Pencil, Trash2, CheckCircle2, XCircle, Eye, Image as ImageIcon, Filter, X, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, ShieldCheck, File as FileEdit, Database } from 'lucide-react';
import { supabase, type UserActivityLog, type SystemUser } from '../lib/supabase';
import AuditLogInsights from './AuditLogInsights';

type AuditLogWithUser = UserActivityLog & {
  user: SystemUser;
};

type ActionMeta = {
  Icon: typeof LogIn;
  ringClass: string;
  bgClass: string;
  textClass: string;
  verb: string;
};

const MODULE_SINGULAR: Record<string, string> = {
  owners: 'owner',
  motorcycles: 'motorcycle',
  riders: 'rider',
  verifications: 'verification',
  users: 'user',
  groups: 'group',
  settings: 'setting',
  system: 'system',
};

const MODULE_BADGE_CLASS: Record<string, string> = {
  owners: 'bg-blue-50 text-blue-700 ring-blue-100',
  motorcycles: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  riders: 'bg-amber-50 text-amber-700 ring-amber-100',
  verifications: 'bg-teal-50 text-teal-700 ring-teal-100',
  users: 'bg-rose-50 text-rose-700 ring-rose-100',
  groups: 'bg-slate-50 text-slate-700 ring-slate-100',
  settings: 'bg-slate-50 text-slate-700 ring-slate-100',
  system: 'bg-slate-50 text-slate-700 ring-slate-100',
};

function getActionMeta(action: string): ActionMeta {
  switch (action) {
    case 'login':
      return { Icon: LogIn, ringClass: 'ring-emerald-200', bgClass: 'bg-emerald-500', textClass: 'text-white', verb: 'signed in' };
    case 'logout':
      return { Icon: LogOut, ringClass: 'ring-slate-200', bgClass: 'bg-slate-500', textClass: 'text-white', verb: 'signed out' };
    case 'create':
      return { Icon: PlusCircle, ringClass: 'ring-blue-200', bgClass: 'bg-blue-500', textClass: 'text-white', verb: 'created' };
    case 'update':
      return { Icon: Pencil, ringClass: 'ring-amber-200', bgClass: 'bg-amber-500', textClass: 'text-white', verb: 'updated' };
    case 'delete':
      return { Icon: Trash2, ringClass: 'ring-rose-200', bgClass: 'bg-rose-500', textClass: 'text-white', verb: 'deleted' };
    case 'approve':
      return { Icon: CheckCircle2, ringClass: 'ring-emerald-200', bgClass: 'bg-emerald-500', textClass: 'text-white', verb: 'approved' };
    case 'reject':
      return { Icon: XCircle, ringClass: 'ring-rose-200', bgClass: 'bg-rose-500', textClass: 'text-white', verb: 'rejected' };
    case 'view':
      return { Icon: Eye, ringClass: 'ring-slate-200', bgClass: 'bg-slate-400', textClass: 'text-white', verb: 'viewed' };
    case 'export':
      return { Icon: Download, ringClass: 'ring-teal-200', bgClass: 'bg-teal-500', textClass: 'text-white', verb: 'exported' };
    default:
      return { Icon: Activity, ringClass: 'ring-slate-200', bgClass: 'bg-slate-400', textClass: 'text-white', verb: action };
  }
}

const PHOTO_KEYS = ['profile_photo_url', 'photo_url', 'bike_photo_url', 'avatar_url', 'image_url'];

function extractPhoto(details: any): string | null {
  if (!details || typeof details !== 'object') return null;
  for (const key of PHOTO_KEYS) {
    const val = details[key];
    if (typeof val === 'string' && /^https?:\/\//i.test(val)) return val;
  }
  return null;
}

function isPhotoUpdate(details: any): boolean {
  if (!details || typeof details !== 'object') return false;
  const keys = Object.keys(details).map((k) => k.toLowerCase());
  return keys.some((k) => k.includes('photo') || k.includes('avatar') || k.includes('picture'));
}

function buildSentence(log: AuditLogWithUser): string {
  const meta = getActionMeta(log.action_type);
  const noun = MODULE_SINGULAR[log.module] || log.module;
  const details = log.details || {};

  if (log.action_type === 'login') return 'signed in to the platform';
  if (log.action_type === 'logout') return 'signed out';

  if (log.action_type === 'update' && log.module === 'users' && isPhotoUpdate(details)) {
    return 'updated their profile picture';
  }
  if (log.action_type === 'update' && isPhotoUpdate(details)) {
    return `updated a ${noun}'s photo`;
  }

  if (log.action_type === 'export') return `exported ${log.module} data`;
  if (log.action_type === 'view') return `viewed a ${noun} record`;
  if (log.action_type === 'create') return `created a new ${noun}`;
  if (log.action_type === 'update') return `updated a ${noun}`;
  if (log.action_type === 'delete') return `deleted a ${noun}`;
  if (log.action_type === 'approve') return `approved a ${noun}`;
  if (log.action_type === 'reject') return `rejected a ${noun}`;

  return `${meta.verb} a ${noun}`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initialsOf(name?: string | null): string {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function humanKey(key: string): string {
  return key
    .replace(/_url$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function renderDetailValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'string') {
    if (/^https?:\/\//i.test(val)) return 'link';
    return val;
  }
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

function meaningfulDetailEntries(details: any): [string, any][] {
  if (!details || typeof details !== 'object') return [];
  return Object.entries(details).filter(([key, value]) => {
    if (PHOTO_KEYS.includes(key)) return false;
    if (value === null || value === undefined || value === '') return false;
    return true;
  });
}

type CategoryKey = 'all' | 'auth' | 'records' | 'approvals' | 'access';

const CATEGORIES: { key: CategoryKey; label: string; Icon: typeof LayoutGrid; actions: string[] | null }[] = [
  { key: 'all', label: 'All', Icon: LayoutGrid, actions: null },
  { key: 'auth', label: 'Sign-ins', Icon: LogIn, actions: ['login', 'logout'] },
  { key: 'records', label: 'Record changes', Icon: FileEdit, actions: ['create', 'update', 'delete'] },
  { key: 'approvals', label: 'Approvals', Icon: ShieldCheck, actions: ['approve', 'reject'] },
  { key: 'access', label: 'Data access', Icon: Database, actions: ['view', 'export'] },
];

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogWithUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<CategoryKey, number>>({
    all: 0,
    auth: 0,
    records: 0,
    approvals: 0,
    access: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryKey>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [view, setView] = useState<'insights' | 'log'>('insights');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [category, filterAction, filterModule, dateFrom, dateTo, debouncedSearch]);

  const applyBaseFilters = useCallback(
    (query: any, opts: { includeCategory?: boolean } = { includeCategory: true }) => {
      let q = query;
      if (opts.includeCategory) {
        const cat = CATEGORIES.find((c) => c.key === category);
        if (cat && cat.actions) q = q.in('action_type', cat.actions);
      }
      if (filterAction !== 'all') q = q.eq('action_type', filterAction);
      if (filterModule !== 'all') q = q.eq('module', filterModule);
      if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        q = q.lte('created_at', to.toISOString());
      }
      return q;
    },
    [category, filterAction, filterModule, dateFrom, dateTo],
  );

  const applySearch = useCallback(
    async (query: any) => {
      if (!debouncedSearch) return query;
      const like = `%${debouncedSearch}%`;
      const { data: users } = await supabase
        .from('system_users')
        .select('id')
        .or(`full_name.ilike.${like},username.ilike.${like}`)
        .limit(50);
      const userIds = (users || []).map((u: any) => u.id).filter(Boolean);
      const orParts = [`action_type.ilike.${like}`, `module.ilike.${like}`];
      if (userIds.length > 0) orParts.push(`user_id.in.(${userIds.join(',')})`);
      return query.or(orParts.join(','));
    },
    [debouncedSearch],
  );

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('user_activity_logs')
        .select('*, user:system_users(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      query = applyBaseFilters(query);
      query = await applySearch(query);
      const { data, count, error } = await query;
      if (error) throw error;
      setLogs((data || []) as AuditLogWithUser[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, applyBaseFilters, applySearch]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const loadCategoryCounts = useCallback(async () => {
    const build = (actions: string[] | null) => {
      let q = supabase.from('user_activity_logs').select('id', { count: 'exact', head: true });
      if (actions) q = q.in('action_type', actions);
      if (filterModule !== 'all') q = q.eq('module', filterModule);
      if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        q = q.lte('created_at', to.toISOString());
      }
      return q;
    };
    try {
      const results = await Promise.all(CATEGORIES.map((c) => build(c.actions)));
      const next: Record<CategoryKey, number> = { all: 0, auth: 0, records: 0, approvals: 0, access: 0 };
      CATEGORIES.forEach((c, i) => {
        next[c.key] = results[i].count || 0;
      });
      setCategoryCounts(next);
    } catch (e) {
      console.error('Error loading category counts:', e);
    }
  }, [filterModule, dateFrom, dateTo]);

  useEffect(() => {
    if (view === 'log') loadCategoryCounts();
  }, [view, loadCategoryCounts]);

  const exportCurrentView = async () => {
    let query = supabase
      .from('user_activity_logs')
      .select('*, user:system_users(full_name,username)')
      .order('created_at', { ascending: false })
      .limit(2000);
    query = applyBaseFilters(query);
    query = await applySearch(query);
    const { data } = await query;
    const headers = ['Date & Time', 'User', 'Action', 'Module', 'Details'];
    const csvContent = [
      headers.join(','),
      ...(data || []).map((log: any) =>
        [
          new Date(log.created_at).toLocaleString(),
          log.user?.full_name || 'Unknown',
          log.action_type,
          log.module,
          JSON.stringify(log.details || {}).replace(/,/g, ';'),
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const activeFilterCount =
    (filterAction !== 'all' ? 1 : 0) +
    (filterModule !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilterAction('all');
    setFilterModule('all');
    setDateFrom('');
    setDateTo('');
  };

  const groupedLogs = useMemo(() => {
    const map = new Map<string, AuditLogWithUser[]>();
    for (const log of logs) {
      const key = new Date(log.created_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, date: new Date(key), items }));
  }, [logs]);

  const formatDayLabel = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activity Feed</h2>
          <p className="text-slate-600 mt-1 text-sm">A human-readable timeline of everything happening across the platform.</p>
        </div>
        {view === 'log' && (
          <button
            onClick={exportCurrentView}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-sm shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setView('insights')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${
            view === 'insights' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Insights
        </button>
        <button
          onClick={() => setView('log')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${
            view === 'log' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ScrollText className="h-4 w-4" />
          Feed
        </button>
      </div>

      {view === 'insights' ? (
        <AuditLogInsights />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 pb-2 border-b border-slate-100 space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                const count = categoryCounts[c.key];
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <c.Icon className="h-3.5 w-3.5" />
                    {c.label}
                    <span className={`inline-flex items-center justify-center min-w-[18px] px-1 h-4 rounded-full text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by user, action, or module..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                  filtersOpen || activeFilterCount > 0
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold ${
                    filtersOpen ? 'bg-white text-emerald-600' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>

            {filtersOpen && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">All actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="view">View</option>
                  <option value="export">Export</option>
                </select>
                <select
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">All modules</option>
                  <option value="owners">Owners</option>
                  <option value="motorcycles">Motorcycles</option>
                  <option value="riders">Riders</option>
                  <option value="verifications">Verifications</option>
                  <option value="users">Users</option>
                  <option value="groups">Groups</option>
                  <option value="settings">Settings</option>
                  <option value="system">System</option>
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-14">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent mx-auto"></div>
              <p className="text-slate-500 mt-3 text-xs">Loading activity…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-14 px-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-2">
                <Activity className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-slate-700 font-semibold text-sm">No activity to show</p>
              <p className="text-slate-500 text-xs mt-0.5">Try adjusting your search, category, or filters.</p>
            </div>
          ) : (
            <div>
              {groupedLogs.map((group) => (
                <section key={group.key} className="border-b border-slate-100 last:border-b-0">
                  <div className="sticky top-0 z-10 px-4 sm:px-5 py-1.5 bg-slate-50/95 backdrop-blur border-b border-slate-100 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {formatDayLabel(group.date)}
                    </span>
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="text-[10px] font-semibold text-slate-400">
                      {group.items.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {group.items.map((log) => (
                      <FeedItem
                        key={log.id}
                        log={log}
                        expanded={!!expanded[log.id]}
                        onToggle={() => toggleExpanded(log.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              {totalCount === 0 ? (
                <>0 events</>
              ) : (
                <>
                  Showing <span className="font-semibold text-slate-700">{rangeStart}–{rangeEnd}</span>
                  {' '}of <span className="font-semibold text-slate-700">{totalCount.toLocaleString()}</span>
                </>
              )}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="px-2 text-slate-500 font-medium">
                Page <span className="text-slate-800 font-semibold">{page}</span> / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedItem({ log, expanded, onToggle }: { log: AuditLogWithUser; expanded: boolean; onToggle: () => void }) {
  const meta = getActionMeta(log.action_type);
  const { Icon } = meta;
  const sentence = buildSentence(log);
  const photo = extractPhoto(log.details);
  const detailEntries = meaningfulDetailEntries(log.details);
  const time = new Date(log.created_at);
  const userName = log.user?.full_name || log.user?.username || 'Unknown user';
  const userPhoto = log.user?.profile_photo_url;
  const initials = initialsOf(userName);
  const moduleBadge = MODULE_BADGE_CLASS[log.module] || MODULE_BADGE_CLASS.system;
  const canExpand = photo !== null || detailEntries.length > 0;

  return (
    <li>
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        className={`w-full text-left flex items-center gap-3 px-4 sm:px-5 py-2 hover:bg-slate-50/70 transition ${
          canExpand ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="relative shrink-0">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt={userName}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-[10px] font-semibold flex items-center justify-center ring-1 ring-slate-200">
              {initials}
            </div>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ring-2 ring-white flex items-center justify-center ${meta.bgClass}`}
          >
            <Icon className={`h-2.5 w-2.5 ${meta.textClass}`} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-snug truncate">
            <span className="font-semibold text-slate-900">{userName}</span>{' '}
            <span className="text-slate-600">{sentence}</span>
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ring-1 ring-inset ${moduleBadge}`}
            >
              {log.module}
            </span>
            <span className="text-[10px] text-slate-400">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {photo && !expanded && (
          <img
            src={photo}
            alt="attachment"
            className="hidden sm:block h-9 w-9 rounded-md object-cover ring-1 ring-slate-200 shrink-0"
          />
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <time
            className="text-[11px] text-slate-400 whitespace-nowrap"
            title={time.toLocaleString()}
          >
            {formatRelative(log.created_at)}
          </time>
          {canExpand && (
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </button>

      {canExpand && expanded && (
        <div className="pl-[52px] sm:pl-[60px] pr-4 sm:pr-5 pb-3 -mt-1">
          {photo && (
            <a
              href={photo}
              target="_blank"
              rel="noreferrer"
              className="mb-2 block max-w-[220px] rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition group"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                <img src={photo} alt="Uploaded" className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition-transform" />
                <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white">
                  <ImageIcon className="h-2.5 w-2.5" />
                  Photo
                </div>
              </div>
            </a>
          )}
          {detailEntries.length > 0 && (
            <div className="rounded-lg bg-slate-50 border border-slate-200/70 p-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                {detailEntries.slice(0, 10).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 shrink-0">
                      {humanKey(key)}
                    </span>
                    <span className="text-[11px] text-slate-700 font-medium truncate">
                      {renderDetailValue(value)}
                    </span>
                  </div>
                ))}
              </div>
              {detailEntries.length > 10 && (
                <p className="text-[10px] text-slate-400 mt-1.5">+{detailEntries.length - 10} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
