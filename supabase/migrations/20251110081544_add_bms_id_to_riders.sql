/*
  # Add BMS ID to Riders Table

  1. Changes
    - Add `bms_id` column to `riders` table
      - Stores the unique Bodaboda Management System ID for each rider
      - Format: BMS-YYYY-XXXXX (e.g., BMS-2025-00001)
      - Unique constraint to prevent duplicates
    
  2. Purpose
    - Generate unique identification for registered riders
    - Enable PDF card generation for riders
    - Track riders in the system with a human-readable ID
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'bms_id'
  ) THEN
    ALTER TABLE riders 
    ADD COLUMN bms_id text UNIQUE;
  END IF;
END $$;