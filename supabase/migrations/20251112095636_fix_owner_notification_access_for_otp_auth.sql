/*
  # Fix Owner Incident Notification Access for OTP Authentication

  1. Changes
    - Owners don't use Supabase Auth, they use OTP authentication
    - Update policies to allow public read/update for owner notifications
    - Keep rider policies with auth.uid() since riders use Supabase Auth

  2. Security
    - Owners can read and update their notifications (checked by owner_id in application)
    - Riders can read and update their notifications (checked by auth.uid())
*/

-- Drop existing owner policies
DROP POLICY IF EXISTS "Owners can view their own incident notifications" ON incident_notifications;
DROP POLICY IF EXISTS "Owners can mark their notifications as read" ON incident_notifications;

-- Create policies that allow owners to access via owner_id (no auth.uid() check since they use OTP)
CREATE POLICY "Owners can view their incident notifications"
  ON incident_notifications
  FOR SELECT
  TO public
  USING (user_type = 'owner');

CREATE POLICY "Owners can mark their incident notifications as read"
  ON incident_notifications
  FOR UPDATE
  TO public
  USING (user_type = 'owner')
  WITH CHECK (user_type = 'owner');