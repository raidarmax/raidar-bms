/*
# Expand incident resolution system

Adds a comprehensive resolution workflow so admins can triage reported incidents
and police can move them through a full investigate → resolve pipeline, with
finable offences optionally linking into the fines system.

## Incidents table changes
Adds:
  - resolution_outcome   (text)  — chosen outcome when police close a case
                                   (fined, warning, no_action, unfounded,
                                    referred_court, custodial, other)
  - resolution_summary   (text)  — public-facing summary of the outcome
  - resolved_by_officer_id (uuid FK police_officers) — officer who resolved it
  - resolved_at          (timestamptz)
  - closed_at            (timestamptz)
  - reopened_count       (int, default 0)
  - ignore_reason        (text) — reason admin dismissed the case
                                  (duplicate, not_credible, outside_jurisdiction,
                                   malicious, other)

Expands `incidents_police_status_check` to allow 'awaiting_evidence' and
'awaiting_appeal_review' so the workflow can pause without closing.

## New table: incident_resolutions
Structured timeline replacing the append-to-text `police_notes` blob. One row
per action (assignment, status change, note, evidence added, fine issued, case
closed). RLS allows public read/write, consistent with other tables in this
schema.

Columns:
  - id             (uuid PK)
  - incident_id    (uuid FK incidents ON DELETE CASCADE)
  - action_type    (text) — assigned, status_changed, note_added,
                            evidence_added, fine_issued, resolved,
                            reopened, closed
  - actor_type     (text) — admin, officer, system
  - actor_id       (uuid) — nullable
  - actor_name     (text)
  - from_status    (text)
  - to_status      (text)
  - notes          (text)
  - metadata       (jsonb)  — freeform payload (fine_id, offence_id, etc.)
  - created_at     (timestamptz default now())

## Fines table changes
Adds:
  - incident_id (uuid FK incidents ON DELETE SET NULL) — traces the source
                 incident when a fine is issued as a resolution
  - origin      (text default 'standalone') — 'standalone' | 'from_incident'

## Traffic offences table changes
Adds:
  - applicable_incident_types (text[] default '{}') — incident types this
    offence is a valid resolution for; empty means universal.
  - is_finable_default (boolean default true) — whether this offence should
    show up by default in the "issue fine" flow.

## Rating function fix
Patches `recompute_rider_stats(uuid)` so incidents in status 'ignored' or
'deleted' no longer inflate `v_total_incidents`, `v_confirmed`, `v_pending`,
`v_recent_confirmed`. This makes "mark ignored" truly stop the incident from
affecting the rider's score. Runs a full backfill afterwards.

Idempotent. No columns dropped. No data loss.
*/

-- 1) Incidents: new columns + expanded police_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='resolution_outcome') THEN
    ALTER TABLE incidents ADD COLUMN resolution_outcome text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='resolution_summary') THEN
    ALTER TABLE incidents ADD COLUMN resolution_summary text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='resolved_by_officer_id') THEN
    ALTER TABLE incidents ADD COLUMN resolved_by_officer_id uuid REFERENCES police_officers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='resolved_at') THEN
    ALTER TABLE incidents ADD COLUMN resolved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='closed_at') THEN
    ALTER TABLE incidents ADD COLUMN closed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='reopened_count') THEN
    ALTER TABLE incidents ADD COLUMN reopened_count int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='ignore_reason') THEN
    ALTER TABLE incidents ADD COLUMN ignore_reason text;
  END IF;
END $$;

-- Add resolution_outcome CHECK (drop first if exists, since we may be re-running)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_resolution_outcome_check') THEN
    ALTER TABLE incidents DROP CONSTRAINT incidents_resolution_outcome_check;
  END IF;
END $$;
ALTER TABLE incidents ADD CONSTRAINT incidents_resolution_outcome_check
  CHECK (resolution_outcome IS NULL OR resolution_outcome IN (
    'fined','warning','no_action','unfounded','referred_court','custodial','other'
  ));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_ignore_reason_check') THEN
    ALTER TABLE incidents DROP CONSTRAINT incidents_ignore_reason_check;
  END IF;
END $$;
ALTER TABLE incidents ADD CONSTRAINT incidents_ignore_reason_check
  CHECK (ignore_reason IS NULL OR ignore_reason IN (
    'duplicate','not_credible','outside_jurisdiction','malicious','other'
  ));

-- Expand police_status enum
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_police_status_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_police_status_check
  CHECK (police_status IS NULL OR police_status IN (
    'unassigned','assigned','investigating','awaiting_evidence',
    'awaiting_appeal_review','resolved','closed'
  ));

-- 2) incident_resolutions timeline table
CREATE TABLE IF NOT EXISTS incident_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  actor_name text,
  from_status text,
  to_status text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_resolutions_action_type_check') THEN
    ALTER TABLE incident_resolutions DROP CONSTRAINT incident_resolutions_action_type_check;
  END IF;
END $$;
ALTER TABLE incident_resolutions ADD CONSTRAINT incident_resolutions_action_type_check
  CHECK (action_type IN (
    'assigned','unassigned','status_changed','note_added','evidence_added',
    'fine_issued','resolved','reopened','closed','ignored','confirmed'
  ));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_resolutions_actor_type_check') THEN
    ALTER TABLE incident_resolutions DROP CONSTRAINT incident_resolutions_actor_type_check;
  END IF;
