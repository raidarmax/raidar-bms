/*
  # Add Rider Response to Incidents

  1. Changes
    - Add `rider_response` column to incidents table to store rider's appeal/response
    - Add `rider_response_submitted_at` timestamp to track when response was submitted
    
  2. Purpose
    - Allow riders to submit appeals or responses to reported incidents
    - Enable two-way communication between riders and admins
    - Track when riders provide their side of the story
    
  3. Security
    - Riders can update their own incident responses
    - Admins can view all responses
    - No changes to existing RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'rider_response'
  ) THEN
    ALTER TABLE incidents ADD COLUMN rider_response text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'rider_response_submitted_at'
  ) THEN
    ALTER TABLE incidents ADD COLUMN rider_response_submitted_at timestamptz;
  END IF;
END $$;