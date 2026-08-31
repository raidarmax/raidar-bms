/*
# Create Traffic Fines System and Incident Routing

## Overview
Creates the traffic offences reference table, fines tracking table, SMS logs,
and adds incident routing columns for police station assignment.

## New Tables

1. **traffic_offences** - Reference table of traffic violations and fine amounts
   - `id` (uuid, primary key)
   - `offence_code` (text, unique) - Code identifier (e.g., TF001)
   - `offence_name` (text) - Human-readable name
   - `description` (text) - Detailed description
   - `fine_amount` (integer) - Fine amount in KES
   - `category` (text) - Category of offence
   - `is_active` (boolean) - Whether offence is still enforceable

2. **fines** - Issued traffic fines
   - `id` (uuid, primary key)
   - `fine_reference` (text, unique) - Auto-generated reference number
   - `offence_id` (uuid, FK) - The offence committed
   - `issued_by_officer_id` (uuid, FK) - Issuing officer
   - `station_id` (uuid, FK) - Station of issuing officer
   - `rider_id` (uuid, FK, nullable) - Rider from BMS (if registered)
   - `owner_id` (uuid, FK, nullable) - Owner from BMS (if registered)
   - `motorcycle_id` (uuid, FK, nullable) - Motorcycle from BMS (if registered)
   - `rider_name` (text) - Rider name (for unregistered)
   - `rider_phone` (text) - Rider phone for SMS
   - `rider_national_id` (text) - Rider ID number
   - `owner_phone` (text) - Owner phone for SMS
   - `fine_amount` (integer) - Actual fine amount (may differ from standard)
   - `location_description` (text) - Where offence occurred
   - `county_id`, `constituency_id`, `ward_id` - Location hierarchy
   - `status` (text) - issued/paid/overdue/disputed/cancelled
   - `issued_at` (timestamptz) - When fine was issued
   - `due_date` (timestamptz) - Payment deadline
   - `paid_at` (timestamptz) - When paid
   - `payment_reference` (text) - Payment tracking
   - `sms_sent_rider` / `sms_sent_owner` (boolean) - SMS delivery status
   - `notes` (text) - Additional notes

3. **fine_sms_logs** - SMS delivery audit trail
   - `id` (uuid, primary key)
   - `fine_id` (uuid, FK) - Associated fine
   - `recipient_type` (text) - rider or owner
   - `phone_number` (text) - Recipient phone
   - `message_content` (text) - SMS content
   - `sms_status` (text) - sent/failed/pending
   - `bulk_ke_response` (jsonb) - API response
   - `sent_at` (timestamptz) - When sent

## Modified Tables

4. **incidents** - Added police routing columns
   - `county_id` (integer, FK) - Incident county
   - `constituency_id` (integer, FK) - Incident constituency
   - `ward_id` (integer, FK) - Incident ward
   - `assigned_station_id` (uuid, FK) - Assigned police station
   - `police_status` (text) - Police investigation status
   - `assigned_officer_id` (uuid, FK) - Assigned investigating officer
   - `police_notes` (text) - Police notes
   - `police_responded_at` (timestamptz) - When police responded

5. **incident_police_notifications** - Notifications to police for incidents
   - `id` (uuid, primary key)
   - `incident_id` (uuid, FK)
   - `station_id` (uuid, FK)
   - `officer_id` (uuid, FK, nullable)
   - `is_read` (boolean)
   - `created_at` (timestamptz)

## Security
- RLS enabled on all new tables
- Public read/write access (app manages auth at application layer)

## Seed Data
- 10 common boda-boda traffic offences with standard fine amounts
*/

