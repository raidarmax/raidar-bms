import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  AlertTriangle,
  Car,
  Shield,
  Zap,
  HardHat,
  Users,
  Eye,
  Info,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  BarChart2,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Award,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase, type Incident } from '../lib/supabase';
import IncidentsAnalytics from './IncidentsAnalytics';
import IncidentsInsights from './IncidentsInsights';
import CountyIncidentsDashboard from './CountyIncidentsDashboard';

const INCIDENT_CATEGORIES = [
  { value: 'all', label: 'All', icon: Filter, color: 'bg-slate-100 text-slate-700 border-slate-200', activeColor: 'bg-slate-800 text-white border-slate-800', barColor: '#64748b' },
  { value: 'accident', label: 'Accidents', icon: Car, color: 'bg-red-50 text-red-700 border-red-200', activeColor: 'bg-red-600 text-white border-red-600', barColor: '#dc2626' },
  { value: 'theft', label: 'Theft', icon: Shield, color: 'bg-orange-50 text-orange-700 border-orange-200', activeColor: 'bg-orange-600 text-white border-orange-600', barColor: '#ea580c' },
  { value: 'crime', label: 'Crime', icon: AlertTriangle, color: 'bg-purple-50 text-purple-700 border-purple-200', activeColor: 'bg-purple-600 text-white border-purple-600', barColor: '#9333ea' },
  { value: 'traffic_violation', label: 'Traffic', icon: Zap, color: 'bg-amber-50 text-amber-700 border-amber-200', activeColor: 'bg-amber-600 text-white border-amber-600', barColor: '#d97706' },
  { value: 'speeding', label: 'Speeding', icon: Zap, color: 'bg-blue-50 text-blue-700 border-blue-200', activeColor: 'bg-blue-600 text-white border-blue-600', barColor: '#2563eb' },
  { value: 'no_helmet', label: 'No Helmet', icon: HardHat, color: 'bg-yellow-50 text-yellow-700 border-yellow-200', activeColor: 'bg-yellow-600 text-white border-yellow-600', barColor: '#ca8a04' },
  { value: 'overloading', label: 'Overloading', icon: Users, color: 'bg-teal-50 text-teal-700 border-teal-200', activeColor: 'bg-teal-600 text-white border-teal-600', barColor: '#0d9488' },
  { value: 'reckless_driving', label: 'Reckless', icon: AlertTriangle, color: 'bg-rose-50 text-rose-700 border-rose-200', activeColor: 'bg-rose-600 text-white border-rose-600', barColor: '#e11d48' },
  { value: 'harassment', label: 'Harassment', icon: Shield, color: 'bg-pink-50 text-pink-700 border-pink-200', activeColor: 'bg-pink-600 text-white border-pink-600', barColor: '#db2777' },
  { value: 'other', label: 'Other', icon: Info, color: 'bg-gray-50 text-gray-700 border-gray-200', activeColor: 'bg-gray-600 text-white border-gray-600', barColor: '#6b7280' },
];

