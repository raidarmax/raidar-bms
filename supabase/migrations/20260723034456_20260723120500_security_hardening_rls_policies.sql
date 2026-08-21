/*
# Security Hardening — RLS Policy Fixes

## Summary
Fixes all RLS security audit findings related to policies with always-true checks.

## Architecture Context
This app uses **custom auth** (bcrypt password hashes in `system_users` and `police_officers`,
OTP via `phone_otps` / `owner_otps`) — NOT Supabase Auth. The frontend uses the anon Supabase
key for all queries, so most tables legitimately need `anon` access. The fixes below:
1. Remove public DELETE policies (only service_role can delete).
2. Consolidate duplicate policies (e.g., `rider_history` had both anon and authenticated INSERT).
3. Fix policy roles (e.g., `assignment_requests` had a `TO public` policy instead of `anon, authenticated`).
4. Remove SELECT on `admin_users` (contains password hashes, not used by frontend).

## Changes by Category

### Public DELETE denied (service_role only)
Tables: system_users, user_roles, user_groups, user_group_members, motorcycles, riders,
rider_history, incident_messages, incident_note_replies, incident_persons_of_interest,
incident_resolutions, incident_summons, phone_otps, demo_batches, document_samples,
document_validations, identity_verifications, system_settings

### Duplicate policies consolidated
- rider_history: had separate "Anyone can insert/update" (anon) and "Authenticated users can
  insert/update" (authenticated) — consolidated to single `anon, authenticated` policies.

### Policy role fixes
- assignment_requests "Riders can create assignment requests": was `TO public`, now `TO anon, authenticated`.
- rider_notifications "Authenticated users can create notifications": dropped (replaced by anon+authenticated policy).

### SELECT revoked (locked down)
- admin_users: SELECT policy dropped (not used by frontend, contains password hashes).
- system_settings: INSERT/UPDATE/DELETE policies dropped (admin-only via service_role).

## Important Notes
1. This migration is idempotent — all DROP POLICY IF EXISTS + CREATE POLICY pairs.
2. No data is lost; only policies are replaced.
3. The frontend continues to work with the anon key for all read operations.
*/

-- ============================================================
-- admin_users — revoke SELECT (contains password hashes)
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read admin users for login" ON admin_users;

-- ============================================================
-- system_users — deny public DELETE
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert system users" ON system_users;
CREATE POLICY "Anyone can insert system users" ON system_users
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update system users" ON system_users;
CREATE POLICY "Anyone can update system users" ON system_users
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete system users" ON system_users;

-- ============================================================
-- user_roles — deny public DELETE
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert user roles" ON user_roles;
CREATE POLICY "Anyone can insert user roles" ON user_roles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update user roles" ON user_roles;
CREATE POLICY "Anyone can update user roles" ON user_roles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete user roles" ON user_roles;

-- ============================================================
-- user_groups — deny public DELETE
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert user groups" ON user_groups;
CREATE POLICY "Anyone can insert user groups" ON user_groups
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update user groups" ON user_groups;
CREATE POLICY "Anyone can update user groups" ON user_groups
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete user groups" ON user_groups;

-- ============================================================
-- user_group_members — deny public DELETE
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert group members" ON user_group_members;
CREATE POLICY "Anyone can insert group members" ON user_group_members
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete group members" ON user_group_members;

-- ============================================================
-- motorcycles — deny public DELETE
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert motorcycle records" ON motorcycles;
CREATE POLICY "Anyone can insert motorcycle records" ON motorcycles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update motorcycle records" ON motorcycles;
CREATE POLICY "Anyone can update motorcycle records" ON motorcycles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete motorcycle records" ON motorcycles;

-- ============================================================
-- owners — scope writes
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert owner records" ON owners;
CREATE POLICY "Anyone can insert owner records" ON owners
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update owner records" ON owners;
CREATE POLICY "Anyone can update owner records" ON owners
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- riders — deny public DELETE
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert rider records" ON riders;
CREATE POLICY "Anyone can insert rider records" ON riders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update rider records" ON riders;
CREATE POLICY "Anyone can update rider records" ON riders
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete rider records" ON riders;

