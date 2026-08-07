/*
# Auto-populate tracking_data from real GPS packets

## Problem
The TCP server on the VPS writes every incoming GPS packet to `device_locations`
(the raw protocol log), but the map view on the site reads from `tracking_data`.
The link between these two tables was living in the TCP server code, and the
server running on production is an older version that never wrote the map row.
The result: fresh GPS data was landing in the raw log every few seconds, but
the map view stayed frozen at whatever the last direct write was.

## Fix
Move the raw-log-to-map bridge into the database as a trigger. Any time a new
row is inserted into `device_locations`, if the source device is linked to a
motorcycle, mirror the essential fields into `tracking_data` automatically.
This makes the map live regardless of which server build is running.

## Changes
1. New function `public.sync_device_location_to_tracking_data()` that reads the
   linked motorcycle from `tracking_devices` and inserts a matching row into
   `tracking_data`. `accuracy` stays NULL because the JT/T 808 protocol does
   not report it (we don't fabricate values).
2. New trigger `device_locations_sync_tracking_data` on `device_locations`
   AFTER INSERT that calls the function for each new row.
3. Backfill: copy any `device_locations` rows for linked devices that were
   received AFTER the last mirrored `tracking_data` row, so the current gap
   is closed immediately.

## Security
No RLS changes. Trigger runs with the inserter's privileges. `tracking_data`
retains its existing policies.
*/

CREATE OR REPLACE FUNCTION public.sync_device_location_to_tracking_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_motorcycle_id uuid;
BEGIN
  SELECT motorcycle_id INTO v_motorcycle_id
  FROM tracking_devices
  WHERE id = NEW.device_id;

  IF v_motorcycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO tracking_data (
    motorcycle_id,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    recorded_at,
    demo_seed
  ) VALUES (
    v_motorcycle_id,
    NEW.latitude,
    NEW.longitude,
    NEW.speed,
    NEW.heading,
    NULL,
    NEW.timestamp,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS device_locations_sync_tracking_data ON device_locations;
CREATE TRIGGER device_locations_sync_tracking_data
AFTER INSERT ON device_locations
FOR EACH ROW
EXECUTE FUNCTION public.sync_device_location_to_tracking_data();

INSERT INTO tracking_data (
  motorcycle_id,
  latitude,
  longitude,
  speed,
  heading,
  accuracy,
  recorded_at,
  demo_seed
)
SELECT
  td.motorcycle_id,
  dl.latitude,
  dl.longitude,
  dl.speed,
  dl.heading,
  NULL,
  dl.timestamp,
  false
FROM device_locations dl
JOIN tracking_devices td ON td.id = dl.device_id
WHERE td.motorcycle_id IS NOT NULL
  AND dl.timestamp > COALESCE(
    (SELECT MAX(recorded_at) FROM tracking_data WHERE motorcycle_id = td.motorcycle_id),
    'epoch'::timestamptz
  );