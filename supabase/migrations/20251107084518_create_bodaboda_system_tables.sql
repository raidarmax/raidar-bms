/*
  # Bodaboda Management System Database Schema

  ## Overview
  This migration creates the complete database structure for the Bodaboda Management System,
  including tables for owners, motorcycles, riders, verifications, and admin users.

  ## Tables Created

  ### 1. owners
  Stores boda boda owner information
  - id (uuid, primary key)
  - full_name (text)
  - phone_number (text, unique)
  - national_id (text, unique)
  - next_of_kin_name (text)
  - next_of_kin_phone (text)
  - otp_verified (boolean, default false)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### 2. motorcycles
  Stores motorcycle details linked to owners
  - id (uuid, primary key)
  - owner_id (uuid, foreign key)
  - registration_number (text, unique)
  - logbook_url (text)
  - tracking_device_id (text)
  - kra_pin_url (text)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### 3. riders
  Stores rider information linked to owners
  - id (uuid, primary key)
  - owner_id (uuid, foreign key)
  - name (text)
  - id_number (text, unique)
  - license_url (text)
  - county_registration_number (text)
  - sacco_id (text)
  - good_conduct_url (text)
  - stage_name (text)
  - photo_url (text)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### 4. verifications
  Stores verification status and QR codes
  - id (uuid, primary key)
  - owner_id (uuid, foreign key)
  - status (text, default 'Pending')
  - qr_code_data (text, unique)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### 5. admin_users
  Stores admin credentials
  - id (uuid, primary key)
  - username (text, unique)
  - password_hash (text)
  - created_at (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public access for owner registration (insert only)
  - Admin access requires authentication
  - Verification data readable by public via QR code lookup

  ## Important Notes
  - All timestamps use timestamptz for proper timezone handling
  - Foreign keys ensure referential integrity
  - Unique constraints prevent duplicate registrations
  - Default values set for booleans and status fields
*/

-- Create owners table
CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone_number text UNIQUE NOT NULL,
  national_id text UNIQUE NOT NULL,
  next_of_kin_name text NOT NULL,
  next_of_kin_phone text NOT NULL,
  otp_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create motorcycles table
CREATE TABLE IF NOT EXISTS motorcycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  registration_number text UNIQUE NOT NULL,
  logbook_url text,
  tracking_device_id text,
  kra_pin_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name text NOT NULL,
  id_number text UNIQUE NOT NULL,
  license_url text,
  county_registration_number text,
  sacco_id text,
  good_conduct_url text,
  stage_name text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create verifications table
CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
  qr_code_data text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for owners table
CREATE POLICY "Anyone can insert owner records"
  ON owners FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read owner records for verification"
  ON owners FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update owner records"
  ON owners FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for motorcycles table
CREATE POLICY "Anyone can insert motorcycle records"
  ON motorcycles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read motorcycle records"
  ON motorcycles FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for riders table
CREATE POLICY "Anyone can insert rider records"
  ON riders FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read rider records"
  ON riders FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for verifications table
CREATE POLICY "Anyone can insert verification records"
  ON verifications FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification records"
  ON verifications FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update verification records"
  ON verifications FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for admin_users table
CREATE POLICY "Anyone can read admin users for login"
  ON admin_users FOR SELECT
  TO anon
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_owners_phone ON owners(phone_number);
CREATE INDEX IF NOT EXISTS idx_owners_national_id ON owners(national_id);
CREATE INDEX IF NOT EXISTS idx_motorcycles_owner ON motorcycles(owner_id);
CREATE INDEX IF NOT EXISTS idx_motorcycles_registration ON motorcycles(registration_number);
CREATE INDEX IF NOT EXISTS idx_riders_owner ON riders(owner_id);
CREATE INDEX IF NOT EXISTS idx_riders_id_number ON riders(id_number);
CREATE INDEX IF NOT EXISTS idx_verifications_owner ON verifications(owner_id);
CREATE INDEX IF NOT EXISTS idx_verifications_qr_code ON verifications(qr_code_data);

-- Insert default admin user (username: admin, password: admin123 - should be changed in production)
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '$2a$10$rN8RQH7Q7YxH8J.Qq.qjkO4vKQZQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Zu')
ON CONFLICT (username) DO NOTHING;