/*
# Add SELECT policy to documents storage bucket

1. Changes
   - Adds a SELECT policy on storage.objects for the 'documents' bucket
   - Allows anon and authenticated roles to read documents
   - This fixes the "Failed to upload documents" error when using upsert,
     which needs SELECT permission to check if a file already exists

2. Security
   - The documents bucket is already public, so this aligns read access with existing write access
*/

DROP POLICY IF EXISTS "Allow public read from documents" ON storage.objects;
CREATE POLICY "Allow public read from documents"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'documents');
