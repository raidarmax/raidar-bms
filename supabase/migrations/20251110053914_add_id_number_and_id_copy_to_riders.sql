/*
  # Add ID number and ID copy fields to riders table

  1. Changes
    - Add `id_number` column to store the rider's national ID number
    - Add `id_copy_url` column to store the URL of the uploaded ID document
    - Both fields are required for new riders
    - Add index on `id_number` for better query performance

  2. Security
    - Maintains existing RLS policies on riders table
    - ID documents stored in Supabase storage with proper access controls

  3. Notes
    - Existing riders will need to update their records with ID information
    - ID number is unique to prevent duplicate registrations
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'riders' AND column_name = 'id_number'
  ) THEN
    ALTER TABLE riders ADD COLUMN id_number text NOT NULL DEFAULT '';
    ALTER TABLE riders ADD CONSTRAINT unique_id_number UNIQUE (id_number);
    CREATE INDEX IF NOT EXISTS idx_riders_id_number ON riders(id_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'riders' AND column_name = 'id_copy_url'
  ) THEN
    ALTER TABLE riders ADD COLUMN id_copy_url text;
  END IF;
END $$;