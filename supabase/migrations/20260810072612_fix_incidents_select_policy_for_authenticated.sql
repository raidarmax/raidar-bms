/*
# Fix incidents SELECT policy to include authenticated role

## Problem
The existing SELECT policy on `incidents` only grants access to the `anon` role.
When a Supabase client has an active auth session (even if not intentionally signed in),
the client operates as `authenticated`, which has no SELECT policy — causing all incident
queries to return empty results (appearing as "Not Found").

## Changes
- Drop the existing anon-only SELECT policy.
- Recreate it granting access to both `anon` and `authenticated` roles.

## Security
- This table's data is intentionally readable by all app users (officers, public reporters).
- Write operations remain controlled by existing INSERT/UPDATE policies.
*/

DROP POLICY IF EXISTS "Anyone can read incidents" ON incidents;
CREATE POLICY "Anyone can read incidents" ON incidents
  FOR SELECT
  TO anon, authenticated
  USING (true);
