/*
# Add insurance_provider and insurance_expiry columns to motorcycles

1. Changes
   - Adds `insurance_provider` (text, nullable) to store the insurance company name
   - Adds `insurance_expiry` (date, nullable) to store when insurance coverage expires

2. Modified Tables
   - `motorcycles`: two new nullable columns for insurance details
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motorcycles' AND column_name = 'insurance_provider' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.motorcycles ADD COLUMN insurance_provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motorcycles' AND column_name = 'insurance_expiry' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.motorcycles ADD COLUMN insurance_expiry date;
  END IF;
END $$;
