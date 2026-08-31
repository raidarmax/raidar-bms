/*
# Add Government Verification Fields

Adds inline verification tracking columns for government API checks:
- National ID verified via IPRS (GavaConnect)
- KRA PIN stored as text and verified via KRA (GavaConnect)
- Driving License number stored as text and verified via NTSA TIMS (riders only)
- License class extracted from NTSA response (riders only)

## Modified Tables

### owners
- `kra_pin` (text) — KRA PIN number entered at registration
- `kra_pin_verified` (boolean, default false) — whether PIN passed GavaConnect KRA check
- `id_verified` (boolean, default false) — whether National ID passed IPRS check

### riders
- `kra_pin` (text) — KRA PIN number entered at registration
- `kra_pin_verified` (boolean, default false) — whether PIN passed GavaConnect KRA check
- `id_verified` (boolean, default false) — whether National ID passed IPRS check
- `license_number` (text) — driving license number entered at registration
- `license_verified` (boolean, default false) — whether license passed NTSA TIMS check
- `license_class` (text) — license class returned by NTSA (e.g. "A, B")

## Notes
- All columns are optional (nullable) to avoid breaking existing records
- Idempotent: uses DO $$ IF NOT EXISTS blocks so safe to re-run
- No RLS changes required; existing policies cover new columns automatically
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'kra_pin'
  ) THEN
    ALTER TABLE owners ADD COLUMN kra_pin text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'kra_pin_verified'
  ) THEN
    ALTER TABLE owners ADD COLUMN kra_pin_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'id_verified'
  ) THEN
    ALTER TABLE owners ADD COLUMN id_verified boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'kra_pin'
  ) THEN
    ALTER TABLE riders ADD COLUMN kra_pin text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'kra_pin_verified'
  ) THEN
    ALTER TABLE riders ADD COLUMN kra_pin_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'id_verified'
  ) THEN
    ALTER TABLE riders ADD COLUMN id_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'license_number'
  ) THEN
    ALTER TABLE riders ADD COLUMN license_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'license_verified'
  ) THEN
    ALTER TABLE riders ADD COLUMN license_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'license_class'
  ) THEN
    ALTER TABLE riders ADD COLUMN license_class text;
  END IF;
END $$;
