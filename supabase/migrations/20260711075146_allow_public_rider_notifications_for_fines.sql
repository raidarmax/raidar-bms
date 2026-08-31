/*
  # Allow public access to rider_notifications for custom-auth flows

  The rider dashboard authenticates riders via OTP (not Supabase auth), and
  police officers authenticate via a custom cookie-based system. Neither path
  produces a Supabase `authenticated` role session, so the existing policies
  restricted to `TO authenticated` prevented inserts/reads from those clients.

  This migration adds parallel policies on `rider_notifications` scoped to the
  `anon` and `authenticated` roles so that fine-issuance flows can insert
  notifications and riders can read/mark them read.

  1. Policies added
    - `public_insert_rider_notifications` (INSERT)
    - `public_select_rider_notifications` (SELECT)
    - `public_update_rider_notifications` (UPDATE)
*/

DROP POLICY IF EXISTS "public_insert_rider_notifications" ON rider_notifications;
CREATE POLICY "public_insert_rider_notifications" ON rider_notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_rider_notifications" ON rider_notifications;
CREATE POLICY "public_select_rider_notifications" ON rider_notifications
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_update_rider_notifications" ON rider_notifications;
CREATE POLICY "public_update_rider_notifications" ON rider_notifications
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);