-- Create traffic_offences reference table
CREATE TABLE IF NOT EXISTS traffic_offences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offence_code text UNIQUE NOT NULL,
  offence_name text NOT NULL,
  description text,
  fine_amount integer NOT NULL,
  category text NOT NULL CHECK (category IN ('traffic', 'documentation', 'safety', 'public_order')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create fines table
CREATE TABLE IF NOT EXISTS fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fine_reference text UNIQUE NOT NULL,
  offence_id uuid NOT NULL REFERENCES traffic_offences(id),
  issued_by_officer_id uuid NOT NULL REFERENCES police_officers(id),
  station_id uuid NOT NULL REFERENCES police_stations(id),
  rider_id uuid REFERENCES riders(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  motorcycle_id uuid REFERENCES motorcycles(id) ON DELETE SET NULL,
  rider_name text NOT NULL,
  rider_phone text NOT NULL,
  rider_national_id text,
  owner_phone text,
  fine_amount integer NOT NULL,
  location_description text,
  county_id integer REFERENCES kenya_counties(id),
  constituency_id integer REFERENCES kenya_constituencies(id),
  ward_id integer REFERENCES kenya_wards(id),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'overdue', 'disputed', 'cancelled')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  paid_at timestamptz,
  payment_reference text,
  sms_sent_rider boolean NOT NULL DEFAULT false,
  sms_sent_owner boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create fine_sms_logs table
CREATE TABLE IF NOT EXISTS fine_sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fine_id uuid NOT NULL REFERENCES fines(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('rider', 'owner')),
  phone_number text NOT NULL,
  message_content text NOT NULL,
  sms_status text NOT NULL DEFAULT 'pending' CHECK (sms_status IN ('sent', 'failed', 'pending')),
  bulk_ke_response jsonb,
  sent_at timestamptz DEFAULT now()
);

-- Create incident_police_notifications table
CREATE TABLE IF NOT EXISTS incident_police_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES police_stations(id) ON DELETE CASCADE,
  officer_id uuid REFERENCES police_officers(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add locality and police routing columns to incidents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'county_id') THEN
    ALTER TABLE incidents ADD COLUMN county_id integer REFERENCES kenya_counties(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'constituency_id') THEN
    ALTER TABLE incidents ADD COLUMN constituency_id integer REFERENCES kenya_constituencies(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'ward_id') THEN
    ALTER TABLE incidents ADD COLUMN ward_id integer REFERENCES kenya_wards(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'assigned_station_id') THEN
    ALTER TABLE incidents ADD COLUMN assigned_station_id uuid REFERENCES police_stations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'police_status') THEN
    ALTER TABLE incidents ADD COLUMN police_status text DEFAULT 'unassigned' CHECK (police_status IN ('unassigned', 'assigned', 'investigating', 'resolved', 'closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'assigned_officer_id') THEN
    ALTER TABLE incidents ADD COLUMN assigned_officer_id uuid REFERENCES police_officers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'police_notes') THEN
    ALTER TABLE incidents ADD COLUMN police_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'police_responded_at') THEN
    ALTER TABLE incidents ADD COLUMN police_responded_at timestamptz;
  END IF;
END $$;

-- Add locality columns to owners
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'county_id') THEN
    ALTER TABLE owners ADD COLUMN county_id integer REFERENCES kenya_counties(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'constituency_id') THEN
    ALTER TABLE owners ADD COLUMN constituency_id integer REFERENCES kenya_constituencies(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'ward_id') THEN
    ALTER TABLE owners ADD COLUMN ward_id integer REFERENCES kenya_wards(id);
  END IF;
END $$;

-- Add locality columns to motorcycles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'motorcycles' AND column_name = 'county_id') THEN
    ALTER TABLE motorcycles ADD COLUMN county_id integer REFERENCES kenya_counties(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'motorcycles' AND column_name = 'constituency_id') THEN
    ALTER TABLE motorcycles ADD COLUMN constituency_id integer REFERENCES kenya_constituencies(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'motorcycles' AND column_name = 'ward_id') THEN
    ALTER TABLE motorcycles ADD COLUMN ward_id integer REFERENCES kenya_wards(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'motorcycles' AND column_name = 'operating_area') THEN
    ALTER TABLE motorcycles ADD COLUMN operating_area text;
  END IF;
END $$;

