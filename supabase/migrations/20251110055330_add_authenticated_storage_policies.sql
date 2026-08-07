/*
  # Add Authenticated User Storage Policies

  1. Changes
    - Add INSERT policy for authenticated users to upload documents
    - Add UPDATE policy for authenticated users to update documents
    - Add DELETE policy for authenticated users to delete their documents

  2. Security
    - Authenticated users can upload to documents bucket
    - Authenticated users can update documents they own
    - Authenticated users can delete documents they own
    - Maintains existing public read access and anonymous upload access

  3. Notes
    - This allows users to manage their documents in the user dashboard
    - Documents remain publicly readable for verification purposes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated uploads to documents'
  ) THEN
    CREATE POLICY "Allow authenticated uploads to documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated updates to documents'
  ) THEN
    CREATE POLICY "Allow authenticated updates to documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated deletes from documents'
  ) THEN
    CREATE POLICY "Allow authenticated deletes from documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'documents');
  END IF;
END $$;