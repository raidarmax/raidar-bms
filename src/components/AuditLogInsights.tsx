import { useEffect, useMemo, useState } from 'react';
import { Activity, Users, LogIn, PlusCircle, CreditCard as Edit3, Trash2, ArrowUp, ArrowDown, Clock, TrendingUp, Layers, ShieldCheck, Zap, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type LogRow = {
  id: string;
  user_id: string;
  action_type: string;
  module: string;
  created_at: string;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  user?: { full_name: string | null; username: string | null } | null;
};

const ACTION_META: Record<string, { color: string; bar: string; icon: JSX.Element }> = {
  login: { color: 'bg-slate-100 text-slate-700', bar: 'from-slate-400 to-slate-500', icon: <LogIn className="h-3.5 w-3.5" /> },
  logout: { color: 'bg-slate-100 text-slate-700', bar: 'from-slate-300 to-slate-400', icon: <LogIn className="h-3.5 w-3.5 rotate-180" /> },
  create: { color: 'bg-emerald-100 text-emerald-700', bar: 'from-emerald-400 to-emerald-500', icon: <PlusCircle className="h-3.5 w-3.5" /> },
  update: { color: 'bg-blue-100 text-blue-700', bar: 'from-blue-400 to-blue-500', icon: <Edit3 className="h-3.5 w-3.5" /> },
  delete: { color: 'bg-red-100 text-red-700', bar: 'from-red-400 to-red-500', icon: <Trash2 className="h-3.5 w-3.5" /> },
  approve: { color: 'bg-emerald-100 text-emerald-700', bar: 'from-emerald-400 to-teal-500', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  reject: { color: 'bg-red-100 text-red-700', bar: 'from-red-400 to-rose-500', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  view: { color: 'bg-slate-100 text-slate-700', bar: 'from-slate-300 to-slate-400', icon: <Activity className="h-3.5 w-3.5" /> },
  export: { color: 'bg-amber-100 text-amber-700', bar: 'from-amber-400 to-amber-500', icon: <TrendingUp className="h-3.5 w-3.5" /> },
};

const MODULE_META: Record<string, string> = {
  owners: 'from-blue-400 to-blue-500',
  motorcycles: 'from-emerald-400 to-emerald-500',
  riders: 'from-amber-400 to-amber-500',
  verifications: 'from-teal-400 to-teal-500',
  users: 'from-red-400 to-red-500',
  groups: 'from-slate-400 to-slate-500',
  settings: 'from-slate-500 to-slate-600',
  incidents: 'from-orange-400 to-orange-500',
  fines: 'from-rose-400 to-rose-500',
  system: 'from-slate-400 to-slate-500',
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AuditLogInsights() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: logData }, { count: userCount }] = await Promise.all([
          supabase
            .from('user_activity_logs')
            .select('id, user_id, action_type, module, created_at, ip_address, details, user:system_users(full_name, username)')
            .order('created_at', { ascending: false })
            .limit(2000),
          supabase.from('system_users').select('*', { count: 'exact', head: true }),
        ]);
        setLogs((logData as any as LogRow[]) || []);
        setTotalUsers(userCount || 0);
      } catch (e) {
        console.error('AuditLogInsights load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const derived = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const last7d = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const last14dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13).getTime();

    const total = logs.length;
    const todayLogs = logs.filter((l) => new Date(l.created_at).getTime() >= startOfToday);
    const yesterdayLogs = logs.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= startOfYesterday && t < startOfToday;
    });
    const last7Logs = logs.filter((l) => new Date(l.created_at).getTime() >= last7d);

    const activeUsersToday = new Set(todayLogs.map((l) => l.user_id)).size;
    const activeUsersYesterday = new Set(yesterdayLogs.map((l) => l.user_id)).size;
    const loginsToday = todayLogs.filter((l) => l.action_type === 'login').length;
    const createsToday = todayLogs.filter((l) => l.action_type === 'create').length;
    const deletesLast7 = last7Logs.filter((l) => l.action_type === 'delete').length;

    const growthToday = yesterdayLogs.length
      ? Math.round(((todayLogs.length - yesterdayLogs.length) / yesterdayLogs.length) * 100)
      : todayLogs.length > 0
      ? 100
      : 0;
    const activeGrowth = activeUsersYesterday
      ? Math.round(((activeUsersToday - activeUsersYesterday) / activeUsersYesterday) * 100)
      : activeUsersToday > 0
      ? 100
      : 0;

    // Action distribution
    const actionCounts: Record<string, number> = {};
    logs.forEach((l) => {
      actionCounts[l.action_type] = (actionCounts[l.action_type] || 0) + 1;
    });
    const actions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    // Module distribution
    const moduleCounts: Record<string, number> = {};
    logs.forEach((l) => {
      moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1;
    });
    const modules = Object.entries(moduleCounts)
      .map(([m, count]) => ({ module: m, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top users
    const userCounts: Record<string, { name: string; username: string; count: number }> = {};
    logs.forEach((l) => {
      const key = l.user_id || 'unknown';
      if (!userCounts[key]) {
        userCounts[key] = {
          name: l.user?.full_name || 'Unknown',
          username: l.user?.username || 'unknown',
          count: 0,
        };
      }
      userCounts[key].count += 1;
    });
    const topUsers = Object.values(userCounts).sort((a, b) => b.count - a.count).slice(0, 6);

    // 14-day trend
    const dayCounts: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(last14dStart);
      d.setDate(d.getDate() + i);
      dayCounts[dayKey(d)] = 0;
    }
    logs.forEach((l) => {
      const d = new Date(l.created_at);
      if (d.getTime() >= last14dStart) {
        const k = dayKey(d);
        if (dayCounts[k] !== undefined) dayCounts[k] += 1;
      }
    });
    const trend = Object.entries(dayCounts).map(([k, count]) => {
      const [y, mo, day] = k.split('-').map(Number);
      const d = new Date(y, mo - 1, day);
      return { key: k, label: d.toLocaleString('en-KE', { weekday: 'short' }).slice(0, 2), count };
    });
    const maxTrend = Math.max(1, ...trend.map((t) => t.count));

    // Hourly distribution (last 24h)
    const hourCounts = Array.from({ length: 24 }, () => 0);
    logs.forEach((l) => {
      const d = new Date(l.created_at);
      if (now.getTime() - d.getTime() <= 24 * 60 * 60 * 1000) {
        hourCounts[d.getHours()] += 1;
      }
    });
    const maxHour = Math.max(1, ...hourCounts);

    // Latest events
    const latest = logs.slice(0, 6);

    // Peak hour
    const peakHourIdx = hourCounts.indexOf(maxHour);
    const peakHourLabel = maxHour > 0
      ? `${String(peakHourIdx).padStart(2, '0')}:00 · ${maxHour} events`
      : 'No events last 24h';

    return {
      total,
      todayCount: todayLogs.length,
      activeUsersToday,
      loginsToday,
      createsToday,
      deletesLast7,
      growthToday,
      activeGrowth,
      actions,
      modules,
      topUsers,
      trend,
      maxTrend,
      hourCounts,
      maxHour,
      peakHourLabel,
      latest,
    };
  }, [logs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-emerald-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading insights...</p>
        </div>
      </div>
    );
  }

  const totalActions = derived.actions.reduce((s, a) => s + a.count, 0) || 1;
  const totalModules = derived.modules.reduce((s, m) => s + m.count, 0) || 1;
  const engagementRate = totalUsers > 0 ? Math.round((derived.activeUsersToday / totalUsers) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPI
          label="Total Events"
          value={derived.total.toLocaleString()}
          hint={`${derived.todayCount} today`}
          growth={derived.growthToday}
          gradient="from-slate-600 to-slate-800"
          icon={<Activity className="h-4 w-4 text-white" />}
        />
        <KPI
          label="Active Users"
          value={String(derived.activeUsersToday)}
          hint={`${engagementRate}% of ${totalUsers} users`}
          growth={derived.activeGrowth}
          gradient="from-emerald-500 to-teal-600"
          icon={<Users className="h-4 w-4 text-white" />}
        />
        <KPI
          label="Logins Today"
          value={String(derived.loginsToday)}
          hint="24-hour sessions"
          gradient="from-blue-500 to-blue-700"
          icon={<LogIn className="h-4 w-4 text-white" />}
        />
        <KPI
          label="Creations"
          value={String(derived.createsToday)}
          hint="New records today"
          gradient="from-amber-500 to-orange-600"
          icon={<PlusCircle className="h-4 w-4 text-white" />}
        />
        <KPI
          label="Deletes / 7d"
          value={String(derived.deletesLast7)}
          hint="Sensitive actions"
          gradient="from-rose-500 to-red-600"
          icon={<Trash2 className="h-4 w-4 text-white" />}
        />
      </div>

      {/* Row 1: 14d trend + Actions + Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="14-Day Activity"
          subtitle="Events per day"
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        >
          {derived.trend.every((t) => t.count === 0) ? (
            <Empty label="No activity in the last 14 days" />
          ) : (
            <div className="flex items-end justify-between gap-1 h-32 mt-2">
              {derived.trend.map((t, i) => (
                <div key={t.key} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[9px] text-slate-500 font-semibold opacity-0 group-hover:opacity-100 transition">{t.count}</div>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-blue-500 to-blue-400 transition-all"
                    style={{ height: `${(t.count / derived.maxTrend) * 100}%`, minHeight: t.count > 0 ? '3px' : '1px' }}
                  />
                  <div className="text-[9px] text-slate-400">{i % 2 === 0 ? t.label : ''}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Action Types"
          subtitle={`${derived.actions.length} distinct actions`}
          icon={<Zap className="h-4 w-4 text-amber-600" />}
        >
          {derived.actions.length === 0 ? (
            <Empty label="No actions logged yet" />
          ) : (
            <div className="space-y-2.5">
              {derived.actions.slice(0, 6).map((a) => {
                const meta = ACTION_META[a.action] || ACTION_META.view;
                const pct = Math.round((a.count / totalActions) * 100);
                return (
                  <div key={a.action}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
                          {meta.icon}
                          {a.action}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{a.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${meta.bar} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Modules Touched"
          subtitle="Where the activity lands"
          icon={<Layers className="h-4 w-4 text-teal-600" />}
        >
          {derived.modules.length === 0 ? (
            <Empty label="No module activity" />
          ) : (
            <div className="space-y-2.5">
              {derived.modules.map((m) => {
                const pct = Math.round((m.count / totalModules) * 100);
                const grad = MODULE_META[m.module] || 'from-slate-400 to-slate-500';
                return (
                  <div key={m.module}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-700 capitalize">{m.module}</p>
                      <span className="text-xs font-semibold text-slate-700">{m.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Top users + Hourly + Latest */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Most Active Users"
          subtitle="By recorded events"
          icon={<Users className="h-4 w-4 text-emerald-600" />}
        >
          {derived.topUsers.length === 0 ? (
            <Empty label="No user activity yet" />
          ) : (
            <div className="space-y-2">
              {derived.topUsers.map((u, i) => {
                const max = derived.topUsers[0].count || 1;
                const pct = Math.round((u.count / max) * 100);
                return (
                  <div key={u.username + i} className="flex items-center gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                        <span className="text-xs font-semibold text-slate-600 ml-2">{u.count}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">@{u.username}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Hourly Distribution"
          subtitle={derived.peakHourLabel}
          icon={<Clock className="h-4 w-4 text-slate-600" />}
        >
          {derived.maxHour === 0 ? (
            <Empty label="No events in last 24 hours" />
          ) : (
            <div className="flex items-end gap-[3px] h-24 mt-2">
              {derived.hourCounts.map((c, h) => (
                <div key={h} className="flex-1 flex flex-col items-center gap-0.5 group">
                  <div
                    className={`w-full rounded-t bg-gradient-to-t ${c > 0 ? 'from-slate-600 to-slate-400' : 'from-slate-200 to-slate-100'} transition-all`}
                    style={{ height: `${(c / derived.maxHour) * 100}%`, minHeight: c > 0 ? '2px' : '1px' }}
                    title={`${h}:00 — ${c} events`}
                  />
                  {h % 4 === 0 && (
                    <div className="text-[8px] text-slate-400">{String(h).padStart(2, '0')}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-2 text-center">Hour of day (00-23)</p>
        </Card>

        <Card
          title="Latest Events"
          subtitle="Real-time feed"
          icon={<Calendar className="h-4 w-4 text-blue-600" />}
        >
          {derived.latest.length === 0 ? (
            <Empty label="No recent events" />
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto -mr-2 pr-2">
              {derived.latest.map((l) => {
                const meta = ACTION_META[l.action_type] || ACTION_META.view;
                const t = new Date(l.created_at);
                return (
                  <div key={l.id} className="flex items-start gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide shrink-0 ${meta.color}`}>
                      {meta.icon}
                      {l.action_type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700 truncate">
                        <span className="font-semibold">{l.user?.full_name || 'Unknown'}</span>
                        <span className="text-slate-500"> · {l.module}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {t.toLocaleDateString()} · {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function KPI({ label, value, hint, growth, gradient, icon }: {
  label: string;
  value: string;
  hint?: string;
  growth?: number;
  gradient: string;
  icon: JSX.Element;
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
    </div>
  );
}

function Card({ title, subtitle, icon, children }: {
  title: string;
  subtitle?: string;
  icon: JSX.Element;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-md bg-slate-50 flex items-center justify-center shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-center py-6">
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
