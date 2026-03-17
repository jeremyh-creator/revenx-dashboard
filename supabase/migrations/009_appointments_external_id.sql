ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Ensure external IDs are unique per source (nulls allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_external_source_id
  ON appointments (external_source, external_id);

