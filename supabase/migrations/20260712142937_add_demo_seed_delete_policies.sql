/*
# Add DELETE RLS policies for demo-seeded rows

## Problem
The Demo Content Manager's Wipe / Wipe All actions silently deleted zero rows
on most tables because RLS is enabled but only `motorcycles` and `riders` had
DELETE policies. Postgres silently rejects deletes when no matching policy is
present (there is no error — RLS just filters the rows out of the delete).

## Fix
Add a scoped DELETE policy on every demo table that:
- targets `anon, authenticated` (the frontend uses the anon key)
- restricts deletion to rows where `demo_seed = true` so real customer data
  can never be deleted by the demo manager even if invoked with a broken
  predicate.

## Tables
- owners
- fines
- incidents
- tracking_data
- rider_notifications
- police_officers
- incident_notifications
- rider_history
- assignment_requests

## Notes
1. `motorcycles` and `riders` already have DELETE policies (with `USING (true)`),
   left untouched.
2. Policies are dropped-then-created for idempotency.
3. No data is modified.
*/

DROP POLICY IF EXISTS "demo_delete_owners" ON owners;
CREATE POLICY "demo_delete_owners" ON owners FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_fines" ON fines;
CREATE POLICY "demo_delete_fines" ON fines FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_incidents" ON incidents;
CREATE POLICY "demo_delete_incidents" ON incidents FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_tracking_data" ON tracking_data;
CREATE POLICY "demo_delete_tracking_data" ON tracking_data FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_rider_notifications" ON rider_notifications;
CREATE POLICY "demo_delete_rider_notifications" ON rider_notifications FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_police_officers" ON police_officers;
CREATE POLICY "demo_delete_police_officers" ON police_officers FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_incident_notifications" ON incident_notifications;
CREATE POLICY "demo_delete_incident_notifications" ON incident_notifications FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_rider_history" ON rider_history;
CREATE POLICY "demo_delete_rider_history" ON rider_history FOR DELETE
  TO anon, authenticated USING (demo_seed = true);

DROP POLICY IF EXISTS "demo_delete_assignment_requests" ON assignment_requests;
CREATE POLICY "demo_delete_assignment_requests" ON assignment_requests FOR DELETE
  TO anon, authenticated USING (demo_seed = true);
