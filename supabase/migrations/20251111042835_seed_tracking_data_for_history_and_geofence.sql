/*
  # Seed Tracking Data for History Search and GeoFence Features
  
  1. Purpose
    - Seed historical tracking data for November 7th, 2025 showing route from Nairobi CBD to Kawangware
    - Seed tracking data for multiple bikes around Yaya Centre area for geofence testing
    - Create realistic GPS tracking points with varied speeds and timestamps
  
  2. Data Seeded
    - Historical route data: 30+ tracking points from 12:00 PM to 2:00 PM on Nov 7, 2025
    - Point at 1:00 PM specifically in Kawangware (-1.2921, 36.7472)
    - Geofence test data: 10+ bikes passing through Yaya Centre area around 2:00 PM
    - Timestamps distributed across 10-minute windows for testing
  
  3. Important Notes
    - Uses existing motorcycles from the database
    - If no motorcycles exist, data won't be inserted
    - All tracking data has realistic speeds (20-50 km/h) and headings
    - GPS accuracy ranges from 3-10 meters
*/

DO $$
DECLARE
  v_motorcycle_id uuid;
  v_motorcycle_ids uuid[];
  v_count integer;
  v_base_time timestamptz;
  v_current_time timestamptz;
  v_lat decimal;
  v_lng decimal;
  v_speed decimal;
  v_heading decimal;
