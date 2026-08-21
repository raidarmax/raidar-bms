/*
# Tighten motorcycle trip GPS jitter/teleport thresholds

Some rebuilt trips had impossible peak speeds (>1000 km/h) because the raw
tracker data contained 500m–1500m single-fix jumps that fell under the old
2000m teleport guard. Tighten both the trigger and the rebuild path to:

- Treat any segment > 500m in one fix as a teleport (was 2000m).
- Additionally treat any inferred speed > 200 km/h as a teleport, so short
  jumps at implausible speeds don't accumulate distance or bump max_speed.
- Clamp `max_speed_kmh` to at most 200 defensively when the reported speed
  itself is bogus.

Then re-run the backfill so existing trips are recomputed with the stricter
rules.
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
  TELEPORT_M constant double precision := 500;
  MAX_REASONABLE_KMH constant double precision := 200;
BEGIN
  IF NEW.recorded_at IS NULL OR NEW.recorded_at < TIMESTAMPTZ '2020-01-01' THEN
    RETURN NEW;
  END IF;
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  v_reported_speed := LEAST(COALESCE(NEW.speed, 0), MAX_REASONABLE_KMH);

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
      IF v_inferred_speed > MAX_REASONABLE_KMH THEN
        v_inferred_speed := 0;
        v_segment_m := 0;
      END IF;
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
      v_new_max_speed := LEAST(GREATEST(v_trip.max_speed_kmh, v_effective_speed), MAX_REASONABLE_KMH);
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
  TELEPORT_M constant double precision := 500;
  MAX_REASONABLE_KMH constant double precision := 200;
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
      v_reported := LEAST(COALESCE(v_row.speed, 0), MAX_REASONABLE_KMH);

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
          IF v_inferred > MAX_REASONABLE_KMH THEN
            v_inferred := 0;
            v_seg_m := 0;
          END IF;
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
          v_trip_max_speed := LEAST(GREATEST(v_trip_max_speed, v_effective), MAX_REASONABLE_KMH);
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
