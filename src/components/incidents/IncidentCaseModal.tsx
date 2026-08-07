import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, X, CheckCircle2, Clock, MapPin, Hash, Bike, User, Building2,
  FileText, Image as ImageIcon, MessageSquare, Shield, Send, Upload, ChevronRight,
  Flame, Timer, XCircle, ShieldCheck, Loader2, Sparkles, Paperclip, Info,
  ScrollText, Gavel, Phone, Mail, ChevronsLeftRight,
} from 'lucide-react';
import {
  supabase,
  type Incident,
  type IncidentAppeal,
  type IncidentEvidence,
  type IncidentResolution,
  type Motorcycle,
  type Rider,
} from '../../lib/supabase';
import type { IncidentPanelTab } from './IncidentsPanel';

type Role = 'owner' | 'rider';

type IncidentCaseModalProps = {
  role: Role;
  incident: Incident;
  initialTab?: IncidentPanelTab;
  motorcycle?: Motorcycle | null;
  rider?: Rider | null;
  stationName?: string | null;
  riderId?: string;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
};

type StatusKey = 'pending' | 'confirmed' | 'resolved' | 'dismissed';

const STATUS_META: Record<StatusKey, {
  label: string;
  chip: string;
  headerFrom: string;
  headerTo: string;
  headerText: string;
  icon: typeof Timer;
}> = {
  pending: {
    label: 'Pending review',
    chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    headerFrom: 'from-amber-500',
    headerTo: 'to-orange-600',
    headerText: 'text-white',
    icon: Timer,
  },
  confirmed: {
    label: 'Confirmed',
    chip: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    headerFrom: 'from-red-600',
    headerTo: 'to-rose-700',
    headerText: 'text-white',
    icon: Flame,
  },
  resolved: {
    label: 'Resolved',
    chip: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    headerFrom: 'from-emerald-600',
    headerTo: 'to-teal-700',
    headerText: 'text-white',
    icon: CheckCircle2,
  },
  dismissed: {
    label: 'Dismissed',
    chip: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    headerFrom: 'from-slate-600',
    headerTo: 'to-slate-800',
    headerText: 'text-white',
    icon: XCircle,
  },
};

const PROGRESS_STEPS: Array<{ key: string; label: string; description: string }> = [
  { key: 'reported', label: 'Reported', description: 'Incident submitted' },
  { key: 'review', label: 'Under review', description: 'Being investigated' },
  { key: 'response', label: 'Response issued', description: 'Official decision' },
  { key: 'closed', label: 'Resolved', description: 'Case closed' },
];

function toStatusKey(status: string): StatusKey {
  const s = (status || '').toLowerCase();
  if (s === 'pending' || s === 'confirmed' || s === 'resolved' || s === 'dismissed') return s;
  return 'pending';
}

