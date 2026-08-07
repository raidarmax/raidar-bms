/*
# Add DELETE policy to gps_message_log

1. Security changes
- Adds a DELETE policy on `gps_message_log` for anon + authenticated roles.
- The admin device-management UI needs to purge all data for a device when it is
  removed, including raw GPS message logs. Previously only INSERT/SELECT existed,
  so deleting a device's message history failed silently.
- This mirrors the existing pattern on `tracking_devices` and `device_locations`
  (both already allow anon+authenticated DELETE).
*/

DROP POLICY IF EXISTS "anon_delete_gps_message_log" ON gps_message_log;
CREATE POLICY "anon_delete_gps_message_log" ON gps_message_log FOR DELETE
TO anon, authenticated USING (true);
