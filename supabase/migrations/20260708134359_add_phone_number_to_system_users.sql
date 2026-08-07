/*
# Add phone_number to system_users

1. Modified Tables
   - `system_users`: adds a nullable `phone_number` text column for 2FA OTP delivery.

2. Notes
   - Column is nullable so existing accounts are not broken.
   - Seeds known phone numbers for the two existing admin accounts.
*/

ALTER TABLE system_users
ADD COLUMN IF NOT EXISTS phone_number text;

-- Seed phone numbers for known admin accounts
UPDATE system_users SET phone_number = '0722334955' WHERE username = 'admin';
UPDATE system_users SET phone_number = '0722720985' WHERE username = 'dominic';
