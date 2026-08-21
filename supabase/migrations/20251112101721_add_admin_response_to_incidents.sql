/*
  # Add admin response field to incidents

  1. Changes
    - Add `admin_response` column to `incidents` table for official warnings/summons to riders
    - Add `response_type` column to categorize the response (warning, summon, cleared)
    - Add `response_sent_at` timestamp to track when response was sent
    
  2. Notes
    - `admin_notes` remains for internal admin notes
    - `admin_response` is the official message visible to riders
    - `response_type` helps categorize the admin action taken
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'admin_response'
  ) THEN
    ALTER TABLE incidents ADD COLUMN admin_response text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'response_type'
  ) THEN
    ALTER TABLE incidents ADD COLUMN response_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'response_sent_at'
  ) THEN
    ALTER TABLE incidents ADD COLUMN response_sent_at timestamptz;
  END IF;
END $$;