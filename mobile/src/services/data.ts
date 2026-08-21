import { getSupabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import type {
  Fine,
  Incident,
  IncidentEvidence,
  IncidentNote,
  Motorcycle,
  Owner,
  PoliceOfficer,
  PoliceStation,
  Rider,
  Summon,
  TrafficOffence,
} from './supabase';

export type FetchStamp = {
  fetchedAt: number;
  rowCount: number;
  filter?: string;
  errorMessage?: string;
};

export type IncidentBundle = {
  incident: Incident;
  rider: Rider | null;
  motorcycle: Motorcycle | null;
  owner: Owner | null;
  assignedOfficer: PoliceOfficer | null;
  assignedStation: PoliceStation | null;
  notes: IncidentNote[];
  evidence: IncidentEvidence[];
  fines: Fine[];
  summons: Summon[];
  poisCount: number;
  riderRating: { score: number | null; tier: string | null; totalIncidents: number | null } | null;
  stamp: FetchStamp;
};

export type FineBundle = {
  fine: Fine & { offence?: TrafficOffence | null };
  motorcycle: Motorcycle | null;
  rider: Rider | null;
  owner: Owner | null;
  issuingOfficer: PoliceOfficer | null;
  station: PoliceStation | null;
  stamp: FetchStamp;
};

export type RiderBundle = {
  rider: Rider;
  motorcycle: Motorcycle | null;
  totalIncidents: number;
  unpaidFinesCount: number;
  unpaidFinesTotal: number;
  stamp: FetchStamp;
};

export type BikeBundle = {
  motorcycle: Motorcycle;
  owner: Owner | null;
  assignedRider: Rider | null;
  totalIncidents: number;
  unpaidFinesCount: number;
  unpaidFinesTotal: number;
  stamp: FetchStamp;
};

export type OfficerBundle = {
  officer: PoliceOfficer;
  station: PoliceStation | null;
  finesIssuedCount: number;
  incidentsAssignedCount: number;
  stamp: FetchStamp;
};

export type StationBundle = {
  station: PoliceStation;
  officersCount: number;
  incidentsCount: number;
  finesCount: number;
  stamp: FetchStamp;
};

function stamp(rowCount: number, filter?: string, errorMessage?: string): FetchStamp {
  return { fetchedAt: Date.now(), rowCount, filter, errorMessage };
}

async function firstOrNull<T>(promise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T | null> {
  try {
    const res = await promise;
    const rows = res?.data ?? [];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

async function manyOrEmpty<T>(promise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try {
    const res = await promise;
    const rows = res?.data ?? [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function countOrZero(
  promise: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const res = await promise;
    return typeof res?.count === 'number' ? res.count : 0;
  } catch {
    return 0;
  }
}

export async function loadIncidentBundle(incidentId: string): Promise<IncidentBundle | null> {
  const supabase = getSupabase();

  console.log('[loadIncidentBundle] requesting id =', incidentId, 'length =', incidentId.length);

  const { data: incidentRows, error: incidentErr } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', incidentId)
    .limit(1);

  if (incidentErr) {
    console.error('[loadIncidentBundle] postgrest error', incidentErr);
    throw new Error(
      `Incident fetch failed: ${(incidentErr as any).message || (incidentErr as any).code || 'unknown'}`,
    );
  }
  const incident = ((incidentRows as any[]) || [])[0] as Incident | undefined;
  if (!incident) {
    console.warn('[loadIncidentBundle] no row for id', incidentId);
    return null;
  }

  console.log('[loadIncidentBundle] loaded incident id =', incident.id, 'case =', incident.case_number);

  const [rider, motorcycle, assignedOfficer, assignedStation, notes, evidence, fines, summons, poisCount] =
    await Promise.all([
      incident.rider_id
        ? firstOrNull<Rider>(
            supabase
              .from('riders')
              .select('*')
              .eq('id', incident.rider_id)
              .limit(1),
          )
        : Promise.resolve(null),
      incident.motorcycle_id
        ? firstOrNull<Motorcycle>(
            supabase
              .from('motorcycles')
              .select('*')
              .eq('id', incident.motorcycle_id)
              .limit(1),
          )
        : Promise.resolve(null),
      incident.assigned_officer_id
        ? firstOrNull<PoliceOfficer>(
            supabase
              .from('police_officers')
              .select('*')
              .eq('id', incident.assigned_officer_id)
              .limit(1),
          )
        : Promise.resolve(null),
      incident.assigned_station_id
        ? firstOrNull<PoliceStation>(
            supabase
              .from('police_stations')
              .select('*')
              .eq('id', incident.assigned_station_id)
              .limit(1),
          )
        : Promise.resolve(null),
      manyOrEmpty<any>(
        supabase
          .from('incident_note_replies')
          .select('*')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false }),
      ),
      manyOrEmpty<IncidentEvidence>(
        supabase
          .from('incident_evidence')
          .select('*')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false }),
      ),
      manyOrEmpty<Fine>(
        supabase
          .from('fines')
          .select('*')
          .eq('incident_id', incidentId)
          .order('issued_at', { ascending: false }),
      ),
      manyOrEmpty<Summon>(
        supabase
          .from('incident_summons')
          .select('*')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false }),
      ),
      countOrZero(
        supabase
          .from('incident_persons_of_interest')
          .select('id', { count: 'exact', head: true })
          .eq('incident_id', incidentId),
      ),
    ]);

  const owner = motorcycle?.owner_id
    ? await firstOrNull<Owner>(
        supabase
          .from('owners')
          .select('*')
          .eq('id', motorcycle.owner_id)
          .limit(1),
      )
    : null;

  const mappedNotes: IncidentNote[] = notes.map((n: any) => ({
    id: n.id,
    incident_id: n.incident_id,
    officer_id: n.officer_id,
    officer_name: n.officer_name ?? null,
    note_text: n.body ?? n.note_text ?? '',
    created_at: n.created_at,
  }));

  return {
    incident,
    rider,
    motorcycle,
    owner,
    assignedOfficer,
    assignedStation,
    notes: mappedNotes,
    evidence,
    fines,
    summons,
    poisCount,
    riderRating: rider
      ? {
          score: rider.rating_score ?? null,
          tier: rider.rating_tier ?? null,
          totalIncidents: rider.total_incident_count ?? null,
        }
      : null,
    stamp: stamp(1, `incident:${incidentId.slice(0, 8)}`),
  };
}

