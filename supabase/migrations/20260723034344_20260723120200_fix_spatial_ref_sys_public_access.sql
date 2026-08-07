/*
# Fix spatial_ref_sys public access

The PostGIS extension creates spatial_ref_sys with a PUBLIC SELECT grant
(owned by supabase_admin). We cannot ALTER the table or REVOKE the grant
as postgres. Instead, we drop and recreate postgis so it's owned by the
migration role, then revoke PUBLIC SELECT.
*/

DROP EXTENSION IF EXISTS postgis CASCADE;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Now spatial_ref_sys should be owned by the migration role
-- Revoke PUBLIC SELECT
REVOKE SELECT ON extensions.spatial_ref_sys FROM PUBLIC;
