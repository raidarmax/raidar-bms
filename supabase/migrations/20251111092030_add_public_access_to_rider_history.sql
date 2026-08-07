/*
  # Add Public Access to Rider History

  1. Changes
    - Add policies to allow public (anon) users to insert, update, and select from rider_history
    - This is necessary because riders authenticate via phone OTP, not Supabase Auth
    - Riders need to create history entries when accepting assignment requests

  2. Security
    - Allow anon users to insert, update, and view rider history records
    - This maintains consistency with the riders table which already has anon policies
*/

-- Drop existing authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can insert rider history" ON rider_history;
DROP POLICY IF EXISTS "Authenticated users can update rider history" ON rider_history;
DROP POLICY IF EXISTS "Authenticated users can view rider history" ON rider_history;

-- Create new public policies for rider history
CREATE POLICY "Anyone can insert rider history"
  ON rider_history
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update rider history"
  ON rider_history
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can view rider history"
  ON rider_history
  FOR SELECT
  TO anon
  USING (true);

-- Also add authenticated policies for consistency with owner operations
CREATE POLICY "Authenticated users can insert rider history"
  ON rider_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rider history"
  ON rider_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view rider history"
  ON rider_history
  FOR SELECT
  TO authenticated
  USING (true);
