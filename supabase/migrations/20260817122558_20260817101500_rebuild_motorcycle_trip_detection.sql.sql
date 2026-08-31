/*
# Rebuild motorcycle trip detection to work with real-world trackers

## Problem
The old trip detector required `speed >= 3 km/h` from the reported `speed` column
to decide the motorcycle was moving. In production every tracking_data row is
arriving with `speed = 0` because the fleet trackers only populate the JT/T 808
speed field intermittently. As a result no trip has ever been created despite
47,000+ positions in the table.

This migration rewrites the detector to infer motion from the actual movement
between two consecutive fixes (haversine distance / elapsed time), keeps the
reported speed as an additional signal, and filters out GPS jitter and
"pre-GPS-lock" default timestamps.

## Changes
1. Replaced `process_trip_on_tracking_insert()` with a motion-aware version.
2. New helper `_replay_trip_point()` that runs the same detector against
   explicit arguments (no NEW record needed).
3. New function `rebuild_motorcycle_trips(uuid)` that wipes and rebuilds every
   trip for one motorcycle (pass NULL for all).
4. Backfill: rebuild every existing motorcycle's trips at the end.
*/

CREATE OR REPLACE FUNCTION public.process_trip_on_tracking_insert()
RETURNS trigger AS $$
DECLARE
  v_trip record;
  v_reported_speed double precision;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_prev_ts timestamptz;
  v_gap_seconds double precision;
  v_segment_m double precision;
  v_inferred_speed double precision;
  v_effective_speed double precision;
  v_moving boolean;
  v_new_distance double precision;
  v_new_max_speed double precision;
  v_new_point_count integer;
  v_moving_time double precision;
  STOP_THRESHOLD_SECONDS constant double precision := 90;
  MAX_GAP_SECONDS constant double precision := 900;
  MOVING_SPEED_KMH constant double precision := 3;
  MIN_SEGMENT_M constant double precision := 15;
  TELEPORT_M constant double precision := 2000;
BEGIN
  IF NEW.recorded_at IS NULL OR NEW.recorded_at < TIMESTAMPTZ '2020-01-01' THEN
    RETURN NEW;
  END IF;
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  v_reported_speed := COALESCE(NEW.speed, 0);

  SELECT * INTO v_trip
    FROM motorcycle_trips mt
    WHERE mt.motorcycle_id = NEW.motorcycle_id
      AND mt.status = 'active'
    ORDER BY mt.started_at DESC
    LIMIT 1;

  IF v_trip IS NOT NULL THEN
    v_prev_lat := v_trip.end_lat;
    v_prev_lng := v_trip.end_lng;
    v_prev_ts := COALESCE(v_trip.ended_at, v_trip.started_at);
  ELSE
    SELECT td.latitude, td.longitude, td.recorded_at
      INTO v_prev_lat, v_prev_lng, v_prev_ts
      FROM tracking_data td
      WHERE td.motorcycle_id = NEW.motorcycle_id
        AND td.recorded_at < NEW.recorded_at
        AND td.recorded_at >= TIMESTAMPTZ '2020-01-01'
      ORDER BY td.recorded_at DESC
      LIMIT 1;
  END IF;

  IF v_prev_lat IS NOT NULL AND v_prev_ts IS NOT NULL THEN
    v_segment_m := haversine_distance_m(v_prev_lat, v_prev_lng, NEW.latitude, NEW.longitude);
    v_gap_seconds := EXTRACT(EPOCH FROM (NEW.recorded_at - v_prev_ts));
    IF v_gap_seconds IS NULL OR v_gap_seconds <= 0 THEN
      v_inferred_speed := 0;
      v_gap_seconds := 0;
    ELSIF v_segment_m > TELEPORT_M THEN
      v_inferred_speed := 0;
      v_segment_m := 0;
    ELSE
      v_inferred_speed := (v_segment_m / v_gap_seconds) * 3.6;
    END IF;
  ELSE
    v_segment_m := 0;
    v_gap_seconds := 0;
    v_inferred_speed := 0;
  END IF;

  v_effective_speed := GREATEST(v_reported_speed, v_inferred_speed);
  v_moving := v_effective_speed >= MOVING_SPEED_KMH AND v_segment_m >= MIN_SEGMENT_M;

  IF v_trip IS NULL THEN
    IF v_moving THEN
      INSERT INTO motorcycle_trips (
        motorcycle_id, started_at, ended_at, distance_meters,
        max_speed_kmh, avg_speed_kmh, point_count,
        start_lat, start_lng, end_lat, end_lng, status
      ) VALUES (
        NEW.motorcycle_id,
        COALESCE(v_prev_ts, NEW.recorded_at),
        NEW.recorded_at,
        v_segment_m,
        v_effective_speed,
        v_effective_speed,
        CASE WHEN v_prev_lat IS NOT NULL THEN 2 ELSE 1 END,
        COALESCE(v_prev_lat, NEW.latitude),
        COALESCE(v_prev_lng, NEW.longitude),
        NEW.latitude, NEW.longitude, 'active'
      );
    END IF;
  ELSE
    IF v_gap_seconds > MAX_GAP_SECONDS THEN
      UPDATE motorcycle_trips
        SET status = 'completed',
            ended_at = COALESCE(v_trip.ended_at, v_trip.started_at)
        WHERE id = v_trip.id;

      IF v_moving THEN
        INSERT INTO motorcycle_trips (
          motorcycle_id, started_at, ended_at, distance_meters,
          max_speed_kmh, avg_speed_kmh, point_count,
          start_lat, start_lng, end_lat, end_lng, status
        ) VALUES (
          NEW.motorcycle_id, NEW.recorded_at, NEW.recorded_at,
          0, v_effective_speed, v_effective_speed, 1,
          NEW.latitude, NEW.longitude, NEW.latitude, NEW.longitude, 'active'
        );
      END IF;

    ELSIF NOT v_moving AND EXTRACT(EPOCH FROM (NEW.recorded_at - v_trip.ended_at)) > STOP_THRESHOLD_SECONDS THEN
      UPDATE motorcycle_trips
        SET status = 'completed',
            ended_at = COALESCE(v_trip.ended_at, v_trip.started_at)
        WHERE id = v_trip.id;

    ELSE
      v_new_distance := v_trip.distance_meters + CASE WHEN v_moving THEN v_segment_m ELSE 0 END;
      v_new_max_speed := GREATEST(v_trip.max_speed_kmh, v_effective_speed);
      v_new_point_count := v_trip.point_count + 1;
      v_moving_time := EXTRACT(EPOCH FROM (NEW.recorded_at - v_trip.started_at));

      UPDATE motorcycle_trips
        SET end_lat = NEW.latitude,
            end_lng = NEW.longitude,
            ended_at = NEW.recorded_at,
            distance_meters = v_new_distance,
            max_speed_kmh = v_new_max_speed,
            point_count = v_new_point_count,
            avg_speed_kmh = CASE
              WHEN v_moving_time > 0 THEN (v_new_distance / v_moving_time) * 3.6
              ELSE 0
            END
        WHERE id = v_trip.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._replay_trip_point(
  p_motorcycle_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_speed double precision,
  p_recorded_at timestamptz
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip record;
  v_reported_speed double precision;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_prev_ts timestamptz;
  v_gap_seconds double precision;
  v_segment_m double precision;
  v_inferred_speed double precision;
  v_effective_speed double precision;
  v_moving boolean;
  v_new_distance double precision;
  v_new_max_speed double precision;
  v_new_point_count integer;
  v_moving_time double precision;
  STOP_THRESHOLD_SECONDS constant double precision := 90;
  MAX_GAP_SECONDS constant double precision := 900;
  MOVING_SPEED_KMH constant double precision := 3;
  MIN_SEGMENT_M constant double precision := 15;
  TELEPORT_M constant double precision := 2000;
BEGIN
  IF p_recorded_at IS NULL OR p_recorded_at < TIMESTAMPTZ '2020-01-01' THEN
    RETURN;
  END IF;

  v_reported_speed := COALESCE(p_speed, 0);

  SELECT * INTO v_trip
    FROM motorcycle_trips mt
    WHERE mt.motorcycle_id = p_motorcycle_id
      AND mt.status = 'active'
    ORDER BY mt.started_at DESC
    LIMIT 1;

  IF v_trip IS NOT NULL THEN
    v_prev_lat := v_trip.end_lat;
    v_prev_lng := v_trip.end_lng;
    v_prev_ts := COALESCE(v_trip.ended_at, v_trip.started_at);
  ELSE
    v_prev_lat := NULL;
    v_prev_lng := NULL;
    v_prev_ts := NULL;
  END IF;

  IF v_prev_lat IS NOT NULL AND v_prev_ts IS NOT NULL THEN
    v_segment_m := haversine_distance_m(v_prev_lat, v_prev_lng, p_latitude, p_longitude);
    v_gap_seconds := EXTRACT(EPOCH FROM (p_recorded_at - v_prev_ts));
    IF v_gap_seconds IS NULL OR v_gap_seconds <= 0 THEN
      v_inferred_speed := 0;
      v_gap_seconds := 0;
    ELSIF v_segment_m > TELEPORT_M THEN
      v_inferred_speed := 0;
      v_segment_m := 0;
    ELSE
      v_inferred_speed := (v_segment_m / v_gap_seconds) * 3.6;
    END IF;
  ELSE
    v_segment_m := 0;
    v_gap_seconds := 0;
    v_inferred_speed := 0;
  END IF;

  v_effective_speed := GREATEST(v_reported_speed, v_inferred_speed);
  v_moving := v_effective_speed >= MOVING_SPEED_KMH AND v_segment_m >= MIN_SEGMENT_M;

  IF v_trip IS NULL THEN
    IF v_moving THEN
      INSERT INTO motorcycle_trips (
        motorcycle_id, started_at, ended_at, distance_meters,
        max_speed_kmh, avg_speed_kmh, point_count,
        start_lat, start_lng, end_lat, end_lng, status
      ) VALUES (
        p_motorcycle_id,
        COALESCE(v_prev_ts, p_recorded_at),
        p_recorded_at,
        v_segment_m,
        v_effective_speed,
        v_effective_speed,
        CASE WHEN v_prev_lat IS NOT NULL THEN 2 ELSE 1 END,
        COALESCE(v_prev_lat, p_latitude),
        COALESCE(v_prev_lng, p_longitude),
        p_latitude, p_longitude, 'active'
      );
    END IF;
  ELSE
    IF v_gap_seconds > MAX_GAP_SECONDS THEN
      UPDATE motorcycle_trips
        SET status = 'completed',
            ended_at = COALESCE(v_trip.ended_at, v_trip.started_at)
        WHERE id = v_trip.id;

      IF v_moving THEN
        INSERT INTO motorcycle_trips (
          motorcycle_id, started_at, ended_at, distance_meters,
          max_speed_kmh, avg_speed_kmh, point_count,
          start_lat, start_lng, end_lat, end_lng, status
        ) VALUES (
          p_motorcycle_id, p_recorded_at, p_recorded_at,
          0, v_effective_speed, v_effective_speed, 1,
          p_latitude, p_longitude, p_latitude, p_longitude, 'active'
        );
      END IF;

    ELSIF NOT v_moving AND EXTRACT(EPOCH FROM (p_recorded_at - v_trip.ended_at)) > STOP_THRESHOLD_SECONDS THEN
      UPDATE motorcycle_trips
        SET status = 'completed',
            ended_at = COALESCE(v_trip.ended_at, v_trip.started_at)
        WHERE id = v_trip.id;

    ELSE
      v_new_distance := v_trip.distance_meters + CASE WHEN v_moving THEN v_segment_m ELSE 0 END;
      v_new_max_speed := GREATEST(v_trip.max_speed_kmh, v_effective_speed);
      v_new_point_count := v_trip.point_count + 1;
      v_moving_time := EXTRACT(EPOCH FROM (p_recorded_at - v_trip.started_at));

      UPDATE motorcycle_trips
        SET end_lat = p_latitude,
            end_lng = p_longitude,
            ended_at = p_recorded_at,
            distance_meters = v_new_distance,
            max_speed_kmh = v_new_max_speed,
            point_count = v_new_point_count,
            avg_speed_kmh = CASE
              WHEN v_moving_time > 0 THEN (v_new_distance / v_moving_time) * 3.6
              ELSE 0
            END
        WHERE id = v_trip.id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_motorcycle_trips(p_motorcycle_id uuid DEFAULT NULL)
RETURNS TABLE (out_motorcycle_id uuid, trips_created integer, points_replayed integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_moto uuid;
  v_row record;
  v_count integer;
  v_points integer;
BEGIN
  FOR v_moto IN
    SELECT DISTINCT td.motorcycle_id
      FROM tracking_data td
     WHERE p_motorcycle_id IS NULL OR td.motorcycle_id = p_motorcycle_id
  LOOP
    DELETE FROM motorcycle_trips mt WHERE mt.motorcycle_id = v_moto;
    v_points := 0;

    FOR v_row IN
      SELECT td.latitude, td.longitude, td.speed, td.recorded_at
        FROM tracking_data td
       WHERE td.motorcycle_id = v_moto
         AND td.recorded_at >= TIMESTAMPTZ '2020-01-01'
         AND td.latitude IS NOT NULL AND td.longitude IS NOT NULL
       ORDER BY td.recorded_at ASC
    LOOP
      PERFORM public._replay_trip_point(
        v_moto, v_row.latitude, v_row.longitude, v_row.speed, v_row.recorded_at
      );
      v_points := v_points + 1;
    END LOOP;

    SELECT COUNT(*) INTO v_count
      FROM motorcycle_trips mt
     WHERE mt.motorcycle_id = v_moto;

    out_motorcycle_id := v_moto;
    trips_created := v_count;
    points_replayed := v_points;
    RETURN NEXT;
  END LOOP;
END;
$$;

SELECT * FROM public.rebuild_motorcycle_trips(NULL);
