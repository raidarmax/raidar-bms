/*
# Create blocked_connections audit table

1. Purpose
   - Records TCP connections that were dropped because they did not speak the
     JT/T 808 GPS protocol (HTTP scanners, port probes, random junk).
   - Lets operators see who is probing the public tracker port without
     polluting the live `/api/debug` recent_packets feed.

2. New Tables
   - `blocked_connections`
     - `id` (uuid, primary key)
     - `remote_address` (text) - the source IP/port that connected
     - `reason` (text) - short machine-readable reason code
       (`http_probe`, `no_protocol_delimiter`, `oversized_junk`)
     - `first_bytes_hex` (text) - up to first 64 bytes received, hex-encoded
     - `first_bytes_ascii` (text) - printable ASCII rendering for readability
     - `byte_length` (int) - total bytes received before drop
     - `created_at` (timestamptz) - when the drop happened

3. Security
   - Enable RLS.
   - Allow anon + authenticated to SELECT (this is an ops/audit view,
     the data is metadata not user PII).
   - Only the service role writes here (via the Node TCP server), so we
     intentionally do NOT create an INSERT policy for anon/authenticated.

4. Indexes
   - `created_at DESC` for the "recent blocked traffic" view.
   - `remote_address` for grouping by source IP.
*/

CREATE TABLE IF NOT EXISTS blocked_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_address text NOT NULL,
  reason text NOT NULL,
  first_bytes_hex text NOT NULL DEFAULT '',
  first_bytes_ascii text NOT NULL DEFAULT '',
  byte_length integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE blocked_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_blocked_connections" ON blocked_connections;
CREATE POLICY "select_blocked_connections"
  ON blocked_connections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_blocked_connections_created_at
  ON blocked_connections (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_connections_remote_address
  ON blocked_connections (remote_address);
