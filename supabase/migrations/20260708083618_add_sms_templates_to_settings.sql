-- Seed SMS message templates as system_settings rows
INSERT INTO system_settings (category, key, label, description, is_secret, value) VALUES
  (
    'templates',
    'otp_message',
    'OTP Verification Message',
    'Sent when a user requests a login or registration OTP. Variables: {otp}, {expiry_minutes}',
    false,
    'Your SALAMA BMS verification code is: {otp}

This code expires in {expiry_minutes} minutes. Do not share it with anyone.'
  ),
  (
    'templates',
    'fine_rider_message',
    'Fine Notification (Rider)',
    'Sent to the rider when a traffic fine is issued. Variables: {fine_reference}, {fine_amount}, {offence_name}, {due_date}, {officer_service_number}, {station_name}',
    false,
    'BMS TRAFFIC FINE: You have been issued fine {fine_reference} of KES {fine_amount} for "{offence_name}". Pay within 14 days (by {due_date}) to avoid penalties. Issued by Officer {officer_service_number}, {station_name}.'
  ),
  (
    'templates',
    'fine_owner_message',
    'Fine Notification (Owner)',
    'Sent to the motorcycle owner when a fine is issued to their rider. Variables: {fine_reference}, {fine_amount}, {rider_name}, {offence_name}, {due_date}, {station_name}',
    false,
    'BMS NOTICE: A fine {fine_reference} of KES {fine_amount} has been issued to {rider_name} riding your motorcycle for "{offence_name}". Due by {due_date}. Station: {station_name}.'
  )
ON CONFLICT (category, key) DO NOTHING;
