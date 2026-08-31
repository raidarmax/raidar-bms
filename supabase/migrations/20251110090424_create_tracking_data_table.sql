/*
  # Create tracking data table for motorcycle location history

  1. New Tables
    - `tracking_data`
      - `id` (uuid, primary key)
      - `motorcycle_id` (uuid, foreign key to motorcycles)
      - `latitude` (decimal) - GPS latitude coordinate
      - `longitude` (decimal) - GPS longitude coordinate
      - `speed` (decimal, optional) - Speed in km/h
      - `heading` (decimal, optional) - Direction in degrees
      - `accuracy` (decimal, optional) - GPS accuracy in meters
      - `recorded_at` (timestamptz) - Timestamp when location was recorded
      - `created_at` (timestamptz) - Timestamp when record was inserted
  
  2. Security
    - Enable RLS on `tracking_data` table
    - Add policy for authenticated users to read all tracking data
    - Add policy for system to insert tracking data
  
  3. Indexes
    - Index on motorcycle_id for efficient queries
    - Index on recorded_at for time-based searches
*/

CREATE TABLE IF NOT EXISTS tracking_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid REFERENCES motorcycles(id) ON DELETE CASCADE NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  speed decimal(5, 2),
  heading decimal(5, 2),
  accuracy decimal(6, 2),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_data_motorcycle_id ON tracking_data(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_tracking_data_recorded_at ON tracking_data(recorded_at);

ALTER TABLE tracking_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all tracking data"
  ON tracking_data
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert tracking data"
  ON tracking_data
  FOR INSERT
  TO authenticated
  WITH CHECK (true);