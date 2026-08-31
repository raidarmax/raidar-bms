/*
  # Create Rider Notifications Table

  1. New Tables
    - `rider_notifications`
      - `id` (uuid, primary key)
      - `rider_id` (uuid, foreign key to riders)
      - `type` (text) - notification type (e.g., 'removal', 'assignment')
      - `title` (text) - notification title
      - `message` (text) - notification message
      - `read` (boolean) - whether notification has been read
      - `metadata` (jsonb) - additional data (owner name, motorcycle registration, reason, etc.)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `rider_notifications` table
    - Add policy for riders to read their own notifications
    - Add policy for authenticated users to create notifications
*/

CREATE TABLE IF NOT EXISTS rider_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rider_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can view own notifications"
  ON rider_notifications
  FOR SELECT
  TO authenticated
  USING (rider_id IN (
    SELECT id FROM riders WHERE id = rider_id
  ));

CREATE POLICY "Riders can update own notifications"
  ON rider_notifications
  FOR UPDATE
  TO authenticated
  USING (rider_id IN (
    SELECT id FROM riders WHERE id = rider_id
  ))
  WITH CHECK (rider_id IN (
    SELECT id FROM riders WHERE id = rider_id
  ));

CREATE POLICY "Authenticated users can create notifications"
  ON rider_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rider_notifications_rider_id ON rider_notifications(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_notifications_read ON rider_notifications(read);
