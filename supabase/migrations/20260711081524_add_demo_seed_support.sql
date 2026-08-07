/*
  # Demo content infrastructure

  Adds a `demo_seed` boolean flag to every table that can hold generated demo
  data, plus a `demo_batches` audit table that records generation runs from the
  admin Demo Content manager. Every demo row inserted by the admin tool is
  stamped with `demo_seed = true` (and optionally a `demo_batch_id`) so the
  wipe operation can never touch real production rows.

  1. Columns added (boolean, default false)
    - owners.demo_seed
    - riders.demo_seed
    - motorcycles.demo_seed
    - fines.demo_seed
    - incidents.demo_seed
    - rider_notifications.demo_seed
    - incident_notifications.demo_seed
    - tracking_data.demo_seed
    - assignment_requests.demo_seed
    - rider_history.demo_seed
    - police_officers.demo_seed
    - Each column also gets a partial index `WHERE demo_seed` for fast wipes.

  2. New tables
    - `demo_batches`
      - id uuid pk
      - created_by text (admin username)
      - segments jsonb (map of segment -> requested count)
      - counts jsonb (map of segment -> rows actually created)
      - notes text
      - status text (running | completed | failed)
      - created_at, completed_at

  3. Security
    - RLS enabled on `demo_batches` with permissive policies matching the
      other admin-only tables in this project (custom auth managed at the
      application layer).
*/

ALTER TABLE owners ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE motorcycles ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE fines ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE rider_notifications ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE incident_notifications ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE tracking_data ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE assignment_requests ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE rider_history ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE police_officers ADD COLUMN IF NOT EXISTS demo_seed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_owners_demo_seed ON owners(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_riders_demo_seed ON riders(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_motorcycles_demo_seed ON motorcycles(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_fines_demo_seed ON fines(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_incidents_demo_seed ON incidents(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_rider_notifications_demo_seed ON rider_notifications(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_incident_notifications_demo_seed ON incident_notifications(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_tracking_data_demo_seed ON tracking_data(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_assignment_requests_demo_seed ON assignment_requests(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_rider_history_demo_seed ON rider_history(demo_seed) WHERE demo_seed;
CREATE INDEX IF NOT EXISTS idx_police_officers_demo_seed ON police_officers(demo_seed) WHERE demo_seed;

CREATE TABLE IF NOT EXISTS demo_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by text,
  segments jsonb NOT NULL DEFAULT '{}'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE demo_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_demo_batches" ON demo_batches;
CREATE POLICY "public_select_demo_batches" ON demo_batches
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_demo_batches" ON demo_batches;
CREATE POLICY "public_insert_demo_batches" ON demo_batches
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_demo_batches" ON demo_batches;
CREATE POLICY "public_update_demo_batches" ON demo_batches
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_demo_batches" ON demo_batches;
CREATE POLICY "public_delete_demo_batches" ON demo_batches
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_demo_batches_created_at ON demo_batches(created_at DESC);
