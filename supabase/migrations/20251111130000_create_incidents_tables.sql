/*
  # Create Incidents System Tables

  ## Tables Created
  1. **incidents** - Main incident reports table
     - `id` (uuid, primary key)
     - `motorcycle_id` (uuid, nullable FK to motorcycles)
     - `rider_id` (uuid, nullable FK to riders)
     - `owner_id` (uuid, nullable FK to owners)
     - `incident_type` (text, required)
     - `description` (text, required)
     - `incident_date` (timestamptz, required)
     - `location` (text, nullable)
     - `status` (text, default 'pending')
     - `reporter_name` (text, required)
     - `reporter_phone` (text, required)
     - `reporter_email` (text, nullable)
     - `unregistered_details` (text, nullable)
     - `admin_notes` (text, nullable)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **incident_evidence** - Evidence files for incidents
     - `id` (uuid, primary key)
     - `incident_id` (uuid, FK to incidents)
     - `file_url` (text, required)
     - `file_type` (text, default 'photo')
     - `uploaded_by` (text, required)
     - `created_at` (timestamptz)

  3. **incident_appeals** - Rider appeals against incidents
     - `id` (uuid, primary key)
     - `incident_id` (uuid, FK to incidents)
     - `rider_id` (uuid, FK to riders)
     - `appeal_text` (text, required)
     - `appeal_status` (text, default 'pending')
     - `admin_response` (text, nullable)
     - `reviewed_at` (timestamptz, nullable)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  4. **appeal_evidence** - Evidence files for appeals
     - `id` (uuid, primary key)
     - `appeal_id` (uuid, FK to incident_appeals)
     - `file_url` (text, required)
     - `file_type` (text, default 'photo')
     - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public can insert and view incidents (for anonymous reporting)
  - Authenticated users have full access
  - Riders can submit appeals for their incidents
*/

-- Create incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid REFERENCES motorcycles(id) ON DELETE SET NULL,
  rider_id uuid REFERENCES riders(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  incident_type text NOT NULL,
  description text NOT NULL,
  incident_date timestamptz NOT NULL,
  location text,
  status text DEFAULT 'pending' NOT NULL,
  reporter_name text NOT NULL,
  reporter_phone text NOT NULL,
  reporter_email text,
  unregistered_details text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create incident_evidence table
CREATE TABLE IF NOT EXISTS incident_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text DEFAULT 'photo' NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create incident_appeals table
CREATE TABLE IF NOT EXISTS incident_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  appeal_text text NOT NULL,
  appeal_status text DEFAULT 'pending' NOT NULL,
  admin_response text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create appeal_evidence table
CREATE TABLE IF NOT EXISTS appeal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appeal_id uuid NOT NULL REFERENCES incident_appeals(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text DEFAULT 'photo' NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeal_evidence ENABLE ROW LEVEL SECURITY;

-- Policies for incidents table
CREATE POLICY "Anyone can insert incidents"
  ON incidents FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view incidents"
  ON incidents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can update incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete incidents"
  ON incidents FOR DELETE
  TO authenticated
  USING (true);

-- Policies for incident_evidence table
CREATE POLICY "Anyone can upload incident evidence"
  ON incident_evidence FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view incident evidence"
  ON incident_evidence FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can delete incident evidence"
  ON incident_evidence FOR DELETE
  TO authenticated
  USING (true);

-- Policies for incident_appeals table
CREATE POLICY "Riders can insert appeals"
  ON incident_appeals FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view appeals"
  ON incident_appeals FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can update appeals"
  ON incident_appeals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete appeals"
  ON incident_appeals FOR DELETE
  TO authenticated
  USING (true);

-- Policies for appeal_evidence table
CREATE POLICY "Anyone can upload appeal evidence"
  ON appeal_evidence FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view appeal evidence"
  ON appeal_evidence FOR SELECT
  TO anon
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_incidents_motorcycle ON incidents(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_incidents_rider ON incidents(rider_id);
CREATE INDEX IF NOT EXISTS idx_incidents_owner ON incidents(owner_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_incident_evidence_incident ON incident_evidence(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_appeals_incident ON incident_appeals(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_appeals_rider ON incident_appeals(rider_id);
CREATE INDEX IF NOT EXISTS idx_appeal_evidence_appeal ON appeal_evidence(appeal_id);
