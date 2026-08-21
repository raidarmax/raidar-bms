/*
# Create Kenya Locality Reference Tables

## Overview
Creates hierarchical locality reference tables for Kenya's administrative structure.
These tables power cascading dropdowns throughout the system (registration forms, 
police stations, incident reporting, fine issuance).

## New Tables

1. **kenya_counties** - Kenya's 47 counties
   - `id` (integer, primary key)
   - `county_code` (integer, unique) - Official county code
   - `county_name` (text, unique) - County name

2. **kenya_constituencies** - Kenya's 290 constituencies
   - `id` (integer, primary key, auto-increment)
   - `constituency_name` (text)
   - `county_id` (integer, FK to kenya_counties)

3. **kenya_wards** - Kenya's 1,450 wards
   - `id` (integer, primary key, auto-increment)
   - `ward_name` (text)
   - `constituency_id` (integer, FK to kenya_constituencies)

## Security
- RLS enabled on all tables
- Public read access (needed for form dropdowns)
- No write access via public API (reference data only)

## Notes
- Data is seeded with a representative subset of counties, constituencies, and wards
- Full dataset can be loaded via admin tools later
- Indexes on all foreign keys and name fields for fast lookup
*/

-- Create kenya_counties table
CREATE TABLE IF NOT EXISTS kenya_counties (
  id integer PRIMARY KEY,
  county_code integer UNIQUE NOT NULL,
  county_name text UNIQUE NOT NULL
);

-- Create kenya_constituencies table
CREATE TABLE IF NOT EXISTS kenya_constituencies (
  id serial PRIMARY KEY,
  constituency_name text NOT NULL,
  county_id integer NOT NULL REFERENCES kenya_counties(id) ON DELETE CASCADE
);

