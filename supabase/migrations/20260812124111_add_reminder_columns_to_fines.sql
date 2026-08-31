/*
# Add reminder tracking columns to fines

1. Modified Tables
- `fines`
  - `last_reminder_sent_at` (timestamptz, nullable) - When the last final reminder SMS was sent
  - `reminder_count` (integer, default 0) - How many reminder SMS have been sent for this fine

2. Purpose
   Enables the mobile app (and web) to track when a "final reminder" SMS was sent
   for an overdue fine and how many times it has been re-sent, so officers can
   see recent nudges and avoid duplicate spam.

3. Security
   No policy changes — the existing SELECT/INSERT/UPDATE policies on `fines`
   already cover these new columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='fines' AND column_name='last_reminder_sent_at'
  ) THEN
    ALTER TABLE public.fines ADD COLUMN last_reminder_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='fines' AND column_name='reminder_count'
  ) THEN
    ALTER TABLE public.fines ADD COLUMN reminder_count integer NOT NULL DEFAULT 0;
  END IF;
END$$;
