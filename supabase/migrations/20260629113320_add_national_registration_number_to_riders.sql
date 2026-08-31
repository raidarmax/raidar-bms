/*
# Add national_registration_number to riders

Replaces county_registration_number with national_registration_number for national
government alignment. Old column kept for backwards compatibility with existing records.

1. Modified Tables
   - `riders`: adds `national_registration_number` (text, nullable)
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'national_registration_number'
  ) THEN
    ALTER TABLE riders ADD COLUMN national_registration_number text;
  END IF;
END $$;
