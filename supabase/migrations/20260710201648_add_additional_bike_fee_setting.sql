/*
  # Additional Bike Fee Setting

  Adds a system setting for the fee an owner must pay to add another motorcycle
  after their first registered bike. Consumed by the owner portal's "Add
  Motorcycle" flow to gate additional bike registrations behind a payment.

  1. Data
     - INSERT INTO system_settings a row under category 'general' with key
       'additional_bike_fee' (default value: '500' KES).
     - ON CONFLICT (category, key) DO NOTHING so re-runs are safe.
*/

INSERT INTO system_settings (category, key, label, description, is_secret, value)
VALUES (
  'general',
  'additional_bike_fee',
  'Additional Motorcycle Fee (KES)',
  'One-time fee an owner must pay to register each additional motorcycle after their first bike.',
  false,
  '500'
)
ON CONFLICT (category, key) DO NOTHING;
