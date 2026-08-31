/*
  # Setup Storage Policies for Document Uploads

  ## Overview
  This migration creates storage policies for the documents bucket to allow
  public access for viewing and anonymous uploads for registration documents.

  ## Policies Created
  - Public read access for all documents
  - Anonymous upload access for registration documents
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public Access for documents'
  ) THEN
    CREATE POLICY "Public Access for documents"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow anon uploads to documents'
  ) THEN
    CREATE POLICY "Allow anon uploads to documents"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'documents');
  END IF;
END $$;
