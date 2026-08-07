/*
  # Update Storage Policies for Public Access

  1. Changes
    - Add public INSERT policy to allow all users to upload documents
    - Add public UPDATE policy to allow all users to update documents
    - Add public DELETE policy to allow all users to delete documents
    - Maintains existing read access

  2. Security
    - All users can upload, update, and delete documents from the documents bucket
    - This is necessary because users access the system through custom phone/OTP auth
    - Documents are not sensitive as they're used for registration verification

  3. Notes
    - This allows users in the dashboard to manage their documents
    - The custom authentication system handles access control at the application level
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public uploads to documents'
  ) THEN
    CREATE POLICY "Allow public uploads to documents"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public updates to documents'
  ) THEN
    CREATE POLICY "Allow public updates to documents"
    ON storage.objects FOR UPDATE
    TO public
    USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public deletes from documents'
  ) THEN
    CREATE POLICY "Allow public deletes from documents"
    ON storage.objects FOR DELETE
    TO public
    USING (bucket_id = 'documents');
  END IF;
END $$;