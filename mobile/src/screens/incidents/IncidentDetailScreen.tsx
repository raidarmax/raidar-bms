import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeftIcon,
  AlertTriangleIcon,
  UserIcon,
  MapPinIcon,
  CalendarIcon,
  PhoneIcon,
  FileTextIcon,
  ShieldIcon,
  ShieldCheckIcon,
  MotorcycleIcon,
  CheckCircleIcon,
  HashIcon,
  ClockIcon,
  DollarSignIcon,
} from '../../components/icons/Icons';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import type {
  Incident,
  IncidentEvidence,
  IncidentNote,
  Motorcycle,
  Owner,
  PoliceOfficer,
  PoliceStation,
  Rider,
} from '../../services/supabase';
import { getSupabase } from '../../services/supabase';
import { INCIDENT_TYPE_META, STATUS_META, humanize } from './incidentMeta';
import {
  loadIncidentBundle,
  fetchPersonsOfInterest,
  fetchSummons,
  fetchIncidentTimeline,
  removePersonOfInterest,
  type FetchStamp,
} from '../../services/data';
import { DataFooter } from '../../components/ui/DataFooter';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/ui/Toast';
import {
  AssignModal,
  AddPOIModal,
  IssueSummonModal,
  AddNoteModal,
  ResolveModal,
  CloseCaseModal,
} from './IncidentActionModals';
import {
  PlusIcon,
  UsersIcon,
  BellIcon,
  XIcon,
} from '../../components/icons/Icons';

