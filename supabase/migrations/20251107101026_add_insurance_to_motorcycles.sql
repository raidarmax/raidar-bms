/*
  # Add Insurance Fields to Motorcycles Table

  1. Changes
    - Add `insurance_policy_number` column to `motorcycles` table (text)
    - Add `insurance_cover_url` column to `motorcycles` table (text)
  
  2. Notes
    - These fields are optional and can be added/updated after initial registration
    - Insurance cover URL will store the document in Supabase Storage
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motorcycles' AND column_name = 'insurance_policy_number'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN insurance_policy_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motorcycles' AND column_name = 'insurance_cover_url'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN insurance_cover_url text;
  END IF;
END $$;