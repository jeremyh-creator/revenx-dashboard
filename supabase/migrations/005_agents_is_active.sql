-- Add is_active to agents (default true for existing)
-- Run in Supabase SQL Editor

ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