const PROGRESS_STEPS = [
  { key: 'unassigned', label: 'Reported' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

function statusToStepIndex(status?: string | null): number {
  if (!status) return 0;
  if (status === 'awaiting_evidence' || status === 'awaiting_appeal_review') return 2;
  if (status === 'in_progress' || status === 'investigating') return 2;
  const idx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function initialsFor(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / (24 * 60 * 60 * 1000));
}

function ratingTone(score: number | null | undefined): { bg: string; fg: string } {
  if (score === null || score === undefined) return { bg: colors.gray[100], fg: colors.gray[600] };
  if (score < 2.5) return { bg: colors.red[100], fg: colors.red[700] };
  if (score < 3.5) return { bg: colors.amber[100], fg: colors.amber[700] };
  return { bg: colors.green[100], fg: colors.green[700] };
}

export default function IncidentDetailScreen(props: any) {
  const routeKey = props?.route?.key || 'no-key';
  const incidentId = props?.route?.params?.incidentId || 'no-id';
  return (
    <ErrorBoundary label={`Incident ${String(incidentId).slice(0, 12)}`}>
      <IncidentDetailInner key={`${routeKey}::${incidentId}`} {...props} />
    </ErrorBoundary>
  );
}

type Extras = {
  riderPriorCount: number;
  riderUnpaidFines: number;
  motoPriorCount: number;
};

function IncidentDetailInner({ route, navigation }: any) {
  const incidentId: string = route?.params?.incidentId || '';
  const insets = useSafeAreaInsets();
  const { officer } = useAuth();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [assignedOfficer, setAssignedOfficer] = useState<PoliceOfficer | null>(null);
  const [assignedStation, setAssignedStation] = useState<PoliceStation | null>(null);
  const [notes, setNotes] = useState<IncidentNote[]>([]);
  const [evidence, setEvidence] = useState<IncidentEvidence[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [summons, setSummons] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [extras, setExtras] = useState<Extras>({
    riderPriorCount: 0,
    riderUnpaidFines: 0,
    motoPriorCount: 0,
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [poiOpen, setPoiOpen] = useState(false);
  const [summonOpen, setSummonOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState<FetchStamp | null>(null);

  const activeIdRef = useRef<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!incidentId) {
        setError('Missing incident identifier.');
        setStamp({ fetchedAt: Date.now(), rowCount: 0, filter: 'no-id', errorMessage: 'Missing id' });
        return;
      }

      activeIdRef.current = incidentId;
      const ticket: string = incidentId;

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);

      try {
        const bundle = await loadIncidentBundle(incidentId);
        if (activeIdRef.current !== ticket) return;

        if (!bundle) {
          setIncident(null);
          setError(
            'This incident could not be loaded. If this happens repeatedly, take a screenshot and share it.',
          );
          setStamp({
            fetchedAt: Date.now(),
            rowCount: 0,
            filter: `incident:${ticket.slice(0, 8)}`,
            errorMessage: 'Not found or ID mismatch',
          });
          return;
        }

        if (bundle.incident.id && bundle.incident.id !== ticket) {
          console.warn(
            '[IncidentDetail] non-empty id mismatch — requested',
            ticket,
            'received',
            bundle.incident.id,
          );
        }

        setError(null);
        setIncident(bundle.incident);
        setRider(bundle.rider ?? null);
        setMotorcycle(bundle.motorcycle ?? null);
        setOwner(bundle.owner ?? null);
        setAssignedOfficer(bundle.assignedOfficer ?? null);
        setAssignedStation(bundle.assignedStation ?? null);
        setNotes(bundle.notes ?? []);
        setEvidence(bundle.evidence ?? []);
        setStamp(bundle.stamp);

        const supabase = getSupabase();
        const [riderPriorRes, moto, riderUnpaid, poiRes, summonsRes, timelineRes] = await Promise.all([
          bundle.rider?.id
            ? supabase
                .from('incidents')
                .select('id', { count: 'exact', head: true })
                .eq('rider_id', bundle.rider.id)
            : Promise.resolve({ count: 0 } as any),
          bundle.motorcycle?.id
            ? supabase
                .from('incidents')
                .select('id', { count: 'exact', head: true })
                .eq('motorcycle_id', bundle.motorcycle.id)
            : Promise.resolve({ count: 0 } as any),
          bundle.rider?.id
            ? supabase
                .from('fines')
                .select('id', { count: 'exact', head: true })
                .eq('rider_id', bundle.rider.id)
                .neq('status', 'paid')
            : Promise.resolve({ count: 0 } as any),
          fetchPersonsOfInterest(ticket),
          fetchSummons(ticket),
          fetchIncidentTimeline(ticket),
        ]);
        if (activeIdRef.current === ticket) {
          setExtras({
            riderPriorCount: Math.max(0, ((riderPriorRes as any)?.count || 0) - 1),
            motoPriorCount: Math.max(0, ((moto as any)?.count || 0) - 1),
            riderUnpaidFines: (riderUnpaid as any)?.count || 0,
          });
          setPois((poiRes as any)?.rows || []);
          setSummons((summonsRes as any)?.rows || []);
          setTimeline((timelineRes as any)?.rows || []);
        }
      } catch (e: any) {
        if (activeIdRef.current !== ticket) return;
        setError(e?.message || 'Unable to load incident.');
        setStamp({
          fetchedAt: Date.now(),
          rowCount: 0,
          filter: `incident:${ticket.slice(0, 8)}`,
          errorMessage: e?.message || 'Fetch failed',
        });
      } finally {
        if (activeIdRef.current === ticket) {
          if (mode === 'initial') setLoading(false);
          else setRefreshing(false);
        }
      }
    },
    [incidentId],
  );

  useEffect(() => {
    activeIdRef.current = null;
    setIncident(null);
    setRider(null);
    setMotorcycle(null);
    setOwner(null);
    setAssignedOfficer(null);
    setAssignedStation(null);
    setNotes([]);
    setEvidence([]);
    setPois([]);
    setSummons([]);
    setTimeline([]);
    setExtras({ riderPriorCount: 0, riderUnpaidFines: 0, motoPriorCount: 0 });
    setError(null);
    load('initial');
    return () => {
      activeIdRef.current = null;
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Only refetch on subsequent focuses; initial mount already loaded.
      // Empty deps keep this stable across renders.
    }, []),
  );

  const onRefresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  const typeMeta = useMemo(
    () => (incident ? INCIDENT_TYPE_META[incident.incident_type] || INCIDENT_TYPE_META.default : null),
    [incident],
  );
  const statusMeta = useMemo(
    () => (incident ? STATUS_META[incident.police_status] || STATUS_META.unassigned : null),
    [incident],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <TopBar insets={insets} onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading incident</Text>
        </View>
      </View>
    );
  }

  if (error || !incident || !typeMeta || !statusMeta) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <TopBar insets={insets} onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <AlertTriangleIcon size={40} color={colors.red[500]} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error || 'Incident not found.'}</Text>
          <View style={styles.errorDebug}>
            <Text style={styles.errorDebugLabel}>Requested id</Text>
            <Text style={styles.errorDebugValue} selectable>
              {String(incidentId)}
            </Text>
          </View>
          <TouchableOpacity style={styles.errorBtn} onPress={() => load('initial')}>
            <Text style={styles.errorBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stepIndex = statusToStepIndex(incident.police_status);
  const isClosed = incident.police_status === 'closed';
  const isResolved = incident.police_status === 'resolved';
  const progressColor = isClosed
    ? colors.gray[500]
    : isResolved
    ? colors.green[500]
    : colors.blue[500];
  const progressPct = Math.max(
    4,
    Math.round((stepIndex / Math.max(1, PROGRESS_STEPS.length - 1)) * 100),
  );

  const finesTotal = 0; // fines total is optional; kept for parity if reintroduced later

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <TopBar insets={insets} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />
        }
      >
        {/* Case summary header */}
        <View style={styles.card}>
          <View style={styles.headerTopRow}>
            {incident.case_number ? (
              <View style={styles.caseChip}>
                <HashIcon size={12} color={colors.white} />
                <Text style={styles.caseChipText}>{incident.case_number}</Text>
              </View>
            ) : (
              <View style={[styles.caseChip, { backgroundColor: colors.amber[500] }]}>
                <Text style={styles.caseChipText}>DRAFT</Text>
              </View>
            )}
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusMeta.chipBg },
              ]}
            >
              <Text style={[styles.statusPillText, { color: statusMeta.chipFg }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.typeTitle} numberOfLines={2}>
            {humanize(incident.incident_type)}
          </Text>

          <View style={styles.badgeRow}>
            {incident.auto_assigned && !incident.claimed_by_manager_id ? (
              <View style={[styles.miniBadge, { backgroundColor: colors.amber[100] }]}>
                <Text style={[styles.miniBadgeText, { color: colors.amber[700] }]}>Auto-routed</Text>
              </View>
            ) : null}
            {incident.claimed_by_manager_id ? (
              <View style={[styles.miniBadge, { backgroundColor: colors.green[100] }]}>
                <Text style={[styles.miniBadgeText, { color: colors.green[700] }]}>Claimed</Text>
              </View>
            ) : null}
            {(incident.reopened_count ?? 0) > 0 ? (
              <View style={[styles.miniBadge, { backgroundColor: colors.orange[100] }]}>
                <Text style={[styles.miniBadgeText, { color: colors.orange[700] }]}>
                  Reopened x{incident.reopened_count}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <MetaChip
              icon={<CalendarIcon size={12} color={colors.gray[500]} />}
              text={formatDateTime(incident.incident_date || incident.created_at)}
            />
            {incident.location ? (
              <MetaChip
                icon={<MapPinIcon size={12} color={colors.gray[500]} />}
                text={incident.location}
              />
            ) : null}
            {assignedStation ? (
              <MetaChip
                icon={<ShieldIcon size={12} color={colors.gray[500]} />}
                text={assignedStation.station_name}
              />
            ) : null}
          </View>

          {/* Progress */}
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Resolution progress</Text>
              <Text style={styles.progressCount}>
                Step {Math.min(stepIndex + 1, PROGRESS_STEPS.length)} of {PROGRESS_STEPS.length}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPct}%`, backgroundColor: progressColor },
                ]}
              />
            </View>
            <View style={styles.stepsRow}>
              {PROGRESS_STEPS.map((s, i) => {
                const done = i <= stepIndex;
                const active = i === stepIndex;
                return (
                  <View key={s.key} style={styles.stepCol}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: done ? progressColor : colors.gray[300],
                        },
                        active && styles.stepDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.stepLabel,
                        { color: done ? colors.gray[800] : colors.gray[400], fontWeight: done ? '700' : '500' },
                      ]}
                      numberOfLines={1}
                    >
                      {s.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Actions bar */}
        {officer && !isClosed ? (
          <ActionBar
            isResolved={isResolved}
            onAssign={() => setAssignOpen(true)}
            onAddPOI={() => setPoiOpen(true)}
            onSummon={() => setSummonOpen(true)}
            onAddNote={() => setNoteOpen(true)}
            onResolve={() => setResolveOpen(true)}
            onClose={() => setCloseOpen(true)}
          />
        ) : null}

        {/* Description */}
        <SectionCard title="Description" icon={<FileTextIcon size={14} color={colors.gray[700]} />}>
          <Text style={styles.paragraph}>
            {incident.description?.trim() || 'No description provided.'}
          </Text>
          {incident.unregistered_bike_details ? (
            <View style={styles.warningBanner}>
              <AlertTriangleIcon size={14} color={colors.amber[700]} />
              <Text style={styles.warningText}>
                <Text style={styles.warningLabel}>Unregistered bike: </Text>
                {incident.unregistered_bike_details}
              </Text>
            </View>
          ) : null}
        </SectionCard>

        {/* Involved Parties */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Involved Parties</Text>
        </View>

        <RiderCard
          rider={rider}
          priorCount={extras.riderPriorCount}
          unpaidFines={extras.riderUnpaidFines}
        />

        <MotorcycleCard
          motorcycle={motorcycle}
          owner={owner}
          priorCount={extras.motoPriorCount}
        />

        <OwnerCard owner={owner} rider={rider} />

        {/* Reporter */}
        <SectionCard title="Reporter" icon={<UserIcon size={14} color={colors.gray[700]} />}>
          <PersonRow
            initials={initialsFor(incident.reporter_name || 'Anonymous')}
            name={incident.reporter_name || 'Anonymous'}
            phone={incident.reporter_phone || null}
            email={(incident as any).reporter_email || null}
          />
        </SectionCard>

        {/* Case metadata */}
        <SectionCard title="Case metadata" icon={<HashIcon size={14} color={colors.gray[700]} />}>
          {incident.case_number ? (
            <InfoRow label="Case number" value={incident.case_number} />
          ) : null}
          <InfoRow label="Reported" value={formatDateTime(incident.created_at)} />
          <InfoRow label="Incident date" value={formatDateTime(incident.incident_date)} />
          {assignedStation ? (
            <InfoRow label="Assigned station" value={assignedStation.station_name} />
          ) : null}
          <InfoRow label="Type" value={humanize(incident.incident_type)} />
          <InfoRow label="Status" value={statusMeta.label} />
        </SectionCard>

        {/* Assigned Officer */}
        <SectionCard
          title="Assigned officer"
          icon={<ShieldCheckIcon size={14} color={colors.gray[700]} />}
        >
          {assignedOfficer ? (
            <PersonRow
              initials={initialsFor(assignedOfficer.full_name)}
              name={assignedOfficer.full_name}
              phone={(assignedOfficer as any).phone_number || null}
              subtitle={
                (assignedOfficer.rank || null) ||
                (assignedStation?.station_name || null)
              }
              photo={(assignedOfficer as any).profile_photo_url || null}
            />
          ) : (
            <Text style={styles.mutedItalic}>Awaiting officer assignment.</Text>
          )}
        </SectionCard>

        {/* Official response */}
        {incident.admin_response ? (
          <SectionCard
            title={`Official response${
              incident.response_type ? ` · ${humanize(incident.response_type)}` : ''
            }`}
            icon={<ShieldIcon size={14} color={colors.brand[600]} />}
            accent={colors.brand[500]}
          >
            <Text style={styles.paragraph}>{incident.admin_response}</Text>
            {incident.response_sent_at ? (
              <Text style={styles.mutedSmall}>Sent {formatDateTime(incident.response_sent_at)}</Text>
            ) : null}
          </SectionCard>
        ) : null}

        {/* Resolution */}
        {incident.resolution_summary || incident.resolution_outcome || incident.resolved_at ? (
          <SectionCard
            title={`Resolution${
              incident.resolution_outcome ? ` · ${humanize(incident.resolution_outcome)}` : ''
            }`}
            icon={<CheckCircleIcon size={14} color={colors.green[700]} />}
            accent={colors.green[500]}
          >
            {incident.resolution_summary ? (
              <Text style={styles.paragraph}>{incident.resolution_summary}</Text>
            ) : null}
            {incident.resolved_at ? (
              <Text style={styles.mutedSmall}>Closed {formatDateTime(incident.resolved_at)}</Text>
            ) : null}
          </SectionCard>
        ) : null}

        {/* Notes */}
        <SectionCard
          title={`Case notes (${notes.length})`}
          icon={<FileTextIcon size={14} color={colors.gray[700]} />}
        >
          {notes.length === 0 ? (
            <Text style={styles.mutedItalic}>No notes yet.</Text>
          ) : (
            notes.slice(0, 6).map((n) => (
              <View key={n.id} style={styles.noteRow}>
                <Text style={styles.noteText}>{n.note_text}</Text>
                <View style={styles.noteMetaRow}>
                  <Text style={styles.noteAuthor}>{n.officer_name || 'Officer'}</Text>
                  <Text style={styles.mutedTiny}>
                    {new Date(n.created_at).toLocaleString('en-KE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </SectionCard>

        {/* Evidence */}
        <SectionCard
          title={`Evidence (${evidence.length})`}
          icon={<FileTextIcon size={14} color={colors.gray[700]} />}
        >
          {evidence.length === 0 ? (
            <Text style={styles.mutedItalic}>No evidence attached.</Text>
          ) : (
            evidence.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={styles.evidenceRow}
                onPress={() => ev.file_url && Linking.openURL(ev.file_url)}
                activeOpacity={0.7}
              >
                {ev.file_type?.startsWith('image') && ev.file_url ? (
                  <Image source={{ uri: ev.file_url }} style={styles.evidenceThumb} />
                ) : (
                  <View style={styles.evidenceThumbPlaceholder}>
                    <FileTextIcon size={18} color={colors.gray[500]} />
                  </View>
                )}
                <View style={styles.evidenceBody}>
                  <Text style={styles.evidenceKind}>
                    {humanize(ev.file_type || 'file')}
                  </Text>
                  {ev.description ? (
                    <Text style={styles.evidenceDesc} numberOfLines={2}>
                      {ev.description}
                    </Text>
                  ) : null}
                  <Text style={styles.mutedTiny}>
                    Uploaded {formatDate(ev.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </SectionCard>

        {/* Persons of interest */}
        <SectionCard
          title={`Persons of interest (${pois.length})`}
          icon={<UsersIcon size={14} color={colors.gray[700]} />}
        >
          {pois.length === 0 ? (
            <Text style={styles.mutedItalic}>None yet. Add witnesses, suspects, or other people involved.</Text>
          ) : (
            pois.map((p) => (
              <View key={p.id} style={styles.poiRow}>
                <View style={styles.avatarFallback}>
                  <UserIcon size={16} color={colors.gray[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>{p.full_name}</Text>
                  <Text style={styles.personSub}>{humanize(p.relationship)}{p.phone_number ? ` · ${p.phone_number}` : ''}</Text>
                  {p.notes ? <Text style={[styles.mutedTiny, { marginTop: 3 }]}>{p.notes}</Text> : null}
                </View>
                {officer ? (
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await removePersonOfInterest(incidentId, p.id, { id: officer.id, full_name: officer.full_name });
                        showToast('Removed', 'success');
                        load('refresh');
                      } catch (e: any) {
                        showToast(e?.message || 'Failed', 'error');
                      }
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.linkDanger}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </SectionCard>

        {/* Summons */}
        <SectionCard
          title={`Summons (${summons.length})`}
          icon={<BellIcon size={14} color={colors.gray[700]} />}
        >
          {summons.length === 0 ? (
            <Text style={styles.mutedItalic}>No summons issued for this case.</Text>
          ) : (
            summons.map((s) => (
              <View key={s.id} style={styles.summonRow}>
                <View style={styles.summonHeader}>
                  <Text style={styles.personName}>{s.person_name}</Text>
                  <View style={[styles.smallBadge, { backgroundColor: colors.amber[100] }]}>
                    <Text style={[styles.smallBadgeText, { color: colors.amber[700] }]}>{humanize(s.status || 'pending')}</Text>
                  </View>
                </View>
                <Text style={styles.personSub}>
                  {humanize(s.person_type)}{s.person_phone ? ` · ${s.person_phone}` : ''}
                </Text>
                <Text style={[styles.mutedTiny, { marginTop: 4 }]}>
                  {formatDate(s.summon_date)}{s.summon_time ? ` at ${s.summon_time}` : ''}
                </Text>
                <Text style={[styles.paragraph, { marginTop: 4, fontSize: 13 }]}>{s.reason}</Text>
              </View>
            ))
          )}
        </SectionCard>

        {/* Timeline */}
        <SectionCard
          title={`Activity timeline (${timeline.length})`}
          icon={<ClockIcon size={14} color={colors.gray[700]} />}
        >
          {timeline.length === 0 ? (
            <Text style={styles.mutedItalic}>No activity logged yet.</Text>
          ) : (
            timeline.slice(0, 20).map((t) => (
              <View key={t.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineAction}>{humanize(t.action)}</Text>
                  {t.notes ? <Text style={styles.timelineNote}>{t.notes}</Text> : null}
                  <Text style={styles.mutedTiny}>
                    {t.officer_name || 'System'} · {formatDateTime(t.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <DataFooter
          stamp={stamp}
          onRefresh={() => load('refresh')}
          hint={`Incident ${incident.id.slice(0, 8)}`}
        />

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      {officer && incident ? (
        <>
          <AssignModal
            visible={assignOpen}
            onClose={() => setAssignOpen(false)}
            incidentId={incidentId}
            officer={officer}
            onDone={() => load('refresh')}
          />
          <AddPOIModal
            visible={poiOpen}
            onClose={() => setPoiOpen(false)}
            incidentId={incidentId}
            officer={officer}
            onDone={() => load('refresh')}
          />
          <IssueSummonModal
            visible={summonOpen}
            onClose={() => setSummonOpen(false)}
            incidentId={incidentId}
            incident={incident}
            officer={officer}
            rider={rider}
            owner={owner}
            onDone={() => load('refresh')}
          />
          <AddNoteModal
            visible={noteOpen}
            onClose={() => setNoteOpen(false)}
            incidentId={incidentId}
            officer={officer}
            onDone={() => load('refresh')}
          />
          <ResolveModal
            visible={resolveOpen}
            onClose={() => setResolveOpen(false)}
            incidentId={incidentId}
            officer={officer}
            onDone={() => load('refresh')}
          />
          <CloseCaseModal
            visible={closeOpen}
            onClose={() => setCloseOpen(false)}
            incidentId={incidentId}
            officer={officer}
            onDone={() => load('refresh')}
          />
        </>
      ) : null}
    </View>
  );
}

function ActionBar({
  isResolved,
  onAssign, onAddPOI, onSummon, onAddNote, onResolve, onClose,
}: {
  isResolved: boolean;
  onAssign: () => void;
  onAddPOI: () => void;
  onSummon: () => void;
  onAddNote: () => void;
  onResolve: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.actionBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: 2 }}>
        <ActionBtn label="Assign" tone="brand" icon={<ShieldIcon size={14} color={colors.brand[700]} />} onPress={onAssign} />
        <ActionBtn label="Add person" icon={<UsersIcon size={14} color={colors.gray[700]} />} onPress={onAddPOI} />
        <ActionBtn label="Issue summons" icon={<BellIcon size={14} color={colors.gray[700]} />} onPress={onSummon} />
        <ActionBtn label="Add note" icon={<PlusIcon size={14} color={colors.gray[700]} />} onPress={onAddNote} />
        {!isResolved && (
          <ActionBtn label="Resolve" tone="success" icon={<CheckCircleIcon size={14} color={colors.green[700]} />} onPress={onResolve} />
        )}
        <ActionBtn label="Close case" tone="danger" icon={<XIcon size={14} color={colors.red[600]} />} onPress={onClose} />
      </ScrollView>
    </View>
  );
}

function ActionBtn({
  label, icon, onPress, tone,
}: { label: string; icon: React.ReactNode; onPress: () => void; tone?: 'brand' | 'danger' | 'success' }) {
  const toneStyle =
    tone === 'brand' ? { backgroundColor: colors.brand[50], borderColor: colors.brand[200] } :
    tone === 'success' ? { backgroundColor: colors.green[50], borderColor: colors.green[100] } :
    tone === 'danger' ? { backgroundColor: colors.red[50], borderColor: colors.red[100] } :
    null;
  const textColor =
    tone === 'brand' ? colors.brand[700] :
    tone === 'success' ? colors.green[700] :
    tone === 'danger' ? colors.red[700] :
    colors.gray[800];
  return (
    <TouchableOpacity style={[styles.actionBtn, toneStyle]} onPress={onPress} activeOpacity={0.8}>
      {icon}
      <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* --------- sub-components --------- */

function TopBar({ insets, onBack }: { insets: any; onBack: () => void }) {
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <ChevronLeftIcon size={22} color={colors.gray[800]} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function MetaChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.metaChip}>
      {icon}
      <Text style={styles.metaChipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, accent ? { borderTopWidth: 3, borderTopColor: accent } : null]}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PersonRow({
  initials,
  name,
  phone,
  email,
  subtitle,
  photo,
}: {
  initials: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  subtitle?: string | null;
  photo?: string | null;
}) {
  return (
    <View style={styles.personRow}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
      <View style={styles.personBody}>
        <Text style={styles.personName} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={styles.personSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {phone ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${phone}`)}
            style={styles.personLinkRow}
          >
            <PhoneIcon size={12} color={colors.gray[500]} />
            <Text style={styles.personLink}>{phone}</Text>
          </TouchableOpacity>
        ) : null}
        {email ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${email}`)}
            style={styles.personLinkRow}
          >
            <Text style={styles.personLink}>{email}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function ExpiryBadge({ iso, label }: { iso?: string | null; label: string }) {
  const d = daysUntil(iso);
  if (d === null) return null;
  if (d < 0) {
    return (
      <View style={[styles.smallBadge, { backgroundColor: colors.red[100] }]}>
        <Text style={[styles.smallBadgeText, { color: colors.red[700] }]}>
          {label} expired {Math.abs(d)}d
        </Text>
      </View>
    );
  }
  if (d <= 30) {
    return (
      <View style={[styles.smallBadge, { backgroundColor: colors.amber[100] }]}>
        <Text style={[styles.smallBadgeText, { color: colors.amber[700] }]}>
          {label} in {d}d
        </Text>
      </View>
    );
  }
  return null;
}

function RiderCard({
  rider,
  priorCount,
  unpaidFines,
}: {
  rider: Rider | null;
  priorCount: number;
  unpaidFines: number;
}) {
  const tone = ratingTone(rider?.rating_score ?? null);
  return (
    <SectionCard title="Rider" icon={<UserIcon size={14} color={colors.blue[600]} />}>
      {rider ? (
        <View>
          <PersonRow
            initials={initialsFor(rider.name)}
            name={rider.name}
            phone={rider.phone_number || null}
            subtitle={rider.bms_id || rider.id_number || null}
            photo={(rider as any).photo_url || null}
          />
          <View style={styles.badgeWrap}>
            {rider.rating_score !== null && rider.rating_score !== undefined ? (
              <View style={[styles.smallBadge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.smallBadgeText, { color: tone.fg }]}>
                  {Number(rider.rating_score).toFixed(1)}/5
                  {rider.rating_tier ? ` · ${rider.rating_tier}` : ''}
                </Text>
              </View>
            ) : null}
            {priorCount > 0 ? (
              <View style={[styles.smallBadge, { backgroundColor: colors.gray[100] }]}>
                <Text style={[styles.smallBadgeText, { color: colors.gray[700] }]}>
                  {priorCount} prior case{priorCount === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
            {unpaidFines > 0 ? (
              <View style={[styles.smallBadge, { backgroundColor: colors.red[100] }]}>
                <DollarSignIcon size={10} color={colors.red[700]} />
                <Text style={[styles.smallBadgeText, { color: colors.red[700] }]}>
                  {unpaidFines} unpaid fine{unpaidFines === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
            <ExpiryBadge iso={(rider as any).license_expiry} label="Licence" />
          </View>
          {rider.id_number ? (
            <InfoRow label="National ID" value={rider.id_number} />
          ) : null}
        </View>
      ) : (
        <Text style={styles.mutedItalic}>
          No rider on this case yet.
        </Text>
      )}
    </SectionCard>
  );
}

function MotorcycleCard({
  motorcycle,
  owner,
  priorCount,
}: {
  motorcycle: Motorcycle | null;
  owner: Owner | null;
  priorCount: number;
}) {
  return (
    <SectionCard title="Motorcycle" icon={<MotorcycleIcon size={14} color={colors.teal[600]} />}>
      {motorcycle ? (
        <View>
          <View style={styles.personRow}>
            {motorcycle.bike_photo_url ? (
              <Image source={{ uri: motorcycle.bike_photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <MotorcycleIcon size={20} color={colors.gray[500]} />
              </View>
            )}
            <View style={styles.personBody}>
              <Text style={styles.personName}>
                {motorcycle.registration_number || 'Unregistered'}
              </Text>
              {motorcycle.make || motorcycle.model ? (
                <Text style={styles.personSub}>
                  {[motorcycle.make, motorcycle.model].filter(Boolean).join(' ')}
                </Text>
              ) : null}
              {owner?.full_name ? (
                <Text style={styles.personSub}>Owner: {owner.full_name}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.badgeWrap}>
            {motorcycle.is_compliant ? (
              <View style={[styles.smallBadge, { backgroundColor: colors.green[100] }]}>
                <ShieldCheckIcon size={10} color={colors.green[700]} />
                <Text style={[styles.smallBadgeText, { color: colors.green[700] }]}>Compliant</Text>
              </View>
            ) : (
              <View style={[styles.smallBadge, { backgroundColor: colors.amber[100] }]}>
                <AlertTriangleIcon size={10} color={colors.amber[700]} />
                <Text style={[styles.smallBadgeText, { color: colors.amber[700] }]}>Non-compliant</Text>
              </View>
            )}
            {priorCount > 0 ? (
              <View style={[styles.smallBadge, { backgroundColor: colors.gray[100] }]}>
                <Text style={[styles.smallBadgeText, { color: colors.gray[700] }]}>
                  {priorCount} prior
                </Text>
              </View>
            ) : null}
            <ExpiryBadge iso={motorcycle.insurance_expiry} label="Insurance" />
            <ExpiryBadge iso={motorcycle.inspection_expiry} label="Inspection" />
          </View>

          {motorcycle.insurance_provider ? (
            <InfoRow label="Insurance" value={motorcycle.insurance_provider} />
          ) : null}
        </View>
      ) : (
        <Text style={styles.mutedItalic}>
          No registered motorcycle linked. Only the reporter's description is available.
        </Text>
      )}
    </SectionCard>
  );
}

function OwnerCard({ owner, rider }: { owner: Owner | null; rider: Rider | null }) {
  return (
    <SectionCard title="Owner" icon={<UserIcon size={14} color={colors.gray[700]} />}>
      {owner ? (
        <View>
          <PersonRow
            initials={initialsFor(owner.full_name)}
            name={owner.full_name}
            phone={owner.phone_number || null}
            subtitle={owner.national_id || null}
            photo={owner.profile_photo_url || null}
          />
          <View style={styles.badgeWrap}>
            {owner.id_verified ? (
              <View style={[styles.smallBadge, { backgroundColor: colors.green[100] }]}>
                <Text style={[styles.smallBadgeText, { color: colors.green[700] }]}>ID verified</Text>
              </View>
            ) : null}
            {rider && owner.national_id && (rider as any).id_number &&
            (rider as any).id_number !== owner.national_id ? (
              <View style={[styles.smallBadge, { backgroundColor: colors.amber[100] }]}>
                <Text style={[styles.smallBadgeText, { color: colors.amber[700] }]}>
                  Different person
                </Text>
              </View>
            ) : null}
          </View>
          {owner.next_of_kin_name ? (
            <InfoRow
              label="Next of kin"
              value={
                owner.next_of_kin_phone
                  ? `${owner.next_of_kin_name} (${owner.next_of_kin_phone})`
                  : owner.next_of_kin_name
              }
            />
          ) : null}
        </View>
      ) : (
        <Text style={styles.mutedItalic}>Owner not linked to this case.</Text>
      )}
    </SectionCard>
  );
}

/* --------- styles --------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: { marginTop: spacing.md, color: colors.gray[600] },
  errorTitle: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray[900],
  },
  errorText: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.gray[600],
    textAlign: 'center',
  },
  errorBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorBtnText: { color: colors.white, fontWeight: '700' },

  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: colors.gray[800], fontWeight: '600', fontSize: 14 },

  content: { padding: spacing.md, paddingBottom: spacing.xxxxl },

  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    ...shadows.sm,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  caseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gray[900],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  caseChipText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  typeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  miniBadgeText: { fontSize: 10, fontWeight: '700' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    maxWidth: '100%',
  },
  metaChipText: { fontSize: 11, color: colors.gray[700], flexShrink: 1 },

  progressBlock: {
    marginTop: spacing.md,
    backgroundColor: colors.gray[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.gray[500],
  },
  progressCount: { fontSize: 10, color: colors.gray[500] },
  progressTrack: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  stepsRow: { flexDirection: 'row', marginTop: 8 },
  stepCol: { flex: 1, alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 999, marginBottom: 4 },
  stepDotActive: {
    transform: [{ scale: 1.2 }],
  },
  stepLabel: { fontSize: 10 },

  sectionHeader: {
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.gray[500],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray[800],
  },

  paragraph: {
    fontSize: 14,
    color: colors.gray[800],
    lineHeight: 21,
  },

  warningBanner: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: 6,
    padding: spacing.sm,
    backgroundColor: colors.amber[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.amber[100],
  },
  warningText: { fontSize: 12, color: colors.amber[700], flex: 1, lineHeight: 17 },
  warningLabel: { fontWeight: '700' },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  infoLabel: { fontSize: 12, color: colors.gray[500], flex: 1 },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[900],
    flex: 1.4,
    textAlign: 'right',
  },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: borderRadius.md },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontWeight: '700', color: colors.gray[700] },
  personBody: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '700', color: colors.gray[900] },
  personSub: { fontSize: 12, color: colors.gray[500], marginTop: 2 },
  personLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  personLink: { fontSize: 12, color: colors.brand[600], fontWeight: '600' },

  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  smallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallBadgeText: { fontSize: 10, fontWeight: '700' },

  mutedItalic: { fontSize: 13, color: colors.gray[500], fontStyle: 'italic' },
  mutedSmall: { marginTop: 6, fontSize: 11, color: colors.gray[500] },
  mutedTiny: { fontSize: 10, color: colors.gray[500] },

  noteRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  noteText: { fontSize: 13, color: colors.gray[800], lineHeight: 19 },
  noteMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  noteAuthor: { fontSize: 11, fontWeight: '700', color: colors.gray[700] },

  evidenceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  evidenceThumb: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
  evidenceThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceBody: { flex: 1 },
  evidenceKind: { fontSize: 12, fontWeight: '700', color: colors.gray[800] },
  evidenceDesc: { fontSize: 12, color: colors.gray[600], marginTop: 2 },

  diagBanner: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  diagLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  diagText: { fontSize: 11, fontFamily: 'monospace', color: colors.gray[800] },
  errorDebug: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
    alignSelf: 'stretch',
  },
  errorDebugLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.gray[500],
    marginBottom: 4,
  },
  errorDebugValue: { fontSize: 11, fontFamily: 'monospace', color: colors.gray[800] },

  actionBar: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  poiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  linkDanger: { fontSize: 11, color: colors.red[600], fontWeight: '700' },

  summonRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  summonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  timelineDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[500], marginTop: 6,
  },
  timelineAction: { fontSize: 13, fontWeight: '700', color: colors.gray[900] },
  timelineNote: { fontSize: 12, color: colors.gray[700], marginTop: 2 },
});
