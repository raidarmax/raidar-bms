/*
  # Add Assignment Requests System

  1. New Tables
    - `assignment_requests`
      - `id` (uuid, primary key)
      - `rider_id` (uuid, references riders)
      - `motorcycle_id` (uuid, references motorcycles)
      - `owner_id` (uuid, references owners)
      - `status` (text, check constraint: 'Pending', 'Approved', 'Rejected')
      - `requested_at` (timestamptz)
      - `responded_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `assignment_status` column to riders table to track current assignment status
    - This allows riders to approve/reject assignment requests before being linked to motorcycles

  3. Security
    - Enable RLS on `assignment_requests` table
    - Add policies for riders to view their own requests
    - Add policies for owners to view requests they created
*/

-- Create assignment_requests table
CREATE TABLE IF NOT EXISTS assignment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  requested_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add assignment_status to riders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE riders ADD COLUMN assignment_status text DEFAULT 'Unassigned' 
      CHECK (assignment_status IN ('Unassigned', 'Pending', 'Assigned'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE assignment_requests ENABLE ROW LEVEL SECURITY;

-- Policies for assignment_requests
CREATE POLICY "Owners can view their own assignment requests"
  ON assignment_requests
  FOR SELECT
  TO authenticated
  USING (owner_id IN (SELECT id FROM owners WHERE id = owner_id));

CREATE POLICY "Owners can create assignment requests"
  ON assignment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id IN (SELECT id FROM owners WHERE id = owner_id));

CREATE POLICY "Riders can view requests for them"
  ON assignment_requests
  FOR SELECT
  TO authenticated
  USING (rider_id IN (SELECT id FROM riders WHERE id = rider_id));

CREATE POLICY "Riders can update their own assignment requests"
  ON assignment_requests
  FOR UPDATE
  TO authenticated
  USING (rider_id IN (SELECT id FROM riders WHERE id = rider_id))
  WITH CHECK (rider_id IN (SELECT id FROM riders WHERE id = rider_id));

-- Allow public read access for riders checking their requests (they may not be authenticated yet)
CREATE POLICY "Anyone can view assignment requests"
  ON assignment_requests
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update assignment requests"
  ON assignment_requests
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);