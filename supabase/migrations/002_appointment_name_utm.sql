-- Add prospect name fields and utm_source to appointments
-- Run in Supabase SQL Editor (skip if you already added utm_source manually)

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT;