END $$;
ALTER TABLE incident_resolutions ADD CONSTRAINT incident_resolutions_actor_type_check
  CHECK (actor_type IN ('admin','officer','system','rider','reporter'));

CREATE INDEX IF NOT EXISTS idx_incident_resolutions_incident_id
  ON incident_resolutions(incident_id, created_at DESC);

ALTER TABLE incident_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_incident_resolutions" ON incident_resolutions;
CREATE POLICY "public_read_incident_resolutions" ON incident_resolutions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_incident_resolutions" ON incident_resolutions;
CREATE POLICY "public_insert_incident_resolutions" ON incident_resolutions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_incident_resolutions" ON incident_resolutions;
CREATE POLICY "public_update_incident_resolutions" ON incident_resolutions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_incident_resolutions" ON incident_resolutions;
CREATE POLICY "public_delete_incident_resolutions" ON incident_resolutions
  FOR DELETE TO anon, authenticated USING (true);

-- 3) Fines: incident_id + origin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fines' AND column_name='incident_id') THEN
    ALTER TABLE fines ADD COLUMN incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fines' AND column_name='origin') THEN
    ALTER TABLE fines ADD COLUMN origin text NOT NULL DEFAULT 'standalone';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fines_origin_check') THEN
    ALTER TABLE fines DROP CONSTRAINT fines_origin_check;
  END IF;
END $$;
ALTER TABLE fines ADD CONSTRAINT fines_origin_check
  CHECK (origin IN ('standalone','from_incident'));

CREATE INDEX IF NOT EXISTS idx_fines_incident_id ON fines(incident_id) WHERE incident_id IS NOT NULL;

-- 4) Traffic offences: applicable_incident_types + is_finable_default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='traffic_offences' AND column_name='applicable_incident_types') THEN
    ALTER TABLE traffic_offences ADD COLUMN applicable_incident_types text[] NOT NULL DEFAULT '{}'::text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='traffic_offences' AND column_name='is_finable_default') THEN
    ALTER TABLE traffic_offences ADD COLUMN is_finable_default boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Best-effort seed of applicable_incident_types on well-known offences
UPDATE traffic_offences SET applicable_incident_types = ARRAY['speeding','reckless_driving']
  WHERE applicable_incident_types = '{}' AND (offence_name ILIKE '%speed%' OR offence_code ILIKE '%SPD%');
UPDATE traffic_offences SET applicable_incident_types = ARRAY['no_helmet','reckless_driving']
  WHERE applicable_incident_types = '{}' AND (offence_name ILIKE '%helmet%' OR offence_code ILIKE '%HLM%');
UPDATE traffic_offences SET applicable_incident_types = ARRAY['overloading']
  WHERE applicable_incident_types = '{}' AND (offence_name ILIKE '%overload%' OR offence_name ILIKE '%passenger%');
UPDATE traffic_offences SET applicable_incident_types = ARRAY['reckless_driving','traffic_violation']
  WHERE applicable_incident_types = '{}' AND (offence_name ILIKE '%reckless%' OR offence_name ILIKE '%dangerous%');

-- 5) Fix recompute_rider_stats — exclude ignored/deleted from all counters
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

  -- Incidents counters: exclude ignored/deleted so admin dismissal really erases the record from rating
  SELECT
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status NOT IN ('ignored','deleted'))
  INTO v_confirmed, v_pending, v_total_incidents
  FROM incidents WHERE rider_id = p_rider_id;

  SELECT COUNT(*) INTO v_recent_confirmed
  FROM incidents
  WHERE rider_id = p_rider_id
    AND status = 'confirmed'
    AND created_at >= now() - interval '12 months';

  SELECT
    COUNT(*) FILTER (WHERE status = 'paid'),
    COUNT(*) FILTER (WHERE status = 'issued'),
    COUNT(*)
  INTO v_paid_fines, v_unpaid_fines, v_total_fines
  FROM fines WHERE rider_id = p_rider_id;

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

  v_score := 100
             - (v_confirmed * d_conf)
             - (v_pending * d_pend)
             - (v_unpaid_fines * d_unpaid)
             - (v_paid_fines * d_paid);

  IF v_license_expired THEN v_score := v_score - d_lic_exp; END IF;
  IF NOT v_license_expired AND v_license_expiring_soon THEN
    v_score := v_score - d_lic_soon;
  END IF;
  IF NOT COALESCE(v_r.license_verified, false) THEN v_score := v_score - d_lic_unv; END IF;
  IF NOT COALESCE(v_r.id_verified, false) THEN v_score := v_score - d_id_unv; END IF;

  IF v_r.good_conduct_url IS NULL THEN v_score := v_score - d_no_gc; END IF;
  IF v_r.kra_pin IS NULL OR btrim(v_r.kra_pin) = '' THEN v_score := v_score - d_no_kra; END IF;

  IF v_recent_confirmed >= 3 THEN v_score := v_score - d_repeat_inc; END IF;
  IF v_recent_fines >= 3 THEN v_score := v_score - d_repeat_fine; END IF;

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

-- 6) Backfill under the fixed formula
SELECT recompute_all_rider_stats();
