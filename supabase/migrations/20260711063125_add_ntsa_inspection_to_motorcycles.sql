/*
# Add NTSA Inspection Certificate to Motorcycles

Adds NTSA inspection certificate tracking to motorcycles and a corresponding
compliance fee setting for third-party revenue reporting.

1. Modified Tables
   - `motorcycles`
     - `inspection_certificate_url` (text)
     - `inspection_certificate_number` (text)
     - `inspection_expiry` (date)

2. New Settings
   - system_settings general.ntsa_inspection_fee default 1500 KES
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='motorcycles' AND column_name='inspection_certificate_url') THEN
    ALTER TABLE motorcycles ADD COLUMN inspection_certificate_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='motorcycles' AND column_name='inspection_certificate_number') THEN
    ALTER TABLE motorcycles ADD COLUMN inspection_certificate_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='motorcycles' AND column_name='inspection_expiry') THEN
    ALTER TABLE motorcycles ADD COLUMN inspection_expiry date;
  END IF;
END $$;

INSERT INTO system_settings (category, key, value, label, description)
VALUES ('general', 'ntsa_inspection_fee', '1500', 'NTSA Inspection Fee (KES)', 'Fee charged per motorcycle NTSA inspection certificate. Used in compliance revenue reporting.')
ON CONFLICT (category, key) DO NOTHING;
