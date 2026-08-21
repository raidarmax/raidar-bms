-- Backfill county_id / constituency_id / ward_id on incidents from their assigned station
UPDATE incidents i
SET
  county_id = COALESCE(i.county_id, s.county_id),
  constituency_id = COALESCE(i.constituency_id, s.constituency_id),
  ward_id = COALESCE(i.ward_id, s.ward_id)
FROM police_stations s
WHERE i.assigned_station_id = s.id
  AND (i.county_id IS NULL OR i.constituency_id IS NULL OR i.ward_id IS NULL);