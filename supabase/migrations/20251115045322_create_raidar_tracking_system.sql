/*
  # Raidar Tracking System - Core Database Schema

  ## Overview
  Complete database schema for high-volume vehicle tracking platform with GPRS device integration
  and third-party API access. Designed for year-long data retention with partitioning support.

  ## New Tables

  ### 1. `tracking_devices`
  Stores all GPS tracking device information and configuration
  - `id` (uuid, primary key)
  - `device_id` (text, unique) - Device identifier from GPRS protocol
  - `phone_number` (text) - Device SIM phone number (BCD format from protocol)
  - `imei` (text, unique) - Device IMEI
  - `vehicle_id` (uuid, nullable) - Associated vehicle
  - `status` (text) - online, offline, suspended
  - `last_connection` (timestamptz) - Last successful connection
  - `last_heartbeat` (timestamptz) - Last heartbeat received
  - `authentication_code` (text) - Device authentication token
  - `terminal_parameters` (jsonb) - All terminal configuration parameters
  - `firmware_version` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `device_locations`
  High-volume location data from devices
  - `id` (uuid, primary key)
  - `device_id` (uuid, foreign key)
  - `timestamp` (timestamptz, indexed) - Location timestamp from device
  - `latitude` (double precision)
  - `longitude` (double precision)
  - `altitude` (integer) - meters
  - `speed` (double precision) - km/h
  - `heading` (integer) - degrees (0-359)
  - `satellites` (integer) - Number of satellites
  - `odometer` (bigint) - Total distance in meters
  - `positioning_status` (boolean) - GPS fix status
  - `acc_status` (boolean) - Vehicle ACC on/off
  - `alarm_flags` (bigint) - Bitmap of alarm states
  - `status_flags` (bigint) - Bitmap of vehicle status
  - `additional_info` (jsonb) - Extra location information
  - `raw_message` (bytea) - Raw protocol message
  - `created_at` (timestamptz, default now())

  ### 3. `device_alarms`
  All alarm events from devices
  - `id` (uuid, primary key)
  - `device_id` (uuid, foreign key)
  - `location_id` (uuid, foreign key)
  - `alarm_type` (text) - emergency, overspeed, fatigue, geofence_enter, geofence_exit, etc.
  - `alarm_code` (integer) - Alarm bit position from protocol
  - `severity` (text) - critical, high, medium, low
  - `status` (text) - active, acknowledged, resolved
  - `description` (text)
  - `metadata` (jsonb) - Additional alarm context
  - `acknowledged_at` (timestamptz)
  - `acknowledged_by` (uuid)
  - `resolved_at` (timestamptz)
  - `created_at` (timestamptz)

  ### 4. `geofences`
  Polygon areas for geofencing
  - `id` (uuid, primary key)
  - `name` (text)
  - `geofence_id` (integer) - ID sent to device (1 to 0xFFFFFFFF)
  - `type` (text) - polygon, circle, route
  - `coordinates` (jsonb) - Array of lat/lng points
  - `attributes` (jsonb) - Speed limit, alarm on enter/exit, time restrictions
  - `devices` (uuid[]) - Array of device IDs this applies to
  - `enabled` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `device_commands`
  Command queue and history for device control
  - `id` (uuid, primary key)
  - `device_id` (uuid, foreign key)
  - `command_type` (text) - set_parameter, query_parameter, terminal_control, vehicle_control, etc.
  - `command_id` (integer) - Message ID from protocol
  - `command_data` (jsonb) - Command parameters
  - `status` (text) - queued, sent, acknowledged, failed, timeout
  - `priority` (integer, default 5) - 1-10, higher = more urgent
  - `raw_request` (bytea) - Raw protocol message sent
  - `raw_response` (bytea) - Raw protocol response
  - `response_data` (jsonb) - Parsed response
  - `sent_at` (timestamptz)
  - `acknowledged_at` (timestamptz)
  - `retry_count` (integer, default 0)
  - `max_retries` (integer, default 3)
  - `error_message` (text)
  - `created_at` (timestamptz)
  - `created_by` (uuid) - API client or user who created command

  ### 6. `api_clients`
  Third-party API access management
  - `id` (uuid, primary key)
  - `name` (text)
  - `api_key` (text, unique)
  - `api_secret` (text)
  - `status` (text) - active, suspended, revoked
  - `permissions` (jsonb) - Array of allowed endpoints/actions
  - `rate_limit` (integer) - Requests per minute
  - `webhook_url` (text) - URL for event notifications
  - `webhook_events` (text[]) - Array of event types to receive
  - `webhook_secret` (text) - For webhook signature verification
  - `last_used_at` (timestamptz)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. `api_usage_logs`
  Track API usage for billing and monitoring
  - `id` (uuid, primary key)
  - `api_client_id` (uuid, foreign key)
  - `endpoint` (text)
  - `method` (text)
  - `status_code` (integer)
  - `response_time_ms` (integer)
  - `request_size_bytes` (integer)
  - `response_size_bytes` (integer)
  - `timestamp` (timestamptz)

  ### 8. `device_connections`
  Track TCP connection sessions
  - `id` (uuid, primary key)
  - `device_id` (uuid, foreign key)
  - `connection_start` (timestamptz)
  - `connection_end` (timestamptz)
  - `ip_address` (text)
  - `disconnect_reason` (text)

  ### 9. `vehicles`
  Vehicle information associated with devices
  - `id` (uuid, primary key)
  - `registration_number` (text, unique)
  - `make` (text)
  - `model` (text)
  - `year` (integer)
  - `vin` (text)
  - `owner_info` (jsonb)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Create policies for authenticated access
  - API clients will use service role with app-level authorization

  ## Indexes
  - Composite indexes on device_id + timestamp for fast queries
  - Spatial indexes for geofencing
  - Status indexes for filtering active devices/alarms

  ## Notes
  - Location data designed for partitioning by month for scalability
  - All timestamps in UTC
  - Raw protocol messages stored for debugging
  - Supports full year data retention with archival strategy
*/

