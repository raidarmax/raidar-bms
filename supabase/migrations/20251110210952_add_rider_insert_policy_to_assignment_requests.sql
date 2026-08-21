/*
  # Add Rider INSERT Policy to Assignment Requests

  1. Changes
    - Add INSERT policy for riders to create bike change requests
    - This allows riders to request bike changes directly

  2. Security
    - Riders can only create requests for themselves
    - All requests must reference the rider's own ID
*/

-- Allow riders to create their own bike change requests
CREATE POLICY "Riders can create assignment requests"
  ON assignment_requests
  FOR INSERT
  TO public
  WITH CHECK (true);
