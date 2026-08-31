/*
# Fix rebuild loop to carry prev-position state

The rebuild path (`rebuild_motorcycle_trips`) fed each historical point into
`_replay_trip_point`, which only looks at the active trip to find "where were
we last?". On the very first replay point there is no active trip, so
`v_prev_lat` was NULL and motion could never be detected — the second point
had nothing to compare against, so it also never created a trip, and so on.

Rewrite `rebuild_motorcycle_trips` to keep `prev_lat / prev_lng / prev_ts` in
local variables across the loop and run the detector inline. `_replay_trip_point`
is dropped — the trigger version handles live inserts already.
*/

DROP FUNCTION IF EXISTS public._replay_trip_point(uuid, double precision, double precision, double precision, timestamptz);

CREATE OR REPLACE FUNCTION public.rebuild_motorcycle_trips(p_motorcycle_id uuid DEFAULT NULL)
RETURNS TABLE (out_motorcycle_id uuid, trips_created integer, points_replayed integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_moto uuid;
  v_row record;
  v_trip_id uuid;
  v_trip_started_at timestamptz;
  v_trip_ended_at timestamptz;
  v_trip_distance double precision;
  v_trip_max_speed double precision;
  v_trip_point_count integer;
  v_trip_start_lat double precision;
  v_trip_start_lng double precision;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_prev_ts timestamptz;
  v_seg_m double precision;
  v_gap_s double precision;
  v_reported double precision;
  v_inferred double precision;
  v_effective double precision;
  v_moving boolean;
  v_moving_time double precision;
  v_points integer;
  v_count integer;
  STOP_S constant double precision := 90;
  MAX_GAP_S constant double precision := 900;
  MIN_KMH constant double precision := 3;
  MIN_M constant double precision := 15;
  TELEPORT_M constant double precision := 2000;
BEGIN
  FOR v_moto IN
    SELECT DISTINCT td.motorcycle_id
      FROM tracking_data td
     WHERE (p_motorcycle_id IS NULL OR td.motorcycle_id = p_motorcycle_id)
       AND td.recorded_at >= TIMESTAMPTZ '2020-01-01'
       AND td.latitude IS NOT NULL AND td.longitude IS NOT NULL
  LOOP
    DELETE FROM motorcycle_trips mt WHERE mt.motorcycle_id = v_moto;

    v_trip_id := NULL;
    v_prev_lat := NULL;
    v_prev_lng := NULL;
    v_prev_ts := NULL;
    v_points := 0;

    FOR v_row IN
      SELECT td.latitude, td.longitude, td.speed, td.recorded_at
        FROM tracking_data td
       WHERE td.motorcycle_id = v_moto
         AND td.recorded_at >= TIMESTAMPTZ '2020-01-01'
         AND td.latitude IS NOT NULL AND td.longitude IS NOT NULL
       ORDER BY td.recorded_at ASC
    LOOP
      v_points := v_points + 1;
      v_reported := COALESCE(v_row.speed, 0);

      IF v_prev_lat IS NULL THEN
        v_seg_m := 0;
        v_gap_s := 0;
        v_inferred := 0;
      ELSE
        v_seg_m := haversine_distance_m(v_prev_lat, v_prev_lng, v_row.latitude, v_row.longitude);
        v_gap_s := EXTRACT(EPOCH FROM (v_row.recorded_at - v_prev_ts));
        IF v_gap_s IS NULL OR v_gap_s <= 0 THEN
          v_inferred := 0;
          v_gap_s := 0;
        ELSIF v_seg_m > TELEPORT_M THEN
          v_inferred := 0;
          v_seg_m := 0;
        ELSE
          v_inferred := (v_seg_m / v_gap_s) * 3.6;
        END IF;
      END IF;

      v_effective := GREATEST(v_reported, v_inferred);
      v_moving := v_effective >= MIN_KMH AND v_seg_m >= MIN_M;

      IF v_trip_id IS NULL THEN
        IF v_moving THEN
          v_trip_started_at := COALESCE(v_prev_ts, v_row.recorded_at);
          v_trip_ended_at := v_row.recorded_at;
          v_trip_distance := v_seg_m;
          v_trip_max_speed := v_effective;
          v_trip_point_count := CASE WHEN v_prev_lat IS NOT NULL THEN 2 ELSE 1 END;
          v_trip_start_lat := COALESCE(v_prev_lat, v_row.latitude);
          v_trip_start_lng := COALESCE(v_prev_lng, v_row.longitude);

          INSERT INTO motorcycle_trips (
            motorcycle_id, started_at, ended_at, distance_meters,
            max_speed_kmh, avg_speed_kmh, point_count,
            start_lat, start_lng, end_lat, end_lng, status
          ) VALUES (
            v_moto, v_trip_started_at, v_trip_ended_at, v_trip_distance,
            v_trip_max_speed, v_trip_max_speed, v_trip_point_count,
            v_trip_start_lat, v_trip_start_lng, v_row.latitude, v_row.longitude,
            'active'
          )
          RETURNING id INTO v_trip_id;
        END IF;
      ELSE
        IF v_gap_s > MAX_GAP_S THEN
          UPDATE motorcycle_trips SET status = 'completed', ended_at = v_trip_ended_at WHERE id = v_trip_id;
          v_trip_id := NULL;

          IF v_moving THEN
            v_trip_started_at := v_row.recorded_at;
            v_trip_ended_at := v_row.recorded_at;
            v_trip_distance := 0;
            v_trip_max_speed := v_effective;
            v_trip_point_count := 1;
            v_trip_start_lat := v_row.latitude;
            v_trip_start_lng := v_row.longitude;

            INSERT INTO motorcycle_trips (
              motorcycle_id, started_at, ended_at, distance_meters,
              max_speed_kmh, avg_speed_kmh, point_count,
              start_lat, start_lng, end_lat, end_lng, status
            ) VALUES (
              v_moto, v_trip_started_at, v_trip_ended_at, v_trip_distance,
              v_trip_max_speed, v_trip_max_speed, v_trip_point_count,
              v_trip_start_lat, v_trip_start_lng, v_row.latitude, v_row.longitude,
              'active'
            )
            RETURNING id INTO v_trip_id;
          END IF;

        ELSIF NOT v_moving AND EXTRACT(EPOCH FROM (v_row.recorded_at - v_trip_ended_at)) > STOP_S THEN
          UPDATE motorcycle_trips SET status = 'completed', ended_at = v_trip_ended_at WHERE id = v_trip_id;
          v_trip_id := NULL;

        ELSE
          IF v_moving THEN
            v_trip_distance := v_trip_distance + v_seg_m;
          END IF;
          v_trip_max_speed := GREATEST(v_trip_max_speed, v_effective);
          v_trip_point_count := v_trip_point_count + 1;
          v_trip_ended_at := v_row.recorded_at;
          v_moving_time := EXTRACT(EPOCH FROM (v_row.recorded_at - v_trip_started_at));

          UPDATE motorcycle_trips
            SET end_lat = v_row.latitude,
                end_lng = v_row.longitude,
                ended_at = v_trip_ended_at,
                distance_meters = v_trip_distance,
                max_speed_kmh = v_trip_max_speed,
                point_count = v_trip_point_count,
                avg_speed_kmh = CASE WHEN v_moving_time > 0 THEN (v_trip_distance / v_moving_time) * 3.6 ELSE 0 END
            WHERE id = v_trip_id;
        END IF;
      END IF;

      v_prev_lat := v_row.latitude;
      v_prev_lng := v_row.longitude;
      v_prev_ts := v_row.recorded_at;
    END LOOP;

    -- Close any still-active trip left dangling by the tail of the data.
    IF v_trip_id IS NOT NULL THEN
      UPDATE motorcycle_trips SET status = 'completed', ended_at = v_trip_ended_at WHERE id = v_trip_id;
    END IF;

    SELECT COUNT(*) INTO v_count FROM motorcycle_trips mt WHERE mt.motorcycle_id = v_moto;
    out_motorcycle_id := v_moto;
    trips_created := v_count;
    points_replayed := v_points;
    RETURN NEXT;
  END LOOP;
END;
$$;

SELECT * FROM public.rebuild_motorcycle_trips(NULL);
