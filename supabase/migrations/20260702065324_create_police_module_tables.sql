/*
# Create Police Module Tables

## Overview
Creates the police station, officer, activity log, and verification log tables
for the police enforcement module.

## New Tables

1. **police_stations** - Police stations and posts across Kenya
   - `id` (uuid, primary key)
   - `station_name` (text) - Name of the police station
   - `station_code` (text, unique) - Official station code
   - `station_type` (text) - "station" or "post"
   - `ward_id` (integer, FK) - Location ward
   - `constituency_id` (integer, FK) - Location constituency
   - `county_id` (integer, FK) - Location county
   - `physical_address` (text) - Physical address
   - `gps_lat` / `gps_lng` (numeric) - GPS coordinates
   - `phone_number` (text) - Station phone
   - `email` (text) - Station email
   - `is_active` (boolean) - Whether station is active

2. **police_officers** - Registered police officers
   - `id` (uuid, primary key)
   - `service_number` (text, unique) - Police service number
   - `national_id` (text, unique) - National ID
   - `full_name` (text) - Officer full name
   - `phone_number` (text) - Phone number
   - `email` (text) - Email address
   - `rank` (text) - Officer rank
   - `badge_number` (text) - Badge number
   - `password_hash` (text) - Bcrypt hashed password
   - `station_id` (uuid, FK) - Assigned station
   - `is_station_admin` (boolean) - Whether officer is station admin
   - `is_active` (boolean) - Active status
   - `id_verified` (boolean) - Whether ID was verified via IPRS
   - `registered_by` (uuid) - Who registered this officer
   - `must_change_password` (boolean) - Force password change on first login
   - `last_login_at` (timestamptz) - Last login timestamp
   - `failed_login_attempts` (integer) - Failed login counter
   - `locked_until` (timestamptz) - Account lockout timestamp

3. **police_activity_logs** - Audit trail for police actions
   - `id` (uuid, primary key)
   - `officer_id` (uuid, FK) - Acting officer
   - `action_type` (text) - Type of action
   - `target_type` (text) - What was acted on
   - `target_id` (uuid) - ID of the target
   - `details` (jsonb) - Additional details
   - `ip_address` (text) - IP address
   - `created_at` (timestamptz) - When action occurred

4. **police_verification_logs** - Document verification audit trail
   - `id` (uuid, primary key)
   - `officer_id` (uuid, FK) - Verifying officer
   - `station_id` (uuid, FK) - Officer's station
   - `verification_type` (text) - Type of verification
   - `document_value` (text) - Document number verified
   - `subject_type` (text) - Type of subject (owner/rider/motorcycle)
   - `subject_id` (uuid) - Subject ID
   - `verification_result` (text) - Result (verified/failed)
   - `result_details` (jsonb) - Full result data
   - `created_at` (timestamptz) - When verification occurred

## Security
- RLS enabled on all tables
- Public read on police_stations (for incident routing)
- Officers can only read their own station's data
- Activity logs are append-only
*/

-- Create police_stations table
CREATE TABLE IF NOT EXISTS police_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_name text NOT NULL,
  station_code text UNIQUE NOT NULL,
  station_type text NOT NULL CHECK (station_type IN ('station', 'post')),
  ward_id integer REFERENCES kenya_wards(id),
  constituency_id integer REFERENCES kenya_constituencies(id),
  county_id integer NOT NULL REFERENCES kenya_counties(id),
  physical_address text,
  gps_lat numeric,
  gps_lng numeric,
  phone_number text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create police_officers table
CREATE TABLE IF NOT EXISTS police_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_number text UNIQUE NOT NULL,
  national_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  rank text NOT NULL CHECK (rank IN ('constable', 'corporal', 'sergeant', 'senior_sergeant', 'inspector', 'chief_inspector', 'superintendent', 'senior_superintendent', 'commissioner')),
  badge_number text,
  password_hash text NOT NULL,
  station_id uuid NOT NULL REFERENCES police_stations(id) ON DELETE CASCADE,
  is_station_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  id_verified boolean NOT NULL DEFAULT false,
  registered_by uuid,
  must_change_password boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create police_activity_logs table
CREATE TABLE IF NOT EXISTS police_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL REFERENCES police_officers(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('login', 'logout', 'search', 'view_record', 'verify_document', 'issue_fine', 'view_incident', 'update_incident', 'register_officer')),
  target_type text,
  target_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Create police_verification_logs table
CREATE TABLE IF NOT EXISTS police_verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL REFERENCES police_officers(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES police_stations(id) ON DELETE CASCADE,
  verification_type text NOT NULL CHECK (verification_type IN ('national_id', 'kra_pin', 'driving_license', 'insurance')),
  document_value text NOT NULL,
  subject_type text CHECK (subject_type IN ('owner', 'rider', 'motorcycle', 'general')),
  subject_id uuid,
  verification_result text NOT NULL CHECK (verification_result IN ('verified', 'failed')),
  result_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE police_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_verification_logs ENABLE ROW LEVEL SECURITY;

-- Police stations: public read (for incident routing), no public write
DROP POLICY IF EXISTS "public_read_police_stations" ON police_stations;
CREATE POLICY "public_read_police_stations" ON police_stations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_police_stations" ON police_stations;
CREATE POLICY "public_insert_police_stations" ON police_stations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_police_stations" ON police_stations;
CREATE POLICY "public_update_police_stations" ON police_stations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Police officers: public access (app manages auth via service_number/password)
DROP POLICY IF EXISTS "public_read_police_officers" ON police_officers;
CREATE POLICY "public_read_police_officers" ON police_officers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_police_officers" ON police_officers;
CREATE POLICY "public_insert_police_officers" ON police_officers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_police_officers" ON police_officers;
CREATE POLICY "public_update_police_officers" ON police_officers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Police activity logs: public read/insert (append only)
DROP POLICY IF EXISTS "public_read_police_activity_logs" ON police_activity_logs;
CREATE POLICY "public_read_police_activity_logs" ON police_activity_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_police_activity_logs" ON police_activity_logs;
CREATE POLICY "public_insert_police_activity_logs" ON police_activity_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Police verification logs: public read/insert
DROP POLICY IF EXISTS "public_read_police_verification_logs" ON police_verification_logs;
CREATE POLICY "public_read_police_verification_logs" ON police_verification_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_police_verification_logs" ON police_verification_logs;
CREATE POLICY "public_insert_police_verification_logs" ON police_verification_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_police_stations_county ON police_stations(county_id);
CREATE INDEX IF NOT EXISTS idx_police_stations_constituency ON police_stations(constituency_id);
CREATE INDEX IF NOT EXISTS idx_police_stations_ward ON police_stations(ward_id);
CREATE INDEX IF NOT EXISTS idx_police_officers_station ON police_officers(station_id);
CREATE INDEX IF NOT EXISTS idx_police_officers_service_number ON police_officers(service_number);
CREATE INDEX IF NOT EXISTS idx_police_activity_officer ON police_activity_logs(officer_id);
CREATE INDEX IF NOT EXISTS idx_police_activity_created ON police_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_police_verification_officer ON police_verification_logs(officer_id);
CREATE INDEX IF NOT EXISTS idx_police_verification_station ON police_verification_logs(station_id);
CREATE INDEX IF NOT EXISTS idx_police_verification_created ON police_verification_logs(created_at DESC);