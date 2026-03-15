-- Add "No-Show (Pending)" status for evidence awaiting admin review
-- Run in Supabase SQL Editor

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN (
  'Confirmed', 'Show', 'No-Show (Approved)', 'No-Show (Pending)', 'Rescheduled',
  'Canceled', 'Invalid', 'Duplicate', 'Test', 'Other'
));
