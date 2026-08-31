/*
# Update police officer phone numbers

1. Modified Tables
   - `police_officers`: updates phone_number for the two existing officers.

2. Changes
   - Inspector James Mwangi (AP/54321) → 0722334955
   - Corporal Faith Wanjiku (AP/98765) → 0722720985
*/

UPDATE police_officers SET phone_number = '0722334955' WHERE service_number = 'AP/54321';
UPDATE police_officers SET phone_number = '0722720985' WHERE service_number = 'AP/98765';
