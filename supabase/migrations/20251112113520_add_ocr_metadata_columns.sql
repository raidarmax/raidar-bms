/*
  # Add OCR Metadata Tracking

  1. Changes to `owners` table
    - Add `ocr_extracted` boolean to track if data was extracted via OCR
    - Add `ocr_confidence` numeric to store OCR confidence score
    - Add `ocr_verified` boolean to track manual verification status
    - Add `ocr_raw_text` text to store raw OCR output for audit

  2. Changes to `riders` table
    - Add same OCR tracking columns as owners table

  3. Purpose
    - Track which registrations used OCR auto-fill
    - Store confidence scores for quality monitoring
    - Enable audit trail for data extraction
    - Support verification workflow
*/

-- Add OCR tracking columns to owners table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'ocr_extracted'
  ) THEN
    ALTER TABLE owners ADD COLUMN ocr_extracted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'ocr_confidence'
  ) THEN
    ALTER TABLE owners ADD COLUMN ocr_confidence numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'ocr_verified'
  ) THEN
    ALTER TABLE owners ADD COLUMN ocr_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'owners' AND column_name = 'ocr_raw_text'
  ) THEN
    ALTER TABLE owners ADD COLUMN ocr_raw_text text;
  END IF;
END $$;

-- Add OCR tracking columns to riders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'ocr_extracted'
  ) THEN
    ALTER TABLE riders ADD COLUMN ocr_extracted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'ocr_confidence'
  ) THEN
    ALTER TABLE riders ADD COLUMN ocr_confidence numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'ocr_verified'
  ) THEN
    ALTER TABLE riders ADD COLUMN ocr_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'ocr_raw_text'
  ) THEN
    ALTER TABLE riders ADD COLUMN ocr_raw_text text;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN owners.ocr_extracted IS 'Indicates if data was auto-filled using OCR';
COMMENT ON COLUMN owners.ocr_confidence IS 'OCR confidence score (0-100)';
COMMENT ON COLUMN owners.ocr_verified IS 'Manual verification status after OCR extraction';
COMMENT ON COLUMN owners.ocr_raw_text IS 'Raw text extracted from ID document for audit';

COMMENT ON COLUMN riders.ocr_extracted IS 'Indicates if data was auto-filled using OCR';
COMMENT ON COLUMN riders.ocr_confidence IS 'OCR confidence score (0-100)';
COMMENT ON COLUMN riders.ocr_verified IS 'Manual verification status after OCR extraction';
COMMENT ON COLUMN riders.ocr_raw_text IS 'Raw text extracted from ID document for audit';