export async function loadFineBundle(fineId: string): Promise<FineBundle | null> {
  const supabase = getSupabase();

  console.log('[loadFineBundle] requesting id =', fineId, 'length =', fineId.length);

  // Fetch the fine WITHOUT the embedded relationship so we can isolate the failure
  // if the join breaks. Offence is fetched separately below.
  const { data: fineRows, error: fineErr } = await supabase
    .from('fines')
    .select('*')
    .eq('id', fineId)
    .limit(1);

  if (fineErr) {
    console.error('[loadFineBundle] postgrest error', fineErr);
    throw new Error(
      `Fine fetch failed: ${(fineErr as any).message || (fineErr as any).code || 'unknown'}`,
    );
  }
  const fine = ((fineRows as any[]) || [])[0] as Fine | undefined;
  if (!fine) {
    console.warn('[loadFineBundle] no row for id', fineId);
    return null;
  }

  console.log('[loadFineBundle] loaded fine id =', fine.id, 'ref =', fine.fine_reference);

  const [offence, motorcycle, rider, issuingOfficer, station] = await Promise.all([
    fine.offence_id
      ? firstOrNull<TrafficOffence>(
          supabase
            .from('traffic_offences')
            .select('*')
            .eq('id', fine.offence_id)
            .limit(1),
        )
      : Promise.resolve(null),
    fine.motorcycle_id
      ? firstOrNull<Motorcycle>(
          supabase.from('motorcycles').select('*').eq('id', fine.motorcycle_id).limit(1),
        )
      : Promise.resolve(null),
    fine.rider_id
      ? firstOrNull<Rider>(supabase.from('riders').select('*').eq('id', fine.rider_id).limit(1))
      : Promise.resolve(null),
    fine.issued_by_officer_id
      ? firstOrNull<PoliceOfficer>(
          supabase
            .from('police_officers')
            .select('*')
            .eq('id', fine.issued_by_officer_id)
            .limit(1),
        )
      : Promise.resolve(null),
    fine.station_id
      ? firstOrNull<PoliceStation>(
          supabase
            .from('police_stations')
            .select('*')
            .eq('id', fine.station_id)
            .limit(1),
        )
      : Promise.resolve(null),
  ]);

  const fineWithOffence = { ...fine, offence } as Fine & { offence: TrafficOffence | null };

  const owner = motorcycle?.owner_id
    ? await firstOrNull<Owner>(
        supabase.from('owners').select('*').eq('id', motorcycle.owner_id).limit(1),
      )
    : null;

  return {
    fine: fineWithOffence,
    motorcycle,
    rider,
    owner,
    issuingOfficer,
    station,
    stamp: stamp(1, `fine:${fineId.slice(0, 8)}`),
  };
}

