import { supabase } from './supabase';

export type NearestStationCandidate = {
  id: string;
  station_name: string;
  station_type: string | null;
  county_id: number | null;
  constituency_id: number | null;
  ward_id: number | null;
  county_name: string | null;
  distance_km: number | null;
  score: number;
  match: 'ward' | 'constituency' | 'county' | 'text' | 'fallback';
};

type IncidentLocation = {
  county_id: number | null;
  constituency_id: number | null;
  ward_id: number | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const R_KM = 6371;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

async function inferCountyFromText(text: string): Promise<{
  countyId: number | null;
  constituencyId: number | null;
  wardId: number | null;
} | null> {
  const clean = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  const [countiesRes, constituenciesRes, wardsRes] = await Promise.all([
    supabase.from('kenya_counties').select('id, county_name'),
    supabase.from('kenya_constituencies').select('id, constituency_name, county_id'),
    supabase.from('kenya_wards').select('id, ward_name, constituency_id'),
  ]);

  const wardMatch = (wardsRes.data ?? []).find((w: any) =>
    clean.includes(String(w.ward_name).toLowerCase())
  );
  if (wardMatch) {
    const constituency = (constituenciesRes.data ?? []).find(
      (c: any) => c.id === wardMatch.constituency_id
    );
    return {
      countyId: constituency?.county_id ?? null,
      constituencyId: wardMatch.constituency_id ?? null,
      wardId: wardMatch.id,
    };
  }

  const constMatch = (constituenciesRes.data ?? []).find((c: any) =>
    clean.includes(String(c.constituency_name).toLowerCase())
  );
  if (constMatch) {
    return {
      countyId: constMatch.county_id ?? null,
      constituencyId: constMatch.id,
      wardId: null,
    };
  }

  const countyMatch = (countiesRes.data ?? []).find((c: any) =>
    clean.includes(String(c.county_name).toLowerCase())
  );
  if (countyMatch) {
    return { countyId: countyMatch.id, constituencyId: null, wardId: null };
  }

  return null;
}

export async function findNearestStations(
  incident: IncidentLocation,
  limit = 5
): Promise<NearestStationCandidate[]> {
  let countyId = incident.county_id ?? null;
  let constituencyId = incident.constituency_id ?? null;
  let wardId = incident.ward_id ?? null;
  let matchedByText = false;

  if (!countyId && !constituencyId && !wardId && incident.location?.trim()) {
    const inferred = await inferCountyFromText(incident.location);
    if (inferred) {
      countyId = inferred.countyId;
      constituencyId = inferred.constituencyId;
      wardId = inferred.wardId;
      matchedByText = true;
    }
  }

  if (!countyId && !constituencyId && !wardId) {
    return [];
  }

  const filters: string[] = [];
  if (countyId) filters.push(`county_id.eq.${countyId}`);
  if (constituencyId) filters.push(`constituency_id.eq.${constituencyId}`);
  if (wardId) filters.push(`ward_id.eq.${wardId}`);

  const { data, error } = await supabase
    .from('police_stations')
    .select(
      'id, station_name, station_type, county_id, constituency_id, ward_id, gps_lat, gps_lng, county:kenya_counties(county_name, latitude, longitude)'
    )
    .eq('is_active', true)
    .or(filters.join(','))
    .limit(100);

  if (error || !data || data.length === 0) return [];

  let anchorLat: number | null = null;
  let anchorLng: number | null = null;

  if (typeof incident.latitude === 'number' && typeof incident.longitude === 'number') {
    anchorLat = incident.latitude;
    anchorLng = incident.longitude;
  } else if (countyId) {
    const stationWithCoords = data.find(
      (s: any) => s.county?.latitude != null && s.county?.longitude != null && s.county_id === countyId
    );
    if (stationWithCoords) {
      anchorLat = Number((stationWithCoords as any).county.latitude);
      anchorLng = Number((stationWithCoords as any).county.longitude);
    }
  }

  const scored: NearestStationCandidate[] = data.map((s: any) => {
    let score = 0;
    let match: NearestStationCandidate['match'] = matchedByText ? 'text' : 'fallback';

    if (wardId && s.ward_id === wardId) {
      score = 100;
      match = 'ward';
    } else if (constituencyId && s.constituency_id === constituencyId) {
      score = 60;
      match = 'constituency';
    } else if (countyId && s.county_id === countyId) {
      score = 30;
      match = matchedByText ? 'text' : 'county';
    }

    let distance_km: number | null = null;
    if (
      anchorLat != null &&
      anchorLng != null &&
      s.gps_lat != null &&
      s.gps_lng != null
    ) {
      distance_km = haversineKm(anchorLat, anchorLng, Number(s.gps_lat), Number(s.gps_lng));
      score += Math.max(0, 25 - Math.min(distance_km, 25));
    }

    return {
      id: s.id,
      station_name: s.station_name,
      station_type: s.station_type,
      county_id: s.county_id,
      constituency_id: s.constituency_id,
      ward_id: s.ward_id,
      county_name: s.county?.county_name || null,
      distance_km,
      score,
      match,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.distance_km ?? Number.POSITIVE_INFINITY;
    const db = b.distance_km ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.station_name.localeCompare(b.station_name);
  });

  return scored.slice(0, limit);
}
