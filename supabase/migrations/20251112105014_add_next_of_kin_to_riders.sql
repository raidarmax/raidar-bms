/*
  # Add Next of Kin Information to Riders

  1. Changes
    - Add `next_of_kin_name` column to riders table
    - Add `next_of_kin_phone` column to riders table
    
  2. Purpose
    - Store emergency contact information for riders
    - Display next of kin contact during bike verification
    - Provide emergency contact for authorities and bike owners

  3. Notes
    - Fields are nullable to support existing riders
    - Phone number stored as text for flexibility with formats
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'next_of_kin_name'
  ) THEN
    ALTER TABLE riders ADD COLUMN next_of_kin_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'next_of_kin_phone'
  ) THEN
    ALTER TABLE riders ADD COLUMN next_of_kin_phone text;
  END IF;
END $$;