export async function loadRiderBundle(riderId: string): Promise<RiderBundle | null> {
  const supabase = getSupabase();
  const rows = await manyOrEmpty<Rider>(
    supabase.from('riders').select('*').eq('id', riderId).limit(1),
  );
  const rider = rows[0];
  if (!rider) return null;

  const [motorcycle, totalIncidents, unpaidFines] = await Promise.all([
    rider.motorcycle_id
      ? firstOrNull<Motorcycle>(
          supabase.from('motorcycles').select('*').eq('id', rider.motorcycle_id).limit(1),
        )
      : Promise.resolve(null),
    countOrZero(
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('rider_id', rider.id),
    ),
    manyOrEmpty<{ fine_amount: number; status: string }>(
      supabase.from('fines').select('fine_amount, status').eq('rider_id', rider.id).neq('status', 'paid'),
    ),
  ]);

  const unpaidTotal = unpaidFines.reduce((sum, f) => sum + (Number(f.fine_amount) || 0), 0);

  return {
    rider,
    motorcycle,
    totalIncidents,
    unpaidFinesCount: unpaidFines.length,
    unpaidFinesTotal: unpaidTotal,
    stamp: stamp(1, `rider:${riderId.slice(0, 8)}`),
  };
}

export async function loadBikeBundle(bikeId: string): Promise<BikeBundle | null> {
  const supabase = getSupabase();
  const rows = await manyOrEmpty<Motorcycle>(
    supabase.from('motorcycles').select('*').eq('id', bikeId).limit(1),
  );
  const motorcycle = rows[0];
  if (!motorcycle) return null;

  const [owner, assignedRider, totalIncidents, unpaidFines] = await Promise.all([
    motorcycle.owner_id
      ? firstOrNull<Owner>(
          supabase.from('owners').select('*').eq('id', motorcycle.owner_id).limit(1),
        )
      : Promise.resolve(null),
    firstOrNull<Rider>(
      supabase.from('riders').select('*').eq('motorcycle_id', motorcycle.id).limit(1),
    ),
    countOrZero(
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('motorcycle_id', motorcycle.id),
    ),
    manyOrEmpty<{ fine_amount: number }>(
      supabase
        .from('fines')
        .select('fine_amount')
        .eq('motorcycle_id', motorcycle.id)
        .neq('status', 'paid'),
    ),
  ]);

  return {
    motorcycle,
    owner,
    assignedRider,
    totalIncidents,
    unpaidFinesCount: unpaidFines.length,
    unpaidFinesTotal: unpaidFines.reduce((sum, f) => sum + (Number(f.fine_amount) || 0), 0),
    stamp: stamp(1, `bike:${bikeId.slice(0, 8)}`),
  };
}

