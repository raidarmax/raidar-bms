/*
# Create document_validations table

## Purpose
Stores validation results for documents uploaded by riders and owners.
Each record captures the document type, OCR-extracted data, validation status,
field-level match results, issue/expiry dates, and a human-readable summary.

## New Tables
- `document_validations`
  - `id` (uuid, primary key)
  - `user_type` (text: 'rider' | 'owner') — which portal uploaded the document
  - `user_id` (uuid) — FK to riders.id or owners.id (no DB-level FK since it references two tables)
  - `document_type` (text) — e.g. 'national_id', 'driving_license', 'good_conduct', 'logbook', 'insurance_cover', 'kra_pin_doc', 'bike_photo'
  - `file_url` (text) — public URL of the uploaded file in storage
  - `file_name` (text) — original file name
  - `validation_status` (text: 'pending' | 'validated' | 'mismatch' | 'expired' | 'unreadable') — overall status
  - `extracted_name` (text, nullable) — name read from the document via OCR
  - `extracted_id_number` (text, nullable) — ID number read from the document
  - `extracted_date_of_birth` (text, nullable) — DOB read from the document
  - `issue_date` (date, nullable) — issue date parsed from the document
  - `expiry_date` (date, nullable) — expiry date parsed from the document
  - `ocr_confidence` (numeric, nullable) — OCR confidence score 0-100
  - `field_matches` (jsonb, nullable) — per-field match results, e.g. {"name": {"match": true, "similarity": 95}, "id_number": {...}}
  - `summary` (text, nullable) — human-readable summary of the document details
  - `raw_text` (text, nullable) — raw OCR text for audit
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on document_validations.
- The app uses OTP-based auth (no Supabase auth.users), so policies allow
  anon + authenticated CRUD — the anon-key frontend manages its own data.

## Notes
1. This table is write-once-per-upload: each document upload creates a new row.
2. `field_matches` stores structured comparison data for the UI to render badges.
3. `summary` is a precomputed string for quick display in lists.
*/

CREATE TABLE IF NOT EXISTS document_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL CHECK (user_type IN ('rider', 'owner')),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'validated', 'mismatch', 'expired', 'unreadable')),
  extracted_name text,
  extracted_id_number text,
  extracted_date_of_birth text,
  issue_date date,
  expiry_date date,
  ocr_confidence numeric,
  field_matches jsonb,
  summary text,
  raw_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE document_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_document_validations" ON document_validations;
CREATE POLICY "anon_select_document_validations" ON document_validations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_document_validations" ON document_validations;
CREATE POLICY "anon_insert_document_validations" ON document_validations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_document_validations" ON document_validations;
CREATE POLICY "anon_update_document_validations" ON document_validations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_document_validations" ON document_validations;
CREATE POLICY "anon_delete_document_validations" ON document_validations FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_document_validations_user
  ON document_validations (user_type, user_id);