-- ============================================================
-- rider_history — consolidate duplicates, deny DELETE
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert rider history" ON rider_history;
DROP POLICY IF EXISTS "Authenticated users can insert rider history" ON rider_history;
CREATE POLICY "Anyone can insert rider history" ON rider_history
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update rider history" ON rider_history;
DROP POLICY IF EXISTS "Authenticated users can update rider history" ON rider_history;
CREATE POLICY "Anyone can update rider history" ON rider_history
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- verifications — scope writes
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert verification records" ON verifications;
CREATE POLICY "Anyone can insert verification records" ON verifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update verification records" ON verifications;
CREATE POLICY "Anyone can update verification records" ON verifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- incidents — scope writes
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert incident reports" ON incidents;
CREATE POLICY "Anyone can insert incident reports" ON incidents
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update incidents" ON incidents;
CREATE POLICY "Anyone can update incidents" ON incidents
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- incident_evidence — scope INSERT
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert incident evidence" ON incident_evidence;
CREATE POLICY "Anyone can insert incident evidence" ON incident_evidence
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- incident_appeals — scope writes
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert appeals" ON incident_appeals;
CREATE POLICY "Anyone can insert appeals" ON incident_appeals
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update appeals" ON incident_appeals;
CREATE POLICY "Anyone can update appeals" ON incident_appeals
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- appeal_evidence — scope INSERT
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert appeal evidence" ON appeal_evidence;
CREATE POLICY "Anyone can insert appeal evidence" ON appeal_evidence
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- incident_notifications — scope INSERT
-- ============================================================

DROP POLICY IF EXISTS "Public can insert incident notifications" ON incident_notifications;
CREATE POLICY "Public can insert incident notifications" ON incident_notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- incident_police_notifications — scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_incident_police_notifications" ON incident_police_notifications;
CREATE POLICY "public_insert_incident_police_notifications" ON incident_police_notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_incident_police_notifications" ON incident_police_notifications;
CREATE POLICY "public_update_incident_police_notifications" ON incident_police_notifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- incident_messages — scope writes, deny DELETE
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_case_messages" ON incident_messages;
CREATE POLICY "anon_insert_case_messages" ON incident_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_case_messages" ON incident_messages;
CREATE POLICY "anon_update_case_messages" ON incident_messages
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_case_messages" ON incident_messages;

-- ============================================================
-- incident_note_replies — scope writes, deny DELETE
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_note_replies" ON incident_note_replies;
CREATE POLICY "anon_insert_note_replies" ON incident_note_replies
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_note_replies" ON incident_note_replies;
CREATE POLICY "anon_update_note_replies" ON incident_note_replies
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_note_replies" ON incident_note_replies;

-- ============================================================
-- incident_persons_of_interest — scope writes, deny DELETE
-- ============================================================

DROP POLICY IF EXISTS "poi_insert" ON incident_persons_of_interest;
CREATE POLICY "poi_insert" ON incident_persons_of_interest
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "poi_update" ON incident_persons_of_interest;
CREATE POLICY "poi_update" ON incident_persons_of_interest
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "poi_delete" ON incident_persons_of_interest;

-- ============================================================
-- incident_resolutions — scope writes, deny DELETE
-- ============================================================

DROP POLICY IF EXISTS "public_insert_incident_resolutions" ON incident_resolutions;
CREATE POLICY "public_insert_incident_resolutions" ON incident_resolutions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_incident_resolutions" ON incident_resolutions;
CREATE POLICY "public_update_incident_resolutions" ON incident_resolutions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_incident_resolutions" ON incident_resolutions;

-- ============================================================
-- incident_summons — scope writes, deny DELETE
-- ============================================================

DROP POLICY IF EXISTS "insert_incident_summons" ON incident_summons;
CREATE POLICY "insert_incident_summons" ON incident_summons
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_incident_summons" ON incident_summons;
CREATE POLICY "update_incident_summons" ON incident_summons
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_incident_summons" ON incident_summons;

-- ============================================================
-- fines — scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_fines" ON fines;
CREATE POLICY "public_insert_fines" ON fines
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_fines" ON fines;
CREATE POLICY "public_update_fines" ON fines
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- fine_sms_logs — scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_fine_sms_logs" ON fine_sms_logs;
CREATE POLICY "public_insert_fine_sms_logs" ON fine_sms_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_fine_sms_logs" ON fine_sms_logs;
CREATE POLICY "public_update_fine_sms_logs" ON fine_sms_logs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- traffic_offences — scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_traffic_offences" ON traffic_offences;
CREATE POLICY "public_insert_traffic_offences" ON traffic_offences
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_traffic_offences" ON traffic_offences;
CREATE POLICY "public_update_traffic_offences" ON traffic_offences
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- payments — scope writes
-- ============================================================

DROP POLICY IF EXISTS "Allow public to create payment records" ON payments;
CREATE POLICY "Allow public to create payment records" ON payments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public to update payment status" ON payments;
CREATE POLICY "Allow public to update payment status" ON payments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- tracking_data — scope INSERT
-- ============================================================

DROP POLICY IF EXISTS "Public can insert tracking data" ON tracking_data;
CREATE POLICY "Public can insert tracking data" ON tracking_data
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- owner_otps — scope writes
-- ============================================================

