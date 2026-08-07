/*
# Add company/individual owner type to owners table

Supports registering both individual motorcycle owners and company/SACCO owners
(SACCOs, fleets, corporations).

1. Changes to `owners`
   - `owner_type` (text, NOT NULL DEFAULT 'individual') — 'individual' or 'company'
   - `company_name` (text, nullable) — trading / SACCO / corporate name
   - `business_reg_number` (text, nullable) — Certificate of Incorporation / SACCO reg no.
   - `company_kra_pin` (text, nullable) — company-level KRA PIN (separate from individual)
   - `company_kra_pin_verified` (boolean, DEFAULT false)
   - `contact_person_name` (text, nullable) — authorised rep / director who registered
   - `contact_person_id` (text, nullable) — national ID of the contact person
   - `national_id` made nullable — company registrations do not have an individual national ID

2. Security
   - No new tables; existing RLS policies on `owners` apply unchanged.

3. Notes
   - `national_id` was NOT NULL before. Making it nullable is safe: existing rows
     already have a value, and NULL is a valid "not applicable" for company owners.
     PostgreSQL UNIQUE constraints treat multiple NULLs as distinct, so the unique
     index remains valid for existing individual rows.
   - All new columns are nullable so existing owner rows are unaffected.
*/

ALTER TABLE owners
  ALTER COLUMN national_id DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owners' AND column_name = 'owner_type'
  ) THEN
    ALTER TABLE owners ADD COLUMN owner_type text NOT NULL DEFAULT 'individual'
      CHECK (owner_type IN ('individual', 'company'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owners' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE owners ADD COLUMN company_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owners' AND column_name = 'business_reg_number'
  ) THEN
    ALTER TABLE owners ADD COLUMN business_reg_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owners' AND column_name = 'company_kra_pin'
  ) THEN
    ALTER TABLE owners ADD COLUMN company_kra_pin text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owners' AND column_name = 'company_kra_pin_verified'
  ) THEN
    ALTER TABLE owners ADD COLUMN company_kra_pin_verified boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owners' AND column_name = 'contact_person_name'
  ) THEN
    ALTER TABLE owners ADD COLUMN contact_person_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'owners' AND column_name = 'contact_person_id'
  ) THEN
    ALTER TABLE owners ADD COLUMN contact_person_id text;
  END IF;
END $$;
