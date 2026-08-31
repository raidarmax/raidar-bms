/*
  # Fix Security and Performance Issues

  ## 1. Add Missing Indexes for Foreign Keys
  - assignment_requests table: motorcycle_id, owner_id, previous_motorcycle_id, rider_id
  - motorcycles table: verified_by
  - owners table: payment_id
  - riders table: payment_id
  - system_users table: created_by
  - user_group_members table: added_by
  - user_groups table: default_role_id

  ## 2. Optimize RLS Policies
  - Fix incident_notifications policies to use optimized pattern
  - Remove duplicate permissive policies where they create conflicts

  ## 3. Remove Duplicate Indexes
  - Drop idx_appeal_evidence_appeal_id (keeping idx_appeal_evidence_appeal)

  ## 4. Fix Function Security
  - Set search_path for functions to prevent injection attacks

  ## Security Notes
  - Unused indexes kept intentionally for query optimization
  - revenue_summary SECURITY DEFINER is by design for aggregation
*/

-- 1. ADD MISSING FOREIGN KEY INDEXES

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assignment_requests_motorcycle_id') THEN
    CREATE INDEX idx_assignment_requests_motorcycle_id ON assignment_requests(motorcycle_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assignment_requests_owner_id') THEN
    CREATE INDEX idx_assignment_requests_owner_id ON assignment_requests(owner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assignment_requests_previous_motorcycle_id') THEN
    CREATE INDEX idx_assignment_requests_previous_motorcycle_id ON assignment_requests(previous_motorcycle_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assignment_requests_rider_id') THEN
    CREATE INDEX idx_assignment_requests_rider_id ON assignment_requests(rider_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_motorcycles_verified_by') THEN
    CREATE INDEX idx_motorcycles_verified_by ON motorcycles(verified_by);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_owners_payment_id') THEN
    CREATE INDEX idx_owners_payment_id ON owners(payment_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_riders_payment_id') THEN
    CREATE INDEX idx_riders_payment_id ON riders(payment_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_system_users_created_by') THEN
    CREATE INDEX idx_system_users_created_by ON system_users(created_by);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_group_members_added_by') THEN
    CREATE INDEX idx_user_group_members_added_by ON user_group_members(added_by);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_groups_default_role_id') THEN
    CREATE INDEX idx_user_groups_default_role_id ON user_groups(default_role_id);
  END IF;
END $$;

-- 2. OPTIMIZE RLS POLICIES

DROP POLICY IF EXISTS "Riders can view their own incident notifications" ON incident_notifications;
DROP POLICY IF EXISTS "Riders can mark their notifications as read" ON incident_notifications;

CREATE POLICY "Riders can view their own incident notifications"
  ON incident_notifications
  FOR SELECT
  TO authenticated
  USING (
    user_type = 'rider' AND user_id IN (
      SELECT id FROM riders WHERE phone_number = (SELECT current_setting('request.jwt.claims', true)::json->>'phone_number')
    )
  );

CREATE POLICY "Riders can mark their notifications as read"
  ON incident_notifications
  FOR UPDATE
  TO authenticated
  USING (
    user_type = 'rider' AND user_id IN (
      SELECT id FROM riders WHERE phone_number = (SELECT current_setting('request.jwt.claims', true)::json->>'phone_number')
    )
  );

-- 3. REMOVE DUPLICATE POLICIES

DROP POLICY IF EXISTS "Anyone can upload appeal evidence" ON appeal_evidence;
DROP POLICY IF EXISTS "Anyone can view appeal evidence" ON appeal_evidence;
DROP POLICY IF EXISTS "Owners can view their own assignment requests" ON assignment_requests;
DROP POLICY IF EXISTS "Riders can view requests for them" ON assignment_requests;
DROP POLICY IF EXISTS "Anyone can update assignment requests" ON assignment_requests;

-- 4. REMOVE DUPLICATE INDEX
DROP INDEX IF EXISTS idx_appeal_evidence_appeal_id;

-- 5. FIX FUNCTION SEARCH PATHS

ALTER FUNCTION update_updated_at_column() SET search_path = pg_catalog, public;
ALTER FUNCTION generate_transaction_ref(text) SET search_path = pg_catalog, public;
ALTER FUNCTION check_motorcycle_compliance() SET search_path = pg_catalog, public;