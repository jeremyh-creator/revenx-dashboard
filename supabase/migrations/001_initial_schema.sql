-- Revenx Dashboard - Initial Schema (V1)
-- Run this in Supabase SQL Editor after creating your project

-- Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emails TEXT[] DEFAULT '{}',
  show_rate_override_threshold DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roll-ups (e.g. IMO groups)
CREATE TABLE rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent <-> Rollup membership (agents can belong to multiple rollups)
CREATE TABLE agent_rollups (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  rollup_id UUID REFERENCES rollups(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, rollup_id)
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prospect_email TEXT,
  appointment_datetime TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  age_raw TEXT,
  assets_raw TEXT,
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN (
    'Confirmed', 'Show', 'No-Show (Approved)', 'Rescheduled',
    'Canceled', 'Invalid', 'Duplicate', 'Test', 'Other'
  )),
  is_final_instance BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX idx_appointments_status ON appointments(status);

-- No-show evidence uploads
CREATE TABLE no_show_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_no_show_evidence_appointment ON no_show_evidence(appointment_id);

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_show_evidence ENABLE ROW LEVEL SECURITY;

-- Temporary policies: allow all for development (using anon key)
-- Replace with Clerk JWT-based policies when wiring up role-based access
CREATE POLICY "Allow all on agents" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on rollups" ON rollups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on agent_rollups" ON agent_rollups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on appointments" ON appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on no_show_evidence" ON no_show_evidence FOR ALL USING (true) WITH CHECK (true);
