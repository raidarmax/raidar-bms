/*
  # Add Bike Photo to Motorcycles

  1. Changes
    - Add `bike_photo_url` column to motorcycles table
    - This will store photos of motorcycles with visible number plates
    
  2. Purpose
    - Visual identification of motorcycles
    - Verification that number plate is visible
    - Enhanced motorcycle profiles
    - Better documentation for registration
*/

-- Add bike_photo_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motorcycles' AND column_name = 'bike_photo_url'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN bike_photo_url text;
  END IF;
END $$;