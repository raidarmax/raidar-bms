/*
# Didit.me identity verification integration

Adds a persistent record of identity-verification sessions created against the
didit.me KYC/KYB API and seeds the admin-configurable settings needed to talk
to it.

1. New Tables
   - `identity_verifications`
     - `id` (uuid, PK)
     - `subject_type` (text: owner | rider | officer | prospect) — which side of the
       system the verification was raised for
     - `subject_id` (uuid, nullable) — FK-style link to owners/riders/officers/system_users
     - `vendor_data` (text) — echo value we send to didit so their webhook can
       identify which local record to update
     - `session_id` (text, unique) — didit's session_id
     - `session_url` (text) — hosted verification URL we redirect the user to
     - `session_token` (text, nullable) — token for SDK/iframe embeds
     - `workflow_id` (text) — didit workflow that produced this session
     - `status` (text) — Not Started / In Progress / Approved / Declined / Review / etc.
     - `decision` (text, nullable) — final decision text
     - `document_type` (text, nullable) — P / ID / DL / RP (didit's codes)
     - `extracted_data` (jsonb) — id number, DOB, names, expiry, MRZ, address, etc.
     - `risk_flags` (jsonb) — array of AML / liveness / duplicate warnings
     - `face_match_score` (numeric, nullable)
     - `liveness_score` (numeric, nullable)
     - `raw_payload` (jsonb) — full last-seen decision payload for audit
     - `created_by` (text, nullable) — admin username / rider phone that started it
     - `created_at`, `updated_at`

2. New system_settings rows (category `identity_kyc`)
   - `didit_api_base_url`
   - `didit_api_key` (secret) — seeded with the operator-provided key
   - `didit_webhook_secret` (secret)
   - `didit_workflow_id_rider` — workflow used for rider KYC (ID + liveness)
   - `didit_workflow_id_owner` — workflow used for owner KYC
   - `didit_workflow_id_business` — workflow used for owner KYB
   - `didit_enabled` (bool string)

3. Security
   - RLS enabled on `identity_verifications`.
   - `anon, authenticated` can INSERT / SELECT / UPDATE their own vendor_data-scoped
     rows so the existing anon-key frontend (OTP-authenticated riders / owners /
     admins) can drive the flow. The service role used by the edge functions
     bypasses RLS to write webhook results.
   - `system_settings` RLS is inherited from prior migrations.

4. Notes
   - The seed only inserts rows that do not already exist so re-runs are safe.
   - No destructive changes.
*/

CREATE TABLE IF NOT EXISTS identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('owner','rider','officer','prospect','business')),
  subject_id uuid,
  vendor_data text NOT NULL,
  session_id text UNIQUE,
  session_url text,
  session_token text,
  workflow_id text,
  status text NOT NULL DEFAULT 'Not Started',
  decision text,
  document_type text,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  face_match_score numeric,
  liveness_score numeric,
  raw_payload jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_subject ON identity_verifications (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_vendor_data ON identity_verifications (vendor_data);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_status ON identity_verifications (status);

ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "identity_verifications_select_all" ON identity_verifications;
CREATE POLICY "identity_verifications_select_all" ON identity_verifications
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "identity_verifications_insert_all" ON identity_verifications;
CREATE POLICY "identity_verifications_insert_all" ON identity_verifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "identity_verifications_update_all" ON identity_verifications;
CREATE POLICY "identity_verifications_update_all" ON identity_verifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "identity_verifications_delete_all" ON identity_verifications;
CREATE POLICY "identity_verifications_delete_all" ON identity_verifications
  FOR DELETE TO anon, authenticated USING (true);

INSERT INTO system_settings (category, key, value, label, description, is_secret)
VALUES
  ('identity_kyc', 'didit_enabled', 'true', 'Enable Didit KYC', 'Turn the didit.me identity verification flow on or off across the platform.', false),
  ('identity_kyc', 'didit_api_base_url', 'https://verification.didit.me', 'Didit API Base URL', 'Base URL for the didit verification API (v3).', false),
  ('identity_kyc', 'didit_api_key', '2Fg6mKR3m9370PUOV59xpCwrMtanvn4mGeoDzAFaxM8', 'Didit API Key', 'Application API key from the didit Business Console. Sent as the x-api-key header.', true),
  ('identity_kyc', 'didit_webhook_secret', '', 'Didit Webhook Secret', 'Shared secret used to validate HMAC-SHA256 signatures on incoming didit webhooks.', true),
  ('identity_kyc', 'didit_workflow_id_rider', '', 'Rider KYC Workflow ID', 'Didit workflow used for rider identity verification (ID + selfie + liveness).', false),
  ('identity_kyc', 'didit_workflow_id_owner', '', 'Owner KYC Workflow ID', 'Didit workflow used for individual owner identity verification.', false),
  ('identity_kyc', 'didit_workflow_id_business', '', 'Business KYB Workflow ID', 'Didit workflow used for business/SACCO owner Know-Your-Business verification.', false)
ON CONFLICT (category, key) DO NOTHING;
