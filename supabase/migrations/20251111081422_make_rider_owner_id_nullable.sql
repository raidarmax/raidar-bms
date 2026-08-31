/*
  # Make rider owner_id nullable for independent rider registration

  1. Changes
    - Alter the `riders` table to make `owner_id` nullable
    - This allows riders to register independently without being assigned to a motorcycle owner
    - Riders can be assigned to an owner later through the assignment system

  2. Security
    - No changes to RLS policies needed
    - Existing policies continue to work with nullable owner_id
*/

-- Make owner_id nullable to allow independent rider registration
ALTER TABLE riders ALTER COLUMN owner_id DROP NOT NULL;
