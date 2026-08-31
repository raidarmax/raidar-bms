/*
  # Add Previous Motorcycle Tracking to Assignment Requests

  1. Changes
    - Add `previous_motorcycle_id` column to `assignment_requests` table
      - Stores the rider's previous motorcycle ID if this is a bike change request
      - NULL if this is a new assignment request
    
  2. Purpose
    - Track bike change requests separately from new assignments
    - Allow owners to see if a rider is requesting to switch from another bike
    - Maintain audit trail of assignment changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignment_requests' AND column_name = 'previous_motorcycle_id'
  ) THEN
    ALTER TABLE assignment_requests 
    ADD COLUMN previous_motorcycle_id uuid REFERENCES motorcycles(id);
  END IF;
END $$;