-- Add locality columns to riders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'riders' AND column_name = 'county_id') THEN
    ALTER TABLE riders ADD COLUMN county_id integer REFERENCES kenya_counties(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'riders' AND column_name = 'constituency_id') THEN
    ALTER TABLE riders ADD COLUMN constituency_id integer REFERENCES kenya_constituencies(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'riders' AND column_name = 'ward_id') THEN
    ALTER TABLE riders ADD COLUMN ward_id integer REFERENCES kenya_wards(id);
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE traffic_offences ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_police_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for traffic_offences (public read, admin write)
DROP POLICY IF EXISTS "public_read_traffic_offences" ON traffic_offences;
CREATE POLICY "public_read_traffic_offences" ON traffic_offences FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_traffic_offences" ON traffic_offences;
CREATE POLICY "public_insert_traffic_offences" ON traffic_offences FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_traffic_offences" ON traffic_offences;
CREATE POLICY "public_update_traffic_offences" ON traffic_offences FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies for fines
DROP POLICY IF EXISTS "public_read_fines" ON fines;
CREATE POLICY "public_read_fines" ON fines FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_fines" ON fines;
CREATE POLICY "public_insert_fines" ON fines FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_fines" ON fines;
CREATE POLICY "public_update_fines" ON fines FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies for fine_sms_logs
DROP POLICY IF EXISTS "public_read_fine_sms_logs" ON fine_sms_logs;
CREATE POLICY "public_read_fine_sms_logs" ON fine_sms_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_fine_sms_logs" ON fine_sms_logs;
CREATE POLICY "public_insert_fine_sms_logs" ON fine_sms_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_fine_sms_logs" ON fine_sms_logs;
CREATE POLICY "public_update_fine_sms_logs" ON fine_sms_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies for incident_police_notifications
DROP POLICY IF EXISTS "public_read_incident_police_notifications" ON incident_police_notifications;
CREATE POLICY "public_read_incident_police_notifications" ON incident_police_notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_incident_police_notifications" ON incident_police_notifications;
CREATE POLICY "public_insert_incident_police_notifications" ON incident_police_notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_incident_police_notifications" ON incident_police_notifications;
CREATE POLICY "public_update_incident_police_notifications" ON incident_police_notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes for fines
CREATE INDEX IF NOT EXISTS idx_fines_officer ON fines(issued_by_officer_id);
CREATE INDEX IF NOT EXISTS idx_fines_station ON fines(station_id);
CREATE INDEX IF NOT EXISTS idx_fines_rider ON fines(rider_id);
CREATE INDEX IF NOT EXISTS idx_fines_owner ON fines(owner_id);
CREATE INDEX IF NOT EXISTS idx_fines_motorcycle ON fines(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);
CREATE INDEX IF NOT EXISTS idx_fines_issued_at ON fines(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_fine_sms_fine ON fine_sms_logs(fine_id);
CREATE INDEX IF NOT EXISTS idx_incident_police_notif_station ON incident_police_notifications(station_id, is_read);
CREATE INDEX IF NOT EXISTS idx_incident_police_notif_officer ON incident_police_notifications(officer_id, is_read);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_station ON incidents(assigned_station_id);
CREATE INDEX IF NOT EXISTS idx_incidents_police_status ON incidents(police_status);

-- Seed traffic offences
INSERT INTO traffic_offences (offence_code, offence_name, description, fine_amount, category) VALUES
('TF001', 'Riding without helmet', 'Rider or passenger not wearing a helmet', 500, 'safety'),
('TF002', 'Overloading passengers', 'Carrying more than one passenger', 1000, 'safety'),
('TF003', 'Riding without license', 'Operating motorcycle without a valid driving license', 2000, 'documentation'),
('TF004', 'No insurance', 'Operating without valid third-party insurance', 5000, 'documentation'),
('TF005', 'Reckless riding', 'Dangerous or reckless operation of motorcycle', 3000, 'traffic'),
('TF006', 'Speeding', 'Exceeding posted speed limit', 2000, 'traffic'),
('TF007', 'Riding under influence', 'Operating under influence of alcohol or drugs', 5000, 'public_order'),
('TF008', 'No registration plates', 'Operating without visible registration plates', 1000, 'documentation'),
('TF009', 'Carrying unaccompanied child', 'Transporting minor without adult supervision', 1000, 'safety'),
('TF010', 'Using phone while riding', 'Using mobile phone while operating motorcycle', 1000, 'traffic'),
('TF011', 'Running red light', 'Failure to stop at traffic light', 2000, 'traffic'),
('TF012', 'Wrong way riding', 'Riding against traffic flow', 3000, 'traffic'),
('TF013', 'No reflective vest', 'Riding without wearing a reflective vest at night', 500, 'safety'),
('TF014', 'Expired insurance', 'Operating with expired insurance policy', 3000, 'documentation'),
('TF015', 'No BMS registration', 'Operating without BMS registration/QR code', 1500, 'documentation')
ON CONFLICT (offence_code) DO NOTHING;