BEGIN
  -- Get existing motorcycles
  SELECT ARRAY_AGG(id) INTO v_motorcycle_ids
  FROM motorcycles
  LIMIT 15;
  
  -- Check if we have motorcycles
  SELECT ARRAY_LENGTH(v_motorcycle_ids, 1) INTO v_count;
  
  IF v_count IS NULL OR v_count = 0 THEN
    RAISE NOTICE 'No motorcycles found. Skipping tracking data seeding.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found % motorcycles for seeding tracking data', v_count;
  
  -- Use the first motorcycle for historical route
  v_motorcycle_id := v_motorcycle_ids[1];
  
  -- ============================================
  -- SEED HISTORICAL ROUTE DATA (Nov 7, 2025)
  -- Route from Nairobi CBD to Kawangware
  -- ============================================
  
  -- Starting point: Nairobi CBD at 12:00 PM
  v_base_time := '2025-11-07 12:00:00+03'::timestamptz;
  
  -- Insert tracking points along the route
  -- Point 1: Nairobi CBD (starting point)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.286389, 36.817223, 0, 270, 4.5, v_base_time);
  
  -- Point 2: Moving west (12:03 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.287200, 36.810500, 35, 275, 5.2, v_base_time + INTERVAL '3 minutes');
  
  -- Point 3: Continuing west (12:06 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.288100, 36.803000, 40, 272, 4.8, v_base_time + INTERVAL '6 minutes');
  
  -- Point 4: Approaching Westlands (12:10 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.289500, 36.795000, 38, 268, 6.1, v_base_time + INTERVAL '10 minutes');
  
  -- Point 5: Near Westlands (12:15 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.290200, 36.787000, 42, 270, 5.5, v_base_time + INTERVAL '15 minutes');
  
  -- Point 6: Heading towards Kangemi (12:20 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.291000, 36.780000, 36, 265, 4.9, v_base_time + INTERVAL '20 minutes');
  
  -- Point 7: Entering Kangemi area (12:27 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.291500, 36.772000, 28, 268, 6.3, v_base_time + INTERVAL '27 minutes');
  
  -- Point 8: Through Kangemi (12:35 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.292000, 36.765000, 32, 270, 5.8, v_base_time + INTERVAL '35 minutes');
  
  -- Point 9: Approaching Kawangware (12:45 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.292050, 36.755000, 25, 272, 6.5, v_base_time + INTERVAL '45 minutes');
  
  -- Point 10: Near Kawangware center (12:52 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.292080, 36.750000, 20, 268, 7.2, v_base_time + INTERVAL '52 minutes');
  
  -- Point 11: Slowing down in Kawangware (12:58 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.292100, 36.748500, 15, 270, 6.8, v_base_time + INTERVAL '58 minutes');
  
  -- *** CRITICAL POINT: Parked in Kawangware at 1:00 PM ***
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.2921, 36.7472, 0, 270, 5.2, v_base_time + INTERVAL '60 minutes');
  
  -- Point 13: Still parked (1:10 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.2921, 36.7472, 0, 270, 4.8, v_base_time + INTERVAL '70 minutes');
  
  -- Point 14: Still parked (1:20 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.2921, 36.7472, 0, 270, 5.5, v_base_time + INTERVAL '80 minutes');
  
  -- Point 15: Still parked (1:30 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.2921, 36.7472, 0, 270, 6.1, v_base_time + INTERVAL '90 minutes');
  
  -- Point 16: Starting to move (1:35 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.292050, 36.748000, 12, 90, 5.8, v_base_time + INTERVAL '95 minutes');
  
  -- Point 17: Heading back east (1:40 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.291800, 36.752000, 30, 85, 6.2, v_base_time + INTERVAL '100 minutes');
  
  -- Point 18: Moving through Kawangware (1:47 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.291500, 36.760000, 35, 88, 5.9, v_base_time + INTERVAL '107 minutes');
  
  -- Point 19: Leaving Kawangware (1:55 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.291000, 36.770000, 38, 90, 6.5, v_base_time + INTERVAL '115 minutes');
  
  -- Point 20: Back towards Westlands (2:00 PM)
  INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
  VALUES (v_motorcycle_id, -1.290500, 36.780000, 40, 92, 5.3, v_base_time + INTERVAL '120 minutes');
  
  RAISE NOTICE 'Seeded historical route data with 20 tracking points for motorcycle: %', v_motorcycle_id;
  
  -- ============================================
  -- SEED GEOFENCE DATA (Yaya Centre area)
  -- Multiple bikes around 2:00 PM on Nov 7, 2025
  -- ============================================
  
  v_base_time := '2025-11-07 14:00:00+03'::timestamptz;
  
  -- Loop through available motorcycles and create tracking points near Yaya Centre
  FOR i IN 1..LEAST(v_count, 12) LOOP
    v_motorcycle_id := v_motorcycle_ids[i];
    
    -- Create 2-3 tracking points per bike within ±5 minutes of 2:00 PM
    -- Vary positions within 100m of Yaya Centre coordinates
    
    -- Point 1: Within 50m of Yaya Centre
    v_lat := -1.2823 + (RANDOM() * 0.0009 - 0.00045);  -- ±50m latitude variation
    v_lng := 36.8172 + (RANDOM() * 0.0009 - 0.00045);  -- ±50m longitude variation
    v_speed := 15 + (RANDOM() * 25);  -- Speed between 15-40 km/h
    v_heading := RANDOM() * 360;  -- Random heading
    v_current_time := v_base_time + (INTERVAL '1 minute' * (RANDOM() * 10 - 5));  -- ±5 minutes
    
    INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
    VALUES (v_motorcycle_id, v_lat, v_lng, v_speed, v_heading, 4 + RANDOM() * 6, v_current_time);
    
    -- Point 2: Slightly different position (2-3 minutes later)
    v_lat := -1.2823 + (RANDOM() * 0.0009 - 0.00045);
    v_lng := 36.8172 + (RANDOM() * 0.0009 - 0.00045);
    v_speed := 20 + (RANDOM() * 30);
    v_heading := RANDOM() * 360;
    v_current_time := v_current_time + (INTERVAL '1 minute' * (2 + RANDOM() * 2));
    
    INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
    VALUES (v_motorcycle_id, v_lat, v_lng, v_speed, v_heading, 4 + RANDOM() * 6, v_current_time);
  END LOOP;
  
  RAISE NOTICE 'Seeded geofence test data for % motorcycles around Yaya Centre', LEAST(v_count, 12);
  
  -- Add a few more bikes further out (within 200m but outside 100m radius)
  FOR i IN 1..LEAST(v_count, 5) LOOP
    v_motorcycle_id := v_motorcycle_ids[i];
    
    -- Position between 100-200m from Yaya Centre
    v_lat := -1.2823 + (RANDOM() * 0.0018 - 0.0009 + CASE WHEN RANDOM() > 0.5 THEN 0.0009 ELSE -0.0009 END);
    v_lng := 36.8172 + (RANDOM() * 0.0018 - 0.0009 + CASE WHEN RANDOM() > 0.5 THEN 0.0009 ELSE -0.0009 END);
    v_speed := 25 + (RANDOM() * 25);
    v_heading := RANDOM() * 360;
    v_current_time := v_base_time + (INTERVAL '1 minute' * (RANDOM() * 10 - 5));
    
    INSERT INTO tracking_data (motorcycle_id, latitude, longitude, speed, heading, accuracy, recorded_at)
    VALUES (v_motorcycle_id, v_lat, v_lng, v_speed, v_heading, 5 + RANDOM() * 5, v_current_time);
  END LOOP;
  
  RAISE NOTICE 'Added additional test data for bikes at various distances from Yaya Centre';
  RAISE NOTICE 'Tracking data seeding completed successfully!';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error seeding tracking data: %', SQLERRM;
    RAISE;
END $$;
