/*
# Case note replies and case messaging

Add two new tables to support the redesigned case view:

1. New Tables
- `incident_note_replies` — threaded replies attached to a parent entry in `incident_resolutions`.
  - `id` uuid primary key
  - `parent_resolution_id` uuid references `incident_resolutions(id)` on delete cascade — the note being replied to
  - `incident_id` uuid references `incidents(id)` on delete cascade — for RLS scoping and direct lookup
  - `officer_id` uuid references `police_officers(id)` — author
  - `officer_name` text — snapshot at write time
  - `body` text not null — the reply body
  - `created_at` timestamptz default now()

- `incident_messages` — free-form messages sent by an officer to any party involved in the case (rider, owner, reporter, another officer, or a senior/managing officer). This is the audit log for case-related communication.
  - `id` uuid primary key
  - `incident_id` uuid references `incidents(id)` on delete cascade
  - `from_officer_id` uuid references `police_officers(id)`
  - `from_officer_name` text
  - `recipient_type` text — one of: rider, owner, reporter, officer, senior_officer, other
  - `recipient_id` uuid — id of the linked entity when known (rider, owner, officer)
  - `recipient_name` text not null
  - `recipient_phone` text — for SMS delivery/audit
  - `subject` text
  - `body` text not null
  - `channel` text default 'in_app' — in_app, sms, or both
  - `sms_sent` boolean default false
  - `read_at` timestamptz null
  - `created_at` timestamptz default now()

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD (the police portal uses the anon key with app-level officer session, matching the existing pattern on `incident_resolutions`, `incident_summons`, and `incident_persons_of_interest`).

3. Indexes
- Index each table by `incident_id` for fast lookup.
- Index replies by `parent_resolution_id` for the note→replies fetch path.
*/

CREATE TABLE IF NOT EXISTS incident_note_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_resolution_id uuid NOT NULL REFERENCES incident_resolutions(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  officer_id uuid REFERENCES police_officers(id) ON DELETE SET NULL,
  officer_name text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_replies_parent ON incident_note_replies(parent_resolution_id);
CREATE INDEX IF NOT EXISTS idx_note_replies_incident ON incident_note_replies(incident_id);

ALTER TABLE incident_note_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_note_replies" ON incident_note_replies;
CREATE POLICY "anon_select_note_replies" ON incident_note_replies FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_note_replies" ON incident_note_replies;
CREATE POLICY "anon_insert_note_replies" ON incident_note_replies FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_note_replies" ON incident_note_replies;
CREATE POLICY "anon_update_note_replies" ON incident_note_replies FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_note_replies" ON incident_note_replies;
CREATE POLICY "anon_delete_note_replies" ON incident_note_replies FOR DELETE
TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS incident_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  from_officer_id uuid REFERENCES police_officers(id) ON DELETE SET NULL,
  from_officer_name text,
  recipient_type text NOT NULL,
  recipient_id uuid,
  recipient_name text NOT NULL,
  recipient_phone text,
  subject text,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  sms_sent boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_messages_incident ON incident_messages(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_messages_created ON incident_messages(created_at DESC);

ALTER TABLE incident_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_case_messages" ON incident_messages;
CREATE POLICY "anon_select_case_messages" ON incident_messages FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_case_messages" ON incident_messages;
CREATE POLICY "anon_insert_case_messages" ON incident_messages FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_case_messages" ON incident_messages;
CREATE POLICY "anon_update_case_messages" ON incident_messages FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_case_messages" ON incident_messages;
CREATE POLICY "anon_delete_case_messages" ON incident_messages FOR DELETE
TO anon, authenticated USING (true);
