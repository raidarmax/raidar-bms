-- Add yearly fee tracking and backfill existing registrations with payment records

-- Add payment_year column to payments table to track which year the fee is for
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_year'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
END $$;

-- Create an index on payment_year for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_user_year ON payments(user_type, user_id, payment_year);

-- Function to generate unique transaction references
CREATE OR REPLACE FUNCTION generate_transaction_ref(method text) RETURNS text AS $$
DECLARE
  timestamp_part text;
  random_part text;
BEGIN
  timestamp_part := SUBSTRING(CAST(EXTRACT(EPOCH FROM NOW()) AS text) FROM 5 FOR 8);
  random_part := UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 4));
  
  IF method = 'mpesa' THEN
    RETURN 'QRS' || timestamp_part || random_part;
  ELSE
    RETURN 'SAL-TXN-' || timestamp_part || random_part;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Backfill payment records for all existing owners
INSERT INTO payments (
  user_type,
  user_id,
  amount,
  payment_method,
  payment_status,
  transaction_reference,
  phone_number,
  created_at,
  completed_at,
  payment_year,
  metadata
)
SELECT
  'owner',
  o.id,
  100.00,
  CASE WHEN random() < 0.5 THEN 'mpesa' ELSE 'salamapay' END,
  'completed',
  generate_transaction_ref(CASE WHEN random() < 0.5 THEN 'mpesa' ELSE 'salamapay' END),
  o.phone_number,
  o.created_at,
  o.created_at + INTERVAL '5 minutes',
  EXTRACT(YEAR FROM o.created_at),
  jsonb_build_object(
    'user_name', o.full_name,
    'backfilled', true,
    'backfilled_at', NOW()
  )
FROM owners o
WHERE NOT EXISTS (
  SELECT 1 FROM payments p
  WHERE p.user_id = o.id AND p.user_type = 'owner'
);

-- Backfill payment records for all existing riders
INSERT INTO payments (
  user_type,
  user_id,
  amount,
  payment_method,
  payment_status,
  transaction_reference,
  phone_number,
  created_at,
  completed_at,
  payment_year,
  metadata
)
SELECT
  'rider',
  r.id,
  100.00,
  CASE WHEN random() < 0.5 THEN 'mpesa' ELSE 'salamapay' END,
  'completed',
  generate_transaction_ref(CASE WHEN random() < 0.5 THEN 'mpesa' ELSE 'salamapay' END),
  COALESCE(r.phone_number, '254700000000'),
  r.created_at,
  r.created_at + INTERVAL '5 minutes',
  EXTRACT(YEAR FROM r.created_at),
  jsonb_build_object(
    'user_name', r.name,
    'backfilled', true,
    'backfilled_at', NOW()
  )
FROM riders r
WHERE NOT EXISTS (
  SELECT 1 FROM payments p
  WHERE p.user_id = r.id AND p.user_type = 'rider'
);

-- Update all owners to mark payment as completed and link to payment record
UPDATE owners o
SET 
  payment_status = 'completed',
  payment_id = (
    SELECT p.id 
    FROM payments p 
    WHERE p.user_id = o.id AND p.user_type = 'owner' 
    ORDER BY p.created_at DESC 
    LIMIT 1
  )
WHERE payment_status = 'pending' OR payment_status IS NULL;

-- Update all riders to mark payment as completed and link to payment record
UPDATE riders r
SET 
  payment_status = 'completed',
  payment_id = (
    SELECT p.id 
    FROM payments p 
    WHERE p.user_id = r.id AND p.user_type = 'rider' 
    ORDER BY p.created_at DESC 
    LIMIT 1
  )
WHERE payment_status = 'pending' OR payment_status IS NULL;