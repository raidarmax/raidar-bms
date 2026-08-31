CREATE POLICY "insert_gps_message_log_anon"
  ON gps_message_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "insert_gps_message_log_authenticated"
  ON gps_message_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
