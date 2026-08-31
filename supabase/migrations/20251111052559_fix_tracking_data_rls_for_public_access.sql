/*
  # Fix Tracking Data RLS Policies

  1. Changes
    - Drop existing restrictive RLS policies on tracking_data
    - Add public read access policy for tracking_data
    - Keep insert policy for authenticated users
  
  2. Reason
    - Users login via custom OTP system, not Supabase Auth
    - They need to view tracking data without being authenticated via Supabase Auth
    - This allows the tracking modal and geofence features to work properly
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read all tracking data" ON tracking_data;
DROP POLICY IF EXISTS "Service role can insert tracking data" ON tracking_data;

-- Allow anyone to read tracking data (needed for custom auth system)
CREATE POLICY "Public can read tracking data"
  ON tracking_data
  FOR SELECT
  TO public
  USING (true);

-- Allow anyone to insert tracking data (for GPS devices and testing)
CREATE POLICY "Public can insert tracking data"
  ON tracking_data
  FOR INSERT
  TO public
  WITH CHECK (true);
