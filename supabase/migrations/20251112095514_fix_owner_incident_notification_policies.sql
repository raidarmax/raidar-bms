/*
  # Fix Owner Incident Notification Policies

  1. Changes
    - Drop incorrect owner RLS policies
    - Create correct policies that check owner_id matches the user_id in notifications

  2. Security
    - Owners can view notifications where user_id equals their owner ID
    - Owners can update notifications where user_id equals their owner ID
*/

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Owners can view their own incident notifications" ON incident_notifications;
DROP POLICY IF EXISTS "Owners can mark their notifications as read" ON incident_notifications;

-- Create correct policies
CREATE POLICY "Owners can view their own incident notifications"
  ON incident_notifications
  FOR SELECT
  TO authenticated
  USING (
    user_type = 'owner' AND 
    user_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners can mark their notifications as read"
  ON incident_notifications
  FOR UPDATE
  TO authenticated
  USING (
    user_type = 'owner' AND 
    user_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_type = 'owner' AND 
    user_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );