/*
# Persons of Interest on Incidents

Adds `incident_persons_of_interest` so officers can capture additional people mentioned during a case (e.g. a rider claims someone else had the bike, or a witness comes forward). When the person's national ID matches an existing rider or owner in the system, the record is linked so their account is visible in the case.

1. New Tables
   - `incident_persons_of_interest`
     - `id` (uuid, primary key)
     - `incident_id` (uuid, FK -> incidents, cascade on delete)
     - `full_name` (text, required)
     - `phone_number` (text, nullable)
     - `id_number` (text, nullable) — national ID
     - `relationship` (text, nullable) — e.g. actual_rider, witness, suspect, passenger
     - `notes` (text, nullable)
     - `linked_rider_id` (uuid, FK -> riders, nullable, set null on delete)
     - `linked_owner_id` (uuid, FK -> owners, nullable, set null on delete)
     - `added_by_officer_id` (uuid, FK -> police_officers, nullable, set null on delete)
     - `created_at`, `updated_at` (timestamptz)

2. Security
   - RLS enabled with anon+authenticated CRUD (matches existing incident child tables — police uses custom password hash auth via the anon key).

3. Indexes
   - By incident_id, linked_rider_id, id_number.
*/

CREATE TABLE IF NOT EXISTS incident_persons_of_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_number text,
  id_number text,
  relationship text,
  notes text,
  linked_rider_id uuid REFERENCES riders(id) ON DELETE SET NULL,
  linked_owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  added_by_officer_id uuid REFERENCES police_officers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_incident ON incident_persons_of_interest(incident_id);
CREATE INDEX IF NOT EXISTS idx_poi_linked_rider ON incident_persons_of_interest(linked_rider_id);
CREATE INDEX IF NOT EXISTS idx_poi_id_number ON incident_persons_of_interest(id_number);

ALTER TABLE incident_persons_of_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poi_select" ON incident_persons_of_interest;
CREATE POLICY "poi_select" ON incident_persons_of_interest FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "poi_insert" ON incident_persons_of_interest;
CREATE POLICY "poi_insert" ON incident_persons_of_interest FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "poi_update" ON incident_persons_of_interest;
CREATE POLICY "poi_update" ON incident_persons_of_interest FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "poi_delete" ON incident_persons_of_interest;
CREATE POLICY "poi_delete" ON incident_persons_of_interest FOR DELETE
  TO anon, authenticated USING (true);
