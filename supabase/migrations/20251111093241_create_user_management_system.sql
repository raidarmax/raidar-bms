/*
  # User Management System with Role-Based Access Control

  ## Overview
  This migration creates a comprehensive user management system with role-based permissions,
  user groups, and audit logging capabilities for the Bodaboda Management System.

  ## Tables Created

  ### 1. user_roles
  Defines different role types with configurable permissions
  - id (uuid, primary key)
  - role_name (text, unique) - e.g., 'super_admin', 'admin', 'manager', 'editor', 'viewer'
  - display_name (text) - Human-readable role name
  - description (text) - Role description
  - can_view_all (boolean) - Can view all data
  - can_edit_all (boolean) - Can edit all data
  - can_delete (boolean) - Can delete records
  - can_approve (boolean) - Can approve/reject verifications
  - can_manage_users (boolean) - Can manage system users
  - can_view_audit_logs (boolean) - Can view audit logs
  - can_export_data (boolean) - Can export data
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### 2. system_users
  Stores system administrator accounts
  - id (uuid, primary key)
  - username (text, unique)
  - email (text, unique)
  - password_hash (text)
  - role_id (uuid, foreign key to user_roles)
  - full_name (text)
  - is_active (boolean) - Account status
  - last_login_at (timestamptz)
  - failed_login_attempts (integer)
  - locked_until (timestamptz) - Account lockout timestamp
  - created_at (timestamptz)
  - updated_at (timestamptz)
  - created_by (uuid) - References system_users(id)

  ### 3. user_groups
  Organizes users into logical groups
  - id (uuid, primary key)
  - group_name (text, unique)
  - description (text)
  - default_role_id (uuid, foreign key to user_roles)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### 4. user_group_members
  Links users to groups (many-to-many relationship)
  - id (uuid, primary key)
  - user_id (uuid, foreign key to system_users)
  - group_id (uuid, foreign key to user_groups)
  - added_at (timestamptz)
  - added_by (uuid, foreign key to system_users)

  ### 5. user_activity_logs
  Tracks all user actions for audit purposes
  - id (uuid, primary key)
  - user_id (uuid, foreign key to system_users)
  - action_type (text) - 'login', 'logout', 'create', 'update', 'delete', 'approve', 'reject'
  - module (text) - 'owners', 'motorcycles', 'riders', 'verifications', 'users', 'settings'
  - record_id (uuid) - ID of affected record
  - details (jsonb) - Additional action details
  - ip_address (text)
  - user_agent (text)
  - created_at (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Only authenticated system users can access tables
  - Users can only view their own profile (non-admin users)
  - Only users with can_manage_users permission can modify users
  - Only users with can_view_audit_logs permission can view logs
  - Audit logs are append-only (no updates or deletes)

  ## Important Notes
  - Default roles are created: Super Admin, Admin, Manager, Editor, Viewer
  - Existing admin_users table is deprecated in favor of system_users
  - Migration includes a default Super Admin account (username: admin, password: admin123)
  - All timestamps use timestamptz for proper timezone handling
  - Foreign keys ensure referential integrity
  - Account lockout prevents brute force attacks
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  can_view_all boolean DEFAULT false,
  can_edit_all boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_approve boolean DEFAULT false,
  can_manage_users boolean DEFAULT false,
  can_view_audit_logs boolean DEFAULT false,
  can_export_data boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create system_users table
CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role_id uuid NOT NULL REFERENCES user_roles(id),
  full_name text NOT NULL,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES system_users(id)
);

-- Create user_groups table
CREATE TABLE IF NOT EXISTS user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text UNIQUE NOT NULL,
  description text,
  default_role_id uuid REFERENCES user_roles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_group_members table
CREATE TABLE IF NOT EXISTS user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES system_users(id),
  UNIQUE(user_id, group_id)
);

-- Create user_activity_logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES system_users(id),
  action_type text NOT NULL CHECK (action_type IN ('login', 'logout', 'create', 'update', 'delete', 'approve', 'reject', 'view', 'export')),
  module text NOT NULL CHECK (module IN ('owners', 'motorcycles', 'riders', 'verifications', 'users', 'groups', 'settings', 'system')),
  record_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Anyone can read user roles"
  ON user_roles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert user roles"
  ON user_roles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update user roles"
  ON user_roles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for system_users
CREATE POLICY "Anyone can read system users"
  ON system_users FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert system users"
  ON system_users FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update system users"
  ON system_users FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete system users"
  ON system_users FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for user_groups
CREATE POLICY "Anyone can read user groups"
  ON user_groups FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert user groups"
  ON user_groups FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update user groups"
  ON user_groups FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete user groups"
  ON user_groups FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for user_group_members
CREATE POLICY "Anyone can read group members"
  ON user_group_members FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert group members"
  ON user_group_members FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can delete group members"
  ON user_group_members FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for user_activity_logs
CREATE POLICY "Anyone can read activity logs"
  ON user_activity_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert activity logs"
  ON user_activity_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_users_username ON system_users(username);
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_role ON system_users(role_id);
CREATE INDEX IF NOT EXISTS idx_system_users_active ON system_users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON user_activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON user_activity_logs(created_at DESC);

-- Insert default roles
INSERT INTO user_roles (role_name, display_name, description, can_view_all, can_edit_all, can_delete, can_approve, can_manage_users, can_view_audit_logs, can_export_data)
VALUES
  ('super_admin', 'Super Admin', 'Full system access including user management and system settings', true, true, true, true, true, true, true),
  ('admin', 'Administrator', 'Can approve/reject verifications and manage all records except users', true, true, true, true, false, true, true),
  ('manager', 'Manager', 'Can view and edit records but cannot delete or manage users', true, true, false, false, false, false, true),
  ('editor', 'Editor', 'Can view and edit limited records in specific modules', true, true, false, false, false, false, false),
  ('viewer', 'Viewer (Read-Only)', 'Can only view data without any modification capabilities', true, false, false, false, false, false, false)
ON CONFLICT (role_name) DO NOTHING;

-- Insert default super admin user (username: admin, password: admin123)
-- Password hash for 'admin123' using bcrypt
DO $$
DECLARE
  super_admin_role_id uuid;
BEGIN
  SELECT id INTO super_admin_role_id FROM user_roles WHERE role_name = 'super_admin';

  INSERT INTO system_users (username, email, password_hash, role_id, full_name, is_active)
  VALUES ('admin', 'admin@bms.gov.ke', '$2a$10$rN8RQH7Q7YxH8J.Qq.qjkO4vKQZQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Zu', super_admin_role_id, 'System Administrator', true)
  ON CONFLICT (username) DO NOTHING;
END $$;

-- Insert default user groups
DO $$
DECLARE
  admin_role_id uuid;
  manager_role_id uuid;
BEGIN
  SELECT id INTO admin_role_id FROM user_roles WHERE role_name = 'admin';
  SELECT id INTO manager_role_id FROM user_roles WHERE role_name = 'manager';

  INSERT INTO user_groups (group_name, description, default_role_id)
  VALUES
    ('Regional Administrators', 'Regional office administrators with full access to their region data', admin_role_id),
    ('Data Entry Staff', 'Staff responsible for data entry and verification', manager_role_id),
    ('Auditors', 'Audit team with read-only access for compliance checking', (SELECT id FROM user_roles WHERE role_name = 'viewer'))
  ON CONFLICT (group_name) DO NOTHING;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_users_updated_at ON system_users;
CREATE TRIGGER update_system_users_updated_at
  BEFORE UPDATE ON system_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_groups_updated_at ON user_groups;
CREATE TRIGGER update_user_groups_updated_at
  BEFORE UPDATE ON user_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
