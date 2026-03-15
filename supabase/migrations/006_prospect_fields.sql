-- Add prospect_questions field
-- Run in Supabase SQL Editor

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prospect_questions TEXT;
