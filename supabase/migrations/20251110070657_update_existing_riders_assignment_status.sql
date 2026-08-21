/*
  # Update Existing Riders Assignment Status

  1. Changes
    - Update all existing riders without assignment_status to have proper status
    - Set to 'Assigned' if they have a motorcycle_id
    - Set to 'Unassigned' if they don't have a motorcycle_id

  2. Notes
    - This fixes riders that were created before the assignment_status field was added
    - Ensures all riders can log in properly
*/

-- Update existing riders that have assignment_status as NULL
UPDATE riders
SET assignment_status = CASE
  WHEN motorcycle_id IS NOT NULL THEN 'Assigned'
  ELSE 'Unassigned'
END
WHERE assignment_status IS NULL;

-- Ensure all riders have the assignment_status field with correct values
UPDATE riders
SET assignment_status = CASE
  WHEN motorcycle_id IS NOT NULL AND assignment_status = 'Unassigned' THEN 'Assigned'
  WHEN motorcycle_id IS NULL AND assignment_status = 'Assigned' THEN 'Unassigned'
  ELSE assignment_status
END;