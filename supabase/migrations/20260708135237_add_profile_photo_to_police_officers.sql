/*
# Add profile photo and storage bucket for police officers

1. Modified Tables
   - `police_officers`: adds `profile_photo_url` (nullable text) for storing officer profile photo URL.

2. Storage
   - Creates `police-profiles` storage bucket (public) for officer profile photos.
   - Adds public read + anon/authenticated write/delete policies for the bucket.
*/

ALTER TABLE police_officers
ADD COLUMN IF NOT EXISTS profile_photo_url text;

-- Create storage bucket for police officer profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'police-profiles',
  'police-profiles',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "police_profiles_public_read" ON storage.objects;
CREATE POLICY "police_profiles_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'police-profiles');

DROP POLICY IF EXISTS "police_profiles_upload" ON storage.objects;
CREATE POLICY "police_profiles_upload" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'police-profiles');

DROP POLICY IF EXISTS "police_profiles_update" ON storage.objects;
CREATE POLICY "police_profiles_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'police-profiles') WITH CHECK (bucket_id = 'police-profiles');

DROP POLICY IF EXISTS "police_profiles_delete" ON storage.objects;
CREATE POLICY "police_profiles_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'police-profiles');
