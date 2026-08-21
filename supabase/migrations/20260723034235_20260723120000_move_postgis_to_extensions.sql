/*
# Move PostGIS to extensions schema

PostGIS does not support ALTER EXTENSION SET SCHEMA, so we drop and recreate it.
No user tables use geometry/geography columns, so CASCADE is safe.
*/

CREATE SCHEMA IF NOT EXISTS extensions;

DROP EXTENSION IF EXISTS postgis CASCADE;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