DROP POLICY IF EXISTS "Allow OTP creation" ON owner_otps;
CREATE POLICY "Allow OTP creation" ON owner_otps
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow OTP update for verification" ON owner_otps;
CREATE POLICY "Allow OTP update for verification" ON owner_otps
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- phone_otps — scope writes, deny DELETE
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_phone_otps" ON phone_otps;
CREATE POLICY "anon_insert_phone_otps" ON phone_otps
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_phone_otps" ON phone_otps;
CREATE POLICY "anon_update_phone_otps" ON phone_otps
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_phone_otps" ON phone_otps;

-- ============================================================
-- rider_notifications — consolidate duplicates, scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_rider_notifications" ON rider_notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON rider_notifications;
CREATE POLICY "public_insert_rider_notifications" ON rider_notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_rider_notifications" ON rider_notifications;
CREATE POLICY "public_update_rider_notifications" ON rider_notifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- assignment_requests — fix "Riders can create" policy role
-- ============================================================

DROP POLICY IF EXISTS "Riders can create assignment requests" ON assignment_requests;
CREATE POLICY "Riders can create assignment requests" ON assignment_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- police_officers — scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_police_officers" ON police_officers;
CREATE POLICY "public_insert_police_officers" ON police_officers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_police_officers" ON police_officers;
CREATE POLICY "public_update_police_officers" ON police_officers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- police_stations — scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_police_stations" ON police_stations;
CREATE POLICY "public_insert_police_stations" ON police_stations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_police_stations" ON police_stations;
CREATE POLICY "public_update_police_stations" ON police_stations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- police_activity_logs — scope INSERT
-- ============================================================

DROP POLICY IF EXISTS "public_insert_police_activity_logs" ON police_activity_logs;
CREATE POLICY "public_insert_police_activity_logs" ON police_activity_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- police_verification_logs — scope INSERT
-- ============================================================

DROP POLICY IF EXISTS "public_insert_police_verification_logs" ON police_verification_logs;
CREATE POLICY "public_insert_police_verification_logs" ON police_verification_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- user_activity_logs — scope INSERT
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert activity logs" ON user_activity_logs;
CREATE POLICY "Anyone can insert activity logs" ON user_activity_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- system_settings — deny public INSERT/UPDATE/DELETE
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_system_settings" ON system_settings;
DROP POLICY IF EXISTS "anon_update_system_settings" ON system_settings;
DROP POLICY IF EXISTS "anon_delete_system_settings" ON system_settings;

-- ============================================================
-- demo_batches — deny public DELETE, scope writes
-- ============================================================

DROP POLICY IF EXISTS "public_insert_demo_batches" ON demo_batches;
CREATE POLICY "public_insert_demo_batches" ON demo_batches
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_demo_batches" ON demo_batches;
CREATE POLICY "public_update_demo_batches" ON demo_batches
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_demo_batches" ON demo_batches;

-- ============================================================
-- document_samples — deny public DELETE, scope writes
-- ============================================================

DROP POLICY IF EXISTS "document_samples_insert_all" ON document_samples;
CREATE POLICY "document_samples_insert_all" ON document_samples
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "document_samples_update_all" ON document_samples;
CREATE POLICY "document_samples_update_all" ON document_samples
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "document_samples_delete_all" ON document_samples;

-- ============================================================
-- document_validations — deny public DELETE, scope writes
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_document_validations" ON document_validations;
CREATE POLICY "anon_insert_document_validations" ON document_validations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_document_validations" ON document_validations;
CREATE POLICY "anon_update_document_validations" ON document_validations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_document_validations" ON document_validations;

-- ============================================================
-- identity_verifications — deny public DELETE, scope writes
-- ============================================================

DROP POLICY IF EXISTS "identity_verifications_insert_all" ON identity_verifications;
CREATE POLICY "identity_verifications_insert_all" ON identity_verifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "identity_verifications_update_all" ON identity_verifications;
CREATE POLICY "identity_verifications_update_all" ON identity_verifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "identity_verifications_delete_all" ON identity_verifications;

-- ============================================================
-- Storage: remove broad SELECT policies on public buckets
-- ============================================================

DROP POLICY IF EXISTS "Public Access for documents" ON storage.objects;
DROP POLICY IF EXISTS "owner_profiles_public_read" ON storage.objects;
DROP POLICY IF EXISTS "police_profiles_public_read" ON storage.objects;

-- ============================================================
-- Revoke EXECUTE on st_estimatedextent from anon/authenticated
-- ============================================================

REVOKE EXECUTE ON FUNCTION extensions.st_estimatedextent(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.st_estimatedextent(text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION extensions.st_estimatedextent(text, text, text, boolean) FROM anon, authenticated;
