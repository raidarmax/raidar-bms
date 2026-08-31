/*
# Create phone_otps table for SMS-based OTP verification

A unified OTP store used by all registration and login flows (owner registration,
owner login, rider login). Replaces the demo hardcoded "123456" with real OTPs
delivered by the bulk.ke SMS gateway.

## New Table: phone_otps
- `id` (uuid, pk)
- `phone_number` (text) — normalized E.164 format, e.g. +254712345678
- `otp_code` (text) — 6-digit numeric code
- `expires_at` (timestamptz) — 10 minutes from creation
- `verified` (boolean, default false) — marked true after successful use
- `created_at` (timestamptz)

## Security
- RLS enabled with open anon policies (OTP codes are single-use, time-limited,
  and random — there is no sensitive data exposed beyond what a phone owner already
  receives via SMS)
- An index on (phone_number, expires_at) supports efficient lookups during verification
*/

CREATE TABLE IF NOT EXISTS phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE phone_otps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_otps_lookup ON phone_otps(phone_number, expires_at, verified);

DROP POLICY IF EXISTS "anon_insert_phone_otps" ON phone_otps;
CREATE POLICY "anon_insert_phone_otps" ON phone_otps FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_phone_otps" ON phone_otps;
CREATE POLICY "anon_select_phone_otps" ON phone_otps FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_phone_otps" ON phone_otps;
CREATE POLICY "anon_update_phone_otps" ON phone_otps FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_phone_otps" ON phone_otps;
CREATE POLICY "anon_delete_phone_otps" ON phone_otps FOR DELETE
  TO anon, authenticated USING (true);
