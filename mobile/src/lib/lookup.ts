import { supabase } from './supabase';

export type LookupResult =
  | { type: 'rider'; data: RiderLookup }
  | { type: 'motorcycle'; data: MotorcycleLookup }
  | { type: 'incident'; data: IncidentLookup }
  | { type: 'officer'; data: OfficerLookup }
  | { type: 'not_found'; identifier: string };

export type RiderLookup = {
  id: string;
  name: string;
  bms_id: string | null;
  id_number: string;
  phone_number: string | null;
  license_number: string | null;
  license_verified: boolean;
  license_expiry: string | null;
  photo_url: string | null;
  rating_score: number | null;
  rating_tier: string | null;
  total_fines_count: number | null;
  unpaid_fines_count: number | null;
  total_incident_count: number | null;
  motorcycle: MotorcycleLookup | null;
  compliance: ComplianceSnapshot;
};

export type MotorcycleLookup = {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  bike_photo_url: string | null;
  insurance_expiry: string | null;
  inspection_expiry: string | null;
  status: 'pending' | 'verified';
  is_compliant: boolean;
  owner: { id: string; full_name: string; phone_number: string } | null;
};

export type IncidentLookup = {
  id: string;
  incident_type: string;
  description: string | null;
  location_description: string | null;
  police_status: string;
  created_at: string;
};

export type OfficerLookup = {
  id: string;
  service_number: string;
  full_name: string;
  rank: string;
  station: string | null;
};

export type ComplianceSnapshot = {
  license_valid: boolean;
  insurance_valid: boolean;
  inspection_valid: boolean;
  bike_verified: boolean;
  outstanding_fines: number;
};

const isFuture = (iso?: string | null) => !!iso && new Date(iso).getTime() > Date.now();

export async function lookupBmsId(bmsId: string): Promise<LookupResult> {
  const { data: rider } = await supabase
    .from('riders')
    .select(
      'id, name, bms_id, id_number, phone_number, license_number, license_verified, license_expiry, photo_url, rating_score, rating_tier, total_fines_count, unpaid_fines_count, total_incident_count, motorcycle_id',
    )
    .eq('bms_id', bmsId)
    .maybeSingle();

  if (!rider) return { type: 'not_found', identifier: bmsId };

  const motorcycle = rider.motorcycle_id ? await fetchMotorcycle(rider.motorcycle_id) : null;
  const compliance = deriveCompliance(rider, motorcycle);

  return {
    type: 'rider',
    data: { ...rider, motorcycle, compliance } as RiderLookup,
  };
}

export async function lookupRegistration(plate: string): Promise<LookupResult> {
  const cleaned = plate.replace(/\s+/g, '').toUpperCase();
  const { data } = await supabase
    .from('motorcycles')
    .select(
      'id, registration_number, make, model, bike_photo_url, insurance_expiry, inspection_expiry, status, is_compliant, owner_id',
    )
    .ilike('registration_number', cleaned)
    .maybeSingle();

  if (!data) return { type: 'not_found', identifier: plate };

  const owner = await fetchOwner(data.owner_id);
  return { type: 'motorcycle', data: { ...data, owner } };
}

export async function lookupIncident(reference: string): Promise<LookupResult> {
  const { data } = await supabase
    .from('incidents')
    .select('id, incident_type, description, location_description, police_status, created_at')
    .or(`case_number.eq.${reference},id.eq.${reference}`)
    .maybeSingle();

  if (!data) return { type: 'not_found', identifier: reference };
  return { type: 'incident', data };
}

async function fetchMotorcycle(id: string): Promise<MotorcycleLookup | null> {
  const { data } = await supabase
    .from('motorcycles')
    .select(
      'id, registration_number, make, model, bike_photo_url, insurance_expiry, inspection_expiry, status, is_compliant, owner_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const owner = await fetchOwner(data.owner_id);
  return { ...data, owner };
}

async function fetchOwner(id: string) {
  const { data } = await supabase
    .from('owners')
    .select('id, full_name, phone_number')
    .eq('id', id)
    .maybeSingle();
  return data ?? null;
}

function deriveCompliance(
  rider: {
    license_verified: boolean;
    license_expiry: string | null;
    unpaid_fines_count: number | null;
  },
  motorcycle: MotorcycleLookup | null,
): ComplianceSnapshot {
  return {
    license_valid: rider.license_verified && isFuture(rider.license_expiry),
    insurance_valid: !!motorcycle && isFuture(motorcycle.insurance_expiry),
    inspection_valid: !!motorcycle && isFuture(motorcycle.inspection_expiry),
    bike_verified: !!motorcycle && motorcycle.status === 'verified' && motorcycle.is_compliant,
    outstanding_fines: rider.unpaid_fines_count ?? 0,
  };
}
