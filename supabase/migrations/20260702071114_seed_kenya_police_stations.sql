/*
# Seed Kenya Police Stations

## Overview
Pre-loads the police_stations table with major police stations across Kenya,
mapped to their respective counties, constituencies, and wards where data is available.
Phone numbers sourced from publicly available Kenya Police Service directory.

## Data Added
- 60+ police stations across major counties
- Includes station name, code, type, county, phone number
- All marked as active
- Station codes follow format: COUNTY_CODE/STN_NUMBER

## Notes
- Data sourced from publicly available Kenya Police station listings
- Additional stations can be added by BMS admin via the Police Stations management UI
- GPS coordinates not included (can be added later)
*/

INSERT INTO police_stations (station_name, station_code, station_type, county_id, constituency_id, ward_id, phone_number, is_active) VALUES
-- Nairobi County (47)
('Nairobi Central Police Station', 'NBI/CEN/001', 'station', 47, 16, 26, '020-225685', true),
('Kilimani Police Station', 'NBI/KIL/001', 'station', 47, 2, 6, '020-2721683', true),
('Kasarani Police Station', 'NBI/KAS/001', 'station', 47, 7, 23, '020-8563222', true),
('Langata Police Station', 'NBI/LAN/001', 'station', 47, 4, 11, '020-603694', true),
('Karen Police Station', 'NBI/KAR/001', 'station', 47, 4, 11, '020-882538', true),
('Embakasi Police Station', 'NBI/EMB/001', 'station', 47, 9, 31, '020-823200', true),
('Buruburu Police Station', 'NBI/BUR/001', 'station', 47, 14, NULL, '020-786878', true),
('Kileleshwa Police Station', 'NBI/KLE/001', 'post', 47, 2, 9, '020-560533', true),
('Pangani Police Station', 'NBI/PAN/001', 'station', 47, 16, 28, '020-6760142', true),
('Parklands Police Station', 'NBI/PAR/001', 'station', 47, 1, 2, '020-3742238', true),
('Muthaiga Police Station', 'NBI/MUT/001', 'station', 47, 6, NULL, '020-3762611', true),
('Spring Valley Police Station', 'NBI/SPV/001', 'station', 47, 1, 1, '020-4181245', true),
('Jogoo Police Station', 'NBI/JOG/001', 'station', 47, 14, NULL, '020-557766', true),
('Kabete Police Station', 'NBI/KBT/001', 'station', 47, 44, NULL, '020-632222', true),
('Shauri Moyo Police Station', 'NBI/SHM/001', 'station', 47, 15, NULL, '020-652124', true),
('Industrial Area Police Station', 'NBI/IND/001', 'station', 47, 14, NULL, '020-557284', true),

-- Mombasa County (1)
('Mombasa Central Police Station', 'MSA/CEN/001', 'station', 1, 23, 42, '041-225501', true),
('Changamwe Police Station', 'MSA/CHG/001', 'station', 1, 18, NULL, '041-433700', true),
('Bamburi Police Station', 'MSA/BAM/001', 'station', 1, 20, 38, '041-5485316', true),
('Likoni Police Station', 'MSA/LIK/001', 'station', 1, 22, NULL, '041-451222', true),
('Nyali Police Station', 'MSA/NYL/001', 'station', 1, 21, NULL, '041-477555', true),
('Makupa Police Station', 'MSA/MAK/001', 'station', 1, 23, NULL, '041-491605', true),

-- Kisumu County (42)
('Kisumu Central Police Station', 'KSM/CEN/001', 'station', 42, 26, 47, '057-23594', true),
('Ahero Police Station', 'KSM/AHE/001', 'station', 42, 28, NULL, '057-821008', true),
('Nyando Police Station', 'KSM/NYD/001', 'station', 42, 28, NULL, '057-821167', true),

