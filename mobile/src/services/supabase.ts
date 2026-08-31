import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://aydvtcllqozxvowjtpxd.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5ZHZ0Y2xscW96eHZvd2p0cHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0ODg1MTksImV4cCI6MjA3ODA2NDUxOX0.ogtHmjP8-n8nRqCPOLLYgVl0QJyathPHwNrclS-Gn28';

let _supabase: SupabaseClient | null = null;

/**
 * Returns the real SupabaseClient singleton. Safe to call at any point after
 * polyfills have loaded (which happens before any screen mounts).
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const { createClient } = require('@supabase/supabase-js');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase!;
}

export type PoliceStation = {
  id: string;
  station_name: string;
  station_code: string;
  county_id: number;
  is_active: boolean;
};

export type PoliceOfficer = {
  id: string;
  service_number: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  rank: string;
  badge_number: string | null;
  password_hash: string;
  station_id: string;
  is_station_admin: boolean;
  is_active: boolean;
  id_verified: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  profile_photo_url: string | null;
};

export type PoliceOfficerWithStation = PoliceOfficer & { station: PoliceStation };

export type Rider = {
  id: string;
  name: string;
  id_number: string;
  bms_id: string | null;
  license_number: string | null;
  license_verified: boolean;
  license_expiry: string | null;
  phone_number: string | null;
  photo_url: string | null;
  motorcycle_id: string | null;
  rating_score: number | null;
  rating_tier: string | null;
  total_fines_count: number | null;
  unpaid_fines_count: number | null;
  total_incident_count: number | null;
};

export type Motorcycle = {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  bike_photo_url: string | null;
  insurance_expiry: string | null;
  insurance_provider: string | null;
  inspection_expiry: string | null;
  status: 'pending' | 'verified';
  is_compliant: boolean;
  owner_id: string;
};

export type Owner = {
  id: string;
  full_name: string;
  phone_number: string;
  national_id: string;
  profile_photo_url: string | null;
  id_verified: boolean | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
};

export type Fine = {
  id: string;
  fine_reference: string;
  offence_id: string | null;
  rider_name: string;
  rider_phone: string;
  rider_id: string | null;
  rider_national_id: string | null;
  owner_id: string | null;
  motorcycle_id: string | null;
  fine_amount: number;
  status: 'issued' | 'paid' | 'overdue' | 'disputed' | 'cancelled';
  issued_at: string;
  due_date: string;
  paid_at: string | null;
  location_description: string | null;
  issued_by_officer_id: string | null;
  station_id: string | null;
  notes: string | null;
  incident_id: string | null;
  origin: string | null;
  last_reminder_sent_at: string | null;
  reminder_count: number | null;
  offence?: TrafficOffence | null;
};

export type TrafficOffence = {
  id: string;
  offence_code: string;
  offence_name: string;
  description: string;
  fine_amount: number;
  category: string;
  is_active: boolean;
};

export type Incident = {
  id: string;
  case_number: string | null;
  incident_type: string;
  description: string | null;
  location: string | null;
  police_status: string;
  status: string | null;
  created_at: string;
  incident_date: string | null;
  motorcycle_id: string | null;
  rider_id: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  reporter_email: string | null;
  assigned_officer_id: string | null;
  assigned_station_id: string | null;
  police_notes: string | null;
  police_responded_at: string | null;
  resolution_outcome: string | null;
  resolution_summary: string | null;
  resolved_at: string | null;
  admin_response: string | null;
  response_type: string | null;
  response_sent_at: string | null;
  auto_assigned: boolean | null;
  claimed_by_manager_id: string | null;
  reopened_count: number | null;
  unregistered_bike_details: string | null;
};

export type IncidentEvidence = {
  id: string;
  incident_id: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_by_role: string;
  description: string | null;
  created_at: string;
};

export type IncidentNote = {
  id: string;
  incident_id: string;
  officer_id: string;
  officer_name: string | null;
  note_text: string;
  created_at: string;
};

export type Summon = {
  id: string;
  incident_id: string;
  issued_by_officer_id: string;
  station_id: string | null;
  person_type: 'rider' | 'owner' | 'reporter' | 'other';
  person_id: string | null;
  person_name: string;
  person_phone: string | null;
  person_id_number: string | null;
  summon_date: string;
  summon_time: string | null;
  reason: string | null;
  notes: string | null;
  status: 'pending' | 'served' | 'attended' | 'no_show' | 'cancelled';
  created_at: string;
};

export type PersonOfInterest = {
  id: string;
  incident_id: string;
  full_name: string;
  phone_number: string | null;
  id_number: string | null;
  relationship: string;
  notes: string | null;
  linked_rider_id: string | null;
  linked_owner_id: string | null;
  added_by_officer_id: string | null;
  created_at: string;
};

export type IncidentResolutionEntry = {
  id: string;
  incident_id: string;
  action_type: string;
  actor_type: string | null;
  actor_id: string | null;
  actor_name: string | null;
  notes: string | null;
  metadata: any;
  created_at: string;
};

export type IncidentMessage = {
  id: string;
  incident_id: string;
  from_officer_id: string | null;
  from_officer_name: string | null;
  recipient_type: string;
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  subject: string | null;
  body: string;
  channel: string;
  sms_sent: boolean;
  created_at: string;
};
