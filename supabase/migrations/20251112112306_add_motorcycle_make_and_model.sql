/*
  # Add Make and Model to Motorcycles

  1. Changes
    - Add `make` column to motorcycles table (e.g., Yamaha, Boxer, TVS, Bajaj)
    - Add `model` column to motorcycles table (e.g., 120, 100, Star, Platina)
    
  2. Data Migration
    - Populate existing motorcycles with realistic makes and models
    - Common boda boda models in Kenya:
      - Yamaha 120
      - Boxer 100
      - TVS Star
      - Bajaj Boxer
      - Honda CG 125
      - Haojue HJ125
      
  3. Purpose
    - Better motorcycle identification and tracking
    - Improved reporting and analytics
    - More detailed motorcycle profiles
*/

-- Add make and model columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motorcycles' AND column_name = 'make'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN make text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motorcycles' AND column_name = 'model'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN model text;
  END IF;
END $$;

-- Populate existing motorcycles with realistic makes and models
-- Distribute across common boda boda brands in Kenya
DO $$
DECLARE
  motorcycle_record RECORD;
  makes_models text[][] := ARRAY[
    ARRAY['Yamaha', '120'],
    ARRAY['Boxer', '100'],
    ARRAY['TVS', 'Star'],
    ARRAY['Bajaj', 'Boxer'],
    ARRAY['Honda', 'CG 125'],
    ARRAY['Haojue', 'HJ125-8'],
    ARRAY['Yamaha', 'YBR 125'],
    ARRAY['TVS', 'Apache'],
    ARRAY['Bajaj', 'Platina'],
    ARRAY['Suzuki', 'GS150R']
  ];
  random_index int;
BEGIN
  FOR motorcycle_record IN 
    SELECT id FROM motorcycles WHERE make IS NULL OR model IS NULL
  LOOP
    -- Pick a random make/model combination
    random_index := floor(random() * array_length(makes_models, 1) + 1)::int;
    
    UPDATE motorcycles 
    SET 
      make = makes_models[random_index][1],
      model = makes_models[random_index][2]
    WHERE id = motorcycle_record.id;
  END LOOP;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_motorcycles_make ON motorcycles(make);
CREATE INDEX IF NOT EXISTS idx_motorcycles_model ON motorcycles(model);