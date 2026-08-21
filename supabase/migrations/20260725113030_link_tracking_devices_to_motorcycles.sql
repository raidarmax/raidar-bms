/*
  # Add motorcycle_id link to tracking_devices

  The existing `tracking_devices.vehicle_id` column references a separate
  `vehicles` table that is not used by the main app. We add a nullable
  `motorcycle_id` column that references the app's `motorcycles` table so
  the tracker can be tied to a real registered motorcycle, and so the
  location writer can populate `tracking_data` (keyed by motorcycle_id)
  and make positions show up on the map.

  Also index the column for the join used by the map.
*/

ALTER TABLE tracking_devices
  ADD COLUMN IF NOT EXISTS motorcycle_id uuid
    REFERENCES motorcycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tracking_devices_motorcycle_id_idx
  ON tracking_devices(motorcycle_id);
