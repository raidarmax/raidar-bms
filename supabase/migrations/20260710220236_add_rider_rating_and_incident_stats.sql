/*
# Rider rating system and denormalized incident/fine stats

Introduces a comprehensive rating system for riders and denormalizes incident/fine
counters onto the riders and motorcycles rows so admin lists can order by incidents
without expensive joins on every request.

1. New columns
   - riders.pending_incident_count / confirmed_incident_count / total_fines_count / unpaid_fines_count
   - riders.rating_score (int, 0-100) / rating_tier (text) / rating_updated_at (timestamptz)
   - motorcycles.pending_incident_count / confirmed_incident_count / total_incident_count

2. New functions
   - recompute_rider_stats(uuid): recomputes counters + rating for one rider
   - recompute_motorcycle_stats(uuid): recomputes incident counters for one motorcycle
   - recompute_all_rider_stats() / recompute_all_motorcycle_stats(): full backfill

3. New triggers
   - After INSERT/UPDATE/DELETE on incidents: refresh both linked rider and motorcycle stats
   - After INSERT/UPDATE/DELETE on fines: refresh linked rider stats
   - After UPDATE on riders (license/id/payment fields) refresh that rider's rating

4. Rating scoring formula (start at 100, clamp 0-100)
   - Deductions
     - -10 per confirmed incident, -3 per pending incident (ignored incidents no penalty)
     - -8 per unpaid fine, -3 per paid fine
     - -20 if license expired, -10 if license not verified, -5 if id not verified
   - Bonuses
     - +5 clean record (zero incidents & fines)
     - +5 yearly compliance fee paid
     - +5 profile complete (photo + next of kin)
   - Tier bands: excellent >=90, good >=75, fair >=60, poor >=40, else very_poor

5. Security
   - Views/functions run as SECURITY INVOKER so RLS is respected.
   - Existing RLS on riders / motorcycles is unchanged. Rating columns are read via
     existing SELECT policies. There are no separate policies to add.

Notes
   1. All counters are backfilled once at migration time.
   2. Idempotent: safe to re-run.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='pending_incident_count') THEN
    ALTER TABLE riders ADD COLUMN pending_incident_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='confirmed_incident_count') THEN
    ALTER TABLE riders ADD COLUMN confirmed_incident_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='total_incident_count') THEN
    ALTER TABLE riders ADD COLUMN total_incident_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='total_fines_count') THEN
    ALTER TABLE riders ADD COLUMN total_fines_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='unpaid_fines_count') THEN
    ALTER TABLE riders ADD COLUMN unpaid_fines_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='rating_score') THEN
    ALTER TABLE riders ADD COLUMN rating_score integer NOT NULL DEFAULT 100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='rating_tier') THEN
    ALTER TABLE riders ADD COLUMN rating_tier text NOT NULL DEFAULT 'excellent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='rating_updated_at') THEN
    ALTER TABLE riders ADD COLUMN rating_updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='motorcycles' AND column_name='pending_incident_count') THEN
    ALTER TABLE motorcycles ADD COLUMN pending_incident_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='motorcycles' AND column_name='confirmed_incident_count') THEN
    ALTER TABLE motorcycles ADD COLUMN confirmed_incident_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='motorcycles' AND column_name='total_incident_count') THEN
    ALTER TABLE motorcycles ADD COLUMN total_incident_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_riders_rating_score ON riders(rating_score DESC);
CREATE INDEX IF NOT EXISTS idx_riders_pending_incidents ON riders(pending_incident_count DESC);
CREATE INDEX IF NOT EXISTS idx_motorcycles_pending_incidents ON motorcycles(pending_incident_count DESC);

CREATE OR REPLACE FUNCTION recompute_rider_stats(p_rider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE
  v_r riders%ROWTYPE;
  v_confirmed int := 0;
  v_pending int := 0;
  v_total_incidents int := 0;
  v_paid_fines int := 0;
  v_unpaid_fines int := 0;
  v_total_fines int := 0;
  v_score int := 100;
  v_tier text := 'excellent';
  v_license_expired boolean := false;
  v_profile_complete boolean := false;
BEGIN
  SELECT * INTO v_r FROM riders WHERE id = p_rider_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*)
  INTO v_confirmed, v_pending, v_total_incidents
  FROM incidents WHERE rider_id = p_rider_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'paid'),
    COUNT(*) FILTER (WHERE status = 'issued'),
    COUNT(*)
  INTO v_paid_fines, v_unpaid_fines, v_total_fines
  FROM fines WHERE rider_id = p_rider_id;

  v_license_expired := v_r.license_expiry IS NOT NULL AND v_r.license_expiry < CURRENT_DATE;
  v_profile_complete := v_r.photo_url IS NOT NULL
                        AND v_r.next_of_kin_name IS NOT NULL
                        AND v_r.next_of_kin_phone IS NOT NULL;

  v_score := 100
             - (v_confirmed * 10)
             - (v_pending * 3)
             - (v_unpaid_fines * 8)
             - (v_paid_fines * 3);

  IF v_license_expired THEN v_score := v_score - 20; END IF;
  IF NOT COALESCE(v_r.license_verified, false) THEN v_score := v_score - 10; END IF;
  IF NOT COALESCE(v_r.id_verified, false) THEN v_score := v_score - 5; END IF;

  IF v_total_incidents = 0 AND v_total_fines = 0 THEN v_score := v_score + 5; END IF;
  IF v_r.payment_status = 'Paid' THEN v_score := v_score + 5; END IF;
  IF v_profile_complete THEN v_score := v_score + 5; END IF;

  v_score := GREATEST(0, LEAST(100, v_score));

  v_tier := CASE
    WHEN v_score >= 90 THEN 'excellent'
    WHEN v_score >= 75 THEN 'good'
    WHEN v_score >= 60 THEN 'fair'
    WHEN v_score >= 40 THEN 'poor'
    ELSE 'very_poor'
  END;

  UPDATE riders SET
    pending_incident_count = v_pending,
    confirmed_incident_count = v_confirmed,
    total_incident_count = v_total_incidents,
    total_fines_count = v_total_fines,
    unpaid_fines_count = v_unpaid_fines,
    rating_score = v_score,
    rating_tier = v_tier,
    rating_updated_at = now()
  WHERE id = p_rider_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION recompute_motorcycle_stats(p_motorcycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE
  v_confirmed int := 0;
  v_pending int := 0;
  v_total int := 0;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*)
  INTO v_confirmed, v_pending, v_total
  FROM incidents WHERE motorcycle_id = p_motorcycle_id;

  UPDATE motorcycles SET
    pending_incident_count = v_pending,
    confirmed_incident_count = v_confirmed,
    total_incident_count = v_total
  WHERE id = p_motorcycle_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION recompute_all_rider_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM riders LOOP
    PERFORM recompute_rider_stats(r.id);
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION recompute_all_motorcycle_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE m record;
BEGIN
  FOR m IN SELECT id FROM motorcycles LOOP
    PERFORM recompute_motorcycle_stats(m.id);
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION trg_incidents_refresh_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.rider_id IS NOT NULL THEN PERFORM recompute_rider_stats(NEW.rider_id); END IF;
    IF NEW.motorcycle_id IS NOT NULL THEN PERFORM recompute_motorcycle_stats(NEW.motorcycle_id); END IF;
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    IF OLD.rider_id IS NOT NULL AND (TG_OP='DELETE' OR OLD.rider_id IS DISTINCT FROM NEW.rider_id) THEN
      PERFORM recompute_rider_stats(OLD.rider_id);
    END IF;
    IF OLD.motorcycle_id IS NOT NULL AND (TG_OP='DELETE' OR OLD.motorcycle_id IS DISTINCT FROM NEW.motorcycle_id) THEN
      PERFORM recompute_motorcycle_stats(OLD.motorcycle_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS incidents_refresh_stats ON incidents;
CREATE TRIGGER incidents_refresh_stats
AFTER INSERT OR UPDATE OR DELETE ON incidents
FOR EACH ROW EXECUTE FUNCTION trg_incidents_refresh_stats();

CREATE OR REPLACE FUNCTION trg_fines_refresh_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.rider_id IS NOT NULL THEN PERFORM recompute_rider_stats(NEW.rider_id); END IF;
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    IF OLD.rider_id IS NOT NULL AND (TG_OP='DELETE' OR OLD.rider_id IS DISTINCT FROM NEW.rider_id) THEN
      PERFORM recompute_rider_stats(OLD.rider_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS fines_refresh_stats ON fines;
CREATE TRIGGER fines_refresh_stats
AFTER INSERT OR UPDATE OR DELETE ON fines
FOR EACH ROW EXECUTE FUNCTION trg_fines_refresh_stats();

CREATE OR REPLACE FUNCTION trg_rider_self_refresh_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
BEGIN
  IF (OLD.license_expiry IS DISTINCT FROM NEW.license_expiry)
     OR (OLD.license_verified IS DISTINCT FROM NEW.license_verified)
     OR (OLD.id_verified IS DISTINCT FROM NEW.id_verified)
     OR (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     OR (OLD.photo_url IS DISTINCT FROM NEW.photo_url)
     OR (OLD.next_of_kin_name IS DISTINCT FROM NEW.next_of_kin_name)
     OR (OLD.next_of_kin_phone IS DISTINCT FROM NEW.next_of_kin_phone) THEN
    PERFORM recompute_rider_stats(NEW.id);
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS riders_self_refresh_stats ON riders;
CREATE TRIGGER riders_self_refresh_stats
AFTER UPDATE ON riders
FOR EACH ROW EXECUTE FUNCTION trg_rider_self_refresh_stats();

SELECT recompute_all_rider_stats();
SELECT recompute_all_motorcycle_stats();
