/*
  # Add RLS Policy for OTP Insert

  1. Changes
    - Add policy to allow inserts to owner_otps table
    - This allows the application to create OTP records
  
  2. Security
    - Policy allows inserting OTPs for any owner
    - OTPs are short-lived (10 minutes) and single-use
*/

CREATE POLICY "Allow OTP creation"
  ON owner_otps
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow OTP reading for verification"
  ON owner_otps
  FOR SELECT
  USING (true);

CREATE POLICY "Allow OTP update for verification"
  ON owner_otps
  FOR UPDATE
  USING (true);
