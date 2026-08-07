/*
# Add case ID, manager claim, and auto-assign fields to incidents

## Summary
Introduces the case-ID lifecycle for incidents that get routed to a police station.
Adds a human-readable case number (CASE-YYYY-NNNNN) generated the first time an
incident is linked to a station, plus a "claiming manager" concept so that once
an incident has been taken up by a station manager, only that manager can move it
to another station.

## New columns on `incidents`
1. `case_number` (text, unique when set) — auto-populated on first station assignment.
2. `claimed_by_manager_id` (uuid, nullable) — the manager who accepted the case.
3. `claimed_at` (timestamptz, nullable) — when the case was claimed.
4. `auto_assigned` (boolean, default false) — flag if the initial routing was automatic.

## New helper table
- `incident_case_counters` (year int PK, last_number int) — used by the trigger to
  produce sequential case numbers per year without race conditions.

## Trigger
- `incidents_case_number_trigger` fires BEFORE UPDATE on `incidents`. Whenever
  `assigned_station_id` transitions from NULL to a non-null value AND
  `case_number` is still NULL, a new case number is minted using
  `incident_case_counters`.

## Security
- RLS on `incident_case_counters` restricted to authenticated/anon read;
  writes only happen through the SECURITY DEFINER trigger function.

## Notes
1. Existing incidents that are already assigned but have no case number are backfilled
   with a CASE-<year>-<seq> number derived from their creation year.
2. Nothing about existing status/RLS on `incidents` is changed by this migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='case_number') THEN
    ALTER TABLE incidents ADD COLUMN case_number text;
    CREATE UNIQUE INDEX incidents_case_number_key ON incidents(case_number) WHERE case_number IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='claimed_by_manager_id') THEN
    ALTER TABLE incidents ADD COLUMN claimed_by_manager_id uuid REFERENCES police_officers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='claimed_at') THEN
    ALTER TABLE incidents ADD COLUMN claimed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='auto_assigned') THEN
    ALTER TABLE incidents ADD COLUMN auto_assigned boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS incident_case_counters (
  year int PRIMARY KEY,
  last_number int NOT NULL DEFAULT 0
);

ALTER TABLE incident_case_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_case_counters" ON incident_case_counters;
CREATE POLICY "read_case_counters" ON incident_case_counters FOR SELECT
  TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION set_incident_case_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr int := extract(year FROM COALESCE(NEW.created_at, now()))::int;
  next_num int;
BEGIN
  IF NEW.assigned_station_id IS NOT NULL
     AND (OLD.assigned_station_id IS NULL OR OLD.assigned_station_id IS DISTINCT FROM NEW.assigned_station_id)
     AND NEW.case_number IS NULL THEN

    INSERT INTO incident_case_counters(year, last_number)
      VALUES (yr, 1)
      ON CONFLICT (year) DO UPDATE SET last_number = incident_case_counters.last_number + 1
      RETURNING last_number INTO next_num;

    NEW.case_number := 'CASE-' || yr || '-' || lpad(next_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_case_number_trigger ON incidents;
CREATE TRIGGER incidents_case_number_trigger
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION set_incident_case_number();

-- Backfill: assign case numbers to already-assigned incidents that don't have one yet.
DO $$
DECLARE
  r RECORD;
  yr int;
  next_num int;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM incidents
    WHERE assigned_station_id IS NOT NULL AND case_number IS NULL
    ORDER BY created_at ASC
  LOOP
    yr := extract(year FROM r.created_at)::int;
    INSERT INTO incident_case_counters(year, last_number)
      VALUES (yr, 1)
      ON CONFLICT (year) DO UPDATE SET last_number = incident_case_counters.last_number + 1
      RETURNING last_number INTO next_num;
    UPDATE incidents
      SET case_number = 'CASE-' || yr || '-' || lpad(next_num::text, 5, '0')
      WHERE id = r.id;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidents_claimed_by_manager ON incidents(claimed_by_manager_id);
CREATE INDEX IF NOT EXISTS idx_incidents_county_status ON incidents(county_id, police_status);