function formatType(type: string): string {
  return type
    .split('_')
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(' ');
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function currentStepIndex(status: StatusKey, incident: Incident): number {
  if (status === 'resolved' || status === 'dismissed') return 3;
  if (incident.admin_response || incident.response_sent_at || status === 'confirmed') return 2;
  return 1;
}

function uploaderLabel(uploaded_by: string): string {
  const key = (uploaded_by || '').toLowerCase();
  if (key === 'reporter') return 'Reporter';
  if (key === 'rider') return 'Rider';
  if (key === 'owner') return 'Owner';
  if (key === 'officer' || key === 'police') return 'Officer';
  if (key === 'admin' || key === 'admin_user') return 'Admin';
  return uploaded_by || 'Party';
}

function uploaderTone(uploaded_by: string): string {
  const key = (uploaded_by || '').toLowerCase();
  if (key === 'reporter') return 'bg-slate-900 text-white';
  if (key === 'rider') return 'bg-blue-600 text-white';
  if (key === 'owner') return 'bg-emerald-600 text-white';
  if (key === 'officer' || key === 'police') return 'bg-indigo-600 text-white';
  return 'bg-slate-500 text-white';
}

export default function IncidentCaseModal({
  role,
  incident,
  initialTab = 'overview',
  motorcycle,
  rider,
  stationName,
  riderId,
  onClose,
  onRefresh,
}: IncidentCaseModalProps) {
  const [tab, setTab] = useState<IncidentPanelTab>(initialTab);
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const [evidence, setEvidence] = useState<IncidentEvidence[]>([]);
  const [appeals, setAppeals] = useState<IncidentAppeal[]>([]);
  const [resolutions, setResolutions] = useState<IncidentResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<IncidentEvidence | null>(null);

  const [responseText, setResponseText] = useState('');
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const [appealText, setAppealText] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const [ownerNote, setOwnerNote] = useState('');
  const [ownerFiles, setOwnerFiles] = useState<File[]>([]);
  const [submittingOwnerInfo, setSubmittingOwnerInfo] = useState(false);

  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const responseFileInputRef = useRef<HTMLInputElement | null>(null);
  const ownerFileInputRef = useRef<HTMLInputElement | null>(null);

  const statusKey = toStatusKey(incident.status);
  const meta = STATUS_META[statusKey];
  const StatusIcon = meta.icon;
  const stepIndex = currentStepIndex(statusKey, incident);

  const loadCase = async () => {
    setLoading(true);
    try {
      const [ev, ap, rs] = await Promise.all([
        supabase
          .from('incident_evidence')
          .select('*')
          .eq('incident_id', incident.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('incident_appeals')
          .select('*')
          .eq('incident_id', incident.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('incident_resolutions')
          .select('*')
          .eq('incident_id', incident.id)
          .order('created_at', { ascending: true }),
      ]);
      if (!ev.error) setEvidence(ev.data ?? []);
      if (!ap.error) setAppeals(ap.data ?? []);
      if (!rs.error) setResolutions(rs.data ?? []);
    } catch (err) {
      console.error('Error loading incident case:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.id]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, onClose]);

  const evidenceByUploader = useMemo(() => {
    const groups: Record<string, IncidentEvidence[]> = {};
    for (const item of evidence) {
      const key = uploaderLabel(item.uploaded_by);
      groups[key] = groups[key] || [];
      groups[key].push(item);
    }
    return groups;
  }, [evidence]);

  const timelineItems = useMemo(() => {
    const items: Array<{
      key: string;
      icon: any;
      title: string;
      body?: string | null;
      timestamp: string | null;
      tone: 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'indigo';
    }> = [];

    items.push({
      key: 'reported',
      icon: AlertTriangle,
      title: 'Incident reported',
      body: `Filed by ${incident.reporter_name}${incident.reporter_phone ? ` · ${incident.reporter_phone}` : ''}`,
      timestamp: incident.created_at,
      tone: 'slate',
    });

    for (const r of resolutions) {
      const to = (r.to_status || '').toLowerCase();
      const tone: any =
        r.action_type?.toLowerCase().includes('resolve') || to === 'resolved'
          ? 'emerald'
          : r.action_type?.toLowerCase().includes('dismiss') || to === 'dismissed'
          ? 'slate'
          : r.action_type?.toLowerCase().includes('appeal')
          ? 'blue'
          : r.action_type?.toLowerCase().includes('response')
          ? 'indigo'
          : r.action_type?.toLowerCase().includes('confirm') || to === 'confirmed'
          ? 'red'
          : 'amber';
      const iconMap: Record<string, any> = {
        emerald: CheckCircle2,
        slate: XCircle,
        blue: MessageSquare,
        indigo: ShieldCheck,
        red: Flame,
        amber: Timer,
      };
      const label = (r.action_type || 'update').replace(/_/g, ' ');
      items.push({
        key: r.id,
        icon: iconMap[tone] || Info,
        title: label.charAt(0).toUpperCase() + label.slice(1),
        body: r.notes || (r.actor_name ? `by ${r.actor_name} (${r.actor_type})` : null),
        timestamp: r.created_at,
        tone,
      });
    }

    if (incident.response_sent_at && !resolutions.some((r) => r.action_type?.toLowerCase().includes('response'))) {
      items.push({
        key: 'response',
        icon: ShieldCheck,
        title: `Official response · ${incident.response_type ? incident.response_type.charAt(0).toUpperCase() + incident.response_type.slice(1) : 'Notice'}`,
        body: incident.admin_response,
        timestamp: incident.response_sent_at,
        tone: 'indigo',
      });
    }

    if (incident.rider_response_submitted_at) {
      items.push({
        key: 'rider-response',
        icon: MessageSquare,
        title: 'Rider submitted a response',
        body: incident.rider_response,
        timestamp: incident.rider_response_submitted_at,
        tone: 'blue',
      });
    }

    for (const a of appeals) {
      items.push({
        key: `appeal-${a.id}`,
        icon: Gavel,
        title: `Appeal filed · ${a.appeal_status}`,
        body: a.appeal_text,
        timestamp: a.created_at,
        tone: a.appeal_status === 'approved' ? 'emerald' : a.appeal_status === 'rejected' ? 'red' : 'amber',
      });
      if (a.admin_response && a.reviewed_at) {
        items.push({
          key: `appeal-reviewed-${a.id}`,
          icon: Shield,
          title: `Appeal ${a.appeal_status}`,
          body: a.admin_response,
          timestamp: a.reviewed_at,
          tone: a.appeal_status === 'approved' ? 'emerald' : 'red',
        });
      }
    }

    if (incident.resolved_at) {
      items.push({
        key: 'resolved',
        icon: CheckCircle2,
        title: `Case resolved${incident.resolution_outcome ? ` · ${incident.resolution_outcome.replace(/_/g, ' ')}` : ''}`,
        body: incident.resolution_summary,
        timestamp: incident.resolved_at,
        tone: 'emerald',
      });
    }

    return items.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
  }, [incident, resolutions, appeals]);

  async function uploadEvidenceFiles(
    files: File[],
    uploaded_by: 'rider' | 'owner',
    description: string | null,
  ) {
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'bin';
      const filename = `incident_${incident.id}_${uploaded_by}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const path = `incident_evidence/${filename}`;

      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) {
        console.error('Upload failed', upErr);
        continue;
      }
      const { data } = supabase.storage.from('documents').getPublicUrl(path);
      const kind = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
        ? 'video'
        : 'document';
      await supabase.from('incident_evidence').insert({
        incident_id: incident.id,
        evidence_url: data.publicUrl,
        evidence_type: kind,
        uploaded_by,
        description,
      });
    }
  }

  async function handleSubmitRiderResponse() {
    if (!responseText.trim()) {
      setFeedback({ tone: 'error', text: 'Please write your response before submitting.' });
      return;
    }
    setSubmittingResponse(true);
    setFeedback(null);
    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          rider_response: responseText.trim(),
          rider_response_submitted_at: new Date().toISOString(),
        })
        .eq('id', incident.id);
      if (error) throw error;

      if (responseFiles.length > 0) {
        await uploadEvidenceFiles(responseFiles, 'rider', 'Attached to rider response');
      }

      setResponseText('');
      setResponseFiles([]);
      setFeedback({ tone: 'success', text: 'Your response has been recorded.' });
      await loadCase();
      await onRefresh?.();
    } catch (err) {
      console.error('rider response submit error', err);
      setFeedback({ tone: 'error', text: 'We could not save your response. Please try again.' });
    } finally {
      setSubmittingResponse(false);
    }
  }

  async function handleSubmitAppeal() {
    if (!appealText.trim()) {
      setFeedback({ tone: 'error', text: 'Please write your appeal statement.' });
      return;
    }
    if (!riderId) {
      setFeedback({ tone: 'error', text: 'Only the assigned rider can submit an appeal.' });
      return;
    }
    setSubmittingAppeal(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('incident_appeals').insert({
        incident_id: incident.id,
        rider_id: riderId,
        appeal_text: appealText.trim(),
        appeal_status: 'pending',
      });
      if (error) throw error;
      setAppealText('');
      setFeedback({ tone: 'success', text: 'Your appeal has been filed for review.' });
      await loadCase();
      await onRefresh?.();
    } catch (err) {
      console.error('appeal submit error', err);
      setFeedback({ tone: 'error', text: 'Failed to file appeal. Please try again.' });
    } finally {
      setSubmittingAppeal(false);
    }
  }

  async function handleSubmitOwnerInfo() {
    if (!ownerNote.trim() && ownerFiles.length === 0) {
      setFeedback({ tone: 'error', text: 'Add a note or upload evidence before submitting.' });
      return;
    }
    setSubmittingOwnerInfo(true);
    setFeedback(null);
    try {
      if (ownerFiles.length > 0) {
        await uploadEvidenceFiles(ownerFiles, 'owner', ownerNote.trim() || null);
      }
      await supabase.from('incident_resolutions').insert({
        incident_id: incident.id,
        action_type: 'owner_information',
        actor_type: 'owner',
        notes: ownerNote.trim() || 'Owner provided supporting information.',
        metadata: {
          files_added: ownerFiles.length,
        },
      });
      setOwnerNote('');
      setOwnerFiles([]);
      setFeedback({ tone: 'success', text: 'Your information has been shared with the review team.' });
      await loadCase();
      await onRefresh?.();
    } catch (err) {
      console.error('owner info submit error', err);
      setFeedback({ tone: 'error', text: 'Failed to submit information. Please try again.' });
    } finally {
      setSubmittingOwnerInfo(false);
    }
  }

  const pendingAppeal = appeals.find((a) => a.appeal_status === 'pending');
  const canRiderAppeal =
    role === 'rider' &&
    statusKey === 'confirmed' &&
    !pendingAppeal &&
    Boolean(riderId);
  const canRiderRespond =
    role === 'rider' &&
    !incident.rider_response &&
    (statusKey === 'pending' || statusKey === 'confirmed');

  const tabs: Array<{ key: IncidentPanelTab; label: string; icon: any; count?: number }> = [
    { key: 'overview', label: 'Overview', icon: FileText },
    { key: 'timeline', label: 'Timeline', icon: ScrollText, count: timelineItems.length },
    { key: 'evidence', label: 'Evidence', icon: ImageIcon, count: evidence.length },
    { key: 'responses', label: 'Responses & Appeals', icon: MessageSquare, count: appeals.length + (incident.rider_response ? 1 : 0) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`bg-gradient-to-r ${meta.headerFrom} ${meta.headerTo} ${meta.headerText} px-5 sm:px-7 pt-5 pb-6 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
              <StatusIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-white/90 text-xs font-semibold">
                {incident.case_number && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 backdrop-blur">
                    <Hash className="h-3 w-3" />
                    {incident.case_number}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] ${meta.chip}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {meta.label}
                </span>
                {statusKey === 'confirmed' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white/15 text-white/95">
                    <Sparkles className="h-3 w-3" />
                    Action available
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-bold leading-tight">
                {formatType(incident.incident_type)}
              </h2>
              <p className="mt-1 text-white/85 text-sm max-w-2xl line-clamp-2">
                {incident.description}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <ProgressStepper current={stepIndex} status={statusKey} />
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-5 sm:px-7 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <FactCell icon={<Clock className="h-3.5 w-3.5" />} label="Incident date" value={formatShort(incident.incident_date)} />
          {motorcycle && (
            <FactCell icon={<Bike className="h-3.5 w-3.5" />} label="Motorcycle" value={motorcycle.registration_number} />
          )}
          {role === 'owner' && rider && (
            <FactCell icon={<User className="h-3.5 w-3.5" />} label="Rider" value={rider.name} />
          )}
          {incident.location && (
            <FactCell icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={incident.location} />
          )}
          {stationName && (
            <FactCell icon={<Building2 className="h-3.5 w-3.5" />} label="Station" value={stationName} />
          )}
        </div>

        <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className={`flex px-5 sm:px-7 ${tabsCollapsed ? 'gap-1' : 'gap-6'} items-center`}>
            {tabs.map(({ key, label, icon: Icon, count }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  title={tabsCollapsed ? label : undefined}
                  className={`inline-flex items-center gap-2 py-3.5 border-b-2 text-sm font-semibold whitespace-nowrap transition ${
                    active
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {!tabsCollapsed && label}
                  {typeof count === 'number' && count > 0 && (
                    <span className={`min-w-[1.25rem] text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setTabsCollapsed(!tabsCollapsed)}
              className="ml-auto py-3.5 text-slate-400 hover:text-slate-700 transition"
              title={tabsCollapsed ? 'Expand tabs' : 'Collapse tabs'}
            >
              <ChevronsLeftRight className={`h-4 w-4 ${tabsCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7 bg-slate-50/40">
          {feedback && (
            <div
              className={`mb-4 rounded-xl border p-3 text-sm flex items-start gap-2 ${
                feedback.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {feedback.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span className="flex-1">{feedback.text}</span>
              <button className="text-current opacity-60 hover:opacity-100" onClick={() => setFeedback(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading case details…
            </div>
          ) : (
            <>
              {tab === 'overview' && (
                <OverviewTab
                  role={role}
                  incident={incident}
                  motorcycle={motorcycle}
                  rider={rider}
                  stationName={stationName}
                  onJumpTo={setTab}
                />
              )}

              {tab === 'timeline' && <TimelineTab items={timelineItems} />}

              {tab === 'evidence' && (
                <EvidenceTab
                  groups={evidenceByUploader}
                  totalCount={evidence.length}
                  role={role}
                  incident={incident}
                  ownerNote={ownerNote}
                  setOwnerNote={setOwnerNote}
                  ownerFiles={ownerFiles}
                  setOwnerFiles={setOwnerFiles}
                  ownerFileInputRef={ownerFileInputRef}
                  submittingOwnerInfo={submittingOwnerInfo}
                  onSubmitOwnerInfo={handleSubmitOwnerInfo}
                  onOpenImage={setLightbox}
                />
              )}

              {tab === 'responses' && (
                <ResponsesTab
                  role={role}
                  incident={incident}
                  appeals={appeals}
                  canRiderRespond={canRiderRespond}
                  canRiderAppeal={canRiderAppeal}
                  responseText={responseText}
                  setResponseText={setResponseText}
                  responseFiles={responseFiles}
                  setResponseFiles={setResponseFiles}
                  responseFileInputRef={responseFileInputRef}
                  submittingResponse={submittingResponse}
                  onSubmitResponse={handleSubmitRiderResponse}
                  appealText={appealText}
                  setAppealText={setAppealText}
                  submittingAppeal={submittingAppeal}
                  onSubmitAppeal={handleSubmitAppeal}
                  pendingAppeal={pendingAppeal}
                />
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-5 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {incident.reporter_phone || '—'}
            </span>
            {incident.reporter_email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {incident.reporter_email}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canRiderRespond && tab !== 'responses' && (
              <button
                onClick={() => setTab('responses')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                <MessageSquare className="h-4 w-4" />
                Add response
              </button>
            )}
            {canRiderAppeal && tab !== 'responses' && (
              <button
                onClick={() => setTab('responses')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
              >
                <Gavel className="h-4 w-4" />
                File appeal
              </button>
            )}
            {role === 'owner' &&
              (statusKey === 'pending' || statusKey === 'confirmed') &&
              tab !== 'evidence' && (
                <button
                  onClick={() => setTab('evidence')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  <Upload className="h-4 w-4" />
                  Provide info
                </button>
              )}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {lightbox.evidence_type?.startsWith('image') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lightbox.evidence_url) ? (
            <img src={lightbox.evidence_url} alt="Evidence" className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          ) : (
            <a
              href={lightbox.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold inline-flex items-center gap-2"
            >
              <FileText className="h-5 w-5" />
              Open attachment
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressStepper({ current, status }: { current: number; status: StatusKey }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {PROGRESS_STEPS.map((step, i) => {
        const done = i < current || (i === current && (status === 'resolved' || status === 'dismissed' && i === 3));
        const active = i === current && !(status === 'resolved' || status === 'dismissed');
        const dotClass = done
          ? 'bg-white text-slate-900'
          : active
          ? 'bg-white/25 text-white ring-2 ring-white/60'
          : 'bg-white/10 text-white/60';
        return (
          <li key={step.key} className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${dotClass}`}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className={`text-[11px] font-semibold leading-tight ${active || done ? 'text-white' : 'text-white/60'}`}>{step.label}</p>
                <p className="text-[10px] text-white/60 truncate">{step.description}</p>
              </div>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className={`hidden sm:block h-0.5 mt-2 rounded-full ${i < current ? 'bg-white/70' : 'bg-white/20'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FactCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
        <span>{icon}</span>
        {label}
      </p>
      <p className="text-slate-900 font-semibold text-xs truncate mt-0.5">{value}</p>
    </div>
  );
}

function OverviewTab({
  role,
  incident,
  motorcycle,
  rider,
  stationName,
  onJumpTo,
}: {
  role: Role;
  incident: Incident;
  motorcycle?: Motorcycle | null;
  rider?: Rider | null;
  stationName?: string | null;
  onJumpTo: (t: IncidentPanelTab) => void;
}) {
  const status = toStatusKey(incident.status);
  const guidance =
    status === 'pending'
      ? 'This case is under review. You will be notified once a decision is issued.'
      : status === 'confirmed'
      ? 'This incident has been confirmed. Riders may file an appeal; owners can supply supporting information.'
      : status === 'resolved'
      ? 'This case has been resolved. Review the outcome and appeal history for reference.'
      : 'This case has been closed with no further action required.';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description</p>
            <p className="mt-1 text-slate-800 leading-relaxed whitespace-pre-wrap">
              {incident.description}
            </p>
          </div>
        </div>
        {incident.unregistered_bike_details && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <span className="font-semibold">Unregistered bike details: </span>
            {incident.unregistered_bike_details}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard title="Reporter" icon={<User className="h-4 w-4" />}>
          <InfoRow label="Name" value={incident.reporter_name} />
          <InfoRow label="Phone" value={incident.reporter_phone || '—'} />
          {incident.reporter_email && <InfoRow label="Email" value={incident.reporter_email} />}
        </InfoCard>

        <InfoCard title="Case metadata" icon={<Info className="h-4 w-4" />}>
          {incident.case_number && <InfoRow label="Case number" value={incident.case_number} />}
          <InfoRow label="Reported" value={formatDate(incident.created_at)} />
          <InfoRow label="Incident date" value={formatDate(incident.incident_date)} />
          {stationName && <InfoRow label="Assigned station" value={stationName} />}
        </InfoCard>

        {motorcycle && (
          <InfoCard title="Motorcycle" icon={<Bike className="h-4 w-4" />}>
            <InfoRow label="Registration" value={motorcycle.registration_number} />
            {(motorcycle as any).make && <InfoRow label="Make" value={(motorcycle as any).make} />}
            {(motorcycle as any).model && <InfoRow label="Model" value={(motorcycle as any).model} />}
          </InfoCard>
        )}

        {role === 'owner' && rider && (
          <InfoCard title="Rider" icon={<User className="h-4 w-4" />}>
            <InfoRow label="Name" value={rider.name} />
            {(rider as any).phone_number && <InfoRow label="Phone" value={(rider as any).phone_number} />}
            {(rider as any).id_number && <InfoRow label="National ID" value={(rider as any).id_number} />}
          </InfoCard>
        )}
      </div>

      {incident.admin_response && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Official response · {incident.response_type ? formatType(incident.response_type) : 'Notice'}
            </p>
          </div>
          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{incident.admin_response}</p>
          {incident.response_sent_at && (
            <p className="mt-2 text-xs text-slate-500">Sent {formatDate(incident.response_sent_at)}</p>
          )}
        </div>
      )}

      {(incident.resolution_summary || incident.resolution_outcome) && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Resolution{incident.resolution_outcome ? ` · ${formatType(incident.resolution_outcome)}` : ''}
            </p>
          </div>
          {incident.resolution_summary && (
            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{incident.resolution_summary}</p>
          )}
          {incident.resolved_at && (
            <p className="mt-2 text-xs text-slate-500">Closed {formatDate(incident.resolved_at)}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 text-white p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-white/90 leading-relaxed">{guidance}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => onJumpTo('timeline')}
              className="text-xs font-semibold inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              View timeline
              <ChevronRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => onJumpTo('evidence')}
              className="text-xs font-semibold inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              View evidence
              <ChevronRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => onJumpTo('responses')}
              className="text-xs font-semibold inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              Responses & appeals
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3 text-slate-700">
        {icon}
        <p className="text-[11px] font-bold uppercase tracking-wider">{title}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-32 text-slate-500">{label}</span>
      <span className="flex-1 text-slate-900 font-medium break-words">{value}</span>
    </div>
  );
}

function TimelineTab({ items }: { items: Array<{ key: string; icon: any; title: string; body?: string | null; timestamp: string | null; tone: string }> }) {
  if (items.length === 0) {
    return <EmptyState icon={<ScrollText className="h-6 w-6 text-slate-500" />} title="No activity yet" body="Timeline updates will appear here as the case progresses." />;
  }

  const toneMap: Record<string, { bg: string; text: string; ring: string }> = {
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
    red: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <ol className="relative border-l-2 border-slate-100 ml-3 space-y-6">
        {items.map((it) => {
          const t = toneMap[it.tone] || toneMap.slate;
          const Icon = it.icon;
          return (
            <li key={it.key} className="pl-6 relative">
              <span className={`absolute -left-[13px] top-1 w-6 h-6 rounded-full flex items-center justify-center ring-4 ${t.bg} ${t.text} ${t.ring}`}>
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{it.title}</p>
                <p className="text-[11px] text-slate-500">{formatDate(it.timestamp)}</p>
              </div>
              {it.body && (
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{it.body}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EvidenceTab({
  groups,
  totalCount,
  role,
  incident,
  ownerNote,
  setOwnerNote,
  ownerFiles,
  setOwnerFiles,
  ownerFileInputRef,
  submittingOwnerInfo,
  onSubmitOwnerInfo,
  onOpenImage,
}: {
  groups: Record<string, IncidentEvidence[]>;
  totalCount: number;
  role: Role;
  incident: Incident;
  ownerNote: string;
  setOwnerNote: (v: string) => void;
  ownerFiles: File[];
  setOwnerFiles: React.Dispatch<React.SetStateAction<File[]>>;
  ownerFileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  submittingOwnerInfo: boolean;
  onSubmitOwnerInfo: () => void;
  onOpenImage: (item: IncidentEvidence) => void;
}) {
  const groupOrder = ['Reporter', 'Rider', 'Owner', 'Officer', 'Admin'];
  const ordered = Object.entries(groups).sort(
    (a, b) => (groupOrder.indexOf(a[0]) + 999) - (groupOrder.indexOf(b[0]) + 999),
  );
  const status = toStatusKey(incident.status);
  const showOwnerUpload = role === 'owner' && (status === 'pending' || status === 'confirmed');

  return (
    <div className="space-y-4">
      {totalCount === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-6 w-6 text-slate-500" />}
          title="No evidence uploaded yet"
          body="Photos, videos or documents submitted with this case will appear here."
        />
      ) : (
        ordered.map(([label, items]) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${uploaderTone(label)}`}>
                {label}
              </span>
              <span className="text-[11px] text-slate-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((item) => (
                <EvidenceTile key={item.id} item={item} onOpen={() => onOpenImage(item)} />
              ))}
            </div>
          </div>
        ))
      )}

      {showOwnerUpload && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="h-4 w-4 text-emerald-700" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Provide supporting information
            </p>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Add context or upload documents, photos, or receipts that help investigators understand this case.
          </p>

          <textarea
            value={ownerNote}
            onChange={(e) => setOwnerNote(e.target.value)}
            placeholder="Add a note for the review team (optional)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[110px] text-sm"
            disabled={submittingOwnerInfo}
          />

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => ownerFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              disabled={submittingOwnerInfo}
            >
              <Paperclip className="h-4 w-4" />
              Attach files
            </button>
            <input
              ref={ownerFileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) setOwnerFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                e.target.value = '';
              }}
            />
            <span className="text-xs text-slate-500">
              {ownerFiles.length > 0 ? `${ownerFiles.length} file${ownerFiles.length === 1 ? '' : 's'} attached` : 'No files attached'}
            </span>
          </div>

          {ownerFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {ownerFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm">
                  <span className="truncate text-slate-700">{f.name}</span>
                  <button
                    onClick={() => setOwnerFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-600 text-xs font-semibold"
                    disabled={submittingOwnerInfo}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={onSubmitOwnerInfo}
              disabled={submittingOwnerInfo || (!ownerNote.trim() && ownerFiles.length === 0)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:bg-slate-300"
            >
              {submittingOwnerInfo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit information
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceTile({ item, onOpen }: { item: IncidentEvidence; onOpen: () => void }) {
  const isImage =
    (item.evidence_type && item.evidence_type.toLowerCase().startsWith('image')) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(item.evidence_url);
  return (
    <button
      onClick={onOpen}
      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
    >
      {isImage ? (
        <img
          src={item.evidence_url}
          alt="Evidence"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1">
          <FileText className="h-6 w-6" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Document</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-end p-2">
        <span className="text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition">
          Open
        </span>
      </div>
    </button>
  );
}

function ResponsesTab({
  role,
  incident,
  appeals,
  canRiderRespond,
  canRiderAppeal,
  responseText,
  setResponseText,
  responseFiles,
  setResponseFiles,
  responseFileInputRef,
  submittingResponse,
  onSubmitResponse,
  appealText,
  setAppealText,
  submittingAppeal,
  onSubmitAppeal,
  pendingAppeal,
}: {
  role: Role;
  incident: Incident;
  appeals: IncidentAppeal[];
  canRiderRespond: boolean;
  canRiderAppeal: boolean;
  responseText: string;
  setResponseText: (v: string) => void;
  responseFiles: File[];
  setResponseFiles: React.Dispatch<React.SetStateAction<File[]>>;
  responseFileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  submittingResponse: boolean;
  onSubmitResponse: () => void;
  appealText: string;
  setAppealText: (v: string) => void;
  submittingAppeal: boolean;
  onSubmitAppeal: () => void;
  pendingAppeal: IncidentAppeal | undefined;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-slate-700" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Official response</p>
        </div>
        {incident.admin_response ? (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                {incident.response_type ? formatType(incident.response_type) : 'Notice'}
              </span>
              {incident.response_sent_at && (
                <span className="text-[11px] text-slate-500">
                  {formatDate(incident.response_sent_at)}
                </span>
              )}
            </div>
            <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{incident.admin_response}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No official response has been issued yet.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-slate-700" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rider statement</p>
        </div>
        {incident.rider_response ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{incident.rider_response}</p>
            {incident.rider_response_submitted_at && (
              <p className="mt-2 text-[11px] text-slate-500">
                Submitted {formatDate(incident.rider_response_submitted_at)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {role === 'rider'
              ? 'You have not submitted a statement yet.'
              : 'The rider has not submitted a statement yet.'}
          </p>
        )}

        {canRiderRespond && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <p className="text-sm font-semibold text-slate-900 mb-2">Add your response</p>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Provide your side of the story, clarifications, or additional context…"
              className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[110px] text-sm bg-white"
              disabled={submittingResponse}
            />

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => responseFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
                disabled={submittingResponse}
              >
                <Paperclip className="h-4 w-4" />
                Attach counter-evidence
              </button>
              <input
                ref={responseFileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) setResponseFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = '';
                }}
              />
              <span className="text-xs text-slate-500">
                {responseFiles.length > 0
                  ? `${responseFiles.length} file${responseFiles.length === 1 ? '' : 's'} attached`
                  : 'Optional attachments'}
              </span>
            </div>

            {responseFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {responseFiles.map((f, i) => (
                  <li key={i} className="flex items-center justify-between bg-white border border-blue-200 rounded px-3 py-1.5 text-sm">
                    <span className="truncate text-slate-700">{f.name}</span>
                    <button
                      onClick={() => setResponseFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-red-600 text-xs font-semibold"
                      disabled={submittingResponse}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex justify-end">
              <button
                onClick={onSubmitResponse}
                disabled={submittingResponse || !responseText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:bg-slate-300"
              >
                {submittingResponse ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit response
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-slate-700" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Appeals</p>
          </div>
          <span className="text-[11px] text-slate-500">{appeals.length} filed</span>
        </div>

        {appeals.length === 0 ? (
          <p className="text-sm text-slate-500">No appeals have been filed for this case.</p>
        ) : (
          <ul className="space-y-3">
            {appeals.map((appeal) => {
              const s = appeal.appeal_status;
              const tone =
                s === 'approved'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : s === 'rejected'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800';
              return (
                <li key={appeal.id} className={`rounded-xl border p-4 ${tone}`}>
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="uppercase tracking-wider">{s}</span>
                    <span className="opacity-70">{formatDate(appeal.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {appeal.appeal_text}
                  </p>
                  {appeal.admin_response && (
                    <div className="mt-3 pt-3 border-t border-current/20">
                      <p className="text-[11px] font-bold uppercase tracking-wider">Admin response</p>
                      <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{appeal.admin_response}</p>
                      {appeal.reviewed_at && (
                        <p className="mt-1 text-[11px] opacity-70">
                          Reviewed {formatDate(appeal.reviewed_at)}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pendingAppeal && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Your appeal is pending review. You will be notified once a decision is made.
          </div>
        )}

        {canRiderAppeal && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-sm font-semibold text-slate-900 mb-2">File an appeal</p>
            <p className="text-xs text-slate-600 mb-2">
              Explain why you believe this decision should be reviewed. Include any relevant details.
            </p>
            <textarea
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              placeholder="Explain the grounds of your appeal…"
              className="w-full px-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[110px] text-sm bg-white"
              disabled={submittingAppeal}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={onSubmitAppeal}
                disabled={submittingAppeal || !appealText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition disabled:bg-slate-300"
              >
                {submittingAppeal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Filing…
                  </>
                ) : (
                  <>
                    <Gavel className="h-4 w-4" />
                    File appeal
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-slate-900 font-semibold">{title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{body}</p>
    </div>
  );
}
