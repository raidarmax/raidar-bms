/*
  # Create gps_message_log table for tracker debugging

  Captures every parsed and unparsed frame from the TCP server so we can see
  exactly what the physical tracker is sending. Without this we have zero
  visibility beyond the pm2 process log — this table lets us query from
  anywhere and diagnose why GPS positions never land.

  Columns capture: remote address, phone number, JT/T-808 message id (both
  numeric and hex for search), serial number, raw body hex, parse status
  ("parsed", "parse_failed", "unhandled", "location_saved", "location_dropped"),
  and a free-text note describing why a parse or save was skipped.

  RLS: enabled. Service-role (server) inserts bypass RLS. anon/authenticated
  can read for the debug UI. No policy grants write to anon — only the
  server-side service key writes here.
*/

CREATE TABLE IF NOT EXISTS gps_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  remote_address text,
  phone_number text,
  message_id integer,
  message_id_hex text,
  serial_number integer,
  body_length integer,
  body_hex text,
  parse_status text NOT NULL DEFAULT 'parsed',
  parse_note text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gps_message_log_received_at_idx
  ON gps_message_log (received_at DESC);

CREATE INDEX IF NOT EXISTS gps_message_log_phone_number_idx
  ON gps_message_log (phone_number);

CREATE INDEX IF NOT EXISTS gps_message_log_message_id_idx
  ON gps_message_log (message_id);

ALTER TABLE gps_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_gps_message_log_authenticated"
  ON gps_message_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "read_gps_message_log_anon"
  ON gps_message_log FOR SELECT
  TO anon
  USING (true);