-- Enable PostGIS for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tracking devices table
CREATE TABLE IF NOT EXISTS tracking_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  phone_number text,
  imei text UNIQUE,
  vehicle_id uuid,
  status text DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'suspended')),
  last_connection timestamptz,
  last_heartbeat timestamptz,
  authentication_code text,
  terminal_parameters jsonb DEFAULT '{}'::jsonb,
  firmware_version text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text UNIQUE NOT NULL,
  make text,
  model text,
  year integer,
  vin text,
  owner_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key for vehicle_id in tracking_devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tracking_devices_vehicle_id_fkey'
  ) THEN
    ALTER TABLE tracking_devices 
    ADD CONSTRAINT tracking_devices_vehicle_id_fkey 
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Device locations table (high volume)
CREATE TABLE IF NOT EXISTS device_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES tracking_devices(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude integer DEFAULT 0,
  speed double precision DEFAULT 0,
  heading integer DEFAULT 0 CHECK (heading >= 0 AND heading < 360),
  satellites integer DEFAULT 0,
  odometer bigint DEFAULT 0,
  positioning_status boolean DEFAULT false,
  acc_status boolean DEFAULT false,
  alarm_flags bigint DEFAULT 0,
  status_flags bigint DEFAULT 0,
  additional_info jsonb DEFAULT '{}'::jsonb,
  raw_message bytea,
  created_at timestamptz DEFAULT now()
);

-- Create composite index for fast device location queries
CREATE INDEX IF NOT EXISTS idx_device_locations_device_timestamp 
ON device_locations(device_id, timestamp DESC);

-- Create spatial index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_device_locations_coordinates 
ON device_locations USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- Device alarms table
CREATE TABLE IF NOT EXISTS device_alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES tracking_devices(id) ON DELETE CASCADE,
  location_id uuid REFERENCES device_locations(id) ON DELETE SET NULL,
  alarm_type text NOT NULL,
  alarm_code integer,
  severity text DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for active alarms
CREATE INDEX IF NOT EXISTS idx_device_alarms_device_status 
ON device_alarms(device_id, status, created_at DESC);

-- Geofences table
CREATE TABLE IF NOT EXISTS geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  geofence_id integer UNIQUE NOT NULL CHECK (geofence_id >= 1),
  type text DEFAULT 'polygon' CHECK (type IN ('polygon', 'circle', 'route')),
  coordinates jsonb NOT NULL,
  attributes jsonb DEFAULT '{}'::jsonb,
  devices uuid[] DEFAULT ARRAY[]::uuid[],
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Device commands table
CREATE TABLE IF NOT EXISTS device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES tracking_devices(id) ON DELETE CASCADE,
  command_type text NOT NULL,
  command_id integer,
  command_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'acknowledged', 'failed', 'timeout')),
  priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  raw_request bytea,
  raw_response bytea,
  response_data jsonb,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  error_message text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Index for command queue processing
CREATE INDEX IF NOT EXISTS idx_device_commands_queue 
ON device_commands(device_id, status, priority DESC, created_at ASC)
WHERE status IN ('queued', 'sent');

-- API clients table
CREATE TABLE IF NOT EXISTS api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key text UNIQUE NOT NULL,
  api_secret text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  permissions jsonb DEFAULT '[]'::jsonb,
  rate_limit integer DEFAULT 100,
  webhook_url text,
  webhook_events text[] DEFAULT ARRAY[]::text[],
  webhook_secret text,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id uuid REFERENCES api_clients(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  request_size_bytes integer,
  response_size_bytes integer,
  timestamp timestamptz DEFAULT now()
);

-- Index for usage analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_client_time 
ON api_usage_logs(api_client_id, timestamp DESC);

-- Device connections table
CREATE TABLE IF NOT EXISTS device_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES tracking_devices(id) ON DELETE CASCADE,
  connection_start timestamptz DEFAULT now(),
  connection_end timestamptz,
  ip_address text,
  disconnect_reason text
);

-- Index for active connections
CREATE INDEX IF NOT EXISTS idx_device_connections_active 
ON device_connections(device_id, connection_start DESC)
WHERE connection_end IS NULL;

-- Enable Row Level Security
ALTER TABLE tracking_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_connections ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated access (will be managed by API layer with service role)
CREATE POLICY "Allow service role full access to tracking_devices"
  ON tracking_devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to vehicles"
  ON vehicles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to device_locations"
  ON device_locations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to device_alarms"
  ON device_alarms FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to geofences"
  ON geofences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to device_commands"
  ON device_commands FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to api_clients"
  ON api_clients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to api_usage_logs"
  ON api_usage_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to device_connections"
  ON device_connections FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);