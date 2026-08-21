import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, User, MapPin, Calendar, Shield, UserCheck, ArrowLeft, FileText, DollarSign, ShieldCheck, RotateCcw, ZoomIn, Zap, Lock, Users, Gavel, MessageSquarePlus, Upload, Loader2, Ban, Clock, XCircle, CheckCircle, ChevronDown, ChevronUp, Search, Filter, Camera, FileImage, LayoutList, LayoutGrid } from 'lucide-react';
import { supabase, type PoliceOfficerWithStation, type PoliceOfficer, type Incident, type IncidentEvidence, type IncidentResolution, type Fine, type PoliceStation, type IncidentSummons, type Rider, type Owner, type IncidentPersonOfInterest } from '../../lib/supabase';
import { PoliceAuthService } from '../../lib/policeAuth';
import { logIncidentResolution, fetchIncidentResolutions, RESOLUTION_OUTCOMES } from '../../lib/incidentResolutions';
import ResolveIncidentModal from './ResolveIncidentModal';
import SummonModal from './SummonModal';
import CaseBriefCard from './CaseBriefCard';
import InvolvedParties from './InvolvedParties';
import PreviousReports from './PreviousReports';
import CaseSummaryHeader from './CaseSummaryHeader';
import CaseTimeline from './CaseTimeline';
import CaseNotes from './CaseNotes';
import CaseMessagesPanel from './CaseMessagesPanel';
import PersonsOfInterestPanel from './PersonsOfInterestPanel';
import EntityProfileDrawer, { type EntityRef } from './EntityProfileDrawer';

type Props = { officer: PoliceOfficerWithStation };

