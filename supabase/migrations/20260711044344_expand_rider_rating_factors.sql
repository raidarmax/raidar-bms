/*
# Expand rider rating factors

Adds more factors to the rider rating engine so admins can reward or penalize a
richer set of behaviours. All new factors are exposed as configurable point
values in `system_settings` (category = 'rating') and are consumed by
`recompute_rider_stats()`. Existing factors are unchanged; scores are
recomputed at the end so ratings reflect the expanded formula.

## New deductions
  - deduct_license_expiring_soon (default 5)  — licence expires within 30 days
  - deduct_no_good_conduct       (default 5)  — no good conduct certificate on file
  - deduct_no_kra_pin            (default 3)  — no KRA PIN registered
  - deduct_repeat_offender       (default 10) — 3+ confirmed incidents in the past 12 months
  - deduct_repeat_fined          (default 5)  — 3+ fines in the past 12 months

## New bonuses
  - bonus_good_conduct           (default 5) — good conduct certificate uploaded
  - bonus_kra_pin_verified       (default 3) — KRA PIN provided and verified
  - bonus_all_documents          (default 5) — ID copy + licence doc + good conduct all uploaded
  - bonus_sacco_member           (default 3) — SACCO membership on file
  - bonus_bms_issued             (default 3) — BMS card issued
  - bonus_assigned               (default 2) — currently assigned to a motorcycle
  - bonus_tenure_year            (default 5) — registered for more than 12 months
  - bonus_no_recent_incidents    (default 5) — no incidents in past 12 months
  - bonus_no_recent_fines        (default 5) — no fines in past 12 months

## Function changes
  - `recompute_rider_stats()` now reads the new settings and applies them.
  - Backfill runs at the end so every rider is scored under the new rules.

Idempotent. No columns dropped. No data loss.
*/

-- Seed new rating settings rows (idempotent — existing rows untouched)
INSERT INTO system_settings (category, key, value, label, description, is_secret)
VALUES
  ('rating', 'deduct_license_expiring_soon', '5',  'Deduction when licence expires soon', 'Points removed if the rider''s driving licence expires within the next 30 days.', false),
  ('rating', 'deduct_no_good_conduct',       '5',  'Deduction for missing good conduct', 'Points removed when the rider has not uploaded a police good conduct certificate.', false),
  ('rating', 'deduct_no_kra_pin',            '3',  'Deduction for missing KRA PIN',       'Points removed when the rider has no KRA PIN registered.', false),
  ('rating', 'deduct_repeat_offender',       '10', 'Deduction — repeat offender',         'Additional penalty applied when the rider has 3 or more confirmed incidents in the past 12 months.', false),
  ('rating', 'deduct_repeat_fined',          '5',  'Deduction — repeatedly fined',        'Additional penalty applied when the rider has 3 or more fines in the past 12 months.', false),
  ('rating', 'bonus_good_conduct',           '5',  'Bonus for good conduct on file',      'Points awarded when the rider has uploaded a police good conduct certificate.', false),
  ('rating', 'bonus_kra_pin_verified',       '3',  'Bonus for verified KRA PIN',          'Points awarded when the rider''s KRA PIN is provided and verified.', false),
  ('rating', 'bonus_all_documents',          '5',  'Bonus — all documents uploaded',      'Points awarded when ID copy, driving licence document, and good conduct certificate are all on file.', false),
  ('rating', 'bonus_sacco_member',           '3',  'Bonus — SACCO member',                'Points awarded when the rider is a member of a SACCO.', false),
  ('rating', 'bonus_bms_issued',             '3',  'Bonus — BMS card issued',             'Points awarded when the rider has been issued a BMS ID card.', false),
  ('rating', 'bonus_assigned',               '2',  'Bonus — actively assigned',           'Points awarded when the rider is currently assigned to a motorcycle.', false),
  ('rating', 'bonus_tenure_year',            '5',  'Bonus for long tenure',               'Points awarded when the rider has been registered for more than 12 months.', false),
  ('rating', 'bonus_no_recent_incidents',    '5',  'Bonus — no recent incidents',         'Points awarded when the rider has had zero incidents in the past 12 months.', false),
  ('rating', 'bonus_no_recent_fines',        '5',  'Bonus — no recent fines',             'Points awarded when the rider has had zero fines in the past 12 months.', false)
ON CONFLICT (category, key) DO NOTHING;