export async function loadOfficerBundle(officerId: string): Promise<OfficerBundle | null> {
  const supabase = getSupabase();
  const rows = await manyOrEmpty<PoliceOfficer>(
    supabase.from('police_officers').select('*').eq('id', officerId).limit(1),
  );
  const officer = rows[0];
  if (!officer) return null;

  const [station, finesIssued, incidentsAssigned] = await Promise.all([
    officer.station_id
      ? firstOrNull<PoliceStation>(
          supabase
            .from('police_stations')
            .select('*')
            .eq('id', officer.station_id)
            .limit(1),
        )
      : Promise.resolve(null),
    countOrZero(
      supabase
        .from('fines')
        .select('id', { count: 'exact', head: true })
        .eq('issued_by_officer_id', officer.id),
    ),
    countOrZero(
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_officer_id', officer.id),
    ),
  ]);

  return {
    officer,
    station,
    finesIssuedCount: finesIssued,
    incidentsAssignedCount: incidentsAssigned,
    stamp: stamp(1, `officer:${officerId.slice(0, 8)}`),
  };
}

export async function loadStationBundle(stationId: string): Promise<StationBundle | null> {
  const supabase = getSupabase();
  const rows = await manyOrEmpty<PoliceStation>(
    supabase.from('police_stations').select('*').eq('id', stationId).limit(1),
  );
  const station = rows[0];
  if (!station) return null;

  const [officersCount, incidentsCount, finesCount] = await Promise.all([
    countOrZero(
      supabase
        .from('police_officers')
        .select('id', { count: 'exact', head: true })
        .eq('station_id', station.id),
    ),
    countOrZero(
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_station_id', station.id),
    ),
    countOrZero(
      supabase.from('fines').select('id', { count: 'exact', head: true }).eq('station_id', station.id),
    ),
  ]);

  return {
    station,
    officersCount,
    incidentsCount,
    finesCount,
    stamp: stamp(1, `station:${stationId.slice(0, 8)}`),
  };
}

export type FinesFilter = 'all' | 'issued' | 'overdue' | 'paid' | 'cancelled' | 'disputed';

export async function loadFinesForStation(
  stationId: string,
  filter: FinesFilter = 'all',
): Promise<{ fines: (Fine & { offence?: TrafficOffence | null })[]; stamp: FetchStamp }> {
  const supabase = getSupabase();
  let query = supabase
    .from('fines')
    .select('*, offence:traffic_offences(*)')
    .eq('station_id', stationId)
    .order('issued_at', { ascending: false });
  if (filter !== 'all') query = query.eq('status', filter);
  const rows = await manyOrEmpty<Fine & { offence?: TrafficOffence | null }>(query as any);
  return { fines: rows, stamp: stamp(rows.length, `station:${stationId.slice(0, 8)} · ${filter}`) };
}

export async function searchRiders(term: string): Promise<{ rows: Rider[]; stamp: FetchStamp }> {
  const supabase = getSupabase();
  const q = term.trim();
  if (!q) return { rows: [], stamp: stamp(0, 'empty') };
  const safe = q.replace(/([*,()])/g, '');
  const rows = await manyOrEmpty<Rider>(
    supabase
      .from('riders')
      .select('*')
      .or(`name.ilike.*${safe}*,bms_id.ilike.*${safe}*,id_number.ilike.*${safe}*,phone_number.ilike.*${safe}*`)
      .limit(30),
  );
  return { rows, stamp: stamp(rows.length, `rider:${safe}`) };
}

export async function searchBikes(term: string): Promise<{ rows: Motorcycle[]; stamp: FetchStamp }> {
  const supabase = getSupabase();
  const q = term.trim();
  if (!q) return { rows: [], stamp: stamp(0, 'empty') };
  const safe = q.replace(/([*,()])/g, '');
  const rows = await manyOrEmpty<Motorcycle>(
    supabase
      .from('motorcycles')
      .select('*')
      .or(`registration_number.ilike.*${safe}*,make.ilike.*${safe}*,model.ilike.*${safe}*`)
      .limit(30),
  );
  return { rows, stamp: stamp(rows.length, `bike:${safe}`) };
}

