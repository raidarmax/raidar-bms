DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_users' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE system_users ADD COLUMN profile_photo_url text;
  END IF;
END $$;