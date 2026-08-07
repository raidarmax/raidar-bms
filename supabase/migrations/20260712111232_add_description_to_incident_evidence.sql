/*
# Add description field to incident_evidence

1. Changes
- Adds a nullable `description` (text) column to `incident_evidence`, allowing officers and reporters to attach a short note explaining each piece of evidence.

2. Security
- No RLS or policy changes are required; the existing policies on `incident_evidence` continue to apply.

3. Notes
- Column is nullable and defaults to NULL so existing rows remain valid.
- Idempotent: uses IF NOT EXISTS guard.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'incident_evidence'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.incident_evidence ADD COLUMN description text;
  END IF;
END $$;