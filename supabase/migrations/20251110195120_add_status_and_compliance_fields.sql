/*
  # Add Status and Compliance Fields to Motorcycles

  1. Changes
    - Add `status` column to motorcycles table (pending/verified)
    - Add `is_compliant` column to track if all required documents are uploaded
    - Add `verified_at` timestamp for when motorcycle was verified
    - Add `verified_by` to track admin who verified

  2. Security
    - Update existing policies to allow admins to update status
*/

-- Add status and compliance columns to motorcycles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'motorcycles' AND column_name = 'status'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN status text DEFAULT 'pending' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'motorcycles' AND column_name = 'is_compliant'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN is_compliant boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'motorcycles' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'motorcycles' AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN verified_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add constraint to ensure status is either 'pending' or 'verified'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'motorcycles_status_check'
  ) THEN
    ALTER TABLE motorcycles 
    ADD CONSTRAINT motorcycles_status_check 
    CHECK (status IN ('pending', 'verified'));
  END IF;
END $$;

-- Create function to automatically check compliance
CREATE OR REPLACE FUNCTION check_motorcycle_compliance()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if all required documents are present
  NEW.is_compliant := (
    NEW.logbook_url IS NOT NULL AND
    NEW.kra_pin_url IS NOT NULL AND
    NEW.insurance_policy_number IS NOT NULL AND
    NEW.insurance_cover_url IS NOT NULL AND
    NEW.tracking_device_id IS NOT NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check compliance on insert/update
DROP TRIGGER IF EXISTS motorcycle_compliance_check ON motorcycles;
CREATE TRIGGER motorcycle_compliance_check
  BEFORE INSERT OR UPDATE ON motorcycles
  FOR EACH ROW
  EXECUTE FUNCTION check_motorcycle_compliance();

-- Update existing motorcycles to check compliance
UPDATE motorcycles SET updated_at = updated_at;