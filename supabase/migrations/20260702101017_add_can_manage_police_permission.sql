ALTER TABLE user_roles ADD COLUMN can_manage_police boolean NOT NULL DEFAULT false;

-- Grant the permission to super_admin role
UPDATE user_roles SET can_manage_police = true WHERE role_name = 'super_admin';