-- Rewrite recompute_rider_stats to include all new factors
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
  v_recent_confirmed int := 0;
  v_recent_fines int := 0;
  v_score int := 100;
  v_tier text := 'excellent';
  v_license_expired boolean := false;
  v_license_expiring_soon boolean := false;
  v_profile_complete boolean := false;
  v_docs_complete boolean := false;
  v_tenure_year boolean := false;

  d_conf int; d_pend int; d_unpaid int; d_paid int;
  d_lic_exp int; d_lic_unv int; d_id_unv int;
  d_lic_soon int; d_no_gc int; d_no_kra int;
  d_repeat_inc int; d_repeat_fine int;

  b_clean int; b_comp int; b_profile int;
  b_gc int; b_kra_v int; b_all_docs int;
  b_sacco int; b_bms int; b_assigned int;
  b_tenure int; b_no_recent_inc int; b_no_recent_fines int;

  t_exc int; t_good int; t_fair int; t_poor int;
BEGIN
  SELECT * INTO v_r FROM riders WHERE id = p_rider_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Load configurable points
  d_conf           := get_int_setting('rating', 'deduct_confirmed_incident', 10);
  d_pend           := get_int_setting('rating', 'deduct_pending_incident', 3);
  d_unpaid         := get_int_setting('rating', 'deduct_unpaid_fine', 8);
  d_paid           := get_int_setting('rating', 'deduct_paid_fine', 3);
  d_lic_exp        := get_int_setting('rating', 'deduct_license_expired', 20);
  d_lic_unv        := get_int_setting('rating', 'deduct_license_unverified', 10);
  d_id_unv         := get_int_setting('rating', 'deduct_id_unverified', 5);
  d_lic_soon       := get_int_setting('rating', 'deduct_license_expiring_soon', 5);
  d_no_gc          := get_int_setting('rating', 'deduct_no_good_conduct', 5);
  d_no_kra         := get_int_setting('rating', 'deduct_no_kra_pin', 3);
  d_repeat_inc     := get_int_setting('rating', 'deduct_repeat_offender', 10);
  d_repeat_fine    := get_int_setting('rating', 'deduct_repeat_fined', 5);

  b_clean          := get_int_setting('rating', 'bonus_clean_record', 5);
  b_comp           := get_int_setting('rating', 'bonus_compliance_paid', 5);
  b_profile        := get_int_setting('rating', 'bonus_profile_complete', 5);
  b_gc             := get_int_setting('rating', 'bonus_good_conduct', 5);
  b_kra_v          := get_int_setting('rating', 'bonus_kra_pin_verified', 3);
  b_all_docs       := get_int_setting('rating', 'bonus_all_documents', 5);
  b_sacco          := get_int_setting('rating', 'bonus_sacco_member', 3);
  b_bms            := get_int_setting('rating', 'bonus_bms_issued', 3);
  b_assigned       := get_int_setting('rating', 'bonus_assigned', 2);
  b_tenure         := get_int_setting('rating', 'bonus_tenure_year', 5);
  b_no_recent_inc  := get_int_setting('rating', 'bonus_no_recent_incidents', 5);
  b_no_recent_fines:= get_int_setting('rating', 'bonus_no_recent_fines', 5);

  t_exc  := get_int_setting('rating', 'tier_excellent', 90);
  t_good := get_int_setting('rating', 'tier_good', 75);
  t_fair := get_int_setting('rating', 'tier_fair', 60);
  t_poor := get_int_setting('rating', 'tier_poor', 40);

  -- Total incident counters
  SELECT
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*)
  INTO v_confirmed, v_pending, v_total_incidents
  FROM incidents WHERE rider_id = p_rider_id;

  -- Recent confirmed incidents (last 12 months)
  SELECT COUNT(*) INTO v_recent_confirmed
  FROM incidents
  WHERE rider_id = p_rider_id
    AND status = 'confirmed'
    AND created_at >= now() - interval '12 months';

  -- Total fine counters
  SELECT
    COUNT(*) FILTER (WHERE status = 'paid'),
    COUNT(*) FILTER (WHERE status = 'issued'),
    COUNT(*)
  INTO v_paid_fines, v_unpaid_fines, v_total_fines
  FROM fines WHERE rider_id = p_rider_id;

  -- Recent fines (last 12 months, based on issued_at)
  SELECT COUNT(*) INTO v_recent_fines
  FROM fines
  WHERE rider_id = p_rider_id
    AND issued_at >= now() - interval '12 months';

  v_license_expired := v_r.license_expiry IS NOT NULL AND v_r.license_expiry < CURRENT_DATE;
  v_license_expiring_soon := v_r.license_expiry IS NOT NULL
                             AND v_r.license_expiry >= CURRENT_DATE
                             AND v_r.license_expiry < CURRENT_DATE + interval '30 days';
  v_profile_complete := v_r.photo_url IS NOT NULL
                        AND v_r.next_of_kin_name IS NOT NULL
                        AND v_r.next_of_kin_phone IS NOT NULL;
  v_docs_complete := v_r.id_copy_url IS NOT NULL
                     AND v_r.license_url IS NOT NULL
                     AND v_r.good_conduct_url IS NOT NULL;
  v_tenure_year := v_r.created_at IS NOT NULL
                   AND v_r.created_at <= now() - interval '12 months';

  -- Baseline
  v_score := 100
             - (v_confirmed * d_conf)
             - (v_pending * d_pend)
             - (v_unpaid_fines * d_unpaid)
             - (v_paid_fines * d_paid);

  -- Licence / ID deductions
  IF v_license_expired THEN v_score := v_score - d_lic_exp; END IF;
  IF NOT v_license_expired AND v_license_expiring_soon THEN
    v_score := v_score - d_lic_soon;
  END IF;
  IF NOT COALESCE(v_r.license_verified, false) THEN v_score := v_score - d_lic_unv; END IF;
  IF NOT COALESCE(v_r.id_verified, false) THEN v_score := v_score - d_id_unv; END IF;

  -- Document / compliance gaps
  IF v_r.good_conduct_url IS NULL THEN v_score := v_score - d_no_gc; END IF;
  IF v_r.kra_pin IS NULL OR btrim(v_r.kra_pin) = '' THEN v_score := v_score - d_no_kra; END IF;

  -- Repeat-offender penalties (piled on top of per-item deductions)
  IF v_recent_confirmed >= 3 THEN v_score := v_score - d_repeat_inc; END IF;
  IF v_recent_fines >= 3 THEN v_score := v_score - d_repeat_fine; END IF;

  -- Bonuses
  IF v_total_incidents = 0 AND v_total_fines = 0 THEN v_score := v_score + b_clean; END IF;
  IF v_r.payment_status = 'Paid' THEN v_score := v_score + b_comp; END IF;
  IF v_profile_complete THEN v_score := v_score + b_profile; END IF;
  IF v_r.good_conduct_url IS NOT NULL THEN v_score := v_score + b_gc; END IF;
  IF v_r.kra_pin IS NOT NULL AND btrim(v_r.kra_pin) <> '' AND COALESCE(v_r.kra_pin_verified, false) THEN
    v_score := v_score + b_kra_v;
  END IF;
  IF v_docs_complete THEN v_score := v_score + b_all_docs; END IF;
  IF v_r.sacco_id IS NOT NULL AND btrim(v_r.sacco_id) <> '' THEN v_score := v_score + b_sacco; END IF;
  IF v_r.bms_id IS NOT NULL AND btrim(v_r.bms_id) <> '' THEN v_score := v_score + b_bms; END IF;
  IF v_r.assignment_status = 'Assigned' THEN v_score := v_score + b_assigned; END IF;
  IF v_tenure_year THEN v_score := v_score + b_tenure; END IF;
  IF v_recent_confirmed = 0 AND v_total_incidents > 0 THEN
    v_score := v_score + b_no_recent_inc;
  END IF;
  IF v_recent_fines = 0 AND v_total_fines > 0 THEN
    v_score := v_score + b_no_recent_fines;
  END IF;

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

-- Update the rider self-refresh trigger to cover the new fields it depends on
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
     OR (OLD.next_of_kin_phone IS DISTINCT FROM NEW.next_of_kin_phone)
     OR (OLD.good_conduct_url IS DISTINCT FROM NEW.good_conduct_url)
     OR (OLD.id_copy_url IS DISTINCT FROM NEW.id_copy_url)
     OR (OLD.license_url IS DISTINCT FROM NEW.license_url)
     OR (OLD.kra_pin IS DISTINCT FROM NEW.kra_pin)
     OR (OLD.kra_pin_verified IS DISTINCT FROM NEW.kra_pin_verified)
     OR (OLD.sacco_id IS DISTINCT FROM NEW.sacco_id)
     OR (OLD.bms_id IS DISTINCT FROM NEW.bms_id)
     OR (OLD.assignment_status IS DISTINCT FROM NEW.assignment_status) THEN
    PERFORM recompute_rider_stats(NEW.id);
  END IF;
  RETURN NULL;
END;
$fn$;

-- Backfill all riders under the expanded formula
SELECT recompute_all_rider_stats();
