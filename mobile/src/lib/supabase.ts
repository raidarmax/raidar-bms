import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = (extra as { supabaseUrl?: string }).supabaseUrl;
const supabaseAnonKey = (extra as { supabaseAnonKey?: string }).supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Set supabaseUrl / supabaseAnonKey in mobile/app.json > expo.extra.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
};

export type Fine = {
  id: string;
  fine_reference: string;
  rider_name: string;
  rider_phone: string;
  fine_amount: number;
  status: 'issued' | 'paid' | 'overdue' | 'disputed' | 'cancelled';
  issued_at: string;
  due_date: string;
};

export type Incident = {
  id: string;
  incident_type: string;
  description: string | null;
  location_description: string | null;
  police_status: string;
  created_at: string;
  motorcycle_id: string | null;
  rider_id: string | null;
};
