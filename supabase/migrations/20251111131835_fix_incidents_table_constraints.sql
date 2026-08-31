-- Fix incidents table to ensure proper constraints and defaults
-- Make reporter_name and reporter_phone NOT NULL
-- Ensure status has NOT NULL constraint with default

-- First, update any NULL values
UPDATE incidents SET reporter_name = 'Unknown' WHERE reporter_name IS NULL;
UPDATE incidents SET reporter_phone = 'Not Provided' WHERE reporter_phone IS NULL;
UPDATE incidents SET status = 'pending' WHERE status IS NULL;

-- Now add NOT NULL constraints
ALTER TABLE incidents ALTER COLUMN reporter_name SET NOT NULL;
ALTER TABLE incidents ALTER COLUMN reporter_phone SET NOT NULL;
ALTER TABLE incidents ALTER COLUMN status SET NOT NULL;
ALTER TABLE incidents ALTER COLUMN status SET DEFAULT 'pending';
