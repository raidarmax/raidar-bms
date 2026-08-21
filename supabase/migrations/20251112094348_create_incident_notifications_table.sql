/*
  # Create Incident Notifications System

  1. New Tables
    - `incident_notifications`
      - `id` (uuid, primary key)
      - `incident_id` (uuid, references incidents)
      - `user_type` (text) - 'rider' or 'owner'
      - `user_id` (uuid) - rider_id or owner_id
      - `is_read` (boolean) - whether notification has been read
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `incident_notifications` table
    - Add policies for riders to read their own notifications
    - Add policies for owners to read their own notifications
    - Add policy for authenticated users to update their own notifications (mark as read)

  3. Notes
    - Notifications are created when incidents are reported
    - Both rider and owner get notifications for their associated incidents
    - Users can mark notifications as read
*/

CREATE TABLE IF NOT EXISTS incident_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('rider', 'owner')),
  user_id uuid NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE incident_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can view their own incident notifications"
  ON incident_notifications
  FOR SELECT
  TO authenticated
  USING (
    user_type = 'rider' AND 
    user_id IN (SELECT id FROM riders WHERE owner_id = (SELECT id FROM owners WHERE user_id = auth.uid()))
  );

CREATE POLICY "Owners can view their own incident notifications"
  ON incident_notifications
  FOR SELECT
  TO authenticated
  USING (
    user_type = 'owner' AND 
    user_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

CREATE POLICY "Riders can mark their notifications as read"
  ON incident_notifications
  FOR UPDATE
  TO authenticated
  USING (
    user_type = 'rider' AND 
    user_id IN (SELECT id FROM riders WHERE owner_id = (SELECT id FROM owners WHERE user_id = auth.uid()))
  )
  WITH CHECK (
    user_type = 'rider' AND 
    user_id IN (SELECT id FROM riders WHERE owner_id = (SELECT id FROM owners WHERE user_id = auth.uid()))
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

CREATE POLICY "Public can insert incident notifications"
  ON incident_notifications
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_incident_notifications_user ON incident_notifications(user_type, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_incident_notifications_incident ON incident_notifications(incident_id);