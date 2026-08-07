/*
  # Create OTP Verification Table

  1. New Tables
    - `owner_otps`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, foreign key to owners)
      - `otp_code` (text, 6-digit code)
      - `phone_number` (text, phone number OTP was sent to)
      - `expires_at` (timestamptz, expiration time)
      - `verified` (boolean, whether OTP was used)
      - `created_at` (timestamptz, creation timestamp)
  
  2. Security
    - Enable RLS on `owner_otps` table
    - No policies needed as this is backend-only verification
    - OTPs expire after 10 minutes
  
  3. Important Notes
    - OTPs are 6-digit numeric codes
    - Each OTP is single-use
    - Expired OTPs are marked but not deleted for audit trail
*/

CREATE TABLE IF NOT EXISTS owner_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES owners(id) ON DELETE CASCADE NOT NULL,
  otp_code text NOT NULL,
  phone_number text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE owner_otps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_owner_otps_owner_id ON owner_otps(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_otps_phone_number ON owner_otps(phone_number);
CREATE INDEX IF NOT EXISTS idx_owner_otps_expires_at ON owner_otps(expires_at);
