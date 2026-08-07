/*
# Add SELECT policies to owner-profiles and police-profiles storage buckets

1. Changes
   - Adds SELECT policies for owner-profiles and police-profiles buckets
   - Both buckets already have INSERT/UPDATE/DELETE policies but were missing SELECT

2. Security
   - Both buckets are already public; this aligns read access with existing write access
*/

DROP POLICY IF EXISTS "owner_profiles_select" ON storage.objects;
CREATE POLICY "owner_profiles_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'owner-profiles');

DROP POLICY IF EXISTS "police_profiles_select" ON storage.objects;
CREATE POLICY "police_profiles_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'police-profiles');
