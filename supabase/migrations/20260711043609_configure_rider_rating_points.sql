/*
# Make rider rating points configurable via system_settings

Previously, the point values used to compute rider ratings (deductions for incidents,
fines, expired documents, bonuses for compliance, tier thresholds) were hard-coded
inside `recompute_rider_stats()`. This migration:

1. Inserts a new "rating" category of rows into `system_settings` for every point value.
2. Replaces `recompute_rider_stats()` so it reads each value dynamically from
   `system_settings` (falling back to the previous defaults if a row is missing).
3. Adds a trigger on `system_settings` so editing any rating value automatically
   recomputes every rider's score.
4. Runs a one-time backfill so scores align with the fresh settings.

Changes are additive — no columns dropped, no data lost. Idempotent.

## Settings inserted (category = 'rating')
Deductions (each represented as a positive integer that gets subtracted):
  - deduct_confirmed_incident (default 10)
  - deduct_pending_incident   (default 3)
  - deduct_unpaid_fine        (default 8)
  - deduct_paid_fine          (default 3)
  - deduct_license_expired    (default 20)
  - deduct_license_unverified (default 10)
  - deduct_id_unverified      (default 5)

Bonuses (added when the condition is met):
  - bonus_clean_record        (default 5)
  - bonus_compliance_paid     (default 5)
  - bonus_profile_complete    (default 5)

Tier thresholds (score must be >= threshold to earn the tier):
  - tier_excellent            (default 90)
  - tier_good                 (default 75)
  - tier_fair                 (default 60)
  - tier_poor                 (default 40)

## Security
No new tables. `system_settings` retains its existing RLS. Functions run
SECURITY INVOKER, so callers must already have SELECT rights on the settings
table (admins do via the existing policies).
*/

-- Helper to read an integer setting with a fallback
CREATE OR REPLACE FUNCTION get_int_setting(p_category text, p_key text, p_default int)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $fn$
DECLARE
  v_value text;
  v_int int;
BEGIN
  SELECT value INTO v_value
  FROM system_settings
  WHERE category = p_category AND key = p_key
  LIMIT 1;

  IF v_value IS NULL OR btrim(v_value) = '' THEN
    RETURN p_default;
  END IF;

  BEGIN
    v_int := v_value::int;
  EXCEPTION WHEN others THEN
    RETURN p_default;
  END;

  RETURN v_int;
END;
$fn$;

-- Seed the "rating" category rows (idempotent — only inserts missing ones)
INSERT INTO system_settings (category, key, value, label, description, is_secret)
VALUES
  ('rating', 'deduct_confirmed_incident', '10', 'Deduction per confirmed incident', 'Points removed for every incident that has been confirmed against the rider.', false),
  ('rating', 'deduct_pending_incident',   '3',  'Deduction per pending incident',   'Points removed while an incident against the rider is still under review.', false),
  ('rating', 'deduct_unpaid_fine',        '8',  'Deduction per unpaid fine',        'Points removed for every traffic fine that has not been settled.', false),
  ('rating', 'deduct_paid_fine',          '3',  'Deduction per paid fine',          'Points removed for every traffic fine, even after payment (fine history stays on record).', false),
  ('rating', 'deduct_license_expired',    '20', 'Deduction when licence expired',   'Points removed if the rider''s driving licence is past its expiry date.', false),
  ('rating', 'deduct_license_unverified', '10', 'Deduction when licence unverified','Points removed if the rider''s driving licence has not been verified.', false),
  ('rating', 'deduct_id_unverified',      '5',  'Deduction when ID unverified',     'Points removed if the rider''s national ID has not been verified.', false),
  ('rating', 'bonus_clean_record',        '5',  'Bonus for a clean record',         'Points awarded when the rider has zero incidents and zero fines.', false),
  ('rating', 'bonus_compliance_paid',     '5',  'Bonus for compliance fee paid',    'Points awarded when the rider''s annual compliance fee is paid.', false),
  ('rating', 'bonus_profile_complete',    '5',  'Bonus for a complete profile',     'Points awarded when the rider has uploaded a photo and set next-of-kin details.', false),
  ('rating', 'tier_excellent',            '90', 'Threshold — Excellent tier',       'Minimum score required to earn the Excellent rating badge.', false),
  ('rating', 'tier_good',                 '75', 'Threshold — Good tier',            'Minimum score required to earn the Good rating badge.', false),
  ('rating', 'tier_fair',                 '60', 'Threshold — Fair tier',            'Minimum score required to earn the Fair rating badge.', false),
  ('rating', 'tier_poor',                 '40', 'Threshold — Poor tier',            'Minimum score required to earn the Poor rating badge (below this = Very Poor).', false)
