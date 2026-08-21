/*
# Fix SELECT policies across all tables to include authenticated role

## Problem
Multiple tables have SELECT policies that only grant access to `anon` but not
`authenticated`. When a Supabase client has an active auth session, it operates
as `authenticated` and cannot read these tables -- causing "Not Found" errors
throughout the app.

## Tables fixed
- motorcycles
- riders
- owners
- incident_evidence
- rider_history (anon-only policy)
- system_users
- user_activity_logs
- user_group_members
- user_groups
- user_roles
- verifications
- appeal_evidence
- incident_appeals
- gps_message_log (anon-only policy)

## Security
- All these tables are intentionally readable by all app users.
- Only the SELECT policy is modified; write policies remain unchanged.
*/

-- motorcycles
DROP POLICY IF EXISTS "Anyone can read motorcycle records" ON motorcycles;
CREATE POLICY "Anyone can read motorcycle records" ON motorcycles
  FOR SELECT TO anon, authenticated USING (true);

-- riders
DROP POLICY IF EXISTS "Anyone can read rider records" ON riders;
CREATE POLICY "Anyone can read rider records" ON riders
  FOR SELECT TO anon, authenticated USING (true);

-- owners
DROP POLICY IF EXISTS "Anyone can read owner records for verification" ON owners;
CREATE POLICY "Anyone can read owner records for verification" ON owners
  FOR SELECT TO anon, authenticated USING (true);

-- incident_evidence
DROP POLICY IF EXISTS "Anyone can read incident evidence" ON incident_evidence;
CREATE POLICY "Anyone can read incident evidence" ON incident_evidence
  FOR SELECT TO anon, authenticated USING (true);

-- rider_history (has an anon-only policy)
DROP POLICY IF EXISTS "Anyone can view rider history" ON rider_history;
CREATE POLICY "Anyone can view rider history" ON rider_history
  FOR SELECT TO anon, authenticated USING (true);

-- system_users
DROP POLICY IF EXISTS "Anyone can read system users" ON system_users;
CREATE POLICY "Anyone can read system users" ON system_users
  FOR SELECT TO anon, authenticated USING (true);

-- user_activity_logs
DROP POLICY IF EXISTS "Anyone can read activity logs" ON user_activity_logs;
CREATE POLICY "Anyone can read activity logs" ON user_activity_logs
  FOR SELECT TO anon, authenticated USING (true);

-- user_group_members
DROP POLICY IF EXISTS "Anyone can read group members" ON user_group_members;
CREATE POLICY "Anyone can read group members" ON user_group_members
  FOR SELECT TO anon, authenticated USING (true);

-- user_groups
DROP POLICY IF EXISTS "Anyone can read user groups" ON user_groups;
CREATE POLICY "Anyone can read user groups" ON user_groups
  FOR SELECT TO anon, authenticated USING (true);

-- user_roles
DROP POLICY IF EXISTS "Anyone can read user roles" ON user_roles;
CREATE POLICY "Anyone can read user roles" ON user_roles
  FOR SELECT TO anon, authenticated USING (true);

-- verifications
DROP POLICY IF EXISTS "Anyone can read verification records" ON verifications;
CREATE POLICY "Anyone can read verification records" ON verifications
  FOR SELECT TO anon, authenticated USING (true);

-- appeal_evidence
DROP POLICY IF EXISTS "Anyone can read appeal evidence" ON appeal_evidence;
CREATE POLICY "Anyone can read appeal evidence" ON appeal_evidence
  FOR SELECT TO anon, authenticated USING (true);

-- incident_appeals
DROP POLICY IF EXISTS "Anyone can read appeals" ON incident_appeals;
CREATE POLICY "Anyone can read appeals" ON incident_appeals
  FOR SELECT TO anon, authenticated USING (true);

-- gps_message_log (fix the anon-only one; keep the authenticated-only one that already exists)
DROP POLICY IF EXISTS "read_gps_message_log_anon" ON gps_message_log;
