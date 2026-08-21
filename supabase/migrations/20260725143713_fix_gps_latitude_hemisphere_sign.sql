/*
# Fix GPS latitude hemisphere sign for existing tracking rows

Kenya is south of the equator so its latitudes must be negative. The GPS
protocol parser was reading the raw latitude/longitude value as a signed
integer and ignoring the N/S and E/W bits in the tracker's status flags,
which caused Kenyan positions to be stored as positive latitude.

This migration cleans up the two tables the parser writes to.

1. Delete rows in device_locations that have obviously invalid coordinates
   (|latitude| > 90 or |longitude| > 180). These came from bit-shifted or
   truncated packets and can't be salvaged.

2. Flip the sign of any latitude that is a plausible small positive
   number (0 < latitude < 5). Every tracker in this system operates in
   Kenya, whose entire area south of the equator falls in that range, so
   these rows are misparsed Northern-hemisphere readings.

3. Do the same clean-up on tracking_data (which is populated by the
   database trigger that copies rows out of device_locations).

Notes:
- No table structure changes.
- Longitudes for Kenya are already positive (East hemisphere) so no sign
  flip is applied to longitude, but out-of-range longitudes are still
  purged with the bad-latitude rows.
*/

DELETE FROM device_locations
WHERE ABS(latitude) > 90 OR ABS(longitude) > 180;

UPDATE device_locations
SET latitude = -latitude
WHERE latitude > 0 AND latitude < 5;

DELETE FROM tracking_data
WHERE ABS(latitude) > 90 OR ABS(longitude) > 180;

UPDATE tracking_data
SET latitude = -latitude
WHERE latitude > 0 AND latitude < 5;