-- Nakuru County (32)
('Nakuru Police Station', 'NKR/CEN/001', 'station', 32, 31, 53, '051-2216597', true),
('Naivasha Police Station', 'NKR/NVS/001', 'station', 32, 33, NULL, '050-2030025', true),
('Gilgil Police Station', 'NKR/GIL/001', 'station', 32, 34, NULL, '050-4228', true),
('Njoro Police Station', 'NKR/NJR/001', 'station', 32, 39, NULL, '051-61106', true),
('Bahati Police Station', 'NKR/BAH/001', 'station', 32, 37, NULL, '051-52299', true),
('Subukia Police Station', 'NKR/SUB/001', 'station', 32, 35, NULL, '051-52024', true),
('Lanet Police Station', 'NKR/LAN/001', 'station', 32, 31, NULL, '051-850043', true),
('Molo Police Station', 'NKR/MOL/001', 'station', 32, 38, NULL, '051-5122086', true),
('Kaptembwa Police Station', 'NKR/KAP/001', 'station', 32, 32, 60, '051-213228', true),
('Menengai Police Station', 'NKR/MEN/001', 'station', 32, 31, 56, '051-343333', true),

-- Kiambu County (22)
('Kiambu Police Station', 'KBU/CEN/001', 'station', 22, 42, NULL, '066-22111', true),
('Thika Police Station', 'KBU/THK/001', 'station', 22, 47, 63, '067-31652', true),
('Ruiru Police Station', 'KBU/RUI/001', 'station', 22, 48, 68, '067-54260', true),
('Juja Police Station', 'KBU/JUJ/001', 'station', 22, 46, NULL, '067-52176', true),
('Githunguri Police Station', 'KBU/GTH/001', 'station', 22, 45, NULL, '066-65009', true),
('Kikuyu Police Station', 'KBU/KIK/001', 'station', 22, 44, NULL, '066-32022', true),
('Gatundu Police Station', 'KBU/GAT/001', 'station', 22, 49, NULL, '067-74212', true),
('Tigoni Police Station', 'KBU/TIG/001', 'station', 22, 51, NULL, '066-73222', true),

-- Machakos County (16)
('Machakos Police Station', 'MKS/CEN/001', 'station', 16, 53, 77, '044-22055', true),

-- Kajiado County (34)
('Kajiado Police Station', 'KJD/CEN/001', 'station', 34, 62, NULL, NULL, true),
('Ongata Rongai Police Station', 'KJD/ORG/001', 'station', 34, 61, 79, NULL, true),
('Ngong Police Station', 'KJD/NGN/001', 'station', 34, 61, 82, NULL, true),

-- Uasin Gishu County (27) - Eldoret
('Eldoret Police Station', 'UGS/ELD/001', 'station', 27, 67, 84, '053-2032900', true),
('Turbo Police Station', 'UGS/TUR/001', 'station', 27, 71, NULL, '053-53007', true),

-- Kilifi County (3)
('Kilifi Police Station', 'KLF/CEN/001', 'station', 3, 78, 88, '041-522368', true),
('Malindi Police Station', 'KLF/MAL/001', 'station', 3, 83, NULL, '042-20486', true),
('Watamu Police Station', 'KLF/WAT/001', 'post', 3, 78, 92, '042-32286', true),
('Mariakani Police Station', 'KLF/MRK/001', 'station', 3, 80, NULL, '041-33004', true),

-- Nyeri County (19)
('Nyeri Police Station', 'NYR/CEN/001', 'station', 19, 72, NULL, '061-2030555', true),
('Karatina Police Station', 'NYR/KAR/001', 'station', 19, 75, NULL, '061-72222', true),
('Othaya Police Station', 'NYR/OTH/001', 'station', 19, 76, NULL, '061-52004', true),
('Naromoru Police Station', 'NYR/NAR/001', 'station', 19, 74, NULL, '061-62003', true),

-- Kakamega County (37)
('Kakamega Police Station', 'KAK/CEN/001', 'station', 37, 85, NULL, '056-31486', true),
('Mumias Police Station', 'KAK/MUM/001', 'station', 37, 87, NULL, '056-641010', true),
('Butere Police Station', 'KAK/BUT/001', 'station', 37, 90, NULL, '056-620004', true),

-- Narok County (33)
('Narok Police Station', 'NRK/CEN/001', 'station', 33, NULL, NULL, '050-22201', true),

-- Meru County (12)
('Meru Police Station', 'MRU/CEN/001', 'station', 12, NULL, NULL, '064-31222', true)

ON CONFLICT (station_code) DO NOTHING;