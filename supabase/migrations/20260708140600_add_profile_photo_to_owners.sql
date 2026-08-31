/*
# Add profile photo to owners + owner-profiles storage bucket

1. Modified Tables
   - `owners`: adds `profile_photo_url` (nullable text) for storing owner profile photo URL.

2. Storage
   - Creates `owner-profiles` storage bucket (public, 5MB limit, images only).
   - Adds public read + anon/authenticated write/update/delete policies.
*/

ALTER TABLE owners
ADD COLUMN IF NOT EXISTS profile_photo_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'owner-profiles',
  'owner-profiles',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "owner_profiles_public_read" ON storage.objects;
CREATE POLICY "owner_profiles_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'owner-profiles');

DROP POLICY IF EXISTS "owner_profiles_upload" ON storage.objects;
CREATE POLICY "owner_profiles_upload" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'owner-profiles');

DROP POLICY IF EXISTS "owner_profiles_update" ON storage.objects;
CREATE POLICY "owner_profiles_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'owner-profiles') WITH CHECK (bucket_id = 'owner-profiles');

DROP POLICY IF EXISTS "owner_profiles_delete" ON storage.objects;
CREATE POLICY "owner_profiles_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'owner-profiles');
