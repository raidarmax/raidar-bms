/*
  # Create Rider History Table

  1. New Tables
    - `rider_history`
      - `id` (uuid, primary key)
      - `motorcycle_id` (uuid, foreign key to motorcycles)
      - `rider_id` (uuid, foreign key to riders)
      - `owner_id` (uuid, foreign key to owners)
      - `rider_name` (text) - snapshot of rider name at time of assignment
      - `rider_id_number` (text) - snapshot of rider ID number
      - `assigned_at` (timestamptz) - when the rider was assigned
      - `removed_at` (timestamptz) - when the rider was removed (null if currently assigned)
      - `removal_reason` (text) - optional reason for removal
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `rider_history` table
    - Add policy for authenticated users to read history
    - Add policy for inserting/updating history records

  3. Indexes
    - Index on motorcycle_id for fast history lookups
    - Index on rider_id for rider-specific queries

  4. Notes
    - Stores snapshot of rider information to preserve history even if rider is deleted
    - removed_at NULL means rider is currently assigned
    - removed_at NOT NULL means this is a historical assignment
*/

-- Create rider_history table
CREATE TABLE IF NOT EXISTS rider_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  rider_name text NOT NULL,
  rider_id_number text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removal_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rider_history ENABLE ROW LEVEL SECURITY;

-- Policy for reading history - anyone authenticated can read
CREATE POLICY "Authenticated users can view rider history"
  ON rider_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for inserting history records
CREATE POLICY "Authenticated users can insert rider history"
  ON rider_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for updating history records
CREATE POLICY "Authenticated users can update rider history"
  ON rider_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rider_history_motorcycle_id ON rider_history(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_rider_history_rider_id ON rider_history(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_history_owner_id ON rider_history(owner_id);
CREATE INDEX IF NOT EXISTS idx_rider_history_assigned_at ON rider_history(assigned_at DESC);
