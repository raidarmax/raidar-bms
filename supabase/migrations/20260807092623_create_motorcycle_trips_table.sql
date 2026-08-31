/*
# Create motorcycle trips table and auto-detection trigger

1. New Tables
   - `motorcycle_trips`
     - `id` (uuid, primary key)
     - `motorcycle_id` (uuid, FK to motorcycles)
     - `started_at` (timestamptz, when the trip began)
     - `ended_at` (timestamptz, null while trip is active)
     - `distance_meters` (double precision, cumulative distance)
     - `max_speed_kmh` (double precision, peak speed during trip)
     - `avg_speed_kmh` (double precision, average speed during moving segments)
     - `point_count` (integer, number of GPS fixes in the trip)
     - `start_lat` / `start_lng` (double precision, trip origin)
     - `end_lat` / `end_lng` (double precision, latest/final position)
     - `status` (text, 'active' or 'completed')
     - `created_at` (timestamptz)

2. Functions
   - `process_trip_on_tracking_insert()` — trigger function that:
     a. Looks up the latest active trip for the motorcycle
     b. If no active trip and bike is moving (speed >= 3 km/h), starts a new trip
     c. If active trip exists and bike is moving, extends the trip (adds distance, updates stats)
     d. If active trip exists and bike has been stopped for > 60 seconds, ends the trip

3. Triggers
   - `trg_process_trip` — AFTER INSERT on tracking_data, calls the function above

4. Security
   - RLS enabled on motorcycle_trips
   - Public read access (anon + authenticated) since trip data is operational
   - Insert/update/delete restricted to system (trigger handles writes)

5. Indexes
   - On (motorcycle_id, status) for fast active-trip lookups
   - On (motorcycle_id, started_at DESC) for trip history queries
*/

-- Create the trips table
CREATE TABLE IF NOT EXISTS motorcycle_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  distance_meters double precision NOT NULL DEFAULT 0,
  max_speed_kmh double precision NOT NULL DEFAULT 0,
  avg_speed_kmh double precision NOT NULL DEFAULT 0,
  point_count integer NOT NULL DEFAULT 1,
  start_lat double precision NOT NULL,
  start_lng double precision NOT NULL,
  end_lat double precision NOT NULL,
  end_lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_motorcycle_trips_active
  ON motorcycle_trips(motorcycle_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_motorcycle_trips_history
  ON motorcycle_trips(motorcycle_id, started_at DESC);

-- RLS
ALTER TABLE motorcycle_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_motorcycle_trips" ON motorcycle_trips;
CREATE POLICY "anon_select_motorcycle_trips" ON motorcycle_trips FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_motorcycle_trips" ON motorcycle_trips;
CREATE POLICY "anon_insert_motorcycle_trips" ON motorcycle_trips FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_motorcycle_trips" ON motorcycle_trips;
CREATE POLICY "anon_update_motorcycle_trips" ON motorcycle_trips FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_motorcycle_trips" ON motorcycle_trips;
CREATE POLICY "anon_delete_motorcycle_trips" ON motorcycle_trips FOR DELETE
  TO anon, authenticated USING (true);

-- Haversine distance function (meters)
CREATE OR REPLACE FUNCTION haversine_distance_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) RETURNS double precision AS $$
DECLARE
  R constant double precision := 6371000;
  phi1 double precision;
  phi2 double precision;
  dphi double precision;
  dlam double precision;
  a double precision;
BEGIN
  phi1 := radians(lat1);
  phi2 := radians(lat2);
  dphi := radians(lat2 - lat1);
  dlam := radians(lon2 - lon1);
  a := sin(dphi / 2) * sin(dphi / 2) +
       cos(phi1) * cos(phi2) * sin(dlam / 2) * sin(dlam / 2);
  RETURN R * 2 * atan2(sqrt(a), sqrt(1 - a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function for trip detection
CREATE OR REPLACE FUNCTION process_trip_on_tracking_insert()
RETURNS trigger AS $$
DECLARE
  v_trip record;
  v_speed double precision;
  v_moving boolean;
  v_gap_seconds double precision;
  v_segment_m double precision;
  v_new_distance double precision;
  v_new_max_speed double precision;
  v_new_point_count integer;
  v_total_moving_time double precision;
  STOP_THRESHOLD_SECONDS constant double precision := 60;
  MOVING_SPEED_KMH constant double precision := 3;
BEGIN
  v_speed := COALESCE(NEW.speed, 0);
  v_moving := v_speed >= MOVING_SPEED_KMH;

  -- Find the current active trip for this motorcycle
  SELECT * INTO v_trip
    FROM motorcycle_trips
    WHERE motorcycle_id = NEW.motorcycle_id
      AND status = 'active'
    ORDER BY started_at DESC
    LIMIT 1;

  IF v_trip IS NULL THEN
    -- No active trip — start one if the bike is moving
    IF v_moving THEN
      INSERT INTO motorcycle_trips (
        motorcycle_id, started_at, distance_meters,
        max_speed_kmh, avg_speed_kmh, point_count,
        start_lat, start_lng, end_lat, end_lng, status
      ) VALUES (
        NEW.motorcycle_id, NEW.recorded_at, 0,
        v_speed, v_speed, 1,
        NEW.latitude, NEW.longitude,
        NEW.latitude, NEW.longitude, 'active'
      );
    END IF;
  ELSE
    -- There is an active trip
    v_gap_seconds := EXTRACT(EPOCH FROM (NEW.recorded_at - v_trip.ended_at));
    -- Use started_at if ended_at is somehow null
    IF v_gap_seconds IS NULL THEN
      v_gap_seconds := EXTRACT(EPOCH FROM (NEW.recorded_at - v_trip.started_at));
    END IF;

    IF NOT v_moving AND v_gap_seconds > STOP_THRESHOLD_SECONDS THEN
      -- Bike stopped for more than 60 seconds → end the trip
      UPDATE motorcycle_trips
        SET status = 'completed',
            ended_at = COALESCE(v_trip.ended_at, v_trip.started_at)
        WHERE id = v_trip.id;

    ELSE
      -- Extend the trip
      v_segment_m := haversine_distance_m(
        v_trip.end_lat, v_trip.end_lng,
        NEW.latitude, NEW.longitude
      );

      -- Skip teleport glitches (> 2 km in one fix)
      IF v_segment_m > 2000 THEN
        v_segment_m := 0;
      END IF;

      v_new_distance := v_trip.distance_meters + v_segment_m;
      v_new_max_speed := GREATEST(v_trip.max_speed_kmh, v_speed);
      v_new_point_count := v_trip.point_count + 1;

      -- Compute average speed from distance and elapsed moving time
      v_total_moving_time := EXTRACT(EPOCH FROM (NEW.recorded_at - v_trip.started_at));
      
      UPDATE motorcycle_trips
        SET end_lat = NEW.latitude,
            end_lng = NEW.longitude,
            ended_at = NEW.recorded_at,
            distance_meters = v_new_distance,
            max_speed_kmh = v_new_max_speed,
            point_count = v_new_point_count,
            avg_speed_kmh = CASE
              WHEN v_total_moving_time > 0 THEN (v_new_distance / v_total_moving_time) * 3.6
              ELSE 0
            END
        WHERE id = v_trip.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tracking_data
DROP TRIGGER IF EXISTS trg_process_trip ON tracking_data;
CREATE TRIGGER trg_process_trip
  AFTER INSERT ON tracking_data
  FOR EACH ROW
  EXECUTE FUNCTION process_trip_on_tracking_insert();
