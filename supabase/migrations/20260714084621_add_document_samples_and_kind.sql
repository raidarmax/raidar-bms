-- Document samples table (admin-uploaded reference samples to guide OCR)
CREATE TABLE IF NOT EXISTS document_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  document_kind text,
  label text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_name text,
  keywords text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_samples_type_idx ON document_samples(document_type);
CREATE INDEX IF NOT EXISTS document_samples_active_idx ON document_samples(active);

ALTER TABLE document_samples ENABLE ROW LEVEL SECURITY;

-- Public read (needed by OCR client) and permissive write since this project uses
-- app-level auth (system_users), not supabase auth.
CREATE POLICY "document_samples_select_all"
  ON document_samples FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "document_samples_insert_all"
  ON document_samples FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "document_samples_update_all"
  ON document_samples FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "document_samples_delete_all"
  ON document_samples FOR DELETE
  TO anon, authenticated USING (true);

-- Add document_kind to document_validations (national_id | passport for ID docs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_validations' AND column_name = 'document_kind'
  ) THEN
    ALTER TABLE document_validations ADD COLUMN document_kind text;
  END IF;
END $$;

-- Add id_document_kind + rejection tracking to riders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'id_document_kind'
  ) THEN
    ALTER TABLE riders ADD COLUMN id_document_kind text DEFAULT 'national_id';
  END IF;
END $$;

-- Add id_document_kind to owners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'id_document_kind'
  ) THEN
    ALTER TABLE owners ADD COLUMN id_document_kind text DEFAULT 'national_id';
  END IF;
END $$;
