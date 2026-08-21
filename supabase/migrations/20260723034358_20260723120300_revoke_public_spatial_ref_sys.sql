/*
# Revoke PUBLIC SELECT on spatial_ref_sys

PostGIS grants SELECT to PUBLIC during install. We need to revoke it
to prevent anon/authenticated from accessing spatial reference data.
*/

REVOKE SELECT ON TABLE extensions.spatial_ref_sys FROM PUBLIC;
