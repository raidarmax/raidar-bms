/*
# Allow 'officer' as an incident evidence uploader

1. Problem
- `incident_evidence.uploaded_by` has a CHECK constraint restricting values to
  ('reporter', 'rider', 'admin'). The police portal writes 'officer' when an
  officer uploads case evidence, causing every officer-side upload to fail with
  a constraint violation.

2. Change
- Drop the old CHECK constraint and add a new one that includes 'officer'.
- No data loss: existing rows already use one of the previously-allowed values.

3. Security
- No RLS changes.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incident_evidence_uploaded_by_check'
  ) THEN
    ALTER TABLE incident_evidence DROP CONSTRAINT incident_evidence_uploaded_by_check;
  END IF;
END $$;

ALTER TABLE incident_evidence
  ADD CONSTRAINT incident_evidence_uploaded_by_check
  CHECK (uploaded_by = ANY (ARRAY['reporter'::text, 'rider'::text, 'admin'::text, 'officer'::text]));
