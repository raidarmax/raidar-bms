/*
# Incident Summons

Introduces the ability for police officers to summon a person of interest
(rider, owner, reporter, or a third party) to appear at a specific police
station for an unresolved incident, with optional SMS notification.

## New Tables

### `incident_summons`
Stores one row per summons issued for an incident.

- `id` (uuid, PK) - summons identifier.
- `incident_id` (uuid, FK -> incidents) - the incident being summoned about.
- `issued_by_officer_id` (uuid, FK -> police_officers) - officer who issued it.
- `station_id` (uuid, FK -> police_stations) - station the person must appear at.
- `person_type` (text) - 'rider' | 'owner' | 'reporter' | 'other'.
- `person_id` (uuid, nullable) - optional link to a rider/owner record.
- `person_name` (text) - name of person being summoned.
- `person_phone` (text) - phone number for SMS delivery.
- `person_id_number` (text, nullable) - national id if available.
- `summon_date` (date) - date they must appear.
- `summon_time` (time, nullable) - time of appearance.
- `reason` (text) - reason for summons (shown in SMS).
- `status` (text) - 'pending' | 'attended' | 'no_show' | 'cancelled'.
- `sms_sent` (bool) - whether an SMS was successfully delivered.
- `sms_sent_at` (timestamptz, nullable) - when the SMS was sent.
- `sms_response` (jsonb, nullable) - raw response from the SMS provider.
- `notes` (text, nullable) - free-form officer notes on the summons.
- `attended_at` (timestamptz, nullable) - when person actually attended.
- `created_at`, `updated_at` (timestamptz).

## Security

1. Enable RLS on `incident_summons`.
2. Grant CRUD to `anon, authenticated` matching the pattern used by
   `incidents`, `fines`, and `incident_evidence` in this project (the police
   module uses custom password-hash auth and talks to Supabase via anon key).
*/

CREATE TABLE IF NOT EXISTS incident_summons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  issued_by_officer_id uuid REFERENCES police_officers(id) ON DELETE SET NULL,
  station_id uuid NOT NULL REFERENCES police_stations(id),
  person_type text NOT NULL DEFAULT 'other',
  person_id uuid,
  person_name text NOT NULL,
  person_phone text NOT NULL,
  person_id_number text,
  summon_date date NOT NULL,
  summon_time time,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sms_sent boolean NOT NULL DEFAULT false,
  sms_sent_at timestamptz,
  sms_response jsonb,
  notes text,
  attended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_summons_incident_id ON incident_summons(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_summons_station_id ON incident_summons(station_id);
CREATE INDEX IF NOT EXISTS idx_incident_summons_status ON incident_summons(status);

ALTER TABLE incident_summons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_incident_summons" ON incident_summons;
CREATE POLICY "select_incident_summons" ON incident_summons FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_incident_summons" ON incident_summons;
CREATE POLICY "insert_incident_summons" ON incident_summons FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_incident_summons" ON incident_summons;
CREATE POLICY "update_incident_summons" ON incident_summons FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_incident_summons" ON incident_summons;
CREATE POLICY "delete_incident_summons" ON incident_summons FOR DELETE
  TO anon, authenticated USING (true);