export async function searchOfficers(term: string): Promise<{ rows: PoliceOfficer[]; stamp: FetchStamp }> {
  const supabase = getSupabase();
  const q = term.trim();
  if (!q) return { rows: [], stamp: stamp(0, 'empty') };
  const safe = q.replace(/([*,()])/g, '');
  const rows = await manyOrEmpty<PoliceOfficer>(
    supabase
      .from('police_officers')
      .select('*')
      .or(`full_name.ilike.*${safe}*,service_number.ilike.*${safe}*,badge_number.ilike.*${safe}*`)
      .limit(30),
  );
  return { rows, stamp: stamp(rows.length, `officer:${safe}`) };
}

export async function searchStations(term: string): Promise<{ rows: PoliceStation[]; stamp: FetchStamp }> {
  const supabase = getSupabase();
  const q = term.trim();
  if (!q) return { rows: [], stamp: stamp(0, 'empty') };
  const safe = q.replace(/([*,()])/g, '');
  const rows = await manyOrEmpty<PoliceStation>(
    supabase
      .from('police_stations')
      .select('*')
      .or(`station_name.ilike.*${safe}*,station_code.ilike.*${safe}*`)
      .limit(30),
  );
  return { rows, stamp: stamp(rows.length, `station:${safe}`) };
}

// ==== INCIDENT ACTIONS ====

async function logResolution(
  incidentId: string,
  actionType: string,
  actor: { id: string; name: string; type?: string },
  extras: { notes?: string | null; metadata?: any } = {},
) {
  const supabase = getSupabase();
  const { error } = await supabase.from('incident_resolutions').insert({
    incident_id: incidentId,
    action_type: actionType,
    actor_type: actor.type || 'officer',
    actor_id: actor.id,
    actor_name: actor.name,
    notes: extras.notes ?? null,
    metadata: extras.metadata ?? {},
  });
  if (error) console.warn('[logResolution]', actionType, error);
}

