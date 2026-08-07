import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock, MessageSquare, ZoomIn, Shield, Search, X, Send, Loader2, Zap, Lock, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { supabase, type Incident, type IncidentEvidence, type IncidentAppeal, type IncidentResolution, type Motorcycle, type Rider, type Owner, type PoliceStation } from '../lib/supabase';
import { logIncidentResolution, fetchIncidentResolutions, IGNORE_REASONS } from '../lib/incidentResolutions';
import { findNearestStations, type NearestStationCandidate } from '../lib/nearestStation';
import CaseSummaryHeader from './police/CaseSummaryHeader';
import CaseBriefCard from './police/CaseBriefCard';
import CaseTimeline from './police/CaseTimeline';
import CaseNotes from './police/CaseNotes';
import InvolvedParties from './police/InvolvedParties';
import PreviousReports from './police/PreviousReports';
import EntityProfileDrawer, { type EntityRef } from './police/EntityProfileDrawer';

type IncidentDetailsPageProps = {
  incident: Incident;
  onBack: () => void;
  onUpdate: () => void;
};

type StationWithCounty = PoliceStation & { county_name?: string };

const ADMIN_ACTOR = { id: null, name: 'Admin' };

export default function IncidentDetailsPage({ incident, onBack, onUpdate }: IncidentDetailsPageProps) {
  const [evidence, setEvidence] = useState<IncidentEvidence[]>([]);
  const [appeals, setAppeals] = useState<IncidentAppeal[]>([]);
  const [timeline, setTimeline] = useState<IncidentResolution[]>([]);
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [assignedOfficerName, setAssignedOfficerName] = useState<string | null>(null);
  const [assignedOfficerPhotoUrl, setAssignedOfficerPhotoUrl] = useState<string | null>(null);
  const [profileEntity, setProfileEntity] = useState<EntityRef | null>(null);
  const [adminNotes, setAdminNotes] = useState(incident.admin_notes || '');
  const [adminResponse, setAdminResponse] = useState(incident.admin_response || '');
  const [responseType, setResponseType] = useState(incident.response_type || '');
  const [ignoreReason, setIgnoreReason] = useState<string>(incident.ignore_reason || '');
  const [showIgnoreForm, setShowIgnoreForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaveMsg, setNoteSaveMsg] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showEvidence, setShowEvidence] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showResponseForm, setShowResponseForm] = useState(false);

  const [sendAlsoAsSms, setSendAlsoAsSms] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendMessageError, setSendMessageError] = useState('');
  const [sendMessageSuccess, setSendMessageSuccess] = useState('');

  const [nearestCandidates, setNearestCandidates] = useState<NearestStationCandidate[]>([]);
  const [loadingNearest, setLoadingNearest] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [stationSearchResults, setStationSearchResults] = useState<StationWithCounty[]>([]);
  const [searchingStations, setSearchingStations] = useState(false);
  const [showStationDropdown, setShowStationDropdown] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationWithCounty | null>(null);
  const [currentlyAssignedStation, setCurrentlyAssignedStation] = useState<StationWithCounty | null>(null);
  const [assigningStation, setAssigningStation] = useState(false);
  const [stationAssignSuccess, setStationAssignSuccess] = useState('');
  const stationSearchRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCaseLocked = incident.police_status === 'resolved' || incident.police_status === 'closed';

  useEffect(() => {
    loadIncidentDetails();
    if (incident.assigned_station_id) loadCurrentStation();
    loadNearestStationCandidates();
  }, [incident.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stationSearchRef.current && !stationSearchRef.current.contains(e.target as Node)) {
        setShowStationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCurrentStation = async () => {
    const { data } = await supabase
      .from('police_stations')
      .select('*, county:kenya_counties(county_name)')
      .eq('id', incident.assigned_station_id!)
      .maybeSingle();
    if (data) {
      setCurrentlyAssignedStation({
        ...data,
        county_name: (data.county as any)?.county_name || undefined,
      });
    }
  };

  const searchStations = async (query: string) => {
    if (query.length < 2) {
      setStationSearchResults([]);
      setShowStationDropdown(false);
      return;
    }
    setSearchingStations(true);
    setShowStationDropdown(true);

    const { data: stationsByName } = await supabase
      .from('police_stations')
      .select('*, county:kenya_counties(county_name)')
      .eq('is_active', true)
      .ilike('station_name', `%${query}%`)
      .limit(10);

    const { data: countyMatches } = await supabase
      .from('kenya_counties')
      .select('id, county_name')
      .ilike('county_name', `%${query}%`)
      .limit(5);

    let stationsByCounty: any[] = [];
    if (countyMatches && countyMatches.length > 0) {
      const countyIds = countyMatches.map((c) => c.id);
      const { data } = await supabase
        .from('police_stations')
        .select('*, county:kenya_counties(county_name)')
        .eq('is_active', true)
        .in('county_id', countyIds)
        .limit(15);
      stationsByCounty = data || [];
    }

    const allStations = [...(stationsByName || []), ...stationsByCounty];
    const uniqueMap = new Map<string, StationWithCounty>();
    for (const s of allStations) {
      if (!uniqueMap.has(s.id)) {
        uniqueMap.set(s.id, { ...s, county_name: (s.county as any)?.county_name || undefined });
      }
    }

    setStationSearchResults(Array.from(uniqueMap.values()));
    setSearchingStations(false);
  };

  const handleStationSearchChange = (value: string) => {
    setStationSearchQuery(value);
    setSelectedStation(null);
    setStationAssignSuccess('');
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchStations(value), 300);
  };

  const selectStation = (station: StationWithCounty) => {
    setSelectedStation(station);
    setStationSearchQuery(station.station_name);
    setShowStationDropdown(false);
  };

  const loadIncidentDetails = async () => {
    setLoading(true);
    try {
      const [{ data: evidenceData }, { data: appealsData }, tl] = await Promise.all([
        supabase.from('incident_evidence').select('*').eq('incident_id', incident.id),
        supabase.from('incident_appeals').select('*').eq('incident_id', incident.id).order('created_at', { ascending: false }),
        fetchIncidentResolutions(incident.id),
      ]);

      setEvidence(evidenceData || []);
      setAppeals(appealsData || []);
      setTimeline(tl);

      if (incident.motorcycle_id) {
        const { data: motorcycleData } = await supabase
          .from('motorcycles')
          .select('*')
          .eq('id', incident.motorcycle_id)
          .maybeSingle();
        setMotorcycle(motorcycleData);

        if (motorcycleData?.owner_id) {
          const { data: ownerData } = await supabase
            .from('owners')
            .select('*')
            .eq('id', motorcycleData.owner_id)
            .maybeSingle();
          setOwner(ownerData);
        }
      }

      if (incident.rider_id) {
        const { data: riderData } = await supabase
          .from('riders')
          .select('*')
          .eq('id', incident.rider_id)
          .maybeSingle();
        setRider(riderData);
      }

      if (incident.assigned_officer_id) {
        const { data: officerData } = await supabase
          .from('police_officers')
          .select('full_name, profile_photo_url')
          .eq('id', incident.assigned_officer_id)
          .maybeSingle();
        setAssignedOfficerName(officerData?.full_name || null);
        setAssignedOfficerPhotoUrl(officerData?.profile_photo_url || null);
      } else {
        setAssignedOfficerName(null);
        setAssignedOfficerPhotoUrl(null);
      }
    } catch (error) {
      console.error('Error loading incident details:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTimeline = async () => {
    const tl = await fetchIncidentResolutions(incident.id);
    setTimeline(tl);
  };

  const handleAddNote = async () => {
    const body = newNote.trim();
    if (!body) return;
    setSavingNote(true);
    setNoteSaveMsg('');
    try {
      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'note_added',
        actorType: 'admin',
        actorName: ADMIN_ACTOR.name,
        notes: body,
        metadata: {},
      });
      await refreshTimeline();
      setNewNote('');
      setNoteSaveMsg('Note added to case.');
      setShowNoteInput(false);
      onUpdate();
    } catch (err: any) {
      setNoteSaveMsg(err?.message || 'Failed to add note.');
    } finally {
      setSavingNote(false);
    }
  };

  const updateStatus = async (newStatus: string, opts?: { ignoreReasonValue?: string }) => {
    if (newStatus === 'ignored' && !opts?.ignoreReasonValue) {
      setShowIgnoreForm(true);
      return;
    }
    setUpdating(true);
    try {
      const updateData: any = {
        status: newStatus,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString(),
      };

      if (adminResponse.trim()) {
        updateData.admin_response = adminResponse.trim();
        updateData.response_type = responseType || 'other';
        updateData.response_sent_at = new Date().toISOString();
      }

      if (newStatus === 'ignored') {
        updateData.ignore_reason = opts?.ignoreReasonValue || 'other';
      }

      const { error } = await supabase.from('incidents').update(updateData).eq('id', incident.id);
      if (error) throw error;

      const actionType = newStatus === 'ignored' ? 'ignored' : newStatus === 'confirmed' ? 'confirmed' : 'status_changed';
      await logIncidentResolution({
        incidentId: incident.id,
        actionType,
        actorType: 'admin',
        actorName: ADMIN_ACTOR.name,
        fromStatus: incident.status,
        toStatus: newStatus,
        notes:
          newStatus === 'ignored'
            ? `Ignored — reason: ${IGNORE_REASONS.find((r) => r.value === (opts?.ignoreReasonValue || 'other'))?.label}`
            : adminNotes || null,
        metadata: newStatus === 'ignored' ? { ignore_reason: opts?.ignoreReasonValue || 'other' } : {},
      });

      onUpdate();
      onBack();
    } catch (error) {
      console.error('Error updating incident status:', error);
      alert('Failed to update incident status');
    } finally {
      setUpdating(false);
      setShowIgnoreForm(false);
    }
  };

  const handleAppealResponse = async (appealId: string, status: string, response: string) => {
    try {
      const { error } = await supabase
        .from('incident_appeals')
        .update({
          appeal_status: status,
          admin_response: response,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', appealId);

      if (error) throw error;
      await loadIncidentDetails();
    } catch (error) {
      console.error('Error responding to appeal:', error);
      alert('Failed to save appeal response');
    }
  };

  const handleSendMessageToRider = async () => {
    setSendMessageError('');
    setSendMessageSuccess('');

    const trimmed = adminResponse.trim();
    if (!trimmed) {
      setSendMessageError('Enter a response message before sending.');
      return;
    }
    if (!rider) {
      setSendMessageError('No linked rider on this incident. The message cannot be delivered.');
      return;
    }

    const wantsSms = sendAlsoAsSms;
    const riderPhone = rider.phone_number || '';
    if (wantsSms && !riderPhone) {
      setSendMessageError("This rider has no phone number on file. Uncheck SMS or add a phone number first.");
      return;
    }

    setSendingMessage(true);
    try {
      const nowIso = new Date().toISOString();
      const chosenType = responseType || 'other';

      const { error: updErr } = await supabase
        .from('incidents')
        .update({
          admin_response: trimmed,
          response_type: chosenType,
          response_sent_at: nowIso,
          admin_notes: adminNotes,
          updated_at: nowIso,
        })
        .eq('id', incident.id);
      if (updErr) throw updErr;

      const notifTitle =
        chosenType === 'warning' ? 'Warning from administration' :
        chosenType === 'summon' ? 'You have been summoned' :
        chosenType === 'cleared' ? 'Incident cleared' :
        'Message from administration';

      const { error: notifErr } = await supabase.from('rider_notifications').insert({
        rider_id: rider.id,
        type: 'incident_response',
        title: notifTitle,
        message: trimmed,
        metadata: {
          incident_id: incident.id,
          response_type: chosenType,
          sent_via_sms: wantsSms,
        },
      });
      if (notifErr) throw notifErr;

      let smsOk = false;
      let smsError = '';
      if (wantsSms) {
        try {
          const { data: smsData, error: smsErr } = await supabase.functions.invoke('send-incident-message-sms', {
            body: {
              rider_phone: riderPhone,
              message: trimmed,
              incident_id: incident.id,
              response_type: chosenType,
            },
          });
          if (smsErr) throw smsErr;
          smsOk = !!(smsData && (smsData as any).success);
          if (!smsOk) smsError = (smsData as any)?.error || 'SMS delivery failed';
        } catch (err: any) {
          smsError = err?.message || 'SMS delivery failed';
        }
      }

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'response_sent',
        actorType: 'admin',
        actorName: ADMIN_ACTOR.name,
        notes: trimmed,
        metadata: {
          response_type: chosenType,
          sent_via_sms: wantsSms,
          sms_delivered: smsOk,
          sms_error: smsError || null,
        },
      });

      const parts = ['Message posted to rider account'];
      if (wantsSms) parts.push(smsOk ? 'SMS sent' : `SMS failed: ${smsError}`);
      setSendMessageSuccess(parts.join(' · '));

      await refreshTimeline();
      onUpdate();
    } catch (err: any) {
      setSendMessageError(err?.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const loadNearestStationCandidates = async () => {
    setLoadingNearest(true);
    try {
      let countyId = incident.county_id;
      let constituencyId = incident.constituency_id;
      let wardId = incident.ward_id;

      if (!countyId && !constituencyId && !wardId) {
        const backfillQueries: Promise<any>[] = [];
        if (incident.rider_id) {
          backfillQueries.push(
            supabase
              .from('riders')
              .select('county_id, constituency_id, ward_id')
              .eq('id', incident.rider_id)
              .maybeSingle()
          );
        }
        if (incident.motorcycle_id) {
          backfillQueries.push(
            supabase
              .from('motorcycles')
              .select('county_id, constituency_id, ward_id, owner_id')
              .eq('id', incident.motorcycle_id)
              .maybeSingle()
          );
        }
        const backfillResults = await Promise.all(backfillQueries);
        for (const r of backfillResults) {
          const row = r?.data;
          if (!row) continue;
          if (!countyId && row.county_id) countyId = row.county_id;
          if (!constituencyId && row.constituency_id) constituencyId = row.constituency_id;
          if (!wardId && row.ward_id) wardId = row.ward_id;
        }

        if (!countyId) {
          const ownerId = (backfillResults.find(r => r?.data?.owner_id)?.data as any)?.owner_id;
          if (ownerId) {
            const { data: ownerData } = await supabase
              .from('owners')
              .select('county_id, constituency_id, ward_id')
              .eq('id', ownerId)
              .maybeSingle();
            if (ownerData) {
              if (!countyId && ownerData.county_id) countyId = ownerData.county_id;
              if (!constituencyId && ownerData.constituency_id) constituencyId = ownerData.constituency_id;
              if (!wardId && ownerData.ward_id) wardId = ownerData.ward_id;
            }
          }
        }
      }

      const results = await findNearestStations(
        {
          county_id: countyId,
          constituency_id: constituencyId,
          ward_id: wardId,
          location: incident.location ?? null,
        },
        6
      );
      setNearestCandidates(results);
    } finally {
      setLoadingNearest(false);
    }
  };

  const handleAutoAssignNearest = async () => {
    if (nearestCandidates.length === 0) return;
    const best = nearestCandidates[0];
    setAutoAssigning(true);
    setStationAssignSuccess('');
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('incidents')
        .update({
          assigned_station_id: best.id,
          police_status: 'unassigned',
          status: incident.status === 'pending' ? 'confirmed' : incident.status,
          auto_assigned: true,
          claimed_by_manager_id: null,
          claimed_at: null,
          updated_at: nowIso,
        })
        .eq('id', incident.id);
      if (error) throw error;

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'auto_assigned',
        actorType: 'admin',
        actorName: ADMIN_ACTOR.name,
        fromStatus: incident.police_status,
        toStatus: 'unassigned',
        notes: `Auto-routed to ${best.station_name} (nearest by ${best.match}). Awaiting a station manager to claim it.`,
        metadata: {
          station_id: best.id,
          station_name: best.station_name,
          match_level: best.match,
          auto_assigned: true,
        },
      });

      setStationAssignSuccess(`Auto-routed to ${best.station_name}`);
      setCurrentlyAssignedStation({
        id: best.id,
        station_name: best.station_name,
        station_code: '',
        station_type: best.station_type,
        county_id: best.county_id,
        constituency_id: best.constituency_id,
        ward_id: best.ward_id,
        physical_address: null,
        gps_lat: null,
        gps_lng: null,
        phone_number: null,
        email: null,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
        county_name: best.county_name || undefined,
      } as any);
      await refreshTimeline();
      onUpdate();
    } catch (err) {
      console.error('Auto-assign failed', err);
      alert('Failed to auto-assign the case.');
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleAssignStation = async () => {
    if (!selectedStation) return;
    if (incident.claimed_by_manager_id) {
      alert('This case has already been claimed by a station manager. Only that manager can reassign it to another station.');
      return;
    }
    setAssigningStation(true);
    setStationAssignSuccess('');
    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          assigned_station_id: selectedStation.id,
          police_status: 'unassigned',
          status: incident.status === 'pending' ? 'confirmed' : incident.status,
          auto_assigned: false,
          claimed_by_manager_id: null,
          claimed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', incident.id);
      if (error) throw error;

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'assigned',
        actorType: 'admin',
        actorName: ADMIN_ACTOR.name,
        fromStatus: incident.police_status,
        toStatus: 'unassigned',
        notes: `Assigned to ${selectedStation.station_name}. Awaiting a station manager to claim it.`,
        metadata: { station_id: selectedStation.id, station_name: selectedStation.station_name },
      });

      setStationAssignSuccess(`Assigned to ${selectedStation.station_name}`);
      setCurrentlyAssignedStation(selectedStation);
      await refreshTimeline();
      onUpdate();
    } catch (error) {
      console.error('Error assigning station:', error);
      alert('Failed to assign station');
    } finally {
      setAssigningStation(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'confirmed':
        return 'bg-red-100 text-red-800';
      case 'resolved':
        return 'bg-emerald-100 text-emerald-800';
      case 'ignored':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading incident details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-semibold">Back to Incidents</span>
        </button>
        <div className="h-5 w-px bg-slate-300" />
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusColor(incident.status)}`}>
          Report: {incident.status}
        </span>
        {isCaseLocked && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Case locked by police
          </span>
        )}
      </div>

      <CaseSummaryHeader
        incident={incident}
        rider={rider}
        owner={owner}
        motorcycleReg={motorcycle?.registration_number || null}
        motorcyclePhotoUrl={motorcycle?.bike_photo_url || null}
        assignedOfficerName={assignedOfficerName}
        assignedOfficerPhotoUrl={assignedOfficerPhotoUrl}
        station={currentlyAssignedStation || null}
        onOpenProfile={setProfileEntity}
      />

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-4">
          <CaseBriefCard incidentId={incident.id} isClosed={isCaseLocked} />

          <InvolvedParties rider={rider} owner={owner} motorcycleId={incident.motorcycle_id} onOpenProfile={setProfileEntity} />

          {incident.unregistered_bike_details && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <h4 className="font-bold text-amber-900 mb-1 flex items-center text-sm gap-2">
                <AlertTriangle className="h-4 w-4" />
                Unregistered Motorcycle Details
              </h4>
              <p className="text-amber-800 text-sm">{incident.unregistered_bike_details}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowDescription((s) => !s)}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-bold text-slate-900">Description</p>
              </div>
              {showDescription ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showDescription && (
              <div className="border-t border-slate-100 px-5 py-4">
                <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{incident.description}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowEvidence((s) => !s)}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-bold text-slate-900">Evidence</p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{evidence.length}</span>
              </div>
              {showEvidence ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showEvidence && (
              <div className="border-t border-slate-100 px-5 py-4">
                {evidence.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {evidence.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedImage(item.evidence_url)}
                        className="group focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg text-left"
                      >
                        <div className="relative">
                          <img
                            src={item.evidence_url}
                            alt="Evidence"
                            className="w-full h-32 object-cover rounded-lg border-2 border-slate-200 group-hover:border-emerald-500 transition"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          {item.uploaded_by === 'rider' && (
                            <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-medium">
                              Rider
                            </div>
                          )}
                          {item.uploaded_by === 'officer' && (
                            <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded font-medium">
                              Officer
                            </div>
                          )}
                          {item.uploaded_by === 'reporter' && (
                            <div className="absolute top-2 left-2 bg-slate-700 text-white text-xs px-2 py-0.5 rounded font-medium">
                              Reporter
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition flex items-center justify-center">
                            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        </div>
                        {item.description && (
                          <p
                            className="mt-1.5 text-[11px] text-slate-600 line-clamp-2 leading-snug"
                            title={item.description}
                          >
                            {item.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">No evidence uploaded.</p>
                )}
              </div>
            )}
          </div>

          {incident.rider_response && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center text-sm gap-2">
                <MessageSquare className="h-4 w-4" />
                Rider's Response
              </h4>
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <p className="text-[11px] text-slate-500 mb-1">
                  Submitted: {incident.rider_response_submitted_at ? new Date(incident.rider_response_submitted_at).toLocaleString() : 'N/A'}
                </p>
                <p className="text-slate-800 text-sm whitespace-pre-wrap">{incident.rider_response}</p>
              </div>
            </div>
          )}

          {appeals.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center text-sm gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                Rider Appeals
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{appeals.length}</span>
              </h4>
              <div className="space-y-3">
                {appeals.map((appeal) => (
                  <div key={appeal.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="text-[11px] text-slate-500">Submitted {new Date(appeal.created_at).toLocaleString()}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          appeal.appeal_status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : appeal.appeal_status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {appeal.appeal_status}
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap mb-2">{appeal.appeal_text}</p>
                    {appeal.admin_response && (
                      <div className="bg-emerald-50 rounded p-2.5 border border-emerald-200">
                        <p className="text-[10px] text-emerald-700 font-semibold mb-1">Admin Response:</p>
                        <p className="text-emerald-900 text-sm">{appeal.admin_response}</p>
                        <p className="text-[10px] text-emerald-600 mt-1.5">Reviewed: {new Date(appeal.reviewed_at!).toLocaleString()}</p>
                      </div>
                    )}
                    {appeal.appeal_status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            const response = prompt('Enter response to accept this appeal:');
                            if (response) handleAppealResponse(appeal.id, 'accepted', response);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            const response = prompt('Enter response to reject this appeal:');
                            if (response) handleAppealResponse(appeal.id, 'rejected', response);
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <CaseNotes
            incidentId={incident.id}
            actor={ADMIN_ACTOR}
            legacyNotes={incident.police_notes}
            timeline={timeline}
            locked={isCaseLocked}
            onReplied={refreshTimeline}
          />

          <CaseTimeline timeline={timeline} />
        </div>

        <div className="space-y-4">
          {isCaseLocked && (
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lock className="h-4 w-4 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    Case {incident.police_status === 'closed' ? 'closed' : 'resolved'} by police
                  </p>
                  <p className="text-xs text-slate-600 leading-snug mt-0.5">
                    Assignment, admin notes and rider responses are locked. The case must be reopened by an officer before further admin changes can be made.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm font-bold text-slate-900">Admin Actions</p>
            </div>

            {!isCaseLocked ? (
              <>
                {showIgnoreForm ? (
                  <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-700">Why are you dismissing this report?</p>
                    <div className="space-y-1">
                      {IGNORE_REASONS.map((r) => (
                        <label key={r.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white rounded px-2 py-1.5">
                          <input
                            type="radio"
                            name="ignore-reason"
                            value={r.value}
                            checked={ignoreReason === r.value}
                            onChange={(e) => setIgnoreReason(e.target.value)}
                            className="text-slate-600"
                          />
                          <span className="text-slate-700">{r.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Dismissed reports do not affect the rider's rating and cannot be actioned by police.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus('ignored', { ignoreReasonValue: ignoreReason || 'other' })}
                        disabled={updating || !ignoreReason}
                        className="flex-1 px-3 py-2 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 disabled:opacity-50"
                      >
                        Confirm Dismiss
                      </button>
                      <button
                        onClick={() => { setShowIgnoreForm(false); setIgnoreReason(''); }}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {incident.status !== 'confirmed' && (
                      <button
                        onClick={() => updateStatus('confirmed')}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition flex items-center justify-center gap-1.5"
                        disabled={updating}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Confirm Case
                      </button>
                    )}
                    {incident.status !== 'ignored' && (
                      <button
                        onClick={() => setShowIgnoreForm(true)}
                        className="px-3 py-2 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
                        disabled={updating}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                    )}
                    {incident.status === 'ignored' && (
                      <button
                        onClick={() => updateStatus('pending')}
                        className="px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition flex items-center justify-center gap-1.5 col-span-2"
                        disabled={updating}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Restore for Review
                      </button>
                    )}
                    {!showNoteInput && (
                      <button
                        onClick={() => { setShowNoteInput(true); setNoteSaveMsg(''); }}
                        className="col-span-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Add Note
                      </button>
                    )}
                    {!showResponseForm && rider && (
                      <button
                        onClick={() => { setShowResponseForm(true); setSendMessageError(''); setSendMessageSuccess(''); }}
                        className="col-span-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Message the Rider
                      </button>
                    )}
                  </div>
                )}

                {showNoteInput && (
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-2">
                    <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">New Admin Note</p>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                      placeholder="What did you find or decide? This is visible in the case timeline."
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs resize-none focus:ring-2 focus:ring-blue-500"
                    />
                    {noteSaveMsg && (
                      <div className={`text-[11px] px-2 py-1 rounded flex items-center gap-1 ${
                        noteSaveMsg.includes('added') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {noteSaveMsg.includes('added') ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {noteSaveMsg}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddNote}
                        disabled={savingNote || !newNote.trim()}
                        className="flex-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {savingNote ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
                        ) : (
                          <><CheckCircle className="h-3 w-3" /> Save note</>
                        )}
                      </button>
                      <button
                        onClick={() => { setShowNoteInput(false); setNewNote(''); setNoteSaveMsg(''); }}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {incident.status === 'ignored' && incident.ignore_reason && (
                  <div className="p-2.5 rounded-lg bg-slate-100 text-xs text-slate-600">
                    <span className="font-semibold">Dismissed:</span>{' '}
                    {IGNORE_REASONS.find((r) => r.value === incident.ignore_reason)?.label || incident.ignore_reason}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 italic">Admin triage actions are locked while the case is closed by police.</p>
            )}
          </div>

          {!isCaseLocked && showResponseForm && rider && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">Official Response to Rider</p>
                <button onClick={() => setShowResponseForm(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">Visible to the rider in their account. Optionally deliver as SMS.</p>

              {incident.response_sent_at && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-700">Last sent:</span>{' '}
                  {new Date(incident.response_sent_at).toLocaleString()}
                  {incident.response_type && <span className="ml-1 capitalize">({incident.response_type})</span>}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Response type</label>
                <select
                  value={responseType}
                  onChange={(e) => setResponseType(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select type...</option>
                  <option value="warning">Warning</option>
                  <option value="summon">Summon to Station</option>
                  <option value="cleared">Cleared/No Action</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <textarea
                value={adminResponse}
                onChange={(e) => { setAdminResponse(e.target.value); setSendMessageSuccess(''); setSendMessageError(''); }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs resize-none focus:ring-2 focus:ring-amber-500"
                rows={4}
                placeholder="Official response message..."
              />

              <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${
                rider.phone_number ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  checked={sendAlsoAsSms}
                  onChange={(e) => setSendAlsoAsSms(e.target.checked)}
                  disabled={!rider.phone_number}
                  className="w-3.5 h-3.5 mt-0.5 text-amber-600 rounded border-slate-300"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-800">Also send as SMS</p>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    {rider.phone_number
                      ? `Deliver via SMS to ${rider.phone_number} alongside the in-app message.`
                      : 'Rider has no phone number on file — SMS unavailable.'}
                  </p>
                </div>
              </label>

              {sendMessageError && (
                <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700">{sendMessageError}</p>
                </div>
              )}
              {sendMessageSuccess && (
                <div className="flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-700">{sendMessageSuccess}</p>
                </div>
              )}

              <button
                onClick={handleSendMessageToRider}
                disabled={sendingMessage || !adminResponse.trim()}
                className="w-full px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {sendingMessage ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Send{sendAlsoAsSms ? ' (in-app + SMS)' : ' in-app'}</>
                )}
              </button>
            </div>
          )}

          {!isCaseLocked && !incident.claimed_by_manager_id && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <p className="text-sm font-bold text-slate-900">Nearest station auto-assign</p>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">
                Route by locality match (ward &rsaquo; constituency &rsaquo; county). A station manager then claims it.
              </p>

              {loadingNearest ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Finding nearest stations...
                </div>
              ) : nearestCandidates.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">No matching stations found in this locality.</p>
              ) : (
                <>
                  <ol className="space-y-1.5">
                    {nearestCandidates.slice(0, 3).map((c, idx) => (
                      <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                            <p className="text-xs font-semibold text-slate-900 truncate">{c.station_name}</p>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {c.county_name && <span>{c.county_name} County</span>}
                            {c.station_type && <span> · {c.station_type}</span>}
                            {c.distance_km != null && (
                              <span> · {c.distance_km < 1 ? '<1' : c.distance_km.toFixed(1)} km</span>
                            )}
                          </p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex-shrink-0 ${
                          c.match === 'ward' ? 'bg-emerald-100 text-emerald-700' :
                          c.match === 'constituency' ? 'bg-blue-100 text-blue-700' :
                          c.match === 'county' ? 'bg-slate-100 text-slate-600' :
                          c.match === 'text' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {c.match}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <button
                    onClick={handleAutoAssignNearest}
                    disabled={autoAssigning}
                    className="w-full px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {autoAssigning ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Auto-routing...</>
                    ) : (
                      <><Zap className="h-3.5 w-3.5" /> Auto-assign to nearest</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {!isCaseLocked && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <p className="text-sm font-bold text-slate-900">Assign to police station</p>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">Search by station name or county.</p>

              {stationAssignSuccess && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle className="h-3 w-3" />
                  {stationAssignSuccess}
                </div>
              )}

              {currentlyAssignedStation && !stationAssignSuccess && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[10px] text-blue-600 font-medium mb-0.5">Currently Assigned</p>
                  <p className="text-xs font-semibold text-blue-900">{currentlyAssignedStation.station_name}</p>
                  {currentlyAssignedStation.county_name && (
                    <p className="text-[10px] text-blue-700">{currentlyAssignedStation.county_name} County</p>
                  )}
                  {incident.claimed_by_manager_id && (
                    <div className="mt-1.5 p-1.5 rounded bg-white border border-blue-200 text-[10px] text-slate-700">
                      <span className="font-semibold text-slate-900">Claimed by station manager.</span> Only that manager can reassign this case.
                    </div>
                  )}
                </div>
              )}

              <div className="relative" ref={stationSearchRef}>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={stationSearchQuery}
                    onChange={(e) => handleStationSearchChange(e.target.value)}
                    onFocus={() => { if (stationSearchResults.length > 0) setShowStationDropdown(true); }}
                    className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                    placeholder="Type station or county name..."
                  />
                  {stationSearchQuery && (
                    <button
                      onClick={() => { setStationSearchQuery(''); setStationSearchResults([]); setSelectedStation(null); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {showStationDropdown && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {searchingStations ? (
                      <div className="p-3 text-center text-xs text-slate-500">Searching...</div>
                    ) : stationSearchResults.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        {stationSearchQuery.length < 2 ? 'Type at least 2 characters' : 'No stations found'}
                      </div>
                    ) : (
                      stationSearchResults.map((station) => (
                        <button
                          key={station.id}
                          onClick={() => selectStation(station)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <p className="text-xs font-medium text-slate-900">{station.station_name}</p>
                          <p className="text-[10px] text-slate-500">
                            {station.county_name && `${station.county_name} County`}
                            {station.station_type && ` - ${station.station_type}`}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleAssignStation}
                disabled={!selectedStation || assigningStation || !!incident.claimed_by_manager_id}
                className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigningStation
                  ? 'Assigning...'
                  : incident.claimed_by_manager_id
                  ? 'Locked (claimed by manager)'
                  : currentlyAssignedStation
                  ? 'Reassign station'
                  : 'Assign station'}
              </button>
            </div>
          )}

          {!isCaseLocked && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-sm font-bold text-slate-900 mb-1">Internal notes</p>
              <p className="text-[11px] text-slate-500 mb-2">Private admin memo (not shared with rider or police).</p>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 resize-none"
                rows={3}
                placeholder="Private admin memo..."
              />
            </div>
          )}

          <PreviousReports
            currentIncidentId={incident.id}
            reporterName={incident.reporter_name}
            reporterPhone={incident.reporter_phone}
            riderId={incident.rider_id}
            motorcycleId={incident.motorcycle_id}
          />
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[60]"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={selectedImage}
              alt="Evidence full view"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <EntityProfileDrawer entity={profileEntity} onClose={() => setProfileEntity(null)} />
    </div>
  );
}