ON CONFLICT (category, key) DO NOTHING;

-- Rewrite recompute_rider_stats to read from system_settings
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
  d_conf int; d_pend int; d_unpaid int; d_paid int;
  d_lic_exp int; d_lic_unv int; d_id_unv int;
  b_clean int; b_comp int; b_profile int;
  t_exc int; t_good int; t_fair int; t_poor int;
BEGIN
  SELECT * INTO v_r FROM riders WHERE id = p_rider_id;
  IF NOT FOUND THEN RETURN; END IF;

  d_conf    := get_int_setting('rating', 'deduct_confirmed_incident', 10);
  d_pend    := get_int_setting('rating', 'deduct_pending_incident', 3);
  d_unpaid  := get_int_setting('rating', 'deduct_unpaid_fine', 8);
  d_paid    := get_int_setting('rating', 'deduct_paid_fine', 3);
  d_lic_exp := get_int_setting('rating', 'deduct_license_expired', 20);
  d_lic_unv := get_int_setting('rating', 'deduct_license_unverified', 10);
  d_id_unv  := get_int_setting('rating', 'deduct_id_unverified', 5);
  b_clean   := get_int_setting('rating', 'bonus_clean_record', 5);
  b_comp    := get_int_setting('rating', 'bonus_compliance_paid', 5);
  b_profile := get_int_setting('rating', 'bonus_profile_complete', 5);
  t_exc     := get_int_setting('rating', 'tier_excellent', 90);
  t_good    := get_int_setting('rating', 'tier_good', 75);
  t_fair    := get_int_setting('rating', 'tier_fair', 60);
  t_poor    := get_int_setting('rating', 'tier_poor', 40);

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
             - (v_confirmed * d_conf)
             - (v_pending * d_pend)
             - (v_unpaid_fines * d_unpaid)
             - (v_paid_fines * d_paid);

  IF v_license_expired THEN v_score := v_score - d_lic_exp; END IF;
  IF NOT COALESCE(v_r.license_verified, false) THEN v_score := v_score - d_lic_unv; END IF;
  IF NOT COALESCE(v_r.id_verified, false) THEN v_score := v_score - d_id_unv; END IF;

  IF v_total_incidents = 0 AND v_total_fines = 0 THEN v_score := v_score + b_clean; END IF;
  IF v_r.payment_status = 'Paid' THEN v_score := v_score + b_comp; END IF;
  IF v_profile_complete THEN v_score := v_score + b_profile; END IF;

  v_score := GREATEST(0, LEAST(100, v_score));

  v_tier := CASE
    WHEN v_score >= t_exc THEN 'excellent'
    WHEN v_score >= t_good THEN 'good'
    WHEN v_score >= t_fair THEN 'fair'
    WHEN v_score >= t_poor THEN 'poor'
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

-- Recompute all rider ratings when a rating setting changes
CREATE OR REPLACE FUNCTION trg_rating_settings_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.category = 'rating')
     OR (TG_OP = 'UPDATE' AND (NEW.category = 'rating' OR OLD.category = 'rating')
          AND (NEW.value IS DISTINCT FROM OLD.value))
     OR (TG_OP = 'DELETE' AND OLD.category = 'rating') THEN
    PERFORM recompute_all_rider_stats();
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS rating_settings_refresh ON system_settings;
CREATE TRIGGER rating_settings_refresh
AFTER INSERT OR UPDATE OR DELETE ON system_settings
FOR EACH ROW EXECUTE FUNCTION trg_rating_settings_refresh();

-- Backfill so any drift from prior manual tweaks is realigned
SELECT recompute_all_rider_stats();
