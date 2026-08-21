/*
  # Add UPDATE and DELETE policies for motorcycles and riders

  1. Changes
    - Add UPDATE policy for motorcycles table to allow modifications
    - Add DELETE policy for motorcycles table to allow deletions
    - Add UPDATE policy for riders table to allow modifications
    - Add DELETE policy for riders table to allow deletions

  2. Security
    - All anonymous users can update and delete records
    - This matches the existing pattern where users authenticate via custom phone/OTP
    - Application-level logic controls access based on owner_id

  3. Notes
    - These policies are required for the user dashboard to function
    - Users need to edit their motorcycles and riders
    - The custom authentication system provides the security layer
*/

DO $$
BEGIN
  -- Add UPDATE policy for motorcycles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'motorcycles' 
    AND policyname = 'Anyone can update motorcycle records'
  ) THEN
    CREATE POLICY "Anyone can update motorcycle records"
    ON motorcycles FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;

  -- Add DELETE policy for motorcycles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'motorcycles' 
    AND policyname = 'Anyone can delete motorcycle records'
  ) THEN
    CREATE POLICY "Anyone can delete motorcycle records"
    ON motorcycles FOR DELETE
    TO anon
    USING (true);
  END IF;

  -- Add UPDATE policy for riders
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'riders' 
    AND policyname = 'Anyone can update rider records'
  ) THEN
    CREATE POLICY "Anyone can update rider records"
    ON riders FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;

  -- Add DELETE policy for riders
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'riders' 
    AND policyname = 'Anyone can delete rider records'
  ) THEN
    CREATE POLICY "Anyone can delete rider records"
    ON riders FOR DELETE
    TO anon
    USING (true);
  END IF;
END $$;