/*
  # Add license expiry to riders and compliance fee settings

  1. Schema Changes
    - Add `license_expiry` column (date, nullable) to `riders` table

  2. Settings
    - Insert `driving_license_fee` (default 600 KES) into `system_settings`
    - Insert `good_conduct_fee` (default 1000 KES) into `system_settings`

  3. Notes
    - Existing rider rows are unaffected; license_expiry defaults to NULL
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'riders'
      AND column_name = 'license_expiry'
  ) THEN
    ALTER TABLE riders ADD COLUMN license_expiry date;
  END IF;
END $$;

INSERT INTO system_settings (category, key, value, label, description)
VALUES
  ('general', 'driving_license_fee', '600', 'Driving License Fee (KES)', 'Cost of driving license used for third-party compliance revenue'),
  ('general', 'good_conduct_fee', '1000', 'Good Conduct Certificate Fee (KES)', 'Cost of good conduct certificate used for third-party compliance revenue')
ON CONFLICT (category, key) DO NOTHING;
