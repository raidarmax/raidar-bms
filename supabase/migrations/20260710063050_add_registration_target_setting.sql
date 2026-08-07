INSERT INTO system_settings (category, key, label, description, is_secret, value)
VALUES
  ('general', 'registration_target', 'Registration Target', 'Target total number of registrations (owners + riders + motorcycles) used for the admin dashboard progress card', false, '10000')
ON CONFLICT (category, key) DO NOTHING;