export async function fetchIncidentTimeline(incidentId: string) {
  const supabase = getSupabase();
  return manyOrEmpty<any>(
    supabase
      .from('incident_resolutions')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchPersonsOfInterest(incidentId: string) {
  const supabase = getSupabase();
  return manyOrEmpty<any>(
    supabase
      .from('incident_persons_of_interest')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchSummons(incidentId: string) {
  const supabase = getSupabase();
  return manyOrEmpty<any>(
    supabase
      .from('incident_summons')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchStationOfficers(stationId: string) {
  const supabase = getSupabase();
  return manyOrEmpty<any>(
    supabase
      .from('police_officers')
      .select('*')
      .eq('station_id', stationId)
      .order('full_name', { ascending: true }),
  );
}

export async function claimIncidentAsOfficer(
  incidentId: string,
  officer: { id: string; full_name: string },
) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('incidents')
    .update({
      assigned_officer_id: officer.id,
      police_status: 'investigating',
      police_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', incidentId);
  if (error) throw error;
  await logResolution(incidentId, 'assigned', { id: officer.id, name: officer.full_name }, {
    notes: 'Case claimed / self-assigned',
    metadata: { self_assigned: true },
  });
}

export async function claimIncidentAsManager(
  incidentId: string,
  officer: { id: string; full_name: string; station_id: string | null },
  moveToMyStation: boolean,
) {
  const supabase = getSupabase();
  const patch: any = {
    claimed_by_manager_id: officer.id,
    claimed_at: new Date().toISOString(),
    police_status: 'assigned',
    updated_at: new Date().toISOString(),
  };
  if (moveToMyStation && officer.station_id) patch.assigned_station_id = officer.station_id;
  const { error } = await supabase.from('incidents').update(patch).eq('id', incidentId);
  if (error) throw error;
  await logResolution(incidentId, 'claimed_by_manager', { id: officer.id, name: officer.full_name }, {
    notes: 'Case claimed by station manager',
    metadata: { moved_station: moveToMyStation },
  });
}

export async function assignOfficerToIncident(
  incidentId: string,
  target: { id: string; full_name: string },
  actor: { id: string; full_name: string },
) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('incidents')
    .update({
      assigned_officer_id: target.id,
      police_status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', incidentId);
  if (error) throw error;
  await logResolution(incidentId, 'assigned', { id: actor.id, name: actor.full_name }, {
    notes: `Assigned to ${target.full_name}`,
    metadata: { officer_id: target.id },
  });
}

export async function addIncidentNote(
  incidentId: string,
  actor: { id: string; full_name: string },
  noteText: string,
) {
  const trimmed = noteText.trim();
  if (!trimmed) throw new Error('Note cannot be empty');
  await logResolution(
    incidentId,
    'note_added',
    { id: actor.id, name: actor.full_name },
    { notes: trimmed },
  );
}

export async function addPersonOfInterest(
  incidentId: string,
  actor: { id: string; full_name: string },
  data: {
    full_name: string;
    phone_number?: string | null;
    id_number?: string | null;
    relationship: string;
    notes?: string | null;
  },
) {
  const supabase = getSupabase();
  let linked_rider_id: string | null = null;
  let linked_owner_id: string | null = null;

  if (data.id_number) {
    const rider = await firstOrNull<any>(
      supabase.from('riders').select('id').eq('id_number', data.id_number).limit(1),
    );
    if (rider) linked_rider_id = rider.id;
    const owner = await firstOrNull<any>(
      supabase.from('owners').select('id').eq('national_id', data.id_number).limit(1),
    );
    if (owner) linked_owner_id = owner.id;
  }
  if (!linked_rider_id && data.phone_number) {
    const rider = await firstOrNull<any>(
      supabase.from('riders').select('id').eq('phone_number', data.phone_number).limit(1),
    );
    if (rider) linked_rider_id = rider.id;
  }
  if (!linked_owner_id && data.phone_number) {
    const owner = await firstOrNull<any>(
      supabase.from('owners').select('id').eq('phone_number', data.phone_number).limit(1),
    );
    if (owner) linked_owner_id = owner.id;
  }

  const { data: inserted, error } = await supabase
    .from('incident_persons_of_interest')
    .insert({
      incident_id: incidentId,
      full_name: data.full_name.trim(),
      phone_number: data.phone_number?.trim() || null,
      id_number: data.id_number?.trim() || null,
      relationship: data.relationship,
      notes: data.notes?.trim() || null,
      linked_rider_id,
      linked_owner_id,
      added_by_officer_id: actor.id,
    })
    .select()
    .maybeSingle();
  if (error) throw error;

  await logResolution(incidentId, 'person_of_interest_added', { id: actor.id, name: actor.full_name }, {
    notes: `Added ${data.relationship}: ${data.full_name}`,
    metadata: { poi_id: inserted?.id, relationship: data.relationship },
  });
  return inserted;
}

export async function removePersonOfInterest(
  incidentId: string,
  poiId: string,
  actor: { id: string; full_name: string },
) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('incident_persons_of_interest')
    .delete()
    .eq('id', poiId);
  if (error) throw error;
  await logResolution(incidentId, 'person_of_interest_removed', { id: actor.id, name: actor.full_name }, {
    notes: 'Removed person of interest',
    metadata: { poi_id: poiId },
  });
}

export async function issueSummon(
  incidentId: string,
  actor: { id: string; full_name: string; station_id: string | null },
  data: {
    person_type: 'rider' | 'owner' | 'reporter' | 'other';
    person_id?: string | null;
    person_name: string;
    person_phone?: string | null;
    person_id_number?: string | null;
    summon_date: string;
    summon_time?: string | null;
    reason: string;
    notes?: string | null;
    station_name?: string;
    station_phone?: string;
    case_number?: string | null;
    send_sms?: boolean;
  },
) {
  const supabase = getSupabase();
  const { data: inserted, error } = await supabase
    .from('incident_summons')
    .insert({
      incident_id: incidentId,
      issued_by_officer_id: actor.id,
      station_id: actor.station_id,
      person_type: data.person_type,
      person_id: data.person_id || null,
      person_name: data.person_name.trim(),
      person_phone: data.person_phone?.trim() || null,
      person_id_number: data.person_id_number?.trim() || null,
      summon_date: data.summon_date,
      summon_time: data.summon_time || null,
      reason: data.reason.trim(),
      notes: data.notes?.trim() || null,
      status: 'pending',
    })
    .select()
    .maybeSingle();
  if (error) throw error;

  if (data.send_sms && data.person_phone && inserted?.id) {
    try {
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnv();
      await fetch(`${SUPABASE_URL}/functions/v1/send-summons-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          summons_id: inserted.id,
          person_phone: data.person_phone,
          person_name: data.person_name,
          station_name: data.station_name || '',
          station_phone: data.station_phone || '',
          summon_date: data.summon_date,
          summon_time: data.summon_time || '',
          reason: data.reason,
          case_number: data.case_number || '',
        }),
      });
    } catch (smsErr) {
      console.warn('[issueSummon] SMS send failed', smsErr);
    }
  }

  await logResolution(incidentId, 'summons_issued', { id: actor.id, name: actor.full_name }, {
    notes: `Summoned ${data.person_name} on ${data.summon_date}`,
    metadata: { summons_id: inserted?.id, person_type: data.person_type },
  });
  return inserted;
}

export async function resolveIncident(
  incidentId: string,
  actor: { id: string; full_name: string },
  data: { outcome: string; summary: string },
) {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('incidents')
    .update({
      status: 'resolved',
      police_status: 'resolved',
      resolution_outcome: data.outcome,
      resolution_summary: data.summary.trim(),
      resolved_by_officer_id: actor.id,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', incidentId);
  if (error) throw error;
  await logResolution(incidentId, 'resolved', { id: actor.id, name: actor.full_name }, {
    notes: data.summary,
    metadata: { outcome: data.outcome },
  });
}

export async function closeIncident(
  incidentId: string,
  actor: { id: string; full_name: string },
  closingNotes?: string,
) {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const patch: any = {
    police_status: 'closed',
    closed_at: now,
    updated_at: now,
  };
  if (closingNotes?.trim()) patch.police_notes = closingNotes.trim();
  const { error } = await supabase.from('incidents').update(patch).eq('id', incidentId);
  if (error) throw error;
  await logResolution(incidentId, 'closed', { id: actor.id, name: actor.full_name }, {
    notes: closingNotes || 'Case closed',
  });
}

export async function sendFineReminder(fine: {
  id: string;
  fine_reference: string;
  rider_phone: string;
  rider_name: string;
  fine_amount: number;
  reminder_count?: number | null;
  offence?: { offence_name?: string } | null;
  station?: { station_name?: string } | null;
  officer?: { service_number?: string } | null;
}) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnv();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-fine-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      fine_id: fine.id,
      fine_reference: fine.fine_reference,
      rider_phone: fine.rider_phone,
      rider_name: fine.rider_name,
      offence_name: fine.offence?.offence_name || 'traffic offence',
      fine_amount: fine.fine_amount,
      station_name: fine.station?.station_name || '',
      officer_service_number: fine.officer?.service_number || '',
      reminder: true,
      current_reminder_count: fine.reminder_count || 0,
    }),
  });
  if (!res.ok) throw new Error(`Reminder SMS failed (${res.status})`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Reminder SMS failed');
  return json;
}

function getEnv() {
  return { SUPABASE_URL, SUPABASE_ANON_KEY };
}

export function formatFetchedAgo(fetchedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