-- Create kenya_wards table
CREATE TABLE IF NOT EXISTS kenya_wards (
  id serial PRIMARY KEY,
  ward_name text NOT NULL,
  constituency_id integer NOT NULL REFERENCES kenya_constituencies(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE kenya_counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE kenya_constituencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE kenya_wards ENABLE ROW LEVEL SECURITY;

-- Public read-only access
DROP POLICY IF EXISTS "public_read_counties" ON kenya_counties;
CREATE POLICY "public_read_counties" ON kenya_counties FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_constituencies" ON kenya_constituencies;
CREATE POLICY "public_read_constituencies" ON kenya_constituencies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_wards" ON kenya_wards;
CREATE POLICY "public_read_wards" ON kenya_wards FOR SELECT
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_constituencies_county ON kenya_constituencies(county_id);
CREATE INDEX IF NOT EXISTS idx_constituencies_name ON kenya_constituencies(constituency_name);
CREATE INDEX IF NOT EXISTS idx_wards_constituency ON kenya_wards(constituency_id);
CREATE INDEX IF NOT EXISTS idx_wards_name ON kenya_wards(ward_name);

-- Seed all 47 Kenya counties
INSERT INTO kenya_counties (id, county_code, county_name) VALUES
(1, 1, 'Mombasa'), (2, 2, 'Kwale'), (3, 3, 'Kilifi'), (4, 4, 'Tana River'),
(5, 5, 'Lamu'), (6, 6, 'Taita Taveta'), (7, 7, 'Garissa'), (8, 8, 'Wajir'),
(9, 9, 'Mandera'), (10, 10, 'Marsabit'), (11, 11, 'Isiolo'), (12, 12, 'Meru'),
(13, 13, 'Tharaka Nithi'), (14, 14, 'Embu'), (15, 15, 'Kitui'), (16, 16, 'Machakos'),
(17, 17, 'Makueni'), (18, 18, 'Nyandarua'), (19, 19, 'Nyeri'), (20, 20, 'Kirinyaga'),
(21, 21, 'Muranga'), (22, 22, 'Kiambu'), (23, 23, 'Turkana'), (24, 24, 'West Pokot'),
(25, 25, 'Samburu'), (26, 26, 'Trans Nzoia'), (27, 27, 'Uasin Gishu'),
(28, 28, 'Elgeyo Marakwet'), (29, 29, 'Nandi'), (30, 30, 'Baringo'),
(31, 31, 'Laikipia'), (32, 32, 'Nakuru'), (33, 33, 'Narok'), (34, 34, 'Kajiado'),
(35, 35, 'Kericho'), (36, 36, 'Bomet'), (37, 37, 'Kakamega'), (38, 38, 'Vihiga'),
(39, 39, 'Bungoma'), (40, 40, 'Busia'), (41, 41, 'Siaya'), (42, 42, 'Kisumu'),
(43, 43, 'Homa Bay'), (44, 44, 'Migori'), (45, 45, 'Kisii'), (46, 46, 'Nyamira'),
(47, 47, 'Nairobi')
ON CONFLICT (id) DO NOTHING;

-- Seed representative constituencies (key urban + rural areas)
INSERT INTO kenya_constituencies (id, constituency_name, county_id) VALUES
-- Nairobi (47)
(1, 'Westlands', 47), (2, 'Dagoretti North', 47), (3, 'Dagoretti South', 47),
(4, 'Langata', 47), (5, 'Kibra', 47), (6, 'Roysambu', 47),
(7, 'Kasarani', 47), (8, 'Ruaraka', 47), (9, 'Embakasi South', 47),
(10, 'Embakasi North', 47), (11, 'Embakasi Central', 47), (12, 'Embakasi East', 47),
(13, 'Embakasi West', 47), (14, 'Makadara', 47), (15, 'Kamukunji', 47),
(16, 'Starehe', 47), (17, 'Mathare', 47),
-- Mombasa (1)
(18, 'Changamwe', 1), (19, 'Jomvu', 1), (20, 'Kisauni', 1),
(21, 'Nyali', 1), (22, 'Likoni', 1), (23, 'Mvita', 1),
-- Kisumu (42)
(24, 'Kisumu East', 42), (25, 'Kisumu West', 42), (26, 'Kisumu Central', 42),
(27, 'Seme', 42), (28, 'Nyando', 42), (29, 'Muhoroni', 42), (30, 'Nyakach', 42),
-- Nakuru (32)
(31, 'Nakuru Town East', 32), (32, 'Nakuru Town West', 32), (33, 'Naivasha', 32),
(34, 'Gilgil', 32), (35, 'Subukia', 32), (36, 'Rongai', 32), (37, 'Bahati', 32),
(38, 'Molo', 32), (39, 'Njoro', 32), (40, 'Kuresoi North', 32), (41, 'Kuresoi South', 32),
-- Kiambu (22)
(42, 'Kiambu', 22), (43, 'Kiambaa', 22), (44, 'Kabete', 22),
(45, 'Githunguri', 22), (46, 'Juja', 22), (47, 'Thika Town', 22),
(48, 'Ruiru', 22), (49, 'Gatundu South', 22), (50, 'Gatundu North', 22),
(51, 'Limuru', 22), (52, 'Lari', 22),
-- Machakos (16)
(53, 'Machakos Town', 16), (54, 'Mavoko', 16), (55, 'Masinga', 16),
(56, 'Yatta', 16), (57, 'Kangundo', 16), (58, 'Matungulu', 16),
(59, 'Kathiani', 16), (60, 'Mwala', 16),
-- Kajiado (34)
(61, 'Kajiado North', 34), (62, 'Kajiado Central', 34), (63, 'Kajiado East', 34),
(64, 'Kajiado West', 34), (65, 'Kajiado South', 34),
-- Uasin Gishu (27)
(66, 'Ainabkoi', 27), (67, 'Kapseret', 27), (68, 'Kesses', 27),
(69, 'Moiben', 27), (70, 'Soy', 27), (71, 'Turbo', 27),
-- Nyeri (19)
(72, 'Nyeri Town', 19), (73, 'Tetu', 19), (74, 'Kieni', 19),
(75, 'Mathira', 19), (76, 'Othaya', 19), (77, 'Mukurweini', 19),
-- Kilifi (3)
(78, 'Kilifi North', 3), (79, 'Kilifi South', 3), (80, 'Kaloleni', 3),
(81, 'Rabai', 3), (82, 'Ganze', 3), (83, 'Malindi', 3), (84, 'Magarini', 3),
-- Kakamega (37)
(85, 'Lurambi', 37), (86, 'Navakholo', 37), (87, 'Mumias West', 37),
(88, 'Mumias East', 37), (89, 'Matungu', 37), (90, 'Butere', 37),
(91, 'Khwisero', 37), (92, 'Shinyalu', 37), (93, 'Ikolomani', 37),
(94, 'Likuyani', 37), (95, 'Lugari', 37), (96, 'Malava', 37)
ON CONFLICT (id) DO NOTHING;

-- Seed representative wards
INSERT INTO kenya_wards (id, ward_name, constituency_id) VALUES
-- Westlands (1)
(1, 'Kitisuru', 1), (2, 'Parklands/Highridge', 1), (3, 'Karura', 1),
(4, 'Kangemi', 1), (5, 'Mountain View', 1),
-- Dagoretti North (2)
(6, 'Kilimani', 2), (7, 'Kawangware', 2), (8, 'Gatina', 2),
(9, 'Kileleshwa', 2), (10, 'Kabiro', 2),
-- Langata (4)
(11, 'Karen', 4), (12, 'Nairobi West', 4), (13, 'Mugumo-ini', 4),
(14, 'South C', 4), (15, 'Nyayo Highrise', 4),
-- Kibra (5)
(16, 'Laini Saba', 5), (17, 'Lindi', 5), (18, 'Makina', 5),
(19, 'Woodley/Kenyatta Golf Course', 5), (20, 'Sarang''ombe', 5),
-- Kasarani (7)
(21, 'Clay City', 7), (22, 'Mwiki', 7), (23, 'Kasarani', 7),
(24, 'Njiru', 7), (25, 'Ruai', 7),
-- Starehe (16)
(26, 'Nairobi Central', 16), (27, 'Ngara', 16), (28, 'Pangani', 16),
(29, 'Ziwani/Kariokor', 16), (30, 'Landimawe', 16),
-- Embakasi South (9)
(31, 'Imara Daima', 9), (32, 'Kwa Njenga', 9), (33, 'Kwa Reuben', 9),
(34, 'Pipeline', 9), (35, 'Kware', 9),
-- Kisauni (20) - Mombasa
(36, 'Mjambere', 20), (37, 'Junda', 20), (38, 'Bamburi', 20),
(39, 'Mwakirunge', 20), (40, 'Mtopanga', 20), (41, 'Magogoni', 20),
-- Mvita (23) - Mombasa
(42, 'Mji wa Kale/Makadara', 23), (43, 'Tudor', 23), (44, 'Tononoka', 23),
(45, 'Shimanzi/Ganjoni', 23), (46, 'Majengo', 23),
-- Kisumu Central (26)
(47, 'Railways', 26), (48, 'Migosi', 26), (49, 'Shauri Moyo Kaloleni', 26),
(50, 'Market Milimani', 26), (51, 'Kondele', 26), (52, 'Nyalenda B', 26),
-- Nakuru Town East (31)
(53, 'Biashara', 31), (54, 'Kivumbini', 31), (55, 'Flamingo', 31),
(56, 'Menengai', 31), (57, 'Nakuru East', 31),
-- Nakuru Town West (32)
(58, 'Barut', 32), (59, 'London', 32), (60, 'Kaptembwa', 32),
(61, 'Rhoda', 32), (62, 'Shaabab', 32),
-- Thika Town (47)
(63, 'Township', 47), (64, 'Kamenu', 47), (65, 'Hospital', 47),
(66, 'Gatuanyaga', 47), (67, 'Ngoliba', 47),
-- Ruiru (48)
(68, 'Gitothua', 48), (69, 'Biashara', 48), (70, 'Gatongora', 48),
(71, 'Kahawa Sukari', 48), (72, 'Kahawa Wendani', 48), (73, 'Kiuu', 48),
-- Machakos Town (53)
(74, 'Kalama', 53), (75, 'Mua', 53), (76, 'Mutituni', 53),
(77, 'Machakos Central', 53), (78, 'Mumbuni North', 53),
-- Kajiado North (61)
(79, 'Ongata Rongai', 61), (80, 'Nkaimurunya', 61), (81, 'Oloolua', 61),
(82, 'Ngong', 61), (83, 'Olkeri', 61),
-- Kapseret (67) - Eldoret
(84, 'Simat/Kapseret', 67), (85, 'Langas', 67), (86, 'Megun', 67),
(87, 'Ngeria', 67),
-- Kilifi North (78)
(88, 'Mnarani', 78), (89, 'Kibarani', 78), (90, 'Dabaso', 78),
(91, 'Matsangoni', 78), (92, 'Watamu', 78), (93, 'Tezo', 78)
ON CONFLICT (id) DO NOTHING;