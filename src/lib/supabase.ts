import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Owner = {
  id: string;
  full_name: string;
  phone_number: string;
  national_id: string;
  kra_pin: string | null;
  kra_pin_verified: boolean;
  id_verified: boolean;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string | null;
  otp_verified: boolean;
  payment_status: 'pending' | 'completed';
  payment_id: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Motorcycle = {
  id: string;
  owner_id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  bike_photo_url: string | null;
  logbook_url: string | null;
  tracking_device_id: string | null;
  kra_pin_url: string | null;
  insurance_policy_number: string | null;
  insurance_cover_url: string | null;
  insurance_provider: string | null;
  insurance_expiry: string | null;
  inspection_certificate_url: string | null;
  inspection_certificate_number: string | null;
  inspection_expiry: string | null;
  status: 'pending' | 'verified';
  is_compliant: boolean;
  verified_at: string | null;
  verified_by: string | null;
  pending_incident_count?: number | null;
  confirmed_incident_count?: number | null;
  total_incident_count?: number | null;
  created_at: string;
  updated_at: string;
};

export type Rider = {
  id: string;
  owner_id: string;
  name: string;
  id_number: string;
  id_verified: boolean;
  id_copy_url: string | null;
  kra_pin: string | null;
  kra_pin_verified: boolean;
  license_number: string | null;
  license_verified: boolean;
  license_class: string | null;
  license_url: string | null;
  license_expiry: string | null;
  national_registration_number: string | null;
  county_registration_number: string | null;
  phone_number: string | null;
  motorcycle_id: string | null;
  assignment_status: string;
  bms_id: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  sacco_id: string | null;
  good_conduct_url: string | null;
  stage_name: string | null;
  photo_url: string | null;
  payment_status: 'pending' | 'completed';
  payment_id: string | null;
  pending_incident_count?: number | null;
  confirmed_incident_count?: number | null;
  total_incident_count?: number | null;
  total_fines_count?: number | null;
  unpaid_fines_count?: number | null;
  rating_score?: number | null;
  rating_tier?: string | null;
  rating_updated_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Verification = {
  id: string;
  owner_id: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  qr_code_data: string;
  created_at: string;
  updated_at: string;
};

export type RegistrationData = {
  owner: Owner;
  motorcycle: Motorcycle;
  rider: Rider;
  verification: Verification;
};

export type RiderHistory = {
  id: string;
  motorcycle_id: string;
  rider_id: string;
  owner_id: string;
  rider_name: string;
  rider_id_number: string;
  assigned_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  id: string;
  role_name: string;
  display_name: string;
  description: string | null;
  can_view_all: boolean;
  can_edit_all: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_manage_users: boolean;
  can_view_audit_logs: boolean;
  can_export_data: boolean;
  can_manage_police: boolean;
  created_at: string;
  updated_at: string;
};

export type SystemUser = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role_id: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  phone_number: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type SystemUserWithRole = SystemUser & {
  role: UserRole;
};

export type UserGroup = {
  id: string;
  group_name: string;
  description: string | null;
  default_role_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UserGroupMember = {
  id: string;
  user_id: string;
  group_id: string;
  added_at: string;
  added_by: string | null;
};

export type UserActivityLog = {
  id: string;
  user_id: string;
  action_type: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'view' | 'export';
  module: 'owners' | 'motorcycles' | 'riders' | 'verifications' | 'users' | 'groups' | 'settings' | 'system';
  record_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type Incident = {
  id: string;
  motorcycle_id: string | null;
  rider_id: string | null;
  owner_id: string | null;
  incident_type: string;
  description: string;
  incident_date: string;
  location: string | null;
  status: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_email: string | null;
  unregistered_bike_details: string | null;
  unregistered_details: string | null;
  admin_notes: string | null;
  admin_response: string | null;
  response_type: string | null;
  response_sent_at: string | null;
  rider_response: string | null;
  rider_response_submitted_at: string | null;
  county_id: number | null;
  constituency_id: number | null;
  ward_id: number | null;
  assigned_station_id: string | null;
  assigned_officer_id: string | null;
  police_status: string | null;
  police_notes: string | null;
  police_responded_at: string | null;
  resolution_outcome: string | null;
  resolution_summary: string | null;
  resolved_by_officer_id: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
  ignore_reason: string | null;
  case_number: string | null;
  claimed_by_manager_id: string | null;
  claimed_at: string | null;
  auto_assigned: boolean;
  created_at: string;
  updated_at: string;
};

export type IncidentResolution = {
  id: string;
  incident_id: string;
  action_type: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

export type IncidentEvidence = {
  id: string;
  incident_id: string;
  evidence_url: string;
  evidence_type: string;
  uploaded_by: string;
  description: string | null;
  created_at: string;
};

export type IncidentAppeal = {
  id: string;
  incident_id: string;
  rider_id: string;
  appeal_text: string;
  appeal_status: string;
  admin_response: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppealEvidence = {
  id: string;
  appeal_id: string;
  file_url: string;
  file_type: string;
  created_at: string;
};

export type IncidentNotification = {
  id: string;
  incident_id: string;
  user_type: 'rider' | 'owner';
  user_id: string;
  is_read: boolean;
  created_at: string;
};

export type Payment = {
  id: string;
  user_type: 'owner' | 'rider';
  user_id: string;
  amount: number;
  payment_method: 'mpesa' | 'salamapay' | 'ecitizen';
  payment_status: 'pending' | 'completed' | 'failed';
  transaction_reference: string;
  phone_number: string;
  payment_year: number;
  created_at: string;
  completed_at: string | null;
  metadata: any;
};

export type RevenueSummary = {
  total_transactions: number;
  total_revenue: number;
  completed_payments: number;
  pending_payments: number;
  failed_payments: number;
  mpesa_transactions: number;
  salamapay_transactions: number;
  mpesa_revenue: number;
  salamapay_revenue: number;
};

// Kenya Locality Types
export type KenyaCounty = {
  id: number;
  county_code: number;
  county_name: string;
};

export type KenyaConstituency = {
  id: number;
  constituency_name: string;
  county_id: number;
};

export type KenyaWard = {
  id: number;
  ward_name: string;
  constituency_id: number;
};

// Police Module Types
export type PoliceStation = {
  id: string;
  station_name: string;
  station_code: string;
  station_type: 'station' | 'post';
  ward_id: number | null;
  constituency_id: number | null;
  county_id: number;
  physical_address: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  phone_number: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PoliceOfficer = {
  id: string;
  service_number: string;
  national_id: string;
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
  registered_by: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PoliceOfficerWithStation = PoliceOfficer & {
  station: PoliceStation;
};

export type PoliceActivityLog = {
  id: string;
  officer_id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
};

export type PoliceVerificationLog = {
  id: string;
  officer_id: string;
  station_id: string;
  verification_type: string;
  document_value: string;
  subject_type: string | null;
  subject_id: string | null;
  verification_result: string;
  result_details: any;
  created_at: string;
};

export type TrafficOffence = {
  id: string;
  offence_code: string;
  offence_name: string;
  description: string | null;
  fine_amount: number;
  category: 'traffic' | 'documentation' | 'safety' | 'public_order';
  is_active: boolean;
  applicable_incident_types: string[];
  is_finable_default: boolean;
  created_at: string;
};

export type Fine = {
  id: string;
  fine_reference: string;
  offence_id: string;
  issued_by_officer_id: string;
  station_id: string;
  rider_id: string | null;
  owner_id: string | null;
  motorcycle_id: string | null;
  rider_name: string;
  rider_phone: string;
  rider_national_id: string | null;
  owner_phone: string | null;
  fine_amount: number;
  location_description: string | null;
  county_id: number | null;
  constituency_id: number | null;
  ward_id: number | null;
  status: 'issued' | 'paid' | 'overdue' | 'disputed' | 'cancelled';
  issued_at: string;
  due_date: string;
  paid_at: string | null;
  payment_reference: string | null;
  sms_sent_rider: boolean;
  sms_sent_owner: boolean;
  notes: string | null;
  incident_id: string | null;
  origin: 'standalone' | 'from_incident';
  created_at: string;
  updated_at: string;
};

export type FineWithDetails = Fine & {
  offence?: TrafficOffence;
  officer?: PoliceOfficer;
  station?: PoliceStation;
  rider?: Rider;
  owner?: Owner;
  motorcycle?: Motorcycle;
};

export type FineSmsLog = {
  id: string;
  fine_id: string;
  recipient_type: 'rider' | 'owner';
  phone_number: string;
  message_content: string;
  sms_status: 'sent' | 'failed' | 'pending';
  bulk_ke_response: any;
  sent_at: string;
};

export type IncidentPoliceNotification = {
  id: string;
  incident_id: string;
  station_id: string;
  officer_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type IncidentSummons = {
  id: string;
  incident_id: string;
  issued_by_officer_id: string | null;
  station_id: string;
  person_type: 'rider' | 'owner' | 'reporter' | 'other';
  person_id: string | null;
  person_name: string;
  person_phone: string;
  person_id_number: string | null;
  summon_date: string;
  summon_time: string | null;
  reason: string;
  status: 'pending' | 'attended' | 'no_show' | 'cancelled';
  sms_sent: boolean;
  sms_sent_at: string | null;
  sms_response: any;
  notes: string | null;
  attended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IncidentPersonOfInterest = {
  id: string;
  incident_id: string;
  full_name: string;
  phone_number: string | null;
  id_number: string | null;
  relationship: string | null;
  notes: string | null;
  linked_rider_id: string | null;
  linked_owner_id: string | null;
  added_by_officer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IncidentNoteReply = {
  id: string;
  parent_resolution_id: string;
  incident_id: string;
  officer_id: string | null;
  officer_name: string | null;
  body: string;
  created_at: string;
};

export type IncidentMessage = {
  id: string;
  incident_id: string;
  from_officer_id: string | null;
  from_officer_name: string | null;
  recipient_type: 'rider' | 'owner' | 'reporter' | 'officer' | 'senior_officer' | 'other';
  recipient_id: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  subject: string | null;
  body: string;
  channel: 'in_app' | 'sms' | 'both';
  sms_sent: boolean;
  read_at: string | null;
  created_at: string;
};