export default function PoliceIncidents({ officer }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [nearbyIncidents, setNearbyIncidents] = useState<Incident[]>([]);
  const [nearbyStations, setNearbyStations] = useState<Record<string, PoliceStation>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [policeNotes, setPoliceNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaveMsg, setNoteSaveMsg] = useState('');
  const [stationOfficers, setStationOfficers] = useState<PoliceOfficer[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [assigningOfficer, setAssigningOfficer] = useState(false);
  const [evidence, setEvidence] = useState<IncidentEvidence[]>([]);
  const [timeline, setTimeline] = useState<IncidentResolution[]>([]);
  const [linkedFines, setLinkedFines] = useState<Fine[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [claimingCase, setClaimingCase] = useState(false);
  const [reassignStationOptions, setReassignStationOptions] = useState<PoliceStation[]>([]);
  const [selectedReassignStationId, setSelectedReassignStationId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [showReassignForm, setShowReassignForm] = useState(false);
  const [summonsList, setSummonsList] = useState<IncidentSummons[]>([]);
  const [showSummonModal, setShowSummonModal] = useState(false);
  const [summonsRider, setSummonsRider] = useState<Rider | null>(null);
  const [summonsOwner, setSummonsOwner] = useState<Owner | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceUploadMsg, setEvidenceUploadMsg] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const [personsOfInterest, setPersonsOfInterest] = useState<IncidentPersonOfInterest[]>([]);
  const [motorcycleReg, setMotorcycleReg] = useState<string | null>(null);
  const [motorcyclePhotoUrl, setMotorcyclePhotoUrl] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [showEvidence, setShowEvidence] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [incidentEvidenceCounts, setIncidentEvidenceCounts] = useState<Record<string, number>>({});
  const [incidentRiderMap, setIncidentRiderMap] = useState<Record<string, { name: string; phone: string | null }>>({});
  const [incidentMotoMap, setIncidentMotoMap] = useState<Record<string, string>>({});
  const [officerNameMap, setOfficerNameMap] = useState<Record<string, { full_name: string; profile_photo_url: string | null }>>({});
  const [profileEntity, setProfileEntity] = useState<EntityRef | null>(null);

  useEffect(() => { loadIncidents(); }, [filter]);
  useEffect(() => {
    if (officer.is_station_admin) loadStationOfficers();
  }, [officer.is_station_admin]);
  useEffect(() => {
    if (selectedIncident) loadIncidentSidebar(selectedIncident.id);
    else {
      setEvidence([]); setTimeline([]); setLinkedFines([]); setSummonsList([]);
      setSummonsRider(null); setSummonsOwner(null); setNoteSaveMsg(''); setEvidenceUploadMsg('');
      setPersonsOfInterest([]); setMotorcycleReg(null); setMotorcyclePhotoUrl(null); setShowNoteForm(false);
      setEvidenceDescription('');
    }
  }, [selectedIncident?.id]);

  const loadIncidentSidebar = async (incidentId: string) => {
    const [ev, tl, fn, sm, poi] = await Promise.all([
      supabase.from('incident_evidence').select('*').eq('incident_id', incidentId),
      fetchIncidentResolutions(incidentId),
      supabase.from('fines').select('*').eq('incident_id', incidentId).order('issued_at', { ascending: false }),
      supabase.from('incident_summons').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }),
      supabase.from('incident_persons_of_interest').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }),
    ]);
    setEvidence((ev.data as IncidentEvidence[]) || []);

    const officerActorIds = Array.from(new Set(
      tl.filter((t) => t.actor_type === 'officer' && t.actor_id).map((t) => t.actor_id as string),
    ));
    const missingIds = officerActorIds.filter((id) => !officerNameMap[id]);
    let nameMapForTimeline = officerNameMap;
    if (missingIds.length > 0) {
      const { data: fetched } = await supabase
        .from('police_officers')
        .select('id, full_name, profile_photo_url')
        .in('id', missingIds);
      const merged = { ...officerNameMap };
      for (const o of (fetched as { id: string; full_name: string; profile_photo_url: string | null }[]) || []) {
        merged[o.id] = { full_name: o.full_name, profile_photo_url: o.profile_photo_url };
      }
      nameMapForTimeline = merged;
      setOfficerNameMap(merged);
    }
    const enrichedTimeline = tl.map((t) => {
      if (t.actor_type !== 'officer' || !t.actor_id) return t;
      const name = nameMapForTimeline[t.actor_id]?.full_name;
      if (!name) return t;
      if (t.actor_name && t.actor_name.trim() && t.actor_name !== 'Unknown officer') return t;
      return { ...t, actor_name: name };
    });
    setTimeline(enrichedTimeline);
    setLinkedFines((fn.data as Fine[]) || []);
    setSummonsList((sm.data as IncidentSummons[]) || []);
    setPersonsOfInterest((poi.data as IncidentPersonOfInterest[]) || []);

    if (selectedIncident) {
      if (selectedIncident.rider_id) {
        const { data: r } = await supabase.from('riders').select('*').eq('id', selectedIncident.rider_id).maybeSingle();
        setSummonsRider(r as Rider | null);
      } else {
        setSummonsRider(null);
      }
      if (selectedIncident.owner_id) {
        const { data: o } = await supabase.from('owners').select('*').eq('id', selectedIncident.owner_id).maybeSingle();
        setSummonsOwner(o as Owner | null);
      } else {
        setSummonsOwner(null);
      }
      if (selectedIncident.motorcycle_id) {
        const { data: m } = await supabase.from('motorcycles').select('registration_number, bike_photo_url').eq('id', selectedIncident.motorcycle_id).maybeSingle();
        const row = m as { registration_number: string; bike_photo_url: string | null } | null;
        setMotorcycleReg(row?.registration_number || null);
        setMotorcyclePhotoUrl(row?.bike_photo_url || null);
      } else {
        setMotorcycleReg(null);
        setMotorcyclePhotoUrl(null);
      }
    }
  };

  const loadStationOfficers = async () => {
    const { data } = await supabase
      .from('police_officers')
      .select('*')
      .eq('station_id', officer.station_id)
      .eq('is_active', true)
      .order('full_name');
    if (data) setStationOfficers(data);
  };

  const loadIncidents = async () => {
    setLoading(true);
    let query = supabase
      .from('incidents')
      .select('*')
      .eq('assigned_station_id', officer.station_id)
      .order('created_at', { ascending: false });

    if (!officer.is_station_admin) {
      query = query.or(`assigned_officer_id.eq.${officer.id},assigned_officer_id.is.null`);
    }

    if (filter !== 'all') {
      query = query.eq('police_status', filter);
    }

    const { data } = await query;
    const list = (data || []) as Incident[];
    setIncidents(list);

    const ids = list.map((i) => i.id);
    const riderIds = Array.from(new Set(list.map((i) => i.rider_id).filter(Boolean))) as string[];
    const motoIds = Array.from(new Set(list.map((i) => i.motorcycle_id).filter(Boolean))) as string[];
    const officerIds = Array.from(new Set(
      list
        .flatMap((i) => [i.assigned_officer_id, i.claimed_by_manager_id])
        .filter(Boolean) as string[],
    ));

    const [{ data: evRows }, { data: riderRows }, { data: motoRows }, { data: officerRows }] = await Promise.all([
      ids.length
        ? supabase.from('incident_evidence').select('incident_id').in('incident_id', ids)
        : Promise.resolve({ data: [] as { incident_id: string }[] }),
      riderIds.length
        ? supabase.from('riders').select('id, name, phone_number').in('id', riderIds)
        : Promise.resolve({ data: [] as { id: string; name: string; phone_number: string | null }[] }),
      motoIds.length
        ? supabase.from('motorcycles').select('id, registration_number').in('id', motoIds)
        : Promise.resolve({ data: [] as { id: string; registration_number: string }[] }),
      officerIds.length
        ? supabase.from('police_officers').select('id, full_name, profile_photo_url').in('id', officerIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; profile_photo_url: string | null }[] }),
    ]);

    const evCounts: Record<string, number> = {};
    for (const row of (evRows as { incident_id: string }[]) || []) {
      evCounts[row.incident_id] = (evCounts[row.incident_id] || 0) + 1;
    }
    setIncidentEvidenceCounts(evCounts);

    const riderMap: Record<string, { name: string; phone: string | null }> = {};
    for (const r of (riderRows as { id: string; name: string; phone_number: string | null }[]) || []) {
      riderMap[r.id] = { name: r.name, phone: r.phone_number };
    }
    setIncidentRiderMap(riderMap);

    const motoMap: Record<string, string> = {};
    for (const m of (motoRows as { id: string; registration_number: string }[]) || []) {
      motoMap[m.id] = m.registration_number;
    }
    setIncidentMotoMap(motoMap);

    setOfficerNameMap((prev) => {
      const next = { ...prev };
      for (const o of (officerRows as { id: string; full_name: string; profile_photo_url: string | null }[]) || []) {
        next[o.id] = { full_name: o.full_name, profile_photo_url: o.profile_photo_url };
      }
      return next;
    });

    if (officer.is_station_admin && officer.station?.county_id) {
      const { data: stations } = await supabase
        .from('police_stations')
        .select('*')
        .eq('county_id', officer.station.county_id)
        .eq('is_active', true)
        .neq('id', officer.station_id);
      const otherStations = (stations || []) as PoliceStation[];
      const otherStationIds = otherStations.map(s => s.id);
      const stationMap: Record<string, PoliceStation> = {};
      for (const s of otherStations) stationMap[s.id] = s;
      setNearbyStations(stationMap);
      setReassignStationOptions(otherStations);

      if (otherStationIds.length > 0) {
        const { data: nearbyData } = await supabase
          .from('incidents')
          .select('*')
          .in('assigned_station_id', otherStationIds)
          .is('claimed_by_manager_id', null)
          .order('created_at', { ascending: false })
          .limit(50);
        setNearbyIncidents((nearbyData as Incident[]) || []);
      } else {
        setNearbyIncidents([]);
      }
    } else {
      setNearbyIncidents([]);
      setNearbyStations({});
      setReassignStationOptions([]);
    }

    setLoading(false);
  };

  const handleManagerClaim = async (incident: Incident, opts?: { moveToMyStation?: boolean }) => {
    setClaimingCase(true);
    try {
      const nowIso = new Date().toISOString();
      const movingStation = opts?.moveToMyStation && incident.assigned_station_id !== officer.station_id;
      const updateData: any = {
        claimed_by_manager_id: officer.id,
        claimed_at: nowIso,
        police_status: incident.police_status === 'unassigned' || !incident.police_status ? 'assigned' : incident.police_status,
        updated_at: nowIso,
      };
      if (movingStation) updateData.assigned_station_id = officer.station_id;

      await supabase.from('incidents').update(updateData).eq('id', incident.id);

      const notes = movingStation
        ? `${officer.full_name} took ownership and moved the case to ${officer.station.station_name}.`
        : `${officer.full_name} took ownership of this case as station manager.`;

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'claimed_by_manager',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        fromStatus: incident.police_status,
        toStatus: updateData.police_status,
        notes,
        metadata: {
          manager_id: officer.id,
          station_id: officer.station_id,
          station_moved: movingStation,
        },
      });

      await PoliceAuthService.logActivity(officer.id, 'update_incident', 'incident', incident.id, {
        action: 'manager_claimed',
        station_moved: movingStation,
      });

      loadIncidents();
      setSelectedIncident(null);
    } finally {
      setClaimingCase(false);
    }
  };

  const handleReassignToStation = async (incident: Incident) => {
    if (!selectedReassignStationId) return;
    if (incident.claimed_by_manager_id !== officer.id) return;
    setReassigning(true);
    try {
      const nowIso = new Date().toISOString();
      const target = reassignStationOptions.find(s => s.id === selectedReassignStationId);

      await supabase.from('incidents').update({
        assigned_station_id: selectedReassignStationId,
        assigned_officer_id: null,
        police_status: 'unassigned',
        claimed_by_manager_id: null,
        claimed_at: null,
        updated_at: nowIso,
      }).eq('id', incident.id);

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'reassigned',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        fromStatus: incident.police_status,
        toStatus: 'unassigned',
        notes: `Reassigned to ${target?.station_name || 'another station'} by managing officer ${officer.full_name}.`,
        metadata: {
          from_station_id: incident.assigned_station_id,
          to_station_id: selectedReassignStationId,
          to_station_name: target?.station_name,
        },
      });

      await PoliceAuthService.logActivity(officer.id, 'update_incident', 'incident', incident.id, {
        action: 'reassigned_station',
        to_station_id: selectedReassignStationId,
      });

      setSelectedReassignStationId('');
      setShowReassignForm(false);
      loadIncidents();
      setSelectedIncident(null);
    } finally {
      setReassigning(false);
    }
  };

  const handleClaimIncident = async (incident: Incident) => {
    await supabase.from('incidents').update({
      assigned_officer_id: officer.id,
      police_status: 'investigating',
      police_responded_at: new Date().toISOString(),
    }).eq('id', incident.id);

    await logIncidentResolution({
      incidentId: incident.id,
      actionType: 'assigned',
      actorType: 'officer',
      actorId: officer.id,
      actorName: officer.full_name,
      fromStatus: incident.police_status,
      toStatus: 'investigating',
      notes: `${officer.full_name} claimed the case and started investigating.`,
      metadata: { officer_id: officer.id, self_assigned: true },
    });

    await PoliceAuthService.logActivity(officer.id, 'update_incident', 'incident', incident.id, { action: 'claimed' });
    loadIncidents();
    setSelectedIncident(null);
  };

  const handleAssignOfficer = async (incident: Incident) => {
    if (!selectedOfficerId) return;
    setAssigningOfficer(true);
    try {
      const newStatus = incident.police_status === 'unassigned' || !incident.police_status ? 'assigned' : incident.police_status;
      await supabase.from('incidents').update({
        assigned_officer_id: selectedOfficerId,
        police_status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', incident.id);

      const assignedOfficer = stationOfficers.find(o => o.id === selectedOfficerId);

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'assigned',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        fromStatus: incident.police_status,
        toStatus: newStatus,
        notes: `Assigned to ${assignedOfficer?.full_name || 'officer'}.`,
        metadata: { officer_id: selectedOfficerId, officer_name: assignedOfficer?.full_name },
      });

      await PoliceAuthService.logActivity(officer.id, 'update_incident', 'incident', incident.id, {
        action: 'assigned_officer',
        officer_id: selectedOfficerId,
        officer_name: assignedOfficer?.full_name,
      });

      setSelectedOfficerId('');
      loadIncidents();
      setSelectedIncident(null);
    } finally {
      setAssigningOfficer(false);
    }
  };

  const handleSelfAssign = async (incident: Incident) => {
    setAssigningOfficer(true);
    try {
      await supabase.from('incidents').update({
        assigned_officer_id: officer.id,
        police_status: 'investigating',
        police_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', incident.id);

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'assigned',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        fromStatus: incident.police_status,
        toStatus: 'investigating',
        notes: `${officer.full_name} is handling this case personally.`,
        metadata: { officer_id: officer.id, self_assigned: true },
      });

      await PoliceAuthService.logActivity(officer.id, 'update_incident', 'incident', incident.id, { action: 'self_assigned' });
      loadIncidents();
      setSelectedIncident(null);
    } finally {
      setAssigningOfficer(false);
    }
  };

  const handleUpdateStatus = async (incident: Incident, newStatus: string) => {
    setUpdating(true);
    const updateData: any = { police_status: newStatus };
    if (newStatus === 'closed') updateData.closed_at = new Date().toISOString();
    if (policeNotes.trim()) {
      const timestamp = new Date().toLocaleString();
      const existingNotes = incident.police_notes || '';
      updateData.police_notes = existingNotes + `[${timestamp} - ${officer.full_name}] ${policeNotes}\n`;
    }

    await supabase.from('incidents').update(updateData).eq('id', incident.id);

    await logIncidentResolution({
      incidentId: incident.id,
      actionType: newStatus === 'closed' ? 'closed' : 'status_changed',
      actorType: 'officer',
      actorId: officer.id,
      actorName: officer.full_name,
      fromStatus: incident.police_status,
      toStatus: newStatus,
      notes: policeNotes.trim() || null,
    });

    await PoliceAuthService.logActivity(officer.id, 'update_incident', 'incident', incident.id, { status: newStatus });
    setPoliceNotes('');
    setUpdating(false);
    loadIncidents();
    setSelectedIncident(null);
  };

  const handleAddNote = async (incident: Incident) => {
    if (!policeNotes.trim()) return;
    setSavingNote(true);
    setNoteSaveMsg('');
    try {
      const timestamp = new Date().toLocaleString();
      const existingNotes = incident.police_notes || '';
      const newNotes = existingNotes + `[${timestamp} - ${officer.full_name}] ${policeNotes}\n`;
      await supabase.from('incidents').update({
        police_notes: newNotes,
        updated_at: new Date().toISOString(),
      }).eq('id', incident.id);
      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'note_added',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        notes: policeNotes,
      });
      setPoliceNotes('');
      setNoteSaveMsg('Note saved to the case log.');
      setShowNoteForm(false);
      setSelectedIncident({ ...incident, police_notes: newNotes });
      loadIncidentSidebar(incident.id);
    } finally {
      setSavingNote(false);
    }
  };

  const handleUploadOfficerEvidence = async (files: FileList | null, incident: Incident) => {
    if (!files || files.length === 0) return;
    setUploadingEvidence(true);
    setEvidenceUploadMsg('');
    let uploaded = 0;
    let failed = 0;
    let lastError = '';
    try {
      for (const file of Array.from(files)) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${incident.id}_officer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
          const filePath = `incidents/${fileName}`;
          const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file);
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
          const isImage = file.type.startsWith('image/');
          const { error: insErr } = await supabase.from('incident_evidence').insert({
            incident_id: incident.id,
            evidence_url: urlData.publicUrl,
            evidence_type: isImage ? 'photo' : 'document',
            uploaded_by: 'officer',
            description: evidenceDescription.trim() || null,
          });
          if (insErr) throw insErr;
          uploaded += 1;
        } catch (e: any) {
          console.error('evidence upload failed', e);
          lastError = e?.message || String(e);
          failed += 1;
        }
      }

      if (uploaded > 0) {
        await logIncidentResolution({
          incidentId: incident.id,
          actionType: 'evidence_added',
          actorType: 'officer',
          actorId: officer.id,
          actorName: officer.full_name,
          notes: `Officer uploaded ${uploaded} item${uploaded === 1 ? '' : 's'} of evidence.`,
          metadata: { count: uploaded, failed },
        });
      }

      setEvidenceUploadMsg(
        uploaded > 0
          ? `${uploaded} item${uploaded === 1 ? '' : 's'} uploaded${failed > 0 ? ` (${failed} failed)` : ''}.`
          : `Upload failed${lastError ? `: ${lastError}` : '.'}`
      );
      loadIncidentSidebar(incident.id);
    } finally {
      setUploadingEvidence(false);
      if (evidenceInputRef.current) evidenceInputRef.current.value = '';
      setEvidenceDescription('');
    }
  };

  const handleUpdateSummonsStatus = async (summons: IncidentSummons, newStatus: 'attended' | 'no_show' | 'cancelled') => {
    if (!selectedIncident) return;
    const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'attended') updateData.attended_at = new Date().toISOString();

    await supabase.from('incident_summons').update(updateData).eq('id', summons.id);

    const label = newStatus === 'attended' ? 'attended' : newStatus === 'no_show' ? 'marked as no-show' : 'cancelled';
    await logIncidentResolution({
      incidentId: selectedIncident.id,
      actionType: `summons_${newStatus}`,
      actorType: 'officer',
      actorId: officer.id,
      actorName: officer.full_name,
      notes: `Summons for ${summons.person_name} ${label}.`,
      metadata: { summons_id: summons.id, person_name: summons.person_name, new_status: newStatus },
    });

    loadIncidentSidebar(selectedIncident.id);
  };

  const handleReopen = async (incident: Incident) => {
    if (!reopenReason.trim()) return;
    setUpdating(true);
    await supabase.from('incidents').update({
      status: 'confirmed',
      police_status: 'investigating',
      resolution_outcome: null,
      resolution_summary: null,
      resolved_at: null,
      closed_at: null,
      reopened_count: (incident.reopened_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', incident.id);

    await logIncidentResolution({
      incidentId: incident.id,
      actionType: 'reopened',
      actorType: 'officer',
      actorId: officer.id,
      actorName: officer.full_name,
      fromStatus: incident.police_status,
      toStatus: 'investigating',
      notes: reopenReason,
    });
    setReopenReason('');
    setShowReopenForm(false);
    setUpdating(false);
    loadIncidents();
    setSelectedIncident(null);
  };

  const getAssignedOfficerName = (incident: Incident) => {
    if (!incident.assigned_officer_id) return null;
    if (incident.assigned_officer_id === officer.id) return 'You';
    const o = stationOfficers.find(off => off.id === incident.assigned_officer_id);
    if (o?.full_name) return o.full_name;
    const fromMap = officerNameMap[incident.assigned_officer_id];
    return fromMap?.full_name || 'Unknown officer';
  };

  const getAssignedOfficerPhoto = (incident: Incident) => {
    if (!incident.assigned_officer_id) return null;
    if (incident.assigned_officer_id === officer.id) return officer.profile_photo_url;
    const o = stationOfficers.find(off => off.id === incident.assigned_officer_id);
    if (o?.profile_photo_url) return o.profile_photo_url;
    return officerNameMap[incident.assigned_officer_id]?.profile_photo_url || null;
  };

  const statusColors: Record<string, string> = {
    unassigned: 'bg-gray-100 text-gray-700',
    assigned: 'bg-amber-100 text-amber-700',
    investigating: 'bg-blue-100 text-blue-700',
    awaiting_evidence: 'bg-purple-100 text-purple-700',
    awaiting_appeal_review: 'bg-purple-100 text-purple-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-slate-200 text-slate-700',
  };

  const outcomeLabel = (v: string | null) =>
    RESOLUTION_OUTCOMES.find(o => o.value === v)?.label || null;

  // Detail page view
  if (selectedIncident) {
    const isCaseLocked =
      selectedIncident.police_status === 'resolved' ||
      selectedIncident.police_status === 'closed';
    const assignedOfficerName = getAssignedOfficerName(selectedIncident);
    const assignedOfficerPhotoUrl = getAssignedOfficerPhoto(selectedIncident);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedIncident(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-semibold">Back to Incidents</span>
          </button>
          <div className="h-5 w-px bg-slate-300" />
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColors[selectedIncident.police_status || 'unassigned']}`}>
            {(selectedIncident.police_status || 'unassigned').replace(/_/g, ' ')}
          </span>
          {selectedIncident.claimed_by_manager_id === officer.id && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Yours
            </span>
          )}
        </div>

        <CaseSummaryHeader
          incident={selectedIncident}
          rider={summonsRider}
          owner={summonsOwner}
          motorcycleReg={motorcycleReg}
          motorcyclePhotoUrl={motorcyclePhotoUrl}
          assignedOfficerName={assignedOfficerName}
          assignedOfficerPhotoUrl={assignedOfficerPhotoUrl}
          station={officer.station}
          onOpenProfile={setProfileEntity}
        />

        <div className="grid lg:grid-cols-3 gap-5 items-start">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            <CaseBriefCard incidentId={selectedIncident.id} isClosed={isCaseLocked} />

            <InvolvedParties
              rider={summonsRider}
              owner={summonsOwner}
              motorcycleId={selectedIncident.motorcycle_id}
              onOpenProfile={setProfileEntity}
            />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowDescription((s) => !s)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-bold text-slate-900">Reporter's Description</p>
                </div>
                {showDescription ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {showDescription && (
                <div className="px-5 pb-4 pt-2 border-t border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedIncident.description}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowEvidence((s) => !s)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-bold text-slate-900">Evidence</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {evidence.length}
                  </span>
                </div>
                {showEvidence ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {showEvidence && (
                <div className="px-5 pb-4 pt-2 border-t border-slate-100">
                  {evidence.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No evidence uploaded yet.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {evidence.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setZoomImage(e.evidence_url)}
                          className="group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg text-left"
                        >
                          <div className="relative">
                            <img
                              src={e.evidence_url}
                              alt="Evidence"
                              className="w-full h-24 object-cover rounded-lg border border-slate-200 group-hover:border-blue-500 transition"
                            />
                            {e.uploaded_by === 'rider' && (
                              <span className="absolute top-1 left-1 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold">Rider</span>
                            )}
                            {e.uploaded_by === 'officer' && (
                              <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold">Officer</span>
                            )}
                            {e.uploaded_by === 'reporter' && (
                              <span className="absolute top-1 left-1 bg-slate-700 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold">Reporter</span>
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition flex items-center justify-center">
                              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                          {e.description && (
                            <p
                              className="mt-1 text-[10px] text-slate-600 line-clamp-2 leading-snug"
                              title={e.description}
                            >
                              {e.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {(selectedIncident.resolution_outcome || linkedFines.length > 0) && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Resolution
                </p>
                {selectedIncident.resolution_outcome && (
                  <div className="mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">Outcome</span>
                    <p className="text-sm text-emerald-900 font-semibold">{outcomeLabel(selectedIncident.resolution_outcome)}</p>
                  </div>
                )}
                {selectedIncident.resolution_summary && (
                  <div className="mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">Summary</span>
                    <p className="text-sm text-emerald-900 whitespace-pre-wrap">{selectedIncident.resolution_summary}</p>
                  </div>
                )}
                {linkedFines.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Fines issued
                    </span>
                    <ul className="mt-1 space-y-1">
                      {linkedFines.map((f) => (
                        <li key={f.id} className="text-xs text-emerald-900 flex items-center justify-between bg-white rounded px-2 py-1.5 border border-emerald-200">
                          <span className="font-mono font-semibold">{f.fine_reference}</span>
                          <span>KES {f.fine_amount.toLocaleString()}</span>
                          <span className="capitalize">{f.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {summonsList.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-red-600" />
                  <p className="text-sm font-bold text-slate-900">Summons Issued</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                    {summonsList.length}
                  </span>
                </div>
                <ul className="p-4 space-y-2">
                  {summonsList.map((s) => {
                    const dateLabel = new Date(s.summon_date + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
                    const statusColor =
                      s.status === 'attended' ? 'bg-emerald-100 text-emerald-800' :
                      s.status === 'no_show' ? 'bg-red-100 text-red-800' :
                      s.status === 'cancelled' ? 'bg-slate-200 text-slate-700' :
                      'bg-amber-100 text-amber-800';
                    return (
                      <li key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900">{s.person_name}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase tracking-wide">{s.person_type}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor}`}>{s.status.replace('_', ' ')}</span>
                            {s.sms_sent ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                                <CheckCircle className="h-2.5 w-2.5" /> SMS sent
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">No SMS</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {dateLabel}{s.summon_time ? ` at ${s.summon_time}` : ''} \u00b7 {s.person_phone}
                          </p>
                          <p className="text-xs text-slate-700 mt-1"><span className="font-semibold">Reason:</span> {s.reason}</p>
                          {s.notes && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">Internal: {s.notes}</p>
                          )}
                        </div>
                        {s.status === 'pending' && (
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleUpdateSummonsStatus(s, 'attended')}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <CheckCircle className="h-3 w-3" /> Mark Attended
                            </button>
                            <button
                              onClick={() => handleUpdateSummonsStatus(s, 'no_show')}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                            >
                              <XCircle className="h-3 w-3" /> No-show
                            </button>
                            <button
                              onClick={() => handleUpdateSummonsStatus(s, 'cancelled')}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-200 text-slate-700 rounded hover:bg-slate-300 flex items-center gap-1"
                            >
                              <Ban className="h-3 w-3" /> Cancel
                            </button>
                          </div>
                        )}
                        {s.attended_at && (
                          <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> Attended {new Date(s.attended_at).toLocaleString()}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <CaseNotes
              incidentId={selectedIncident.id}
              actor={{ id: officer.id, name: officer.full_name }}
              legacyNotes={selectedIncident.police_notes}
              timeline={timeline}
              locked={isCaseLocked}
            />

            <CaseTimeline timeline={timeline} />
          </div>

          {/* Right column - Resolution & communication */}
          <div className="space-y-4">
            {isCaseLocked && (
              <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Lock className="h-4 w-4 text-slate-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      Case {selectedIncident.police_status === 'closed' ? 'closed' : 'resolved'}
                    </p>
                    <p className="text-xs text-slate-600 leading-snug mt-0.5">
                      Notes, evidence, assignment and summons are locked. Reopen the case below to make further changes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Case Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Resolution Actions</h4>
              <div className="space-y-2">
                {!officer.is_station_admin && (!selectedIncident.assigned_officer_id || selectedIncident.police_status === 'assigned') && (
                  <button
                    onClick={() => handleClaimIncident(selectedIncident)}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    Claim &amp; Investigate
                  </button>
                )}

                {selectedIncident.assigned_station_id === officer.station_id &&
                  selectedIncident.police_status !== 'resolved' &&
                  selectedIncident.police_status !== 'closed' && (
                  <button
                    onClick={() => setShowSummonModal(true)}
                    className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <Gavel className="h-4 w-4" />
                    Issue Summons...
                  </button>
                )}

                {selectedIncident.police_status === 'investigating' && (
                  <>
                    <button
                      onClick={() => setShowResolveModal(true)}
                      disabled={updating}
                      className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Resolve Case...
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedIncident, 'awaiting_evidence')}
                      disabled={updating}
                      className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      Await Evidence
                    </button>
                  </>
                )}

                {selectedIncident.police_status === 'awaiting_evidence' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedIncident, 'investigating')}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    Resume Investigation
                  </button>
                )}

                {selectedIncident.police_status === 'resolved' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedIncident, 'closed')}
                      disabled={updating}
                      className="w-full px-4 py-2.5 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      Close Case
                    </button>
                    <button
                      onClick={() => setShowReopenForm((s) => !s)}
                      disabled={updating}
                      className="w-full px-4 py-2.5 bg-amber-50 text-amber-800 border border-amber-200 text-sm font-semibold rounded-lg hover:bg-amber-100 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reopen
                    </button>
                  </>
                )}

                {selectedIncident.police_status === 'closed' && (
                  <button
                    onClick={() => setShowReopenForm((s) => !s)}
                    disabled={updating}
                    className="w-full px-4 py-2.5 bg-amber-50 text-amber-800 border border-amber-200 text-sm font-semibold rounded-lg hover:bg-amber-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reopen Case
                  </button>
                )}

                {showReopenForm && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                    <p className="text-xs font-semibold text-amber-900">Why are you reopening?</p>
                    <textarea
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      rows={2}
                      className="w-full text-xs px-2 py-1.5 border border-amber-200 rounded"
                      placeholder="e.g., new evidence emerged from the rider..."
                    />
                    <button
                      onClick={() => handleReopen(selectedIncident)}
                      disabled={updating || !reopenReason.trim()}
                      className="w-full px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700 disabled:opacity-50"
                    >
                      Confirm Reopen
                    </button>
                  </div>
                )}

                {!isCaseLocked && !showNoteForm && (
                  <button
                    onClick={() => { setShowNoteForm(true); setNoteSaveMsg(''); }}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Add Note
                  </button>
                )}

                {!isCaseLocked && showNoteForm && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">New investigation note</p>
                    <textarea
                      value={policeNotes}
                      onChange={(e) => setPoliceNotes(e.target.value)}
                      rows={3}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs resize-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Interviewed witness, statement recorded..."
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500">Appended to the case log with your name and timestamp.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddNote(selectedIncident)}
                        disabled={savingNote || !policeNotes.trim()}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {savingNote ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
                        ) : (
                          <><MessageSquarePlus className="h-3 w-3" /> Save note</>
                        )}
                      </button>
                      <button
                        onClick={() => { setShowNoteForm(false); setPoliceNotes(''); }}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {noteSaveMsg && !showNoteForm && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {noteSaveMsg}
                  </div>
                )}

                {!isCaseLocked && selectedIncident.assigned_station_id === officer.station_id && (
                  <>
                    <input
                      ref={evidenceInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUploadOfficerEvidence(e.target.files, selectedIncident)}
                    />
                    <div className="space-y-2">
                      <label className="block">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Evidence details <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
                        </span>
                        <textarea
                          value={evidenceDescription}
                          onChange={(e) => setEvidenceDescription(e.target.value)}
                          disabled={uploadingEvidence}
                          placeholder="Briefly describe what this evidence shows (e.g. CCTV still of suspect at 21:14, dashcam clip from witness)"
                          rows={2}
                          className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:opacity-50"
                        />
                      </label>
                      <button
                        onClick={() => evidenceInputRef.current?.click()}
                        disabled={uploadingEvidence}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {uploadingEvidence ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                        ) : (
                          <><Upload className="h-4 w-4" /> Add Evidence</>
                        )}
                      </button>
                    </div>
                    {evidenceUploadMsg && (
                      <p className={`text-[11px] rounded px-2 py-1 flex items-center gap-1 border ${
                        evidenceUploadMsg.toLowerCase().includes('fail')
                          ? 'text-red-700 bg-red-50 border-red-200'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      }`}>
                        {evidenceUploadMsg.toLowerCase().includes('fail') ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        {evidenceUploadMsg}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Officer Assignment - Station Admin Only */}
            {!isCaseLocked && officer.is_station_admin && selectedIncident.assigned_station_id === officer.station_id && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Assign Officer
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">Delegate the case or handle it yourself.</p>
                <div className="space-y-2">
                  <select
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an officer...</option>
                    {stationOfficers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.full_name} ({o.rank.replace(/_/g, ' ')}) {o.id === officer.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssignOfficer(selectedIncident)}
                    disabled={!selectedOfficerId || assigningOfficer}
                    className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {assigningOfficer ? 'Assigning...' : 'Assign officer'}
                  </button>
                  <button
                    onClick={() => handleSelfAssign(selectedIncident)}
                    disabled={assigningOfficer || selectedIncident.assigned_officer_id === officer.id}
                    className="w-full px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Handle myself
                  </button>
                </div>
              </div>
            )}

            {/* Manager Claim / Reassign - Station Admin Only */}
            {!isCaseLocked && officer.is_station_admin && (
              <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm p-4">
                <h4 className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" />
                  Case Ownership
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">Manager-level control over case ownership.</p>

                {selectedIncident.claimed_by_manager_id === officer.id ? (
                  <>
                    <div className="mb-2 p-2.5 rounded-lg bg-emerald-100 border border-emerald-200">
                      <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> You own this case
                      </p>
                      {selectedIncident.claimed_at && (
                        <p className="text-[10px] text-emerald-700 mt-0.5">
                          Claimed {new Date(selectedIncident.claimed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {!showReassignForm ? (
                      <button
                        onClick={() => setShowReassignForm(true)}
                        disabled={reassignStationOptions.length === 0}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Reassign to another station...
                      </button>
                    ) : (
                      <div className="space-y-2 p-2.5 rounded-lg bg-white border border-emerald-200">
                        <p className="text-[11px] font-semibold text-slate-700">Choose a station in your county</p>
                        <select
                          value={selectedReassignStationId}
                          onChange={(e) => setSelectedReassignStationId(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Select station...</option>
                          {reassignStationOptions.map((s) => (
                            <option key={s.id} value={s.id}>{s.station_name}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReassignToStation(selectedIncident)}
                            disabled={!selectedReassignStationId || reassigning}
                            className="flex-1 px-2.5 py-1.5 bg-emerald-600 text-white text-[11px] font-semibold rounded hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {reassigning ? 'Reassigning...' : 'Confirm reassign'}
                          </button>
                          <button
                            onClick={() => { setShowReassignForm(false); setSelectedReassignStationId(''); }}
                            className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-[11px] font-semibold rounded hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : selectedIncident.claimed_by_manager_id ? (
                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Claimed by another manager
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Only the claiming manager can reassign.</p>
                  </div>
                ) : (
                  <>
                    {selectedIncident.assigned_station_id === officer.station_id ? (
                      <button
                        onClick={() => handleManagerClaim(selectedIncident)}
                        disabled={claimingCase}
                        className="w-full px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {claimingCase ? 'Claiming...' : 'Claim ownership'}
                      </button>
                    ) : (
                      <>
                        <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-snug">
                          At <span className="font-semibold">{nearbyStations[selectedIncident.assigned_station_id || '']?.station_name || 'another station'}</span>. Taking will move it to your station.
                        </div>
                        <button
                          onClick={() => handleManagerClaim(selectedIncident, { moveToMyStation: true })}
                          disabled={claimingCase}
                          className="w-full px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {claimingCase ? 'Taking case...' : `Take to ${officer.station.station_name}`}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            <PersonsOfInterestPanel
              incidentId={selectedIncident.id}
              officer={officer}
              personsOfInterest={personsOfInterest}
              locked={isCaseLocked}
              onChanged={() => loadIncidentSidebar(selectedIncident.id)}
            />

            <CaseMessagesPanel
              incident={selectedIncident}
              officer={officer}
              rider={summonsRider}
              owner={summonsOwner}
              locked={isCaseLocked}
            />

            <PreviousReports
              currentIncidentId={selectedIncident.id}
              reporterName={selectedIncident.reporter_name}
              reporterPhone={selectedIncident.reporter_phone}
              riderId={selectedIncident.rider_id}
              motorcycleId={selectedIncident.motorcycle_id}
              onOpen={(inc) => { setSelectedIncident(inc); setPoliceNotes(''); setSelectedOfficerId(inc.assigned_officer_id || ''); setShowReassignForm(false); }}
            />
          </div>
        </div>

        {showResolveModal && (
          <ResolveIncidentModal
            incident={selectedIncident}
            officer={officer}
            onClose={() => setShowResolveModal(false)}
            onResolved={() => { setShowResolveModal(false); loadIncidents(); setSelectedIncident(null); }}
          />
        )}

        {showSummonModal && (
          <SummonModal
            incident={selectedIncident}
            officer={officer}
            rider={summonsRider}
            owner={summonsOwner}
            personsOfInterest={personsOfInterest}
            onClose={() => setShowSummonModal(false)}
            onIssued={() => {
              setShowSummonModal(false);
              loadIncidentSidebar(selectedIncident.id);
            }}
          />
        )}

        {zoomImage && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
            <img src={zoomImage} alt="Evidence full view" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          </div>
        )}

        <EntityProfileDrawer entity={profileEntity} onClose={() => setProfileEntity(null)} />
      </div>
    );
  }

  // List view
  const statusFilters = [
    { key: 'all', label: 'All cases', tone: 'slate' },
    { key: 'unassigned', label: 'Unassigned', tone: 'amber' },
    { key: 'assigned', label: 'Assigned', tone: 'blue' },
    { key: 'investigating', label: 'Investigating', tone: 'indigo' },
    { key: 'awaiting_evidence', label: 'Awaiting evidence', tone: 'purple' },
    { key: 'resolved', label: 'Resolved', tone: 'emerald' },
    { key: 'closed', label: 'Closed', tone: 'slate' },
  ] as const;
  const filterToneMap: Record<string, { active: string; inactive: string }> = {
    slate: { active: 'bg-slate-900 text-white border-slate-900', inactive: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300' },
    amber: { active: 'bg-amber-500 text-white border-amber-500', inactive: 'bg-white text-amber-700 border-amber-200 hover:border-amber-300' },
    blue: { active: 'bg-blue-600 text-white border-blue-600', inactive: 'bg-white text-blue-700 border-blue-200 hover:border-blue-300' },
    indigo: { active: 'bg-indigo-600 text-white border-indigo-600', inactive: 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-300' },
    purple: { active: 'bg-purple-600 text-white border-purple-600', inactive: 'bg-white text-purple-700 border-purple-200 hover:border-purple-300' },
    emerald: { active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-300' },
  };

  const uniqueTypes = Array.from(new Set(incidents.map((i) => i.incident_type)));
  const q = searchQuery.trim().toLowerCase();
  const visibleIncidents = incidents.filter((incident) => {
    if (typeFilter !== 'all' && incident.incident_type !== typeFilter) return false;
    if (!q) return true;
    const riderInfo = incident.rider_id ? incidentRiderMap[incident.rider_id] : null;
    const moto = incident.motorcycle_id ? incidentMotoMap[incident.motorcycle_id] : null;
    return [
      incident.case_number,
      incident.incident_type,
      incident.description,
      incident.location,
      incident.reporter_name,
      incident.reporter_phone,
      riderInfo?.name,
      riderInfo?.phone,
      moto,
    ]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });

  const stationName = officer.station?.station_name || 'your station';

  const kpi = [
    { key: 'total', label: 'Total cases', count: incidents.length, tone: 'slate', icon: FileText },
    { key: 'unassigned', label: 'Unassigned', count: incidents.filter((i) => (i.police_status || 'unassigned') === 'unassigned').length, tone: 'amber', icon: Clock },
    { key: 'investigating', label: 'Investigating', count: incidents.filter((i) => i.police_status === 'investigating' || i.police_status === 'assigned').length, tone: 'blue', icon: Shield },
    { key: 'awaiting_evidence', label: 'Awaiting evidence', count: incidents.filter((i) => i.police_status === 'awaiting_evidence').length, tone: 'purple', icon: Camera },
    { key: 'resolved', label: 'Resolved', count: incidents.filter((i) => i.police_status === 'resolved' || i.police_status === 'closed').length, tone: 'emerald', icon: CheckCircle },
  ];
  const kpiToneClasses: Record<string, string> = {
    slate: 'from-slate-500 to-slate-700',
    amber: 'from-amber-400 to-orange-500',
    blue: 'from-blue-500 to-blue-700',
    purple: 'from-purple-500 to-purple-700',
    emerald: 'from-emerald-500 to-teal-600',
  };

  return (
    <div className="space-y-5">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 bg-blue-500/20 rounded-full blur-2xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">Case book</p>
              <h2 className="text-xl sm:text-2xl font-bold">{stationName} incidents</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {incidents.length} case{incidents.length === 1 ? '' : 's'} at your station
                {typeFilter !== 'all' || filter !== 'all' || q ? ` · ${visibleIncidents.length} match your filters` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${viewMode === 'cards' ? 'bg-white text-slate-900' : 'text-slate-200 hover:text-white'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${viewMode === 'compact' ? 'bg-white text-slate-900' : 'text-slate-200 hover:text-white'}`}
            >
              <LayoutList className="h-3.5 w-3.5" /> Compact
            </button>
          </div>
        </div>
      </div>

      {/* KPI ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpi.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.key}
              onClick={() => setFilter(k.key === 'total' ? 'all' : k.key)}
              className={`relative overflow-hidden rounded-xl p-4 text-left transition-all ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-sm bg-white ${
                (filter === k.key || (k.key === 'total' && filter === 'all')) ? 'ring-2 ring-blue-500 shadow-md' : ''
              }`}
            >
              <div className={`absolute -right-4 -top-4 h-16 w-16 bg-gradient-to-br ${kpiToneClasses[k.tone]} opacity-10 rounded-full`} />
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${kpiToneClasses[k.tone]} text-white flex items-center justify-center mb-2 shadow-sm`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-slate-900 leading-none">{k.count}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mt-1">{k.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case number, description, location, reporter, rider, or plate..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1.5">
            <Filter className="h-3 w-3" /> Status
          </p>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => {
              const tone = filterToneMap[f.tone];
              const isActive = filter === f.key;
              const count = f.key === 'all' ? incidents.length : incidents.filter((i) => (i.police_status || 'unassigned') === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${isActive ? tone.active : tone.inactive}`}
                >
                  {f.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/25' : 'bg-slate-100 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {uniqueTypes.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  typeFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                All types
              </button>
              {uniqueTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize transition ${
                    typeFilter === t
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm">Loading incidents...</p>
        </div>
      ) : (
        <>
          {officer.is_station_admin && nearbyIncidents.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900">
                    Nearby unclaimed cases
                  </h3>
                  <p className="text-[11px] text-amber-800">{nearbyIncidents.length} in your area · take one to move it to {stationName}</p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                {nearbyIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    onClick={() => { setSelectedIncident(incident); setPoliceNotes(''); setSelectedOfficerId(''); setShowReassignForm(false); }}
                    className="bg-white rounded-xl border border-amber-200 p-3 cursor-pointer hover:border-amber-400 hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {incident.case_number && (
                            <span className="text-[10px] font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                              {incident.case_number}
                            </span>
                          )}
                          <span className="text-sm font-semibold text-slate-900 capitalize">
                            {incident.incident_type.replace(/_/g, ' ')}
                          </span>
                          {incident.auto_assigned && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold flex items-center gap-0.5">
                              <Zap className="h-2.5 w-2.5" /> Auto
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">{incident.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          <span>At: {nearbyStations[incident.assigned_station_id || '']?.station_name || 'nearby station'}</span>
                          <span>{new Date(incident.incident_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleManagerClaim(incident, { moveToMyStation: true }); }}
                        disabled={claimingCase}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        Take case
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleIncidents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <AlertTriangle className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-800 font-semibold">
                {incidents.length === 0 ? 'No incidents at your station yet' : 'No cases match your filters'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {incidents.length === 0
                  ? 'Cases assigned to your station will appear here.'
                  : 'Try clearing search terms or switching the status filter.'}
              </p>
              {(searchQuery || typeFilter !== 'all' || filter !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setTypeFilter('all'); setFilter('all'); }}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {visibleIncidents.map((incident) => renderIncidentCard(incident))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {visibleIncidents.map((incident) => renderIncidentRowCompact(incident))}
            </div>
          )}
        </>
      )}
    </div>
  );

  function renderIncidentCard(incident: Incident) {
    const status = incident.police_status || 'unassigned';
    const riderInfo = incident.rider_id ? incidentRiderMap[incident.rider_id] : null;
    const moto = incident.motorcycle_id ? incidentMotoMap[incident.motorcycle_id] : null;
    const evCount = incidentEvidenceCounts[incident.id] || 0;
    const created = new Date(incident.incident_date);
    const isMine = incident.claimed_by_manager_id === officer.id || incident.assigned_officer_id === officer.id;
    const typeIcon = incident.incident_type === 'theft' ? Shield : incident.incident_type === 'accident' ? AlertTriangle : incident.incident_type === 'traffic_violation' || incident.incident_type === 'speeding' ? Zap : AlertTriangle;
    const TypeIcon = typeIcon;
    return (
      <div
        key={incident.id}
        onClick={() => { setSelectedIncident(incident); setPoliceNotes(''); setSelectedOfficerId(incident.assigned_officer_id || ''); setShowReassignForm(false); }}
        className="bg-white rounded-2xl border border-slate-200 p-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              incident.incident_type === 'theft' ? 'bg-orange-100 text-orange-600' :
              incident.incident_type === 'accident' ? 'bg-red-100 text-red-600' :
              incident.incident_type === 'harassment' ? 'bg-pink-100 text-pink-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {incident.case_number && (
                  <span className="text-[10px] font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                    {incident.case_number}
                  </span>
                )}
                <p className="text-sm font-bold text-slate-900 capitalize truncate">
                  {incident.incident_type.replace(/_/g, ' ')}
                </p>
                {isMine && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-0.5">
                    <Lock className="h-2.5 w-2.5" /> Yours
                  </span>
                )}
              </div>
              {incident.description && (
                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-snug">{incident.description}</p>
              )}
            </div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusColors[status]}`}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
          {moto && (
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="font-semibold text-slate-800 truncate">{moto}</span>
            </div>
          )}
          {riderInfo && (
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{riderInfo.name}</span>
            </div>
          )}
          {incident.location && (
            <div className="flex items-center gap-1.5 min-w-0 col-span-2">
              <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{incident.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-slate-400" />
            <span>{created.toLocaleDateString()}</span>
          </div>
          {incident.assigned_officer_id && (
            <div className="flex items-center gap-1.5 min-w-0">
              <UserCheck className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{getAssignedOfficerName(incident)}</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            {evCount > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <FileImage className="h-3 w-3" /> {evCount} evidence
              </span>
            )}
            {incident.reporter_name && (
              <span className="truncate">Reported by {incident.reporter_name}</span>
            )}
          </div>
          <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
            Open case <ChevronDown className="h-3 w-3 -rotate-90" />
          </span>
        </div>
      </div>
    );
  }

  function renderIncidentRowCompact(incident: Incident) {
    const status = incident.police_status || 'unassigned';
    const riderInfo = incident.rider_id ? incidentRiderMap[incident.rider_id] : null;
    const moto = incident.motorcycle_id ? incidentMotoMap[incident.motorcycle_id] : null;
    const evCount = incidentEvidenceCounts[incident.id] || 0;
    return (
      <div
        key={incident.id}
        onClick={() => { setSelectedIncident(incident); setPoliceNotes(''); setSelectedOfficerId(incident.assigned_officer_id || ''); setShowReassignForm(false); }}
        className="grid grid-cols-12 gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer items-center"
      >
        <div className="col-span-12 sm:col-span-3 min-w-0 flex items-center gap-2">
          {incident.case_number && (
            <span className="text-[10px] font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
              {incident.case_number}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-900 capitalize truncate">{incident.incident_type.replace(/_/g, ' ')}</span>
        </div>
        <div className="col-span-6 sm:col-span-2 min-w-0 truncate text-xs text-slate-600">{moto || '—'}</div>
        <div className="col-span-6 sm:col-span-2 min-w-0 truncate text-xs text-slate-600">{riderInfo?.name || incident.reporter_name || '—'}</div>
        <div className="col-span-6 sm:col-span-2 min-w-0 truncate text-xs text-slate-500">{incident.location || '—'}</div>
        <div className="col-span-3 sm:col-span-1 text-xs text-slate-500">{new Date(incident.incident_date).toLocaleDateString()}</div>
        <div className="col-span-3 sm:col-span-1 text-xs text-slate-500 text-right">
          {evCount > 0 && (
            <span className="inline-flex items-center gap-0.5"><FileImage className="h-3 w-3" /> {evCount}</span>
          )}
        </div>
        <div className="col-span-6 sm:col-span-1 flex justify-end">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusColors[status]}`}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    );
  }
}
