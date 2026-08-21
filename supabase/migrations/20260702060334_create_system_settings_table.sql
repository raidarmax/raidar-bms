/*
# Create system_settings table

1. New Tables
  - `system_settings`
    - `id` (uuid, primary key)
    - `category` (text, not null) — groups settings (e.g. 'api_keys', 'sms', 'general', 'notifications')
    - `key` (text, not null) — setting identifier within category
    - `value` (text) — the setting value (encrypted secrets stored as masked strings)
    - `label` (text) — human-readable label for UI display
    - `description` (text) — help text for the setting
    - `is_secret` (boolean, default false) — whether value should be masked in UI
    - `updated_at` (timestamptz)
    - `updated_by` (text) — admin username who last changed it
    - UNIQUE constraint on (category, key)

2. Security
  - Enable RLS on `system_settings`.
  - Allow anon + authenticated full CRUD (admin app uses anon key with custom auth).

3. Notes
  - This table stores configuration that admins can view/edit from the dashboard.
  - Actual API secrets for edge functions are stored as Supabase secrets — this table
    tracks what's configured and provides a UI for management.
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key text NOT NULL,
  value text DEFAULT '',
  label text NOT NULL DEFAULT '',
  description text DEFAULT '',
  is_secret boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by text,
  UNIQUE(category, key)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_system_settings" ON system_settings;
CREATE POLICY "anon_select_system_settings" ON system_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_system_settings" ON system_settings;
CREATE POLICY "anon_insert_system_settings" ON system_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_system_settings" ON system_settings;
CREATE POLICY "anon_update_system_settings" ON system_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_system_settings" ON system_settings;
CREATE POLICY "anon_delete_system_settings" ON system_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Seed default settings
INSERT INTO system_settings (category, key, label, description, is_secret, value) VALUES
  -- API Keys
  ('api_keys', 'gavaconnect_client_id', 'GavaConnect Client ID', 'OAuth2 client ID for GavaConnect (IPRS / KRA verification)', true, ''),
  ('api_keys', 'gavaconnect_client_secret', 'GavaConnect Client Secret', 'OAuth2 client secret for GavaConnect', true, ''),
  ('api_keys', 'gavaconnect_base_url', 'GavaConnect Base URL', 'API base URL (default: https://developer.go.ke)', false, 'https://developer.go.ke'),
  ('api_keys', 'ntsa_api_key', 'NTSA API Key', 'API key for NTSA TIMS driving license verification', true, ''),
  ('api_keys', 'ntsa_api_base_url', 'NTSA API Base URL', 'NTSA TIMS API base URL (default: https://serviceportal.ntsa.go.ke/api)', false, 'https://serviceportal.ntsa.go.ke/api'),
  -- SMS
  ('sms', 'bulkke_api_key', 'Bulk.ke API Key', 'API key for Bulk.ke SMS gateway (OTP delivery)', true, ''),
  ('sms', 'bulkke_sender_name', 'SMS Sender Name', 'The sender ID that appears on SMS messages', false, 'SALAMA'),
  ('sms', 'otp_expiry_minutes', 'OTP Expiry (minutes)', 'How long an OTP remains valid after being sent', false, '10'),
  ('sms', 'otp_length', 'OTP Length', 'Number of digits in generated OTP codes', false, '6'),
  -- General
  ('general', 'system_name', 'System Name', 'The name of the BMS system displayed in headers', false, 'SALAMA BMS'),
  ('general', 'support_email', 'Support Email', 'Email shown on support/contact pages', false, ''),
  ('general', 'support_phone', 'Support Phone', 'Phone number shown on support/contact pages', false, ''),
  ('general', 'registration_fee_owner', 'Owner Registration Fee (KES)', 'Fee charged for bike owner registration', false, '1000'),
  ('general', 'registration_fee_rider', 'Rider Registration Fee (KES)', 'Fee charged for rider registration', false, '500'),
  ('general', 'annual_renewal_fee', 'Annual Renewal Fee (KES)', 'Yearly compliance renewal fee', false, '500'),
  -- Notifications
  ('notifications', 'enable_sms_notifications', 'Enable SMS Notifications', 'Send automated SMS for events (verification, payments)', false, 'true'),
  ('notifications', 'enable_incident_alerts', 'Enable Incident Alerts', 'Notify owners/riders via SMS when an incident is reported', false, 'true'),
  ('notifications', 'payment_reminder_days', 'Payment Reminder (days before)', 'Days before renewal deadline to send payment reminder SMS', false, '30'),
  -- Verification
  ('verification', 'require_national_id_verification', 'Require National ID Verification', 'Block registration if National ID cannot be verified', false, 'true'),
  ('verification', 'require_kra_pin_verification', 'Require KRA PIN Verification', 'Block registration if KRA PIN cannot be verified', false, 'true'),
  ('verification', 'require_license_verification', 'Require Driving License Verification', 'Block rider registration if license cannot be verified', false, 'true'),
  ('verification', 'sandbox_mode', 'Sandbox Mode', 'When enabled, verification APIs return simulated responses', false, 'true')
ON CONFLICT (category, key) DO NOTHING;
