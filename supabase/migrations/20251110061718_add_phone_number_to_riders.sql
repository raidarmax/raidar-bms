/*
  # Add phone_number column to riders table

  1. Changes
    - Add phone_number column to riders table (text type, nullable)
    - Allows storing rider contact information

  2. Notes
    - Phone number is optional to maintain backward compatibility
    - Will be used in both admin and user dashboards
    - Admins can view rider phone numbers
    - Owners can add/edit phone numbers for their riders
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'riders'
    AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE riders ADD COLUMN phone_number text;
  END IF;
END $$;