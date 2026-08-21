/*
# Auto-correct GPS hemisphere sign at the database layer

The tracker's GPS parser was ignoring the N/S / E/W bits in the tracker
status flags and storing every reading with a positive latitude. That has
been fixed in the tracker service code, but until the running tracker
service is restarted it will keep inserting positive latitudes. This
migration also fixes the database trigger and adds a guard on
device_locations so bad hemisphere signs are self-corrected server-side
regardless of what the tracker service sends.

1. Trigger update
   - `sync_device_location_to_tracking_data` now flips the latitude sign
     when it looks like a Northern-hemisphere reading in Kenya
     (0 < latitude < 5). Kenya is south of the equator, so any positive
     small latitude is a misparsed row.

2. Row-level auto-fix on new inserts
   - New trigger `fix_device_location_hemisphere` runs BEFORE INSERT on
     `device_locations` and applies the same latitude flip. This protects
     the source table too so both `device_locations` and `tracking_data`
     stay accurate.
*/

CREATE OR REPLACE FUNCTION fix_device_location_hemisphere()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.latitude > 0 AND NEW.latitude < 5 THEN
    NEW.latitude := -NEW.latitude;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fix_device_location_hemisphere_trg ON device_locations;
CREATE TRIGGER fix_device_location_hemisphere_trg
BEFORE INSERT OR UPDATE ON device_locations
FOR EACH ROW
EXECUTE FUNCTION fix_device_location_hemisphere();

CREATE OR REPLACE FUNCTION sync_device_location_to_tracking_data()
RETURNS TRIGGER AS $$
DECLARE
  v_motorcycle_id uuid;
  v_latitude numeric;
BEGIN
  SELECT motorcycle_id INTO v_motorcycle_id
  FROM tracking_devices
  WHERE id = NEW.device_id;

  IF v_motorcycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_latitude := NEW.latitude;
  IF v_latitude IS NOT NULL AND v_latitude > 0 AND v_latitude < 5 THEN
    v_latitude := -v_latitude;
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
    v_latitude,
    NEW.longitude,
    NEW.speed,
    NEW.heading,
    NULL,
    NEW.timestamp,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
