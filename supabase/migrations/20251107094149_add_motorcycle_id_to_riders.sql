/*
  # Add motorcycle_id to riders table

  1. Changes
    - Add `motorcycle_id` column to `riders` table to establish one-to-one relationship
    - Add foreign key constraint to `motorcycles` table
    - Add index on `motorcycle_id` for better query performance
    - Ensure nullable to allow riders without assigned motorcycles initially

  2. Notes
    - This allows each rider to be assigned to a specific motorcycle
    - Maintains data integrity with foreign key constraint
    - Existing riders will have NULL motorcycle_id until assigned
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'riders' AND column_name = 'motorcycle_id'
  ) THEN
    ALTER TABLE riders ADD COLUMN motorcycle_id uuid REFERENCES motorcycles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_riders_motorcycle_id ON riders(motorcycle_id);
  END IF;
END $$;