/*
# Add write policies to blocked_connections table

1. Changes
   - Add INSERT policy for anon + authenticated roles
   - Add UPDATE policy for anon + authenticated roles
   - Add DELETE policy for anon + authenticated roles

2. Reason
   - The server auto-blocks scanner IPs but was failing with
     "new row violates row-level security policy" because only
     a SELECT policy existed.
   - This table is managed by the tracking server process, not end-users.
*/

DROP POLICY IF EXISTS "insert_blocked_connections" ON blocked_connections;
CREATE POLICY "insert_blocked_connections" ON blocked_connections FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_blocked_connections" ON blocked_connections;
CREATE POLICY "update_blocked_connections" ON blocked_connections FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_blocked_connections" ON blocked_connections;
CREATE POLICY "delete_blocked_connections" ON blocked_connections FOR DELETE
  TO anon, authenticated USING (true);