const STATUS_CONFIG = [
  { key: 'pending', label: 'Pending', color: '#d97706', bg: 'bg-amber-100', text: 'text-amber-700' },
  { key: 'confirmed', label: 'Confirmed', color: '#dc2626', bg: 'bg-red-100', text: 'text-red-700' },
  { key: 'resolved', label: 'Resolved', color: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { key: 'ignored', label: 'Dismissed', color: '#94a3b8', bg: 'bg-slate-100', text: 'text-slate-600' },
];

type MonthlyPoint = { label: string; count: number; resolved: number; pending: number; confirmed: number };

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data yet</div>
    );
  }

  const cx = 70; const cy = 70; const r = 52; const innerR = 32;
  let angle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const ix1 = cx + innerR * Math.cos(angle);
    const iy1 = cy + innerR * Math.sin(angle);
    const ix2 = cx + innerR * Math.cos(angle - sweep);
    const iy2 = cy + innerR * Math.sin(angle - sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...d,
      path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`,
    };
  });

  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {slices.map((s) => (
          <path key={s.label} d={s.path} fill={s.color} stroke="white" strokeWidth="2">
            <title>{s.label}: {s.value}</title>
          </path>
        ))}
        <text x="70" y="67" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1e293b">{total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="9" fill="#94a3b8">TOTAL</text>
      </svg>
      <div className="space-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 w-20">{s.label}</span>
            <span className="font-semibold text-slate-800">{s.value}</span>
            <span className="text-slate-400">({total > 0 ? Math.round((s.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal bar chart ───────────────────────────────────────────────────────
function CategoryBarChart({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const categories = INCIDENT_CATEGORIES.filter(c => c.value !== 'all');
  const maxVal = Math.max(...categories.map(c => categoryCounts[c.value] || 0), 1);

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const count = categoryCounts[cat.value] || 0;
        const pct = (count / maxVal) * 100;
        return (
          <div key={cat.value} className="flex items-center gap-2 group">
            <span className="text-xs text-slate-500 w-20 text-right flex-shrink-0 truncate">{cat.label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%`, background: cat.barColor }}
              >
                {count > 0 && (
                  <span className="text-[10px] font-bold text-white leading-none">{count}</span>
                )}
              </div>
            </div>
            {count === 0 && <span className="text-[10px] text-slate-300">0</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Monthly trend — stacked bars + resolution-rate line + side stats ─────────
function TrendChart({ points }: { points: MonthlyPoint[] }) {
  if (points.length === 0 || points.every(p => p.count === 0)) {
    return <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No data yet</div>;
  }

  const W = 380;
  const H = 160;
  const padL = 26;
  const padR = 32;
  const padT = 14;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(...points.map(p => p.count), 1);
  const barSlot = plotW / points.length;
  const barW = Math.min(barSlot * 0.55, 28);

  // Y ticks for count axis (left)
  const yTicks = maxVal <= 3
    ? Array.from({ length: maxVal + 1 }, (_, i) => i)
    : [0, Math.ceil(maxVal / 2), maxVal];

  // Resolution-rate line points (right axis 0–100)
  const linePoints = points.map((p, i) => {
    const cx = padL + barSlot * i + barSlot / 2;
    const rate = p.count > 0 ? (p.resolved / p.count) * 100 : 0;
    const cy = padT + (1 - rate / 100) * plotH;
    return { cx, cy, rate, hasData: p.count > 0 };
  });

  const activeLinePoints = linePoints.filter(p => p.hasData);
  const polyline = activeLinePoints.map(p => `${p.cx},${p.cy}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        style={{ maxHeight: 220 }}
      >
        <defs>
          <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="confirmedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        {/* Y-axis grid + labels (left = count) */}
        {yTicks.map(tick => {
          const y = padT + (1 - tick / maxVal) * plotH;
          return (
            <g key={`yt-${tick}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray={tick === 0 ? '0' : '2 2'} />
              <text x={padL - 4} y={y + 3} fontSize="8" fill="#94a3b8" textAnchor="end">{tick}</text>
            </g>
          );
        })}

        {/* Right axis labels (resolution rate %) */}
        {[0, 50, 100].map(pct => {
          const y = padT + (1 - pct / 100) * plotH;
          return (
            <text key={`rt-${pct}`} x={W - padR + 4} y={y + 3} fontSize="8" fill="#94a3b8" textAnchor="start">
              {pct}%
            </text>
          );
        })}

        {/* Stacked bars */}
        {points.map((p, i) => {
          const xCenter = padL + barSlot * i + barSlot / 2;
          const x = xCenter - barW / 2;
          const heightPer = (n: number) => (n / maxVal) * plotH;

          const hResolved = heightPer(p.resolved);
          const hConfirmed = heightPer(p.confirmed);
          const hPending = heightPer(p.pending);
          const yResolved = padT + plotH - hResolved;
          const yConfirmed = yResolved - hConfirmed;
          const yPending = yConfirmed - hPending;

          const isLast = i === points.length - 1;

          return (
            <g key={`bar-${i}`}>
              {/* Current-month highlight */}
              {isLast && p.count > 0 && (
                <rect x={x - 3} y={padT} width={barW + 6} height={plotH} fill="#f1f5f9" rx="3" opacity="0.6" />
              )}
              {p.resolved > 0 && (
                <rect x={x} y={yResolved} width={barW} height={hResolved} fill="url(#resolvedGrad)" rx="2">
                  <title>{p.label} · Resolved: {p.resolved}</title>
                </rect>
              )}
              {p.confirmed > 0 && (
                <rect x={x} y={yConfirmed} width={barW} height={hConfirmed} fill="url(#confirmedGrad)" rx="2">
                  <title>{p.label} · Confirmed: {p.confirmed}</title>
                </rect>
              )}
              {p.pending > 0 && (
                <rect x={x} y={yPending} width={barW} height={hPending} fill="url(#pendingGrad)" rx="2">
                  <title>{p.label} · Pending: {p.pending}</title>
                </rect>
              )}
              {/* Total count label on top of bar */}
              {p.count > 0 && (
                <text x={xCenter} y={yPending - 3} fontSize="8" fontWeight="700" fill="#334155" textAnchor="middle">
                  {p.count}
                </text>
              )}
              {/* Month label */}
              <text
                x={xCenter}
                y={H - 8}
                fontSize="9"
                fill={isLast ? '#059669' : '#94a3b8'}
                fontWeight={isLast ? '700' : '400'}
                textAnchor="middle"
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Resolution-rate line overlay */}
        {activeLinePoints.length >= 2 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}
        {activeLinePoints.map((p, i) => (
          <g key={`line-${i}`}>
            <circle cx={p.cx} cy={p.cy} r="2.5" fill="white" stroke="#2563eb" strokeWidth="1.5" />
            <title>Resolution: {Math.round(p.rate)}%</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
type IncidentsPanelProps = {
  onViewIncident: (incident: any) => void;
  searchIncidents: (query: string) => Promise<any[]>;
};

export default function IncidentsPanel({ onViewIncident, searchIncidents }: IncidentsPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'geography' | 'personnel'>('overview');
  const [activeCategory, setActiveCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'resolved' | 'ignored'>('all');
  const [latestIncidents, setLatestIncidents] = useState<any[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, confirmed: 0, resolved: 0, ignored: 0 });
  const [monthlyPoints, setMonthlyPoints] = useState<MonthlyPoint[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadIncidentStats();
  }, []);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [activeCategory, statusFilter]);

  useEffect(() => {
    loadIncidentsPage(activeCategory, statusFilter, currentPage);
  }, [activeCategory, statusFilter, currentPage]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchIncidents(searchQuery.trim());
        setSearchResults(results);
        setHasSearched(true);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, searchIncidents]);

  const loadIncidentStats = async () => {
    try {
      const { data } = await supabase
        .from('incidents')
        .select('incident_type, status, created_at');

      if (data) {
        const counts: Record<string, number> = {};
        const statuses = { pending: 0, confirmed: 0, resolved: 0, ignored: 0 };
        type MonthBucket = { total: number; resolved: number; pending: number; confirmed: number };
        const byMonth: Record<string, MonthBucket> = {};

        data.forEach((inc) => {
          counts[inc.incident_type] = (counts[inc.incident_type] || 0) + 1;
          if (inc.status in statuses) statuses[inc.status as keyof typeof statuses]++;
          const d = new Date(inc.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const bucket = byMonth[key] ?? { total: 0, resolved: 0, pending: 0, confirmed: 0 };
          bucket.total++;
          if (inc.status === 'resolved') bucket.resolved++;
          else if (inc.status === 'pending') bucket.pending++;
          else if (inc.status === 'confirmed') bucket.confirmed++;
          byMonth[key] = bucket;
        });

        setCategoryCounts(counts);
        setStatusCounts(statuses);
        setTotalCount(data.length);

        // Build last 6 months trend
        const now = new Date();
        const points: MonthlyPoint[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const monthLabel = d.toLocaleString('default', { month: 'short' });
          const bucket = byMonth[key] ?? { total: 0, resolved: 0, pending: 0, confirmed: 0 };
          points.push({
            label: monthLabel,
            count: bucket.total,
            resolved: bucket.resolved,
            pending: bucket.pending,
            confirmed: bucket.confirmed,
          });
        }
        setMonthlyPoints(points);
      }
    } catch (e) {
      console.error('Error loading incident stats:', e);
    }
  };

  const loadIncidentsPage = async (
    category: string,
    status: 'all' | 'pending' | 'confirmed' | 'resolved' | 'ignored',
    page: number,
  ) => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('incidents')
        .select('*, motorcycle:motorcycles(registration_number), rider:riders(name, id_number)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (category !== 'all') query = query.eq('incident_type', category);
      if (status !== 'all') query = query.eq('status', status);

      const { data, count } = await query;
      setLatestIncidents(data || []);
      setPageTotal(count ?? 0);
    } catch (e) {
      console.error('Error loading incidents:', e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-3.5 w-3.5" />;
      case 'confirmed': return <AlertTriangle className="h-3.5 w-3.5" />;
      case 'resolved': return <CheckCircle className="h-3.5 w-3.5" />;
      case 'ignored': return <XCircle className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'confirmed': return 'bg-red-100 text-red-700';
      case 'resolved': return 'bg-emerald-100 text-emerald-700';
      case 'ignored': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const renderIncidentRow = (incident: any) => (
    <tr key={incident.id} className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-900">
          {new Date(incident.incident_date).toLocaleDateString()}
        </div>
        <div className="text-xs text-slate-500">
          {new Date(incident.incident_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-medium capitalize">
          {incident.incident_type.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        {incident.motorcycle ? (
          <span className="text-sm text-slate-700 font-medium">{incident.motorcycle.registration_number}</span>
        ) : incident.unregistered_details ? (
          <span className="text-xs text-red-600 font-medium">Unregistered</span>
        ) : (
          <span className="text-xs text-slate-400">N/A</span>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-slate-600">{incident.location || '-'}</span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${getStatusStyle(incident.status)}`}>
          {getStatusIcon(incident.status)}
          <span className="capitalize">{incident.status}</span>
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-sm text-slate-600">{incident.reporter_name}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onViewIncident(incident)}
          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">View</span>
        </button>
      </td>
    </tr>
  );

  const displayedIncidents = hasSearched ? searchResults : latestIncidents;
  const totalPages = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));
  const pageStart = pageTotal === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, pageTotal);

  const donutData = STATUS_CONFIG.map(s => ({
    label: s.label,
    value: statusCounts[s.key as keyof typeof statusCounts],
    color: s.color,
  }));

  // Resolution rate
  const resolutionRate = totalCount > 0
    ? Math.round((statusCounts.resolved / totalCount) * 100)
    : 0;

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const topCategoryConfig = topCategory
    ? INCIDENT_CATEGORIES.find(c => c.value === topCategory[0])
    : null;

  const TABS = [
    { key: 'overview' as const, label: 'Overview', icon: LayoutDashboard, count: null },
    { key: 'incidents' as const, label: 'Incidents', icon: ListChecks, count: totalCount },
    { key: 'geography' as const, label: 'Geography', icon: MapPin, count: null },
    { key: 'personnel' as const, label: 'Stations & Officers', icon: Award, count: null },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Incident Reports</h2>
            <p className="text-sm text-slate-500">{totalCount.toLocaleString()} total incidents recorded</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">{resolutionRate}% resolved</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 sticky top-0 bg-white z-10 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mb-px">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── OVERVIEW TAB ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && <IncidentsInsights />}

      {/* ─── INCIDENTS TAB (paginated list) ────────────────────────────── */}
      {activeTab === 'incidents' && (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {/* Search + status filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by type, description, location, or reporter name..."
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Status:</span>
              {(['all', 'pending', 'confirmed', 'resolved', 'ignored'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    statusFilter === s
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s === 'ignored' ? 'Dismissed' : s}
                </button>
              ))}
            </div>
          </div>

          {searchQuery.length > 0 && searchQuery.length < 3 && (
            <p className="text-xs text-amber-600 mt-2 font-medium">
              Type {3 - searchQuery.length} more character{3 - searchQuery.length > 1 ? 's' : ''} to search...
            </p>
          )}

          {!hasSearched && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Filter by Category</p>
              <div className="flex flex-wrap gap-2">
                {INCIDENT_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const count = cat.value === 'all' ? totalCount : (categoryCounts[cat.value] || 0);
                  const isActive = activeCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setActiveCategory(cat.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isActive ? cat.activeColor : cat.color
                      } hover:shadow-sm`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{cat.label}</span>
                      {count > 0 && (
                        <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-white/20' : 'bg-black/5'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {searching || (loading && !hasSearched) ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
              <span className="ml-3 text-sm text-slate-600">
                {searching ? 'Searching...' : 'Loading incidents...'}
              </span>
            </div>
          ) : displayedIncidents.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">
                {hasSearched ? 'No incidents match your search' : 'No incidents match these filters'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {hasSearched ? 'Try a different search term' : 'Try clearing the category or status filter'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-sm text-slate-600">
                  {hasSearched ? (
                    <>Showing <span className="font-semibold text-slate-800">{searchResults.length}</span> search result{searchResults.length !== 1 ? 's' : ''}</>
                  ) : (
                    <>Showing <span className="font-semibold text-slate-800">{pageStart}–{pageEnd}</span> of <span className="font-semibold text-slate-800">{pageTotal.toLocaleString()}</span></>
                  )}
                </p>
                {!hasSearched && totalPages > 1 && (
                  <p className="text-xs text-slate-500">Page {currentPage} of {totalPages}</p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Motorcycle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Reporter</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedIncidents.map(renderIncidentRow)}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!hasSearched && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <div className="hidden sm:flex items-center gap-1">
                    {(() => {
                      const pages: (number | 'gap')[] = [];
                      const push = (v: number | 'gap') => pages.push(v);
                      const maxShown = 5;
                      if (totalPages <= maxShown + 2) {
                        for (let i = 1; i <= totalPages; i++) push(i);
                      } else {
                        push(1);
                        const start = Math.max(2, currentPage - 1);
                        const end = Math.min(totalPages - 1, currentPage + 1);
                        if (start > 2) push('gap');
                        for (let i = start; i <= end; i++) push(i);
                        if (end < totalPages - 1) push('gap');
                        push(totalPages);
                      }
                      return pages.map((p, idx) =>
                        p === 'gap' ? (
                          <span key={`gap-${idx}`} className="px-2 text-slate-400">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`min-w-[32px] h-8 px-2 text-sm font-medium rounded-md transition-colors ${
                              currentPage === p
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* ─── GEOGRAPHY TAB (counties + drill-down) ─────────────────────── */}
      {activeTab === 'geography' && <CountyIncidentsDashboard />}

      {/* ─── PERSONNEL TAB ─────────────────────────────────────────────── */}
      {activeTab === 'personnel' && <IncidentsAnalytics view="personnel" />}
    </div>
  );
}
