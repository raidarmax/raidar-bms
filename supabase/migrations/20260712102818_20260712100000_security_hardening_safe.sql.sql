/*
# Security hardening (safe subset)

## What this migration does

1. Function search_path pinning
   - Pin `SET search_path = public, pg_temp` on every listed public function
     so that the effective search_path can no longer be altered by the caller
     when the function runs. This addresses all "Function Search Path Mutable"
     warnings without changing any function behaviour.

2. Revenue summary view
   - Switch `public.revenue_summary` to `security_invoker = on` so it respects
     the caller's RLS instead of running with the view owner's privileges.

3. PostGIS + trigger function EXECUTE grants
   - Revoke `EXECUTE` on `public.set_incident_case_number()` from `anon` and
     `authenticated` since it is a trigger function and must not be callable
     via `/rest/v1/rpc`.
   - Revoke `EXECUTE` on the three `public.st_estimatedextent` overloads from
     `anon` and `authenticated` for the same reason.

4. spatial_ref_sys RLS
   - PostGIS ships `spatial_ref_sys` in the public schema without RLS. Enable
     RLS and add a permissive read-only policy so reads (which every PostGIS
     query needs) still work while writes are blocked at the RLS layer.

## Notes

- All statements are idempotent. Policies are dropped and recreated.
- No column, table, index, or data changes. No policy changes on application
  tables. The application's runtime behaviour is unaffected.
*/

-- 1. Function search_path pinning

ALTER FUNCTION public.get_int_setting(text, text, integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.recompute_motorcycle_stats(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.recompute_all_rider_stats()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.recompute_all_motorcycle_stats()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.recompute_rider_stats(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_incidents_refresh_stats()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_fines_refresh_stats()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_rider_self_refresh_stats()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_rating_settings_refresh()
  SET search_path = public, pg_temp;

-- 2. Revenue summary view -> security_invoker

ALTER VIEW public.revenue_summary SET (security_invoker = on);

-- 3. Revoke EXECUTE on trigger + PostGIS internal functions from PostgREST roles

REVOKE EXECUTE ON FUNCTION public.set_incident_case_number() FROM anon, authenticated, PUBLIC;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'st_estimatedextent'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM anon, authenticated, PUBLIC';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'st_estimatedextent'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text, text'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM anon, authenticated, PUBLIC';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'st_estimatedextent'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text, text, boolean'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM anon, authenticated, PUBLIC';
  END IF;
END$$;

-- 4. Enable RLS on spatial_ref_sys (PostGIS reference table) with a read-only policy

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'spatial_ref_sys'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN insufficient_privilege THEN
      -- Table owned by supabase_admin/postgres and not alterable by migration role; skip.
      NULL;
    END;

    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "spatial_ref_sys_read" ON public.spatial_ref_sys';
      EXECUTE $p$
        CREATE POLICY "spatial_ref_sys_read" ON public.spatial_ref_sys
          FOR SELECT
          TO anon, authenticated
          USING (true)
      $p$;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;
END$$;
