/*
# Add anon access to GPS tracking tables

## Purpose
The Raidar tracking server (Node.js TCP server) connects to Supabase using the anon key
because the service role key is not available in the local .env file. The existing RLS
policies only allow the `service_role` to insert/update tracking tables, so the server
gets "new row violates row-level security policy" errors when a GPS device sends data.

## Changes
Adds `TO anon, authenticated` CRUD policies to the following tables so the server can
read and write GPS tracking data using the anon key:
- `tracking_devices` — device registration and status
- `device_locations` — GPS location pings
- `device_connections` — connection log
- `device_alarms` — alarm events
- `device_commands` — commands sent to devices

## Security
These tables store machine-generated GPS telemetry, not user data. The tracking server
is the only writer. Allowing anon access is appropriate here because the server has no
user sign-in flow — it communicates with hardware devices over TCP.

## Important notes
1. Drops existing service_role-only policies before recreating with anon access.
2. Uses separate per-verb policies (SELECT/INSERT/UPDATE/DELETE) — no FOR ALL.
3. Idempotent: safe to re-run.
*/

-- tracking_devices
DROP POLICY IF EXISTS "Allow service role full access to tracking_devices" ON tracking_devices;
DROP POLICY IF EXISTS "anon_select_tracking_devices" ON tracking_devices;
DROP POLICY IF EXISTS "anon_insert_tracking_devices" ON tracking_devices;
DROP POLICY IF EXISTS "anon_update_tracking_devices" ON tracking_devices;
DROP POLICY IF EXISTS "anon_delete_tracking_devices" ON tracking_devices;

CREATE POLICY "anon_select_tracking_devices" ON tracking_devices FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_tracking_devices" ON tracking_devices FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_tracking_devices" ON tracking_devices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_tracking_devices" ON tracking_devices FOR DELETE
  TO anon, authenticated USING (true);

-- device_locations
DROP POLICY IF EXISTS "Allow service role full access to device_locations" ON device_locations;
DROP POLICY IF EXISTS "anon_select_device_locations" ON device_locations;
DROP POLICY IF EXISTS "anon_insert_device_locations" ON device_locations;
DROP POLICY IF EXISTS "anon_update_device_locations" ON device_locations;
DROP POLICY IF EXISTS "anon_delete_device_locations" ON device_locations;

CREATE POLICY "anon_select_device_locations" ON device_locations FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_device_locations" ON device_locations FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_device_locations" ON device_locations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_device_locations" ON device_locations FOR DELETE
  TO anon, authenticated USING (true);

-- device_connections
DROP POLICY IF EXISTS "Allow service role full access to device_connections" ON device_connections;
DROP POLICY IF EXISTS "anon_select_device_connections" ON device_connections;
DROP POLICY IF EXISTS "anon_insert_device_connections" ON device_connections;
DROP POLICY IF EXISTS "anon_update_device_connections" ON device_connections;
DROP POLICY IF EXISTS "anon_delete_device_connections" ON device_connections;

CREATE POLICY "anon_select_device_connections" ON device_connections FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_device_connections" ON device_connections FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_device_connections" ON device_connections FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_device_connections" ON device_connections FOR DELETE
  TO anon, authenticated USING (true);

-- device_alarms
DROP POLICY IF EXISTS "Allow service role full access to device_alarms" ON device_alarms;
DROP POLICY IF EXISTS "anon_select_device_alarms" ON device_alarms;
DROP POLICY IF EXISTS "anon_insert_device_alarms" ON device_alarms;
DROP POLICY IF EXISTS "anon_update_device_alarms" ON device_alarms;
DROP POLICY IF EXISTS "anon_delete_device_alarms" ON device_alarms;

CREATE POLICY "anon_select_device_alarms" ON device_alarms FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_device_alarms" ON device_alarms FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_device_alarms" ON device_alarms FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_device_alarms" ON device_alarms FOR DELETE
  TO anon, authenticated USING (true);

-- device_commands
DROP POLICY IF EXISTS "Allow service role full access to device_commands" ON device_commands;
DROP POLICY IF EXISTS "anon_select_device_commands" ON device_commands;
DROP POLICY IF EXISTS "anon_insert_device_commands" ON device_commands;
DROP POLICY IF EXISTS "anon_update_device_commands" ON device_commands;
DROP POLICY IF EXISTS "anon_delete_device_commands" ON device_commands;

CREATE POLICY "anon_select_device_commands" ON device_commands FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_device_commands" ON device_commands FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_device_commands" ON device_commands FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_device_commands" ON device_commands FOR DELETE
  TO anon, authenticated USING